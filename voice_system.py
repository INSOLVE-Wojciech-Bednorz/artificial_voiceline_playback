# voice_system.py
import json
import math
import random
import time
import traceback
import logging
import threading
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

# Third-party imports
import requests
import vlc
import yaml
from pydub import AudioSegment, exceptions as pydub_exceptions
from pydub.playback import play
import numpy as np
from pydub.effects import high_pass_filter, low_pass_filter

# --- Configuration ---
CONFIG_FILE = Path('config.yaml')
DATA_FILE = Path('voice_lines.json')
AUDIO_DIR = Path('audio_files')
AUDIO_DIR.mkdir(exist_ok=True) # Ensure audio directory exists

# --- Logging Setup ---
# Configure once, potentially at the top level (main.py) or here
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Default Config ---
DEFAULT_CONFIG = {
    'api_key': 'YOUR_ELEVENLABS_API_KEY_HERE',
    'voice': {
        'id': 'YOUR_VOICE_ID_HERE',
        'model': 'eleven_multilingual_v2',
        'stability': 0.7,
        'similarity': 0.95,
        'style': 0.3,
        'speed': 1.0
    },
    'volumes': {
        'master': 1.0,
        'radio': 0.5,
        'ducking': 0.1,
        'voice': 1.0,
        'compression': {
            'threshold': -20.0,
            'ratio': 4.0,
            'attack': 5.0,
            'release': 50.0
        }
    },
    'radio': {
        'playlist': None,
        'interval': 300
    },
    'distortion_simulation': { # Single source for these settings
        'enabled': False,
        'sample_rate': 32000,
        'distortion': 0.0002,
        'filter_low': 200,
        'filter_high': 4000,
        'noise_level': 0.0001,
        'bit_depth': 16,
        'crackle': 0.0002
    }
    # No 'degradation' key anymore
}

# --- Helper ---
def _get_nested_value(data: Dict, keys: List[str], default: Any = None) -> Any:
    """Safely get a nested value from a dictionary."""
    try:
        value = data
        for key in keys:
            value = value[key]
        return value
    except (KeyError, TypeError):
        return default

# --- Audio Degradation Function ---
def degrade_audio(audio_segment: AudioSegment, distortion_config: Dict) -> AudioSegment:
    """
    Applies audio degradation effects based on the 'distortion_simulation' config.
    """
    if not distortion_config.get('enabled', False):
        return audio_segment

    logger.debug("Applying distortion simulation effects...")
    degraded = audio_segment

    try:
        # 1. Force mono conversion first
        if degraded.channels > 1:
            degraded = degraded.set_channels(1)
            logger.debug("Converted audio to mono.")

        # 2. Sample rate reduction
        target_sr = int(distortion_config.get('sample_rate', degraded.frame_rate))
        if target_sr > 0 and target_sr < degraded.frame_rate:
             logger.debug(f"Reducing sample rate to {target_sr} Hz.")
             degraded = degraded.set_frame_rate(target_sr)
        elif target_sr <= 0:
             logger.warning(f"Invalid target sample rate ({target_sr}), skipping reduction.")


        # Helper function to safely create AudioSegments from numpy arrays
        def create_audio_segment(samples, sample_width, frame_rate, channels):
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
            max_amp = 2**(sample_width * 8 - 1) - 1
            min_amp = -max_amp -1
            samples = np.clip(samples, min_amp, max_amp)
            dtype = np.int16 if sample_width == 2 else np.int8
            samples_bytes = samples.astype(dtype).tobytes()
            return AudioSegment(
                data=samples_bytes,
                sample_width=sample_width,
                frame_rate=frame_rate,
                channels=channels
            )

        # Convert to numpy array for manipulation
        current_sample_width = degraded.sample_width
        samples_np = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        max_amplitude_float = float(2**(current_sample_width * 8 - 1) - 1)


        # 3. Nonlinear distortion (Clipping)
        distortion_level = float(distortion_config.get('distortion', 0.0))
        if distortion_level > 0:
            logger.debug(f"Applying non-linear distortion: {distortion_level}")
            gain_factor = 1.0 + distortion_level * 5 # Amplify effect
            samples_np = np.clip(samples_np * gain_factor, -max_amplitude_float, max_amplitude_float)


        # 4. Bandpass filtering
        low_freq = int(distortion_config.get('filter_low', 0))
        high_freq = int(distortion_config.get('filter_high', degraded.frame_rate / 2))
        if low_freq > 0 or high_freq < degraded.frame_rate / 2:
            logger.debug(f"Applying bandpass filter: Low={low_freq} Hz, High={high_freq} Hz")
            # Need to convert back to AudioSegment for pydub filters
            temp_audio = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)
            if low_freq > 0:
                try:
                    temp_audio = high_pass_filter(temp_audio, low_freq)
                except Exception as filter_e:
                    logger.warning(f"High-pass filter failed: {filter_e}")
            # Ensure high freq is valid before applying low pass
            if high_freq > 0 and high_freq < degraded.frame_rate / 2:
                 try:
                    temp_audio = low_pass_filter(temp_audio, high_freq)
                 except Exception as filter_e:
                    logger.warning(f"Low-pass filter failed: {filter_e}")
            else:
                 logger.warning(f"Invalid high frequency ({high_freq} Hz) for low-pass filter at sample rate {degraded.frame_rate} Hz. Skipping.")

            # Convert back to numpy
            samples_np = np.array(temp_audio.get_array_of_samples(), dtype=np.float32)


        # 5. Modulated noise
        noise_level = float(distortion_config.get('noise_level', 0.0))
        if noise_level > 0:
            logger.debug(f"Adding modulated noise: Level={noise_level}")
            noise_amp = noise_level * max_amplitude_float
            noise = np.random.normal(0, noise_amp, len(samples_np))
            modulation = np.sin(np.linspace(0, 20 * np.pi, len(samples_np))) * 0.5 + 0.5
            samples_np += noise * modulation


        # 6. Bit crushing (Quantization)
        target_bit_depth = int(distortion_config.get('bit_depth', current_sample_width * 8))
        if 1 <= target_bit_depth < (current_sample_width * 8):
            logger.debug(f"Applying bit crushing to {target_bit_depth}-bit.")
            levels = 2**target_bit_depth
            normalized_samples = samples_np / max_amplitude_float
            quantized_samples = np.round(normalized_samples * (levels / 2 -1) )
            samples_np = (quantized_samples / (levels / 2 - 1)) * max_amplitude_float


        # 7. Crackle effect
        crackle_intensity = float(distortion_config.get('crackle', 0.0))
        if crackle_intensity > 0:
            logger.debug(f"Applying crackle effect: Intensity={crackle_intensity}")
            num_crackles = int(len(samples_np) / degraded.frame_rate * 50 * crackle_intensity)
            for _ in range(num_crackles):
                pos = random.randint(0, len(samples_np) - 1)
                crackle_amp = random.uniform(0.5, 1.0) * max_amplitude_float * random.choice([-1, 1])
                crackle_len = random.randint(1, 3)
                end_pos = min(pos + crackle_len, len(samples_np))
                samples_np[pos:end_pos] += crackle_amp


        # Convert back to AudioSegment using the helper
        degraded = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)

        # 8. Final resampling to a common rate (e.g., 44100 Hz) for playback consistency
        final_sr = 44100
        if degraded.frame_rate != final_sr:
            logger.debug(f"Resampling degraded audio to {final_sr} Hz.")
            try:
                degraded = degraded.set_frame_rate(final_sr)
            except Exception as e:
                logger.error(f"Error during final resampling: {e}. Trying fallback creation.")
                # Fallback: try to create directly if set_frame_rate fails
                samples_np_final = np.array(degraded.get_array_of_samples(), dtype=np.float32)
                try:
                     degraded = create_audio_segment(samples_np_final, degraded.sample_width, final_sr, 1)
                except Exception as fb_e:
                     logger.error(f"Fallback resampling failed: {fb_e}. Returning audio at original rate {degraded.frame_rate} Hz.")
                     # Recreate from original numpy array at original degraded rate if fallback also fails
                     degraded = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)


    except ValueError as ve:
         logger.error(f"Value error during audio degradation (check config?): {ve}\n{traceback.format_exc()}")
         return audio_segment # Return original on config value error
    except Exception as e:
        logger.error(f"Unexpected error during audio degradation: {e}\n{traceback.format_exc()}")
        return audio_segment # Return original on other errors

    logger.debug("Finished applying distortion simulation effects.")
    return degraded


# --- Voice System Class ---
class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        self.lines = self._load_lines()
        self.radio_player = None
        # Use _get_nested_value for safer access to potentially missing keys after load
        self.radio_volume = _get_nested_value(self.config, ['volumes', 'radio'], DEFAULT_CONFIG['volumes']['radio'])
        self.duck_volume = _get_nested_value(self.config, ['volumes', 'ducking'], DEFAULT_CONFIG['volumes']['ducking'])
        self.last_error = None
        self._scheduler_thread = None
        self._stop_scheduler_event = threading.Event()
        self._scheduler_running = False
        try:
            # Initialize VLC instance once with options for headless/quiet operation
            self._vlc_instance = vlc.Instance('--no-xlib --quiet')
            logger.info("VLC instance initialized.")
        except Exception as e:
            logger.critical(f"Failed to initialize VLC instance: {e}. Radio functionality will be disabled.", exc_info=True)
            self._vlc_instance = None
            self.last_error = f"Błąd inicjalizacji VLC: {e}"

    def _load_config(self) -> Dict:
        """Loads config from YAML, merges with defaults, handles errors."""
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    loaded_config = yaml.safe_load(f)
                if isinstance(loaded_config, dict):
                    # Deep merge loaded config with defaults to ensure all keys exist
                    merged_config = self._merge_configs(DEFAULT_CONFIG, loaded_config)
                    logger.info(f"Configuration loaded and merged from {CONFIG_FILE}")
                    return merged_config
                else:
                    logger.warning(f"Invalid structure in {CONFIG_FILE}. Using default configuration and saving.")
                    self._save_config(DEFAULT_CONFIG) # Save defaults for user
                    return DEFAULT_CONFIG.copy()
            else:
                logger.warning(f"{CONFIG_FILE} not found. Creating with default values.")
                self._save_config(DEFAULT_CONFIG)
                return DEFAULT_CONFIG.copy()
        except (yaml.YAMLError, IOError, OSError) as e:
            logger.error(f"Error loading/accessing config file {CONFIG_FILE}: {e}. Using default configuration.", exc_info=True)
            return DEFAULT_CONFIG.copy()
        except Exception as e:
             logger.error(f"Unexpected error loading config: {e}. Using default configuration.", exc_info=True)
             return DEFAULT_CONFIG.copy()

    def _merge_configs(self, default: Dict, loaded: Dict) -> Dict:
        """Recursively merges loaded config into default config."""
        merged = default.copy()
        for key, value in loaded.items():
            if key in merged:
                if isinstance(value, dict) and isinstance(merged[key], dict):
                    merged[key] = self._merge_configs(merged[key], value)
                elif value is not None: # Allow overriding with non-dict values, but not None unless default is None
                    merged[key] = value
            # If key not in default, maybe log a warning about unknown keys?
            # else:
            #    logger.warning(f"Ignoring unknown key '{key}' found in config file.")
        return merged

    def _save_config(self, config_data: Optional[Dict] = None):
        """Saves the provided or current configuration to the YAML file."""
        config_to_save = config_data if config_data is not None else self.config
        try:
            # Remove internal/runtime state if it accidentally got added
            config_to_save.pop('degradation', None) # Ensure this removed key stays removed

            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_to_save, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            logger.info(f"Configuration saved to {CONFIG_FILE}")
        except (yaml.YAMLError, IOError, OSError) as e:
            logger.error(f"Error saving config file {CONFIG_FILE}: {e}", exc_info=True)
            self.last_error = f"Błąd zapisu konfiguracji: {str(e)}"
        except Exception as e:
             logger.error(f"Unexpected error saving config: {e}", exc_info=True)
             self.last_error = f"Nieoczekiwany błąd zapisu konfiguracji: {str(e)}"


    def _load_lines(self) -> List[Dict]:
        """Loads voice lines from the JSON data file with validation."""
        lines_data = []
        try:
            if DATA_FILE.exists():
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    try:
                        lines_data = json.load(f)
                    except json.JSONDecodeError as json_e:
                         logger.error(f"Invalid JSON in {DATA_FILE}: {json_e}. Loading empty list.", exc_info=True)
                         self.last_error = f"Błąd formatu JSON w pliku linii: {json_e}"
                         return [] # Return empty on decode error

                    # Validate basic structure and content
                    if isinstance(lines_data, list):
                         validated_lines = []
                         seen_ids = set()
                         needs_resave = False
                         max_id = 0
                         for i, item in enumerate(lines_data):
                             if isinstance(item, dict) and all(k in item for k in ['id', 'text', 'filename', 'active']):
                                 # Basic type checks
                                 item_id = item.get('id')
                                 item_text = item.get('text')
                                 item_filename = item.get('filename')
                                 item_active = item.get('active')

                                 if not isinstance(item_id, int) or item_id <= 0 or item_id in seen_ids:
                                     logger.warning(f"Invalid or duplicate ID found at index {i}: {item_id}. Skipping line.")
                                     needs_resave = True
                                     continue
                                 if not isinstance(item_text, str) or not item_text:
                                     logger.warning(f"Invalid or empty text found for ID {item_id}. Skipping line.")
                                     needs_resave = True
                                     continue
                                 if not isinstance(item_filename, str) or not item_filename.endswith('.mp3'): # Basic check
                                     logger.warning(f"Invalid filename found for ID {item_id}: {item_filename}. Skipping line.")
                                     needs_resave = True
                                     continue
                                 if not isinstance(item_active, bool):
                                      logger.warning(f"Invalid 'active' state for ID {item_id}. Defaulting to False.")
                                      item['active'] = False # Correct the type
                                      needs_resave = True

                                 # Check if audio file actually exists
                                 if not (AUDIO_DIR / item_filename).exists():
                                      logger.warning(f"Audio file '{item_filename}' for ID {item_id} not found. Line kept but may fail playback.")
                                      # Optionally deactivate or remove? For now, just warn.
                                      # item['active'] = False
                                      # needs_resave = True

                                 validated_lines.append(item)
                                 seen_ids.add(item_id)
                                 max_id = max(max_id, item_id)

                             else:
                                 logger.warning(f"Invalid item structure at index {i} in {DATA_FILE}. Skipping.")
                                 needs_resave = True

                         # Optional: Re-index if IDs are not sequential or have gaps?
                         # For now, just use the loaded (and validated) IDs.

                         if needs_resave:
                              logger.warning(f"Issues found in {DATA_FILE}. Resaving with validated/corrected lines.")
                              self.lines = validated_lines # Temporarily set to save correct data
                              self._save_lines() # Save the cleaned list

                         logger.info(f"Loaded {len(validated_lines)} valid voice lines from {DATA_FILE}")
                         return validated_lines
                    else:
                        logger.warning(f"Invalid data structure (not a list) in {DATA_FILE}. Initializing empty list.")
                        self._save_lines([]) # Save empty list to fix file
                        return []
            else:
                logger.info(f"{DATA_FILE} not found. Initializing empty list.")
                return []
        except (IOError, OSError) as e:
            logger.error(f"Error reading/accessing voice lines file {DATA_FILE}: {e}. Returning empty list.", exc_info=True)
            self.last_error = f"Błąd odczytu pliku linii: {str(e)}"
            return []
        except Exception as e:
             logger.error(f"Unexpected error loading lines: {e}. Returning empty list.", exc_info=True)
             self.last_error = f"Nieoczekiwany błąd ładowania linii: {str(e)}"
             return []


    def _save_lines(self):
        """Saves the current voice lines to the JSON data file."""
        try:
            # Ensure lines are sorted by ID before saving for consistency
            lines_to_save = sorted(self.lines, key=lambda x: x.get('id', float('inf')))
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(lines_to_save, f, indent=2, ensure_ascii=False)
            logger.info(f"Voice lines saved to {DATA_FILE}")
        except (IOError, OSError, TypeError) as e:
            logger.error(f"Error saving voice lines file {DATA_FILE}: {e}", exc_info=True)
            self.last_error = f"Błąd zapisu linii: {str(e)}"
        except Exception as e:
             logger.error(f"Unexpected error saving lines: {e}", exc_info=True)
             self.last_error = f"Nieoczekiwany błąd zapisu linii: {str(e)}"

    def _parse_playlist(self, path_str: Optional[str]) -> List[str]:
        """Parses M3U or PLS playlist files to extract stream URLs."""
        if not path_str:
             logger.info("Playlist path is empty or None. No URLs to parse.")
             return []

        path = Path(path_str)
        urls = []
        if not path.is_file():
            self.last_error = f"Plik playlisty nie istnieje: {path_str}"
            logger.warning(self.last_error)
            return []

        try:
            # Try common encodings if default utf-8 fails
            encodings_to_try = ['utf-8', 'latin-1', 'cp1250', 'cp1252']
            lines = None
            for enc in encodings_to_try:
                try:
                    with open(path, 'r', encoding=enc) as f:
                        lines = f.readlines()
                    logger.debug(f"Successfully read playlist {path} with encoding {enc}")
                    break # Stop trying encodings once successful
                except UnicodeDecodeError:
                    logger.debug(f"Failed to decode playlist {path} with encoding {enc}")
                    continue # Try next encoding
                except (IOError, OSError) as file_e: # Catch file errors during open
                     raise file_e # Re-raise file errors to be caught by outer try-except

            if lines is None:
                 raise IOError(f"Could not decode playlist file {path} with any attempted encoding.")


            playlist_type = path.suffix.lower()
            logger.info(f"Parsing playlist type: {playlist_type}")

            if playlist_type in ['.m3u', '.m3u8']:
                urls = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
            elif playlist_type == '.pls':
                for line in lines:
                    line = line.strip()
                    if line.lower().startswith('file'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            urls.append(parts[1].strip())
            else:
                self.last_error = f"Nieobsługiwany format playlisty: {playlist_type}"
                logger.warning(self.last_error)
                return []

            # Filter for likely stream URLs (simple check)
            valid_urls = [url for url in urls if url.startswith('http://') or url.startswith('https://')]
            logger.info(f"Parsed {len(urls)} lines, found {len(valid_urls)} potential stream URLs from {path_str}")
            return valid_urls

        except (IOError, OSError) as e:
            self.last_error = f"Błąd odczytu pliku playlisty ({path_str}): {str(e)}"
            logger.error(self.last_error, exc_info=True)
            return []
        except Exception as e:
            self.last_error = f"Nieoczekiwany błąd parsowania playlisty ({path_str}): {str(e)}"
            logger.error(self.last_error, exc_info=True)
            return []

    def _get_stream_url(self) -> str:
        """Gets the first valid stream URL from the configured playlist."""
        playlist_path = _get_nested_value(self.config, ['radio', 'playlist'])
        if playlist_path:
            urls = self._parse_playlist(playlist_path)
            if urls:
                logger.info(f"Using stream URL: {urls[0]}")
                return urls[0]
            else:
                msg = f"Brak prawidłowych adresów URL w playliście lub błąd odczytu: {playlist_path}"
                logger.warning(msg)
                # self.last_error is set by _parse_playlist
                return ''
        else:
            logger.info("Ścieżka playlisty nie jest skonfigurowana.")
            self.last_error = "Ścieżka playlisty nie jest skonfigurowana."
            return ''

    def _fade_radio_volume(self, start_vol: float, end_vol: float, duration: float = 1.0):
        """Gradually fades the radio volume over a specified duration."""
        if not self.radio_player or not self._vlc_instance:
            logger.debug("Fade volume: Radio player not available.")
            return
        # Check player state more reliably
        try:
             player_state = self.radio_player.get_state()
             is_playing = player_state in [vlc.State.Playing, vlc.State.Buffering]
             if not is_playing:
                  logger.debug(f"Fade volume: Radio player not in playing/buffering state ({player_state}).")
                  return
        except Exception as e:
             logger.warning(f"Fade volume: Could not get player state: {e}")
             return # Avoid fading if state is unknown

        steps = max(1, int(duration * 20)) # ~20 steps per second
        step_time = duration / steps
        # Ensure volumes are within 0-100 for VLC
        start_vlc = max(0, min(100, int(start_vol * 100)))
        end_vlc = max(0, min(100, int(end_vol * 100)))
        delta = (end_vlc - start_vlc) / steps

        logger.debug(f"Fading radio volume from {start_vlc} to {end_vlc} over {duration}s ({steps} steps)")
        current_vol = float(start_vlc)
        try:
            for i in range(steps):
                current_vol += delta
                vol_to_set = int(round(current_vol))
                # Check state again inside loop? Maybe too much overhead.
                ret = self.radio_player.audio_set_volume(vol_to_set)
                if ret != 0:
                     logger.warning(f"Fade volume: audio_set_volume returned {ret} at step {i+1}")
                     # Should we break? Continue for now.
                time.sleep(step_time)
            # Ensure final volume is set precisely
            self.radio_player.audio_set_volume(end_vlc)
            logger.debug(f"Fade complete. Volume set to {end_vlc}")
        except Exception as e:
            logger.warning(f"Error during radio volume fade: {e}", exc_info=True)


    def generate_speech(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Generates speech using ElevenLabs API and saves it to a file."""
        api_key = _get_nested_value(self.config, ['api_key'])
        voice_id = _get_nested_value(self.config, ['voice', 'id'])
        voice_settings = _get_nested_value(self.config, ['voice'], {})

        if not api_key or api_key == 'YOUR_ELEVENLABS_API_KEY_HERE':
            self.last_error = "Klucz API ElevenLabs nie jest skonfigurowany w config.yaml."
            logger.error(self.last_error)
            return None, self.last_error
        if not voice_id or voice_id == 'YOUR_VOICE_ID_HERE':
             self.last_error = "ID głosu ElevenLabs nie jest skonfigurowane w config.yaml."
             logger.error(self.last_error)
             return None, self.last_error
        if not voice_settings:
             self.last_error = "Sekcja 'voice' w konfiguracji jest pusta lub nieprawidłowa."
             logger.error(self.last_error)
             return None, self.last_error


        url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
        headers = {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': api_key
        }

        # Construct payload carefully, using defaults from DEFAULT_CONFIG if keys missing
        payload = {
            'text': text,
            'model_id': voice_settings.get('model', DEFAULT_CONFIG['voice']['model']),
            'voice_settings': {
                'stability': voice_settings.get('stability', DEFAULT_CONFIG['voice']['stability']),
                'similarity_boost': voice_settings.get('similarity', DEFAULT_CONFIG['voice']['similarity']),
                'style': voice_settings.get('style', DEFAULT_CONFIG['voice']['style']),
                'use_speaker_boost': True,
                # 'speed': voice_settings.get('speed', DEFAULT_CONFIG['voice']['speed']) # Uncomment if speed is supported
            }
        }

        try:
            logger.info(f"Generating speech via ElevenLabs for text: '{text[:50]}...'")
            response = requests.post(url, json=payload, headers=headers, timeout=90) # Increased timeout

            response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

            # Find the next available ID based on current lines
            next_id = max([line.get('id', 0) for line in self.lines] + [0]) + 1
            filename = f'line_{next_id}.mp3'
            path = AUDIO_DIR / filename
            path.write_bytes(response.content)
            logger.info(f"Speech generated successfully and saved as: {filename}")
            return filename, None

        except requests.exceptions.Timeout:
             self.last_error = "Przekroczono limit czasu połączenia z API ElevenLabs."
             logger.error(self.last_error, exc_info=True)
             return None, self.last_error
        except requests.exceptions.RequestException as e:
            # Try to get more specific error from response if available
            error_detail = str(e)
            if e.response is not None:
                 try:
                      error_json = e.response.json()
                      error_detail = error_json.get('detail', {}).get('message', e.response.text)
                 except json.JSONDecodeError:
                      error_detail = e.response.text # Use raw text if not JSON
                 except AttributeError: # Handle cases where .json() or .text might not exist
                      pass # Keep original str(e)
                 status_code = e.response.status_code
                 self.last_error = f"Błąd API ElevenLabs ({status_code}): {error_detail}"
            else:
                 self.last_error = f"Błąd połączenia z API ElevenLabs: {error_detail}"

            logger.error(self.last_error, exc_info=True)
            return None, self.last_error
        except IOError as e:
             self.last_error = f"Błąd zapisu pliku audio: {e}"
             logger.error(self.last_error, exc_info=True)
             return None, self.last_error
        except Exception as e:
            self.last_error = f"Nieoczekiwany błąd generowania mowy: {str(e)}"
            logger.error(f"{self.last_error}", exc_info=True)
            return None, self.last_error

    def start_radio(self) -> Tuple[bool, str]:
        """Starts the radio stream playback."""
        if not self._vlc_instance:
             msg = "Nie można uruchomić radia: Instancja VLC nie jest dostępna."
             logger.error(msg)
             return False, msg

        if self.radio_player:
             try:
                  player_state = self.radio_player.get_state()
                  if player_state in [vlc.State.Playing, vlc.State.Buffering]:
                       logger.info("Radio already playing or buffering.")
                       return True, "Radio już gra lub buforuje."
                  else:
                       logger.info(f"Radio player exists but state is {player_state}. Releasing and creating new player.")
                       self.radio_player.release()
                       self.radio_player = None
             except Exception as e:
                  logger.warning(f"Could not get state of existing player: {e}. Releasing and creating new player.")
                  if self.radio_player: self.radio_player.release()
                  self.radio_player = None


        stream_url = self._get_stream_url()
        if not stream_url:
            msg = "Nie można uruchomić radia: brak URL strumienia lub błąd playlisty."
            logger.warning(msg)
            # self.last_error is set by _get_stream_url
            return False, self.last_error or msg

        try:
            self.radio_player = self._vlc_instance.media_player_new()
            if not self.radio_player:
                 raise vlc.VLCException("Failed to create VLC media player.")

            media = self._vlc_instance.media_new(stream_url)
            if not media:
                 raise vlc.VLCException(f"Failed to create VLC media from URL: {stream_url}")

            media.add_option(':network-caching=1500') # Increase network cache
            media.add_option(':sout-keep') # Keep sout open (might help with reconnections?)
            self.radio_player.set_media(media)
            media.release() # Media object can be released after setting it

            initial_volume = max(0, min(100, int(self.config['volumes']['radio'] * 100)))
            self.radio_player.audio_set_volume(initial_volume)

            if self.radio_player.play() == -1:
                 error_msg = "VLC player.play() returned -1. Nie można uruchomić odtwarzania."
                 logger.error(error_msg)
                 # Attempt to get more specific VLC error if possible
                 # vlc_error = vlc.libvlc_errmsg() # Requires direct libvlc access, might be complex
                 # if vlc_error: logger.error(f"VLC lib error message: {vlc_error.decode()}")
                 self.last_error = error_msg
                 if self.radio_player: self.radio_player.release()
                 self.radio_player = None
                 return False, self.last_error
            else:
                logger.info(f"Radio started playing stream: {stream_url}")
                # Give VLC a moment to buffer and check state
                time.sleep(2)
                player_state = self.radio_player.get_state()
                if player_state not in [vlc.State.Playing, vlc.State.Buffering]:
                    logger.warning(f"Radio start initiated, but player state is {player_state} after 2s.")
                    # Consider checking media state for errors if needed
                return True, "Radio uruchomione."

        except vlc.VLCException as e:
             self.last_error = f"Błąd VLC podczas uruchamiania radia: {str(e)}"
             logger.error(f"{self.last_error}", exc_info=True)
             if self.radio_player: self.radio_player.release()
             self.radio_player = None
             return False, self.last_error
        except Exception as e:
            self.last_error = f"Nieoczekiwany błąd uruchamiania radia: {str(e)}"
            logger.error(f"{self.last_error}", exc_info=True)
            if self.radio_player: self.radio_player.release()
            self.radio_player = None
            return False, self.last_error


    def stop_radio(self) -> Tuple[bool, str]:
        """Stops the radio stream playback."""
        if not self.radio_player:
            logger.info("Stop radio: Player instance does not exist.")
            return True, "Radio nie było uruchomione."

        try:
            player_state = self.radio_player.get_state()
            logger.info(f"Stop radio: Current player state is {player_state}")
            if player_state != vlc.State.Stopped and player_state != vlc.State.Ended and player_state != vlc.State.Error:
                if self.radio_player.is_playing(): # Check this as well
                     self.radio_player.stop()
                     logger.info("Radio stop() called.")
                     # Give it a moment to actually stop
                     time.sleep(0.5)
            else:
                 logger.info("Radio already stopped or in ended/error state.")

            # Always release the player resources
            self.radio_player.release()
            self.radio_player = None
            logger.info("Radio player released.")
            return True, "Radio zatrzymane."
        except Exception as e:
            self.last_error = f"Błąd podczas zatrzymywania radia VLC: {str(e)}"
            logger.error(self.last_error, exc_info=True)
            # Ensure player is cleared even on error during stop/release
            self.radio_player = None
            return False, self.last_error


    def play_audio(self, filename: str) -> Tuple[bool, str]:
        """Plays a specific audio file with effects and ducking."""
        path = AUDIO_DIR / filename
        if not path.is_file():
            self.last_error = f"Plik audio nie istnieje lub nie jest plikiem: {path}"
            logger.error(self.last_error)
            return False, self.last_error

        try:
            logger.info(f"Loading audio file: {path}")
            # Load audio segment
            try:
                audio = AudioSegment.from_file(path)
            except pydub_exceptions.CouldntDecodeError as decode_error:
                 self.last_error = f"Nie można zdekodować pliku audio {filename}: {decode_error}"
                 logger.error(self.last_error, exc_info=True)
                 return False, self.last_error
            except FileNotFoundError: # Should be caught by is_file() but double check
                 self.last_error = f"Plik audio zniknął przed załadowaniem: {path}"
                 logger.error(self.last_error)
                 return False, self.last_error


            # 1. Apply distortion simulation if enabled
            distortion_cfg = self.config.get('distortion_simulation', {})
            if distortion_cfg.get('enabled', False):
                audio = degrade_audio(audio, distortion_cfg)

            # 2. Apply dynamic range compression
            comp_cfg = _get_nested_value(self.config, ['volumes', 'compression'], DEFAULT_CONFIG['volumes']['compression'])
            logger.debug(f"Applying compression: {comp_cfg}")
            audio = audio.compress_dynamic_range(
                threshold=comp_cfg.get('threshold', -20.0),
                ratio=comp_cfg.get('ratio', 4.0),
                attack=comp_cfg.get('attack', 5.0),
                release=comp_cfg.get('release', 50.0)
            )

            # 3. Adjust gain (Voice Volume * Master Volume)
            voice_vol = _get_nested_value(self.config, ['volumes', 'voice'], DEFAULT_CONFIG['volumes']['voice'])
            master_vol = _get_nested_value(self.config, ['volumes', 'master'], DEFAULT_CONFIG['volumes']['master'])
            total_gain_factor = max(0.001, float(voice_vol) * float(master_vol))
            gain_db = 20 * math.log10(total_gain_factor)
            logger.debug(f"Applying gain: {gain_db:.2f} dB (Voice: {voice_vol}, Master: {master_vol})")
            audio = audio.apply_gain(gain_db)

            # 4. Duck radio volume (fade out)
            radio_playing = self.radio_player and self.radio_player.is_playing() # is_playing() might be sufficient
            if radio_playing:
                logger.debug("Ducking radio volume...")
                current_radio_vol = _get_nested_value(self.config, ['volumes', 'radio'], DEFAULT_CONFIG['volumes']['radio'])
                duck_vol = _get_nested_value(self.config, ['volumes', 'ducking'], DEFAULT_CONFIG['volumes']['ducking'])
                self._fade_radio_volume(current_radio_vol, duck_vol, duration=0.5)

            # 5. Play the processed audio (blocking)
            logger.info(f"Playing processed audio: {filename} (Duration: {len(audio)/1000.0:.2f}s)")
            play(audio) # This uses simpleaudio or ffmpeg/avplay backend
            logger.info(f"Finished playing: {filename}")

            # 6. Restore radio volume (fade in)
            if radio_playing:
                logger.debug("Restoring radio volume...")
                current_radio_vol = _get_nested_value(self.config, ['volumes', 'radio'], DEFAULT_CONFIG['volumes']['radio'])
                duck_vol = _get_nested_value(self.config, ['volumes', 'ducking'], DEFAULT_CONFIG['volumes']['ducking'])
                self._fade_radio_volume(duck_vol, current_radio_vol, duration=1.0)

            return True, f"Odtworzono: {filename}"

        except Exception as e:
            self.last_error = f"Błąd podczas przetwarzania lub odtwarzania pliku {filename}: {str(e)}"
            logger.error(f"{self.last_error}", exc_info=True)
            # Attempt to restore radio volume even if playback failed mid-way
            if self.radio_player and self.radio_player.is_playing():
                 logger.warning("Attempting to restore radio volume after playback error.")
                 current_radio_vol = _get_nested_value(self.config, ['volumes', 'radio'], DEFAULT_CONFIG['volumes']['radio'])
                 duck_vol = _get_nested_value(self.config, ['volumes', 'ducking'], DEFAULT_CONFIG['volumes']['ducking'])
                 self._fade_radio_volume(duck_vol, current_radio_vol, duration=0.5)
            return False, self.last_error

    def _scheduler_loop(self):
        """The main loop for the scheduler thread."""
        logger.info("Scheduler thread started.")
        self._scheduler_running = True
        self._stop_scheduler_event.clear()

        # Try starting radio immediately when scheduler starts
        radio_start_success, radio_start_msg = self.start_radio()
        if not radio_start_success:
            logger.warning(f"Scheduler starting, but radio failed to start initially: {radio_start_msg}")

        while not self._stop_scheduler_event.is_set():
            try:
                # --- Get active lines ---
                active_lines = [
                    line for line in self.lines
                    if line.get('active', False)
                    and line.get('filename')
                    and (AUDIO_DIR / line['filename']).is_file() # Check file exists here too
                ]

                if not active_lines:
                    logger.debug("Scheduler loop: No active lines with valid files found. Waiting...")
                    # Wait for a shorter interval if no lines, check stop event more often
                    wait_time = 30.0
                else:
                    # --- Select and play line ---
                    line_to_play = random.choice(active_lines)
                    line_id = line_to_play.get('id', 'N/A')
                    line_text = line_to_play.get('text', '')[:50]
                    logger.info(f"Scheduler selected line ID {line_id}: '{line_text}...'")

                    # Ensure radio is still playing, try restarting if not
                    if self._vlc_instance: # Only manage radio if VLC is available
                        radio_state = vlc.State.Error # Default to error if check fails
                        try:
                            if self.radio_player:
                                radio_state = self.radio_player.get_state()
                        except Exception as state_e:
                             logger.warning(f"Could not get radio state before playing line: {state_e}")

                        if radio_state not in [vlc.State.Playing, vlc.State.Buffering]:
                             logger.warning(f"Radio not playing (state: {radio_state}) before playing line. Attempting restart...")
                             self.start_radio()
                             # Give it a moment to connect before ducking/playing
                             time.sleep(2)


                    # Play the selected line
                    success, msg = self.play_audio(line_to_play['filename'])
                    if not success:
                        logger.error(f"Scheduler failed to play line ID {line_id}: {msg}")
                        # Optional: Deactivate line on playback error?
                        # self.bulk_toggle_sync([line_id], False) # Pass ID directly

                    # --- Wait for interval ---
                    interval = float(_get_nested_value(self.config, ['radio', 'interval'], DEFAULT_CONFIG['radio']['interval']))
                    wait_time = max(1.0, interval) # Ensure wait time is at least 1 second


                logger.debug(f"Scheduler waiting for {wait_time:.1f} seconds...")
                # Use wait() on the event for the interval duration.
                # This allows the loop to exit quickly if stop() is called.
                interrupted = self._stop_scheduler_event.wait(wait_time)
                if interrupted:
                     logger.info("Scheduler wait interrupted by stop event.")
                     break # Exit loop immediately if stop event is set


            except Exception as e:
                logger.error(f"Critical error in scheduler loop: {e}", exc_info=True)
                # Avoid busy-looping on unexpected error, wait a bit before retrying
                logger.info("Waiting 15 seconds after scheduler loop error...")
                interrupted = self._stop_scheduler_event.wait(15)
                if interrupted: break # Exit if stopped during error wait

        # --- Loop exited ---
        logger.info("Scheduler thread received stop signal or exited loop.")
        if self._vlc_instance:
             logger.info("Stopping radio as part of scheduler shutdown...")
             self.stop_radio()
        self._scheduler_running = False
        logger.info("Scheduler thread finished.")


    def start_scheduler(self) -> Tuple[bool, str]:
        """Starts the scheduler in a separate thread."""
        if self._scheduler_thread is not None and self._scheduler_thread.is_alive():
            logger.warning("Scheduler is already running.")
            return False, "Scheduler już działa."

        self._stop_scheduler_event.clear()
        self._scheduler_thread = threading.Thread(target=self._scheduler_loop, name="VoiceLineScheduler", daemon=True)
        try:
            self._scheduler_thread.start()
        except RuntimeError as e:
             logger.error(f"Failed to start scheduler thread: {e}", exc_info=True)
             return False, f"Nie udało się uruchomić wątku schedulera: {e}"

        # Give the thread a moment to set the _scheduler_running flag
        time.sleep(0.5)
        if self._scheduler_running:
             logger.info("Scheduler started successfully.")
             return True, "Scheduler uruchomiony."
        else:
             logger.error("Scheduler thread started but did not set running flag.")
             # Attempt to join the potentially failed thread?
             self._scheduler_thread.join(timeout=1.0)
             return False, "Wątek schedulera nie uruchomił się poprawnie."


    def stop_scheduler(self) -> Tuple[bool, str]:
        """Signals the scheduler thread to stop."""
        if self._scheduler_thread is None or not self._scheduler_thread.is_alive():
            logger.info("Stop scheduler: Scheduler is not running or thread object is None.")
            self._scheduler_running = False # Ensure flag is correct
            return True, "Scheduler nie był uruchomiony." # Return True as the desired state is achieved

        if self._stop_scheduler_event.is_set():
             logger.warning("Stop scheduler: Stop event already set.")
             # Still wait for thread to join? Yes.
        else:
             logger.info("Sending stop signal to scheduler thread...")
             self._stop_scheduler_event.set()

        # Wait for the thread to finish
        thread_name = self._scheduler_thread.name
        logger.info(f"Waiting for scheduler thread ({thread_name}) to join...")
        self._scheduler_thread.join(timeout=10) # Wait up to 10 seconds

        if self._scheduler_thread.is_alive():
            logger.warning(f"Scheduler thread ({thread_name}) did not stop within timeout.")
            # The thread might be stuck, but the radio stop was attempted inside the loop's exit path.
            self._scheduler_running = False # Force setting the flag
            return False, "Scheduler nie zatrzymał się w wyznaczonym czasie (ale próba zatrzymania radia została podjęta)."
        else:
            logger.info(f"Scheduler thread ({thread_name}) stopped successfully.")
            self._scheduler_running = False
            self._scheduler_thread = None # Clear the thread object
            return True, "Scheduler zatrzymany."

    def get_scheduler_status(self) -> bool:
        """Returns the running status of the scheduler."""
        if self._scheduler_thread is not None and not self._scheduler_thread.is_alive():
             logger.debug("Scheduler status check found dead thread. Updating status.")
             self._scheduler_running = False
             self._scheduler_thread = None
        return self._scheduler_running

    def get_lines(self) -> List[Dict]:
        """Returns the list of all voice lines."""
        # Return a deep copy to prevent external modification? Maybe not necessary.
        return self.lines

    def get_line_by_id(self, line_id: int) -> Optional[Dict]:
        """Finds a voice line by its ID."""
        for line in self.lines:
            if line.get('id') == line_id:
                return line
        return None

    def add_line(self, text: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Adds a new voice line, generates speech, and saves."""
        if not isinstance(text, str) or not text.strip():
            self.last_error = "Tekst linii nie może być pusty."
            logger.warning(self.last_error)
            return None, self.last_error

        filename, error = self.generate_speech(text.strip())
        if filename:
            # ID generation is handled by generate_speech now based on max existing ID
            new_id = int(filename.split('_')[1].split('.')[0]) # Extract ID from filename
            new_line = {
                'id': new_id,
                'text': text.strip(),
                'filename': filename,
                'active': True # New lines are active by default
            }
            self.lines.append(new_line)
            self._save_lines()
            logger.info(f"Added new line with ID {new_id}")
            return new_line, None # Return the full new line object
        else:
            # self.last_error is already set by generate_speech
            return None, self.last_error

    def edit_line(self, line_id: int, new_text: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Edits the text of an existing line, regenerates speech, and saves."""
        if not isinstance(new_text, str) or not new_text.strip():
            self.last_error = "Nowy tekst linii nie może być pusty."
            logger.warning(self.last_error)
            return None, self.last_error

        line_to_edit = self.get_line_by_id(line_id)

        if line_to_edit:
            old_filename = line_to_edit.get('filename')
            logger.info(f"Attempting to regenerate audio for line ID {line_id}...")
            # Use the same ID for the new filename to replace the old one
            filename, error = self.generate_speech(new_text.strip()) # Generate speech first

            if filename:
                 # Check if filename actually changed (it shouldn't if ID logic is consistent)
                 if old_filename and old_filename != filename:
                      logger.warning(f"Filename changed during edit for ID {line_id} ('{old_filename}' -> '{filename}'). Deleting old file.")
                      old_path = AUDIO_DIR / old_filename
                      if old_path.is_file():
                          try:
                              old_path.unlink()
                              logger.info(f"Removed old audio file: {old_filename}")
                          except OSError as e:
                              logger.warning(f"Could not remove old audio file {old_filename}: {e}")
                 else:
                      logger.info(f"Audio regenerated successfully, filename '{filename}' remains.")


                 # Update the line in the list
                 line_to_edit['text'] = new_text.strip()
                 line_to_edit['filename'] = filename # Ensure filename is updated if it did change
                 # Keep the existing 'active' status: line_to_edit['active'] remains unchanged

                 self._save_lines()
                 logger.info(f"Edited line ID {line_id}")
                 return line_to_edit, None # Return updated line
            else:
                # self.last_error is set by generate_speech
                logger.error(f"Failed to regenerate audio for editing line ID {line_id}: {self.last_error}")
                return None, self.last_error
        else:
            self.last_error = f"Nie znaleziono linii o ID: {line_id} do edycji."
            logger.warning(self.last_error)
            return None, self.last_error


    def bulk_toggle_sync(self, ids_to_toggle: List[int], new_state: Optional[bool] = None) -> Tuple[int, List[int]]:
        """
        Toggles the active state of lines specified by a list of IDs.
        Returns the count of changed lines and a list of their IDs.
        """
        changed_count = 0
        ids_changed = []
        valid_ids_found = set()

        for line in self.lines:
            line_id = line.get('id')
            if line_id in ids_to_toggle:
                valid_ids_found.add(line_id)
                current_state = line.get('active', False) # Default to False if missing
                target_state = not current_state if new_state is None else new_state

                if current_state != target_state:
                    line['active'] = target_state
                    changed_count += 1
                    ids_changed.append(line_id)
                    logger.debug(f"Toggled line ID {line_id} to active={target_state}")

        # Check for requested IDs that were not found
        not_found_ids = set(ids_to_toggle) - valid_ids_found
        if not_found_ids:
             logger.warning(f"Could not find lines with the following IDs for toggling: {sorted(list(not_found_ids))}")


        if changed_count > 0:
            self._save_lines()
            state_desc = "flipped" if new_state is None else ("active" if new_state else "inactive")
            logger.info(f"Toggled state ({state_desc}) for {changed_count} lines (IDs: {sorted(ids_changed)}).")
        else:
            logger.info("No lines needed toggling for the given IDs.")

        return changed_count, sorted(ids_changed)

    def toggle_all_lines(self, new_state: bool) -> int:
        """Sets the active state for ALL lines."""
        changed_count = 0
        for line in self.lines:
             if line.get('active') != new_state:
                  line['active'] = new_state
                  changed_count += 1
        if changed_count > 0:
             self._save_lines()
        state_desc = "active" if new_state else "inactive"
        logger.info(f"Set all {len(self.lines)} lines to {state_desc}. {changed_count} lines were changed.")
        return changed_count


    def remove_lines_sync(self, ids_to_remove: List[int]) -> Tuple[int, List[int]]:
        """
        Removes lines specified by a list of IDs and their associated audio files.
        Re-indexes remaining lines.
        Returns the count of removed lines and a list of their original IDs.
        """
        removed_count = 0
        actually_removed_ids = []
        lines_to_keep = []
        valid_ids_found = set()

        # Identify lines to keep and files to delete
        files_to_delete = []
        for line in self.lines:
            line_id = line.get('id')
            if line_id in ids_to_remove:
                valid_ids_found.add(line_id)
                filename = line.get('filename')
                if filename:
                    files_to_delete.append(AUDIO_DIR / filename)
                actually_removed_ids.append(line_id)
                removed_count += 1
            else:
                lines_to_keep.append(line)

        # Check for requested IDs that were not found
        not_found_ids = set(ids_to_remove) - valid_ids_found
        if not_found_ids:
             logger.warning(f"Could not find lines with the following IDs for removal: {sorted(list(not_found_ids))}")

        if removed_count > 0:
            logger.info(f"Attempting to remove {removed_count} lines with original IDs: {sorted(actually_removed_ids)}")

            # Delete audio files first
            for path in files_to_delete:
                if path.is_file():
                    try:
                        path.unlink()
                        logger.info(f"Removed audio file: {path.name}")
                    except OSError as e:
                        logger.warning(f"Could not remove audio file {path.name}: {e}")
                else:
                     logger.warning(f"Audio file not found for deletion: {path.name}")


            # Re-index the remaining lines sequentially
            for new_idx, line in enumerate(lines_to_keep):
                line['id'] = new_idx + 1

            self.lines = lines_to_keep
            self._save_lines()
            logger.info(f"Successfully removed {removed_count} lines. Lines re-indexed.")
        else:
            logger.info("No lines were removed for the given IDs.")

        return removed_count, sorted(actually_removed_ids)

    def remove_all_lines(self) -> Tuple[int, List[int]]:
        """Removes ALL lines and their audio files."""
        all_ids = [line.get('id') for line in self.lines if line.get('id') is not None]
        if not all_ids:
             logger.info("Remove all lines: No lines exist to remove.")
             return 0, []
        logger.warning("Removing all voice lines!")
        return self.remove_lines_sync(all_ids)


    def update_settings(self, settings_update_dict: Dict) -> Tuple[bool, str]:
        """
        Updates the system configuration with new settings provided in a dictionary.
        Performs validation before applying and saving.
        """
        try:
            # Create a deep copy of current config to modify and validate
            potential_new_config = self.config.copy() # Or use deepcopy for nested dicts
            potential_new_config = self._merge_configs(potential_new_config, settings_update_dict)

            # --- Perform Validation on potential_new_config ---
            # Example: Check required keys exist and have correct types/ranges
            # This could be more elegantly done by converting potential_new_config
            # to the Pydantic AppSettings model and letting it validate.
            try:
                 # Validate the merged structure using the Pydantic model
                 # This ensures all required fields are present and types are correct
                 # Note: API key might be missing if not provided in update AND not in original default?
                 # Ensure API key validation handles the 'YOUR...HERE' placeholder?
                 import models
                 models.AppSettings(**potential_new_config)
                 logger.debug("Potential new settings passed Pydantic validation.")
            except Exception as pydantic_error: # Catch Pydantic's ValidationError specifically if possible
                 error_msg = f"Błąd walidacji ustawień: {pydantic_error}"
                 logger.error(error_msg, exc_info=True)
                 self.last_error = error_msg
                 return False, self.last_error

            # If validation passes, apply the changes
            self.config = potential_new_config

            # Update runtime variables affected by config changes
            self.radio_volume = _get_nested_value(self.config, ['volumes', 'radio'], DEFAULT_CONFIG['volumes']['radio'])
            self.duck_volume = _get_nested_value(self.config, ['volumes', 'ducking'], DEFAULT_CONFIG['volumes']['ducking'])

            # Apply volume change immediately if radio is playing and VLC is available
            if self._vlc_instance and self.radio_player and self.radio_player.is_playing():
                 new_vol_int = max(0, min(100, int(self.radio_volume * 100)))
                 ret = self.radio_player.audio_set_volume(new_vol_int)
                 if ret == 0:
                      logger.info(f"Applied new radio volume ({new_vol_int}) to playing stream.")
                 else:
                      logger.warning(f"Failed to apply new radio volume ({new_vol_int}) to playing stream (ret={ret}).")


            self._save_config() # Save the validated and updated config
            logger.info("Settings updated successfully.")
            return True, "Ustawienia zaktualizowane."

        except Exception as e:
             self.last_error = f"Nieoczekiwany błąd podczas aktualizacji ustawień: {str(e)}"
             logger.error(f"{self.last_error}", exc_info=True)
             # Should we revert? Reloading might be safest.
             logger.warning("Reverting configuration due to update error.")
             self.config = self._load_config() # Revert by reloading from file or defaults
             return False, self.last_error

    def get_settings(self) -> Dict:
        """Returns the current configuration."""
        # Return a copy to prevent direct modification? Yes, good practice.
        import copy
        return copy.deepcopy(self.config)

    def cleanup(self):
        """Clean up resources like stopping scheduler and radio."""
        logger.info("Cleaning up VoiceSystem resources...")
        self.stop_scheduler() # Stops scheduler thread and attempts radio stop
        # Ensure radio is stopped again, in case scheduler stop failed or wasn't running
        self.stop_radio()
        # Release VLC instance (optional, depends if shared instance needs explicit release)
        # if self._vlc_instance:
        #     try: self._vlc_instance.release()
        #     except Exception as e: logger.warning(f"Error releasing VLC instance: {e}")
        #     self._vlc_instance = None
        logger.info("VoiceSystem cleanup complete.")


# --- Main execution block (for testing module directly) ---
if __name__ == "__main__":
    print("--- Running VoiceSystem Module Self-Test ---")
    vs = VoiceSystem()

    print("\n--- Initial Config ---")
    print(json.dumps(vs.get_settings(), indent=2, ensure_ascii=False))

    print("\n--- Initial Lines ---")
    print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))

    # --- Example Usage (uncomment to test) ---
    # print("\n--- Adding Line ---")
    # test_text = "To jest linia testowa numer jeden."
    # new_line, err = vs.add_line(test_text)
    # added_id = None
    # if new_line:
    #     print(f"Added line: {new_line}")
    #     added_id = new_line['id']
    #     print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))

    #     print("\n--- Adding Second Line ---")
    #     new_line_2, err_2 = vs.add_line("Druga linia do testów.")
    #     added_id_2 = None
    #     if new_line_2:
    #          print(f"Added line 2: {new_line_2}")
    #          added_id_2 = new_line_2['id']
    #          print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))

    #          print(f"\n--- Editing Line ID {added_id} ---")
    #          updated_line, err_edit = vs.edit_line(added_id, "Zedytowany tekst pierwszej linii.")
    #          if updated_line:
    #              print(f"Edited line: {updated_line}")
    #              print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))
    #          else:
    #              print(f"Edit Error: {err_edit}")

    #          print(f"\n--- Toggling Lines {added_id}, {added_id_2} to inactive ---")
    #          count, ids_changed = vs.bulk_toggle_sync([added_id, added_id_2], new_state=False)
    #          print(f"Toggled {count} lines (IDs: {ids_changed}).")
    #          print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))

    #          print(f"\n--- Toggling Line {added_id} (Flip state) ---")
    #          count, ids_changed = vs.bulk_toggle_sync([added_id]) # Flip state
    #          print(f"Toggled {count} lines (IDs: {ids_changed}).")
    #          print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))


    #          print(f"\n--- Removing Line ID {added_id_2} ---")
    #          removed_count, removed_ids = vs.remove_lines_sync([added_id_2])
    #          print(f"Removed {removed_count} lines (Original IDs: {removed_ids}).")
    #          print("Current lines after removal and re-index:")
    #          print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))

    #          # Get the new ID of the remaining line (should be 1 now)
    #          remaining_line = vs.get_lines()[0] if vs.get_lines() else None
    #          if remaining_line:
    #               print(f"\n--- Removing Remaining Line ID {remaining_line['id']} ---")
    #               removed_count, removed_ids = vs.remove_lines_sync([remaining_line['id']])
    #               print(f"Removed {removed_count} lines (Original IDs: {removed_ids}).")
    #               print(json.dumps(vs.get_lines(), indent=2, ensure_ascii=False))
    #          else:
    #               print("\nNo remaining lines to remove.")


    #     else:
    #         print(f"Error adding line 2: {err_2}")

    # else:
    #     print(f"Error adding line 1: {err}")


    # print("\n--- Testing Scheduler (will run for 10s if lines exist) ---")
    # if vs.get_lines(): # Only start if there are lines
    #      start_ok, msg = vs.start_scheduler()
    #      print(f"Start Scheduler: {msg}")
    #      if start_ok:
    #          time.sleep(10)
    #          stop_ok, msg = vs.stop_scheduler()
    #          print(f"Stop Scheduler: {msg}")
    # else:
    #      print("Skipping scheduler test as no lines are present.")

    print("\n--- Testing Cleanup ---")
    vs.cleanup()
    print("\n--- Module Self-Test Finished ---")

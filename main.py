import json
import math
import random
import shutil
import textwrap
import time
import traceback
import logging
import threading
from itertools import zip_longest
from pathlib import Path

# Third-party imports (ensure these are installed: pip install requests pydub PyYAML python-vlc numpy)
import requests
import vlc
import yaml
from pydub import AudioSegment
from pydub.playback import play
import numpy as np
from pydub.effects import high_pass_filter, low_pass_filter

# --- Configuration ---
CONFIG_FILE = Path('config.yaml')
DATA_FILE = Path('voice_lines.json')
AUDIO_DIR = Path('audio_files')
AUDIO_DIR.mkdir(exist_ok=True) # Ensure audio directory exists

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Default Config ---
# Used if config.yaml is missing or invalid
DEFAULT_CONFIG = {
    'api_key': 'sk_c3080639f3d803a0e690bbef0d8d85a238fab2e1e6b4a9fd', # Replace with your actual key
    'voice': {
        'id': 'NacdHGUYR1k3M0FAbAia', # Replace with your desired voice ID
        'model': 'eleven_multilingual_v2',
        'stability': 0.8,
        'similarity': 0.9,
        'style': 0.3,
        'speed': 0.7
    },
    'volumes': {
        'master': 1.0,
        'radio': 0.2,
        'ducking': 0.0,
        'voice': 0.3,
        'compression': {
            'threshold': -20.0,
            'ratio': 4.0,
            'attack': 5.0,
            'release': 50.0
        }
    },
    'radio': {
        'playlist': 'RMF_FM.pls', # Path to .m3u or .pls playlist file
        'interval': 30 # Interval in seconds (e.g., 5 minutes)
    },
    'distortion_simulation': {
        'enabled': False,
        'sample_rate': 32000,
        'distortion': 0.0002,
        'filter_low': 200,
        'filter_high': 4000,
        'noise_level': 0.0001,
        'bit_depth': 16,
        'crackle': 0.0002
    },
    'degradation': { # Keep the degradation section separate for clarity in degrade_audio
        'sample_rate': 32000,
        'distortion': 0.0002,
        'filter_low': 200,
        'filter_high': 4000,
        'noise_level': 0.0001,
        'bit_depth': 16,
        'crackle': 0.0002
    }
}


# --- Audio Degradation Function ---
def degrade_audio(audio_segment, config):
    """
    Applies audio degradation effects based on the 'distortion_simulation' config.
    Uses the 'degradation' sub-section of the config for parameters.
    """
    if not config.get('distortion_simulation', {}).get('enabled', False):
        return audio_segment

    degradation_config = config.get('degradation', {})
    degraded = audio_segment

    try:
        # 1. Force mono conversion first
        degraded = degraded.set_channels(1)

        # 2. Sample rate reduction
        if 'sample_rate' in degradation_config:
            target_sr = int(degradation_config['sample_rate'])
            if target_sr > 0 and target_sr != degraded.frame_rate:
                 # Resample down first, then potentially up later if needed
                 temp_sr = min(target_sr, degraded.frame_rate)
                 degraded = degraded.set_frame_rate(temp_sr)


        # Helper function to safely create AudioSegments from numpy arrays
        def create_audio_segment(samples, sample_width, frame_rate, channels):
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
            max_amp = 2**(sample_width * 8 - 1) - 1
            min_amp = -max_amp -1 # For signed integers
            samples = np.clip(samples, min_amp, max_amp)
            # Ensure correct dtype based on sample_width BEFORE converting to bytes
            dtype = np.int16 if sample_width == 2 else np.int8
            samples_bytes = samples.astype(dtype).tobytes()
            return AudioSegment(
                data=samples_bytes,
                sample_width=sample_width,
                frame_rate=frame_rate,
                channels=channels
            )

        # Convert to numpy array for manipulation (use float for intermediate steps)
        current_sample_width = degraded.sample_width
        samples_np = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        max_amplitude_float = float(2**(current_sample_width * 8 - 1) - 1)


        # 3. Nonlinear distortion (Clipping)
        if 'distortion' in degradation_config and degradation_config['distortion'] > 0:
             # Apply gain and then clip
            gain_factor = 1.0 + float(degradation_config['distortion']) * 5 # Amplify distortion effect
            samples_np = np.clip(samples_np * gain_factor, -max_amplitude_float, max_amplitude_float)


        # 4. Bandpass filtering
        if 'filter_low' in degradation_config and 'filter_high' in degradation_config:
            low = int(degradation_config['filter_low'])
            high = int(degradation_config['filter_high'])
            # Need to convert back to AudioSegment for pydub filters
            temp_audio = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)
            if low > 0:
                temp_audio = high_pass_filter(temp_audio, low)
            if high > 0 and high < degraded.frame_rate / 2: # Nyquist limit
                temp_audio = low_pass_filter(temp_audio, high)
            # Convert back to numpy
            samples_np = np.array(temp_audio.get_array_of_samples(), dtype=np.float32)


        # 5. Modulated noise
        if 'noise_level' in degradation_config and degradation_config['noise_level'] > 0:
            noise_amp = float(degradation_config['noise_level']) * max_amplitude_float
            noise = np.random.normal(0, noise_amp, len(samples_np))
            # Simple sine modulation for variability
            modulation = np.sin(np.linspace(0, 20 * np.pi, len(samples_np))) * 0.5 + 0.5 # Modulate between 0 and 1
            samples_np += noise * modulation


        # 6. Bit crushing (Quantization)
        if 'bit_depth' in degradation_config:
            target_bit_depth = int(degradation_config['bit_depth'])
            if 1 <= target_bit_depth < (current_sample_width * 8):
                # Calculate quantization levels
                levels = 2**target_bit_depth
                # Scale samples to range [0, levels-1] (approximately)
                # Normalize to [-1, 1] first
                normalized_samples = samples_np / max_amplitude_float
                # Scale to target bit depth range and quantize
                quantized_samples = np.round(normalized_samples * (levels / 2 -1) )
                # Scale back to original amplitude range
                samples_np = (quantized_samples / (levels / 2 - 1)) * max_amplitude_float


        # 7. Crackle effect
        if 'crackle' in degradation_config and degradation_config['crackle'] > 0:
            crackle_intensity = float(degradation_config['crackle'])
            # Number of crackles proportional to length and intensity
            num_crackles = int(len(samples_np) / degraded.frame_rate * 50 * crackle_intensity) # ~50 crackles/sec at intensity 1

            for _ in range(num_crackles):
                pos = random.randint(0, len(samples_np) - 1)
                # Short, sharp impulse - simulate with a single high value or short burst
                crackle_amp = random.uniform(0.5, 1.0) * max_amplitude_float * random.choice([-1, 1])
                crackle_len = random.randint(1, 3) # Very short duration
                end_pos = min(pos + crackle_len, len(samples_np))
                samples_np[pos:end_pos] += crackle_amp # Additive crackle


        # Convert back to AudioSegment using the helper
        degraded = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)

        # 8. Final resampling to a common rate (e.g., 44100 Hz) for playback consistency
        # This happens AFTER degradation effects like sample rate reduction
        final_sr = 44100
        if degraded.frame_rate != final_sr:
            try:
                degraded = degraded.set_frame_rate(final_sr)
            except Exception as e:
                logger.error(f"Error during final resampling: {e}")
                # Fallback: try to create directly if set_frame_rate fails
                samples_np_final = np.array(degraded.get_array_of_samples(), dtype=np.float32)
                degraded = create_audio_segment(samples_np_final, degraded.sample_width, final_sr, 1)


    except Exception as e:
        logger.error(f"Error during audio degradation: {e}\n{traceback.format_exc()}")
        return audio_segment # Return original on error

    return degraded


# --- Voice System Class ---
class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        # Ensure degradation settings match distortion settings initially
        self._sync_degradation_config()
        self.lines = self._load_lines()
        self.radio_player = None
        self.radio_volume = self.config['volumes']['radio']
        self.duck_volume = self.config['volumes']['ducking']
        self.last_error = None
        self._scheduler_thread = None
        self._stop_scheduler_event = threading.Event()
        self._scheduler_running = False
        self._vlc_instance = vlc.Instance('--no-xlib --quiet') # Initialize VLC instance once

    def _load_config(self):
        """Loads config from YAML, uses defaults if file not found or invalid."""
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    loaded_config = yaml.safe_load(f)
                    # Basic validation: check for top-level keys
                    if isinstance(loaded_config, dict) and all(k in loaded_config for k in DEFAULT_CONFIG):
                         # Deep merge loaded config with defaults to ensure all keys exist
                         merged_config = self._merge_configs(DEFAULT_CONFIG, loaded_config)
                         logger.info(f"Configuration loaded from {CONFIG_FILE}")
                         return merged_config
                    else:
                        logger.warning(f"Invalid structure in {CONFIG_FILE}. Using default configuration.")
                        self._save_config(DEFAULT_CONFIG) # Save defaults for user
                        return DEFAULT_CONFIG.copy()
            else:
                logger.warning(f"{CONFIG_FILE} not found. Creating with default values.")
                self._save_config(DEFAULT_CONFIG)
                return DEFAULT_CONFIG.copy()
        except (yaml.YAMLError, IOError) as e:
            logger.error(f"Error loading config file {CONFIG_FILE}: {e}. Using default configuration.")
            return DEFAULT_CONFIG.copy()

    def _merge_configs(self, default, loaded):
        """Recursively merges loaded config into default config."""
        merged = default.copy()
        for key, value in loaded.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._merge_configs(merged[key], value)
            else:
                merged[key] = value
        return merged

    def _sync_degradation_config(self):
        """Copies relevant settings from distortion_simulation to degradation."""
        if 'distortion_simulation' in self.config and 'degradation' in self.config:
            for key in self.config['degradation']:
                if key in self.config['distortion_simulation']:
                    self.config['degradation'][key] = self.config['distortion_simulation'][key]
            logger.debug("Synced distortion_simulation settings to degradation section.")


    def _save_config(self, config_data=None):
        """Saves the current configuration to the YAML file."""
        if config_data is None:
            config_data = self.config
        try:
            # Ensure degradation reflects distortion settings before saving
            self._sync_degradation_config()
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_data, f, default_flow_style=False, sort_keys=False)
            logger.info(f"Configuration saved to {CONFIG_FILE}")
        except (yaml.YAMLError, IOError) as e:
            logger.error(f"Error saving config file {CONFIG_FILE}: {e}")
            self.last_error = f"Błąd zapisu konfiguracji: {str(e)}"

    def _load_lines(self):
        """Loads voice lines from the JSON data file."""
        try:
            if DATA_FILE.exists():
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    lines_data = json.load(f)
                    # Validate basic structure (list of dicts with required keys)
                    if isinstance(lines_data, list) and all(
                        isinstance(item, dict) and all(k in item for k in ['id', 'text', 'filename', 'active'])
                        for item in lines_data
                    ):
                        logger.info(f"Voice lines loaded from {DATA_FILE}")
                        return lines_data
                    else:
                        logger.warning(f"Invalid data structure in {DATA_FILE}. Initializing empty list.")
                        self._save_lines([]) # Save empty list to fix file
                        return []
            else:
                logger.info(f"{DATA_FILE} not found. Initializing empty list.")
                return []
        except (FileNotFoundError, json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading voice lines file {DATA_FILE}: {e}")
            self.last_error = f"Błąd ładowania linii: {str(e)}"
            return [] # Return empty list on error

    def _save_lines(self):
        """Saves the current voice lines to the JSON data file."""
        try:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.lines, f, indent=2, ensure_ascii=False)
            logger.info(f"Voice lines saved to {DATA_FILE}")
        except (IOError, TypeError) as e:
            logger.error(f"Error saving voice lines file {DATA_FILE}: {e}")
            self.last_error = f"Błąd zapisu linii: {str(e)}"

    def _parse_playlist(self, path_str):
        """Parses M3U or PLS playlist files to extract stream URLs."""
        path = Path(path_str)
        urls = []
        if not path.is_file():
            self.last_error = f"Plik playlisty nie istnieje: {path_str}"
            logger.warning(self.last_error)
            return []
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()

            if path.suffix.lower() == '.m3u' or path.suffix.lower() == '.m3u8':
                urls = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
            elif path.suffix.lower() == '.pls':
                for line in lines:
                    line = line.strip()
                    if line.lower().startswith('file'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            urls.append(parts[1].strip())
            else:
                self.last_error = f"Nieobsługiwany format playlisty: {path.suffix}"
                logger.warning(self.last_error)
                return []

            # Filter for likely stream URLs (simple check)
            urls = [url for url in urls if url.startswith('http://') or url.startswith('https://')]
            logger.info(f"Parsed {len(urls)} stream URLs from {path_str}")
            return urls

        except Exception as e:
            self.last_error = f"Błąd parsowania playlisty ({path_str}): {str(e)}"
            logger.error(self.last_error)
            return []

    def _get_stream_url(self):
        """Gets the first valid stream URL from the configured playlist."""
        playlist_path = self.config['radio'].get('playlist')
        if playlist_path:
            urls = self._parse_playlist(playlist_path)
            if urls:
                logger.info(f"Using stream URL: {urls[0]}")
                return urls[0]
            else:
                logger.warning(f"Brak prawidłowych adresów URL w playliście: {playlist_path}")
                self.last_error = f"Brak prawidłowych adresów URL w playliście: {playlist_path}"
                return ''
        else:
            logger.warning("Ścieżka playlisty nie jest skonfigurowana.")
            self.last_error = "Ścieżka playlisty nie jest skonfigurowana."
            return ''

    def _fade_radio_volume(self, start_vol, end_vol, duration=1.0):
        """Gradually fades the radio volume over a specified duration."""
        if not self.radio_player or not self.radio_player.is_playing():
            return

        steps = 20 # Number of steps for the fade
        step_time = duration / steps
        # Ensure volumes are within 0-100 for VLC
        start_vlc = max(0, min(100, int(start_vol * 100)))
        end_vlc = max(0, min(100, int(end_vol * 100)))
        delta = (end_vlc - start_vlc) / steps

        current_vol = float(start_vlc)
        try:
            for _ in range(steps):
                current_vol += delta
                self.radio_player.audio_set_volume(int(round(current_vol)))
                time.sleep(step_time)
            # Ensure final volume is set precisely
            self.radio_player.audio_set_volume(end_vlc)
        except Exception as e:
            logger.warning(f"Error during radio volume fade: {e}")


    def generate_speech(self, text):
        """Generates speech using ElevenLabs API and saves it to a file."""
        api_key = self.config.get('api_key')
        voice_id = self.config.get('voice', {}).get('id')

        if not api_key or api_key == 'YOUR_ELEVENLABS_API_KEY_HERE':
            self.last_error = "Klucz API ElevenLabs nie jest skonfigurowany."
            logger.error(self.last_error)
            return None, self.last_error
        if not voice_id or voice_id == 'YOUR_VOICE_ID_HERE':
             self.last_error = "ID głosu ElevenLabs nie jest skonfigurowane."
             logger.error(self.last_error)
             return None, self.last_error

        url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
        headers = {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': api_key
        }
        voice_settings = self.config['voice']
        data = {
            'text': text,
            'model_id': voice_settings.get('model', 'eleven_multilingual_v2'),
            'voice_settings': {
                'stability': voice_settings.get('stability', 0.7),
                'similarity_boost': voice_settings.get('similarity', 0.95),
                'style': voice_settings.get('style', 0.3),
                'use_speaker_boost': True,
                # Note: ElevenLabs API v1 might not support 'speed'. Check their docs.
                # 'speed': voice_settings.get('speed', 1.0) # If supported
            }
        }

        try:
            logger.info(f"Generating speech for text: '{text[:50]}...'")
            response = requests.post(url, json=data, headers=headers, timeout=60) # Increased timeout

            if response.ok:
                # Find the next available ID
                next_id = max([line['id'] for line in self.lines] + [0]) + 1
                filename = f'line_{next_id}.mp3'
                path = AUDIO_DIR / filename
                path.write_bytes(response.content)
                logger.info(f"Speech generated successfully: {filename}")
                return filename, None
            else:
                self.last_error = f"Błąd API ElevenLabs ({response.status_code}): {response.text}"
                logger.error(self.last_error)
                return None, self.last_error
        except requests.exceptions.RequestException as e:
            self.last_error = f"Błąd połączenia z API ElevenLabs: {str(e)}"
            logger.error(self.last_error)
            return None, self.last_error
        except Exception as e:
            self.last_error = f"Nieoczekiwany błąd generowania mowy: {str(e)}"
            logger.error(f"{self.last_error}\n{traceback.format_exc()}")
            return None, self.last_error

    def start_radio(self):
        """Starts the radio stream playback."""
        if self.radio_player and self.radio_player.is_playing():
            logger.info("Radio already playing.")
            return True, "Radio już gra."

        stream_url = self._get_stream_url()
        if stream_url:
            try:
                # Ensure previous player is released if it exists but isn't playing
                if self.radio_player:
                    self.radio_player.release()

                self.radio_player = self._vlc_instance.media_player_new()
                media = self._vlc_instance.media_new(stream_url)
                # Add options to potentially improve streaming stability
                media.add_option(':network-caching=1500') # Increase network cache (milliseconds)
                self.radio_player.set_media(media)

                # Set initial volume BEFORE playing
                initial_volume = max(0, min(100, int(self.config['volumes']['radio'] * 100)))
                self.radio_player.audio_set_volume(initial_volume)

                if self.radio_player.play() == -1:
                     logger.error("Nie można uruchomić odtwarzania radia VLC.")
                     self.last_error = "Nie można uruchomić odtwarzania radia VLC."
                     self.radio_player = None # Reset player on failure
                     return False, self.last_error
                else:
                    logger.info(f"Radio started playing stream: {stream_url}")
                    # Give VLC a moment to buffer and start
                    time.sleep(2)
                    if not self.radio_player.is_playing():
                        logger.warning("Radio start initiated, but player is not in playing state after 2s.")
                        # Potentially check media state: m = self.radio_player.get_media(); m.parse(); print(m.get_state())
                        # For now, assume it might still connect.
                    return True, "Radio uruchomione."

            except Exception as e:
                self.last_error = f"Błąd uruchamiania radia VLC: {str(e)}"
                logger.error(f"{self.last_error}\n{traceback.format_exc()}")
                if self.radio_player:
                    self.radio_player.release()
                self.radio_player = None
                return False, self.last_error
        else:
            msg = "Nie można uruchomić radia: brak URL strumienia lub błąd playlisty."
            logger.warning(msg)
            return False, msg


    def stop_radio(self):
        """Stops the radio stream playback."""
        if self.radio_player:
            try:
                if self.radio_player.is_playing():
                    self.radio_player.stop()
                    logger.info("Radio stopped.")
                self.radio_player.release() # Release resources
                self.radio_player = None
                return True, "Radio zatrzymane."
            except Exception as e:
                self.last_error = f"Błąd zatrzymywania radia VLC: {str(e)}"
                logger.error(self.last_error)
                self.radio_player = None # Ensure it's cleared even on error
                return False, self.last_error
        else:
            logger.info("Radio was not playing.")
            return True, "Radio nie było uruchomione."


    def play_audio(self, filename):
        """Plays a specific audio file with effects and ducking."""
        path = AUDIO_DIR / filename
        if not path.exists():
            self.last_error = f"Plik audio nie istnieje: {filename}"
            logger.error(self.last_error)
            return False, self.last_error

        try:
            logger.info(f"Loading audio file: {path}")
            audio = AudioSegment.from_file(path)

            # 1. Apply distortion simulation if enabled
            if self.config['distortion_simulation']['enabled']:
                logger.debug("Applying distortion simulation...")
                # Pass the 'degradation' part of the config to the function
                audio = degrade_audio(audio, self.config)

            # 2. Apply dynamic range compression
            comp_cfg = self.config['volumes']['compression']
            logger.debug(f"Applying compression: {comp_cfg}")
            audio = audio.compress_dynamic_range(
                threshold=comp_cfg.get('threshold', -20.0),
                ratio=comp_cfg.get('ratio', 4.0),
                attack=comp_cfg.get('attack', 5.0),
                release=comp_cfg.get('release', 50.0)
            )

            # 3. Adjust gain (Voice Volume * Master Volume)
            voice_vol = self.config['volumes'].get('voice', 1.0)
            master_vol = self.config['volumes'].get('master', 1.0)
            # Calculate gain in dB: Gain(dB) = 20 * log10(amplitude_ratio)
            # Avoid log10(0) errors
            total_gain_factor = max(0.001, voice_vol * master_vol) # Prevent factor <= 0
            gain_db = 20 * math.log10(total_gain_factor)
            logger.debug(f"Applying gain: {gain_db:.2f} dB (Voice: {voice_vol}, Master: {master_vol})")
            audio = audio.apply_gain(gain_db)

            # 4. Duck radio volume (fade out)
            radio_playing = self.radio_player and self.radio_player.is_playing()
            if radio_playing:
                logger.debug("Ducking radio volume...")
                current_radio_vol = self.config['volumes']['radio']
                duck_vol = self.config['volumes']['ducking']
                self._fade_radio_volume(current_radio_vol, duck_vol, duration=0.5) # Faster fade out

            # 5. Play the processed audio (blocking)
            logger.info(f"Playing processed audio: {filename}")
            play(audio)
            logger.info(f"Finished playing: {filename}")

            # 6. Restore radio volume (fade in)
            if radio_playing:
                logger.debug("Restoring radio volume...")
                current_radio_vol = self.config['volumes']['radio']
                duck_vol = self.config['volumes']['ducking']
                # Ensure fade starts from the actual ducked volume
                self._fade_radio_volume(duck_vol, current_radio_vol, duration=1.0) # Slower fade in

            return True, f"Odtworzono: {filename}"

        except FileNotFoundError:
             self.last_error = f"Błąd odtwarzania: Nie znaleziono pliku {path}"
             logger.error(self.last_error)
             return False, self.last_error
        except Exception as e:
            self.last_error = f"Błąd podczas odtwarzania pliku {filename}: {str(e)}"
            logger.error(f"{self.last_error}\n{traceback.format_exc()}")
            # Attempt to restore radio volume even if playback failed
            if self.radio_player and self.radio_player.is_playing():
                 current_radio_vol = self.config['volumes']['radio']
                 self._fade_radio_volume(self.config['volumes']['ducking'], current_radio_vol, duration=0.5)
            return False, self.last_error

    def _scheduler_loop(self):
        """The main loop for the scheduler thread."""
        logger.info("Scheduler thread started.")
        self._scheduler_running = True
        self._stop_scheduler_event.clear() # Ensure event is clear at start

        # Try starting radio immediately when scheduler starts
        radio_start_success, radio_start_msg = self.start_radio()
        if not radio_start_success:
            logger.warning(f"Scheduler starting, but radio failed to start: {radio_start_msg}")
            # Decide if scheduler should stop if radio fails? For now, continue.

        while not self._stop_scheduler_event.is_set():
            try:
                active_lines = [line for line in self.lines if line.get('active', False) and 'filename' in line]
                if not active_lines:
                    logger.debug("Scheduler loop: No active lines found. Waiting...")
                    # Wait for a shorter interval if no lines, check stop event more often
                    self._stop_scheduler_event.wait(30) # Check every 30 seconds
                    continue

                # Select a random active line
                line_to_play = random.choice(active_lines)
                logger.info(f"Scheduler selected line ID {line_to_play['id']}: '{line_to_play.get('text', '')[:50]}...'")

                # Ensure radio is still playing, try restarting if not
                if not self.radio_player or not self.radio_player.is_playing():
                     logger.warning("Radio not playing before playing line. Attempting restart...")
                     self.start_radio()
                     # Give it a moment to connect before ducking/playing
                     time.sleep(2)


                # Play the selected line
                success, msg = self.play_audio(line_to_play['filename'])
                if not success:
                    logger.error(f"Scheduler failed to play line ID {line_to_play['id']}: {msg}")
                    # Optional: Deactivate line on playback error?
                    # self.bulk_toggle_sync([line_to_play['id'] - 1], False)

                # Wait for the configured interval AFTER playing the line
                interval = float(self.config.get('radio', {}).get('interval', 300))
                logger.debug(f"Scheduler waiting for interval: {interval} seconds")
                # Use wait() on the event for the interval duration.
                # This allows the loop to exit quickly if stop() is called.
                self._stop_scheduler_event.wait(interval)

            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}\n{traceback.format_exc()}")
                # Avoid busy-looping on error, wait a bit before retrying
                self._stop_scheduler_event.wait(10) # Wait 10 seconds after an error

        # Loop exited (stop event was set)
        logger.info("Scheduler thread received stop signal. Stopping radio...")
        self.stop_radio()
        self._scheduler_running = False
        logger.info("Scheduler thread finished.")


    def start_scheduler(self):
        """Starts the scheduler in a separate thread."""
        if self._scheduler_thread is not None and self._scheduler_thread.is_alive():
            logger.warning("Scheduler is already running.")
            return False, "Scheduler już działa."

        # Clear the stop event before starting a new thread
        self._stop_scheduler_event.clear()
        self._scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self._scheduler_thread.start()
        # Give the thread a moment to set the _scheduler_running flag
        time.sleep(0.5)
        if self._scheduler_running:
             logger.info("Scheduler started successfully.")
             return True, "Scheduler uruchomiony."
        else:
             logger.error("Scheduler thread failed to start.")
             return False, "Nie udało się uruchomić wątku schedulera."


    def stop_scheduler(self):
        """Signals the scheduler thread to stop."""
        if self._scheduler_thread is None or not self._scheduler_thread.is_alive():
            logger.warning("Scheduler is not running.")
            # Ensure flag is false if thread is dead
            self._scheduler_running = False
            return False, "Scheduler nie jest uruchomiony."

        logger.info("Sending stop signal to scheduler thread...")
        self._stop_scheduler_event.set()
        # Wait for the thread to finish (with a timeout)
        self._scheduler_thread.join(timeout=10) # Wait up to 10 seconds

        if self._scheduler_thread.is_alive():
            logger.warning("Scheduler thread did not stop within timeout.")
            # The thread might be stuck, but the radio stop was attempted.
            # Force setting the flag.
            self._scheduler_running = False
            return False, "Scheduler nie zatrzymał się w wyznaczonym czasie (ale radio powinno być zatrzymane)."
        else:
            logger.info("Scheduler stopped successfully.")
            self._scheduler_running = False
            self._scheduler_thread = None # Clear the thread object
            return True, "Scheduler zatrzymany."

    def get_scheduler_status(self):
        """Returns the running status of the scheduler."""
        # Double check thread aliveness
        if self._scheduler_thread is not None and not self._scheduler_thread.is_alive():
             self._scheduler_running = False
             self._scheduler_thread = None
        return self._scheduler_running

    def get_lines(self):
        """Returns the list of all voice lines."""
        return self.lines

    def get_line_by_id(self, line_id):
        """Finds a voice line by its ID."""
        for line in self.lines:
            if line['id'] == line_id:
                return line
        return None

    def add_line(self, text):
        """Adds a new voice line, generates speech, and saves."""
        if not text:
            self.last_error = "Tekst linii nie może być pusty."
            return None, self.last_error

        filename, error = self.generate_speech(text)
        if filename:
            # Find the next available ID
            next_id = max([line['id'] for line in self.lines] + [0]) + 1
            new_line = {
                'id': next_id,
                'text': text,
                'filename': filename,
                'active': True # New lines are active by default
            }
            self.lines.append(new_line)
            self._save_lines()
            logger.info(f"Added new line with ID {next_id}")
            return new_line, None # Return the full new line object
        else:
            # self.last_error is already set by generate_speech
            return None, self.last_error

    def edit_line(self, line_id, new_text):
        """Edits the text of an existing line, regenerates speech, and saves."""
        if not new_text:
            self.last_error = "Nowy tekst linii nie może być pusty."
            return None, self.last_error

        line_index = -1
        for i, line in enumerate(self.lines):
            if line['id'] == line_id:
                line_index = i
                break

        if line_index != -1:
            old_filename = self.lines[line_index].get('filename')
            filename, error = self.generate_speech(new_text)
            if filename:
                # Remove old audio file if it exists and filename changed
                if old_filename and old_filename != filename:
                     old_path = AUDIO_DIR / old_filename
                     if old_path.exists():
                         try:
                             old_path.unlink()
                             logger.info(f"Removed old audio file: {old_filename}")
                         except OSError as e:
                             logger.warning(f"Could not remove old audio file {old_filename}: {e}")

                self.lines[line_index]['text'] = new_text
                self.lines[line_index]['filename'] = filename
                # Keep the existing 'active' status
                self._save_lines()
                logger.info(f"Edited line ID {line_id}")
                return self.lines[line_index], None # Return updated line
            else:
                # self.last_error is set by generate_speech
                return None, self.last_error
        else:
            self.last_error = f"Nie znaleziono linii o ID: {line_id}"
            return None, self.last_error


    def bulk_toggle_sync(self, indices_to_toggle, new_state=None):
        """
        Synchronous version of bulk_toggle used internally or when async context isn't available.
        Accepts list of zero-based indices.
        """
        changed_count = 0
        ids_changed = []
        for index in indices_to_toggle:
            if 0 <= index < len(self.lines):
                current_state = self.lines[index]['active']
                target_state = not current_state if new_state is None else new_state
                if self.lines[index]['active'] != target_state:
                    self.lines[index]['active'] = target_state
                    changed_count += 1
                    ids_changed.append(self.lines[index]['id'])

        if changed_count > 0:
            self._save_lines()
            logger.info(f"Toggled state for {changed_count} lines (IDs: {ids_changed}). New state: {new_state if new_state is not None else 'flipped'}")
        else:
            logger.info("No lines needed toggling for the given indices.")
        return changed_count


    def remove_lines_sync(self, indices_to_remove):
        """
        Synchronous version of remove_lines. Accepts list of zero-based indices.
        Removes lines and their associated audio files.
        """
        removed_count = 0
        ids_removed = []
        # Sort indices in descending order to avoid index shifting issues during deletion
        valid_indices = sorted([idx for idx in indices_to_remove if 0 <= idx < len(self.lines)], reverse=True)

        if not valid_indices:
             logger.warning("No valid line indices provided for removal.")
             return 0, []

        lines_to_keep = []
        all_lines_copy = self.lines[:] # Work on a copy

        for i, line in enumerate(all_lines_copy):
             if i not in valid_indices:
                 lines_to_keep.append(line)
             else:
                 # Line is being removed, try deleting audio file
                 filename = line.get('filename')
                 if filename:
                     path = AUDIO_DIR / filename
                     if path.exists():
                         try:
                             path.unlink()
                             logger.info(f"Removed audio file: {filename}")
                         except OSError as e:
                             logger.warning(f"Could not remove audio file {filename}: {e}")
                 removed_count += 1
                 ids_removed.append(line['id'])


        if removed_count > 0:
            # Re-index the remaining lines sequentially
            for new_idx, line in enumerate(lines_to_keep):
                line['id'] = new_idx + 1

            self.lines = lines_to_keep
            self._save_lines()
            logger.info(f"Removed {removed_count} lines (Original IDs: {sorted(ids_removed)}). Lines re-indexed.")
        else:
            logger.info("No lines were removed.")

        return removed_count, sorted(ids_removed)


    def parse_id_ranges(self, id_input):
        """Parses a string of IDs/ranges (e.g., "1, 3-5, 8") into a list of 0-based indices."""
        indices = set()
        max_id = len(self.lines)
        if not isinstance(id_input, str):
             logger.warning(f"Invalid input type for parse_id_ranges: {type(id_input)}")
             return []

        parts = id_input.replace(' ', '').split(',')

        for part in parts:
            if not part: continue # Skip empty parts

            if part.lower() in ('all', 'wszystkie'):
                # Return indices for all *currently existing* lines
                return list(range(max_id))

            if '-' in part:
                try:
                    start, end = map(int, part.split('-', 1))
                    if start <= end:
                         # Add valid indices within the range
                         indices.update(i - 1 for i in range(start, end + 1) if 1 <= i <= max_id)
                except ValueError:
                    logger.warning(f"Invalid range format: '{part}'")
                    continue # Skip invalid ranges
            elif part.isdigit():
                try:
                    line_id = int(part)
                    if 1 <= line_id <= max_id:
                        indices.add(line_id - 1) # Convert 1-based ID to 0-based index
                    else:
                         logger.warning(f"ID out of range: {line_id} (Max ID: {max_id})")
                except ValueError:
                     logger.warning(f"Invalid ID format: '{part}'")
            else:
                 logger.warning(f"Unrecognized part in ID input: '{part}'")

        return sorted(list(indices)) # Return sorted list of unique 0-based indices


    def update_settings(self, new_settings):
        """Updates the system configuration with new settings."""
        try:
            # Use the merge function to update only provided keys recursively
            updated_config = self._merge_configs(self.config, new_settings)

            # Basic validation (can be expanded with Pydantic models later if needed)
            # Example: Ensure volumes are floats/ints within reasonable ranges
            if not (0.0 <= updated_config['volumes']['master'] <= 2.0):
                raise ValueError("Głośność główna musi być między 0.0 a 2.0")
            if not (0.0 <= updated_config['volumes']['radio'] <= 1.0):
                 raise ValueError("Głośność radia musi być między 0.0 a 1.0")
            # ... add more validation as needed ...

            self.config = updated_config
            # Update runtime variables affected by config changes
            self.radio_volume = self.config['volumes']['radio']
            self.duck_volume = self.config['volumes']['ducking']

            # Apply volume change immediately if radio is playing
            if self.radio_player and self.radio_player.is_playing():
                 new_vol_int = max(0, min(100, int(self.radio_volume * 100)))
                 self.radio_player.audio_set_volume(new_vol_int)
                 logger.info(f"Applied new radio volume ({new_vol_int}) to playing stream.")

            self._save_config() # Save the updated config
            logger.info("Settings updated successfully.")
            return True, "Ustawienia zaktualizowane."
        except (ValueError, KeyError, TypeError) as e:
            self.last_error = f"Błąd aktualizacji ustawień: {str(e)}"
            logger.error(self.last_error)
            # Optionally revert to old config? For now, just report error.
            # self.config = self._load_config() # Revert by reloading
            return False, self.last_error
        except Exception as e:
             self.last_error = f"Nieoczekiwany błąd podczas aktualizacji ustawień: {str(e)}"
             logger.error(f"{self.last_error}\n{traceback.format_exc()}")
             return False, self.last_error

    def get_settings(self):
        """Returns the current configuration."""
        # Return a copy to prevent direct modification
        return self.config.copy()

    def cleanup(self):
        """Clean up resources like stopping scheduler and radio."""
        logger.info("Cleaning up VoiceSystem resources...")
        self.stop_scheduler()
        self.stop_radio()
        # Release VLC instance if necessary (though usually managed globally)
        # if self._vlc_instance:
        #     self._vlc_instance.release()
        #     self._vlc_instance = None
        logger.info("VoiceSystem cleanup complete.")


# --- Main execution block (for testing module directly) ---
if __name__ == "__main__":
    print("Testing VoiceSystem module...")
    vs = VoiceSystem()

    print("\n--- Initial Config ---")
    print(json.dumps(vs.get_settings(), indent=2))

    print("\n--- Initial Lines ---")
    print(json.dumps(vs.get_lines(), indent=2))

    # --- Example Usage (uncomment to test) ---
    # print("\n--- Adding Line ---")
    # new_line, err = vs.add_line("To jest testowa linia dodana z modułu.")
    # if new_line:
    #     print(f"Added line: {new_line}")
    #     print(json.dumps(vs.get_lines(), indent=2))
    #     added_id = new_line['id']

        # print("\n--- Editing Line ---")
        # updated_line, err = vs.edit_line(added_id, "To jest zedytowany tekst linii.")
        # if updated_line:
        #     print(f"Edited line: {updated_line}")
        #     print(json.dumps(vs.get_lines(), indent=2))

        # print("\n--- Toggling Line ---")
        # count = vs.bulk_toggle_sync([added_id - 1], new_state=False) # Toggle off using index
        # print(f"Toggled {count} lines.")
        # print(json.dumps(vs.get_lines(), indent=2))

        # print("\n--- Removing Line ---")
        # removed_count, removed_ids = vs.remove_lines_sync([added_id - 1]) # Remove using index
        # print(f"Removed {removed_count} lines (Original IDs: {removed_ids}).")
        # print(json.dumps(vs.get_lines(), indent=2))

    # else:
    #     print(f"Error adding line: {err}")


    # print("\n--- Testing Scheduler (will run for 10s) ---")
    # start_ok, msg = vs.start_scheduler()
    # print(msg)
    # if start_ok:
    #     time.sleep(10)
    #     stop_ok, msg = vs.stop_scheduler()
    #     print(msg)

    print("\n--- Testing Cleanup ---")
    vs.cleanup()
    print("Module test finished.")

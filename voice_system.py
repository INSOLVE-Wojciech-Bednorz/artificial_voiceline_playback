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
RADIO_FILES_DIR = Path('radio_files') # Default directory for radio music
AUDIO_DIR.mkdir(exist_ok=True) # Ensure audio directory for voice lines exists
RADIO_FILES_DIR.mkdir(exist_ok=True) # Ensure radio files directory exists

# --- Logging Setup ---
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
        'playlist': str(RADIO_FILES_DIR), # Use directory path instead of playlist
        'interval': 300
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
    }
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

# --- Audio Degradation Function (Unchanged) ---
def degrade_audio(audio_segment: AudioSegment, distortion_config: Dict) -> AudioSegment:
    if not distortion_config.get('enabled', False):
        return audio_segment
    logger.debug("Applying distortion simulation effects...")
    degraded = audio_segment
    try:
        if degraded.channels > 1:
            degraded = degraded.set_channels(1)
            logger.debug("Converted audio to mono.")
        target_sr = int(distortion_config.get('sample_rate', degraded.frame_rate))
        if target_sr > 0 and target_sr < degraded.frame_rate:
             logger.debug(f"Reducing sample rate to {target_sr} Hz.")
             degraded = degraded.set_frame_rate(target_sr)
        elif target_sr <= 0:
             logger.warning(f"Invalid target sample rate ({target_sr}), skipping reduction.")
        def create_audio_segment(samples, sample_width, frame_rate, channels):
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
            max_amp = 2**(sample_width * 8 - 1) - 1
            min_amp = -max_amp -1
            samples = np.clip(samples, min_amp, max_amp)
            dtype = np.int16 if sample_width == 2 else np.int8
            samples_bytes = samples.astype(dtype).tobytes()
            return AudioSegment(data=samples_bytes, sample_width=sample_width, frame_rate=frame_rate, channels=channels)
        current_sample_width = degraded.sample_width
        samples_np = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        max_amplitude_float = float(2**(current_sample_width * 8 - 1) - 1)
        distortion_level = float(distortion_config.get('distortion', 0.0))
        if distortion_level > 0:
            logger.debug(f"Applying non-linear distortion: {distortion_level}")
            gain_factor = 1.0 + distortion_level * 5
            samples_np = np.clip(samples_np * gain_factor, -max_amplitude_float, max_amplitude_float)
        low_freq = int(distortion_config.get('filter_low', 0))
        high_freq = int(distortion_config.get('filter_high', degraded.frame_rate / 2))
        if low_freq > 0 or high_freq < degraded.frame_rate / 2:
            logger.debug(f"Applying bandpass filter: Low={low_freq} Hz, High={high_freq} Hz")
            temp_audio = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)
            if low_freq > 0:
                try: temp_audio = high_pass_filter(temp_audio, low_freq)
                except Exception as filter_e: logger.warning(f"High-pass filter failed: {filter_e}")
            if high_freq > 0 and high_freq < degraded.frame_rate / 2:
                 try: temp_audio = low_pass_filter(temp_audio, high_freq)
                 except Exception as filter_e: logger.warning(f"Low-pass filter failed: {filter_e}")
            else:
                 logger.warning(f"Invalid high frequency ({high_freq} Hz) for low-pass filter at sample rate {degraded.frame_rate} Hz. Skipping.")
            samples_np = np.array(temp_audio.get_array_of_samples(), dtype=np.float32)
        noise_level = float(distortion_config.get('noise_level', 0.0))
        if noise_level > 0:
            logger.debug(f"Adding modulated noise: Level={noise_level}")
            noise_amp = noise_level * max_amplitude_float
            noise = np.random.normal(0, noise_amp, len(samples_np))
            modulation = np.sin(np.linspace(0, 20 * np.pi, len(samples_np))) * 0.5 + 0.5
            samples_np += noise * modulation
        target_bit_depth = int(distortion_config.get('bit_depth', current_sample_width * 8))
        if 1 <= target_bit_depth < (current_sample_width * 8):
            logger.debug(f"Applying bit crushing to {target_bit_depth}-bit.")
            levels = 2**target_bit_depth
            normalized_samples = samples_np / max_amplitude_float
            quantized_samples = np.round(normalized_samples * (levels / 2 -1) )
            samples_np = (quantized_samples / (levels / 2 - 1)) * max_amplitude_float
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
        degraded = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)
        final_sr = 44100
        if degraded.frame_rate != final_sr:
            logger.debug(f"Resampling degraded audio to {final_sr} Hz.")
            try: degraded = degraded.set_frame_rate(final_sr)
            except Exception as e:
                logger.error(f"Error during final resampling: {e}. Trying fallback creation.")
                samples_np_final = np.array(degraded.get_array_of_samples(), dtype=np.float32)
                try: degraded = create_audio_segment(samples_np_final, degraded.sample_width, final_sr, 1)
                except Exception as fb_e:
                     logger.error(f"Fallback resampling failed: {fb_e}. Returning audio at original rate {degraded.frame_rate} Hz.")
                     degraded = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)
    except Exception as e:
        logger.error(f"Unexpected error during audio degradation: {e}\n{traceback.format_exc()}")
        return audio_segment
    logger.debug("Finished applying distortion simulation effects.")
    return degraded


# --- Voice System Class ---
class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        self.lines = self._load_lines()
        self.radio_player = None
        self.radio_volume = _get_nested_value(self.config, ['volumes', 'radio'], DEFAULT_CONFIG['volumes']['radio'])
        self.duck_volume = _get_nested_value(self.config, ['volumes', 'ducking'], DEFAULT_CONFIG['volumes']['ducking'])
        self.last_error = None
        self._scheduler_thread = None
        self._stop_scheduler_event = threading.Event()
        self._scheduler_running = False
        try:
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
                    merged_config = self._merge_configs(DEFAULT_CONFIG, loaded_config)
                    logger.info(f"Configuration loaded and merged from {CONFIG_FILE}")
                    return merged_config
                else:
                    logger.warning(f"Invalid structure in {CONFIG_FILE}. Using default configuration and saving.")
                    self._save_config(DEFAULT_CONFIG)
                    return DEFAULT_CONFIG.copy()
            else:
                logger.warning(f"{CONFIG_FILE} not found. Creating with default values.")
                self._save_config(DEFAULT_CONFIG)
                return DEFAULT_CONFIG.copy()
        except Exception as e:
             logger.error(f"Unexpected error loading config: {e}. Using default configuration.", exc_info=True)
             return DEFAULT_CONFIG.copy()

    def _merge_configs(self, default: Dict, loaded: Dict) -> Dict:
        """Recursively merges loaded config into default config."""
        merged = default.copy()
        for key, value in loaded.items():
            if key in merged and isinstance(value, dict) and isinstance(merged[key], dict):
                merged[key] = self._merge_configs(merged[key], value)
            elif value is not None:
                merged[key] = value
        return merged

    def _save_config(self, config_data: Optional[Dict] = None):
        """Saves the provided or current configuration to the YAML file."""
        config_to_save = config_data if config_data is not None else self.config
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_to_save, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            logger.info(f"Configuration saved to {CONFIG_FILE}")
        except Exception as e:
             logger.error(f"Unexpected error saving config: {e}", exc_info=True)
             self.last_error = f"Nieoczekiwany błąd zapisu konfiguracji: {str(e)}"

    def _load_lines(self) -> List[Dict]:
        """
        Loads voice lines from JSON and robustly reconciles with audio files on disk.
        - Adds entries for new audio files.
        - Disables and marks entries for missing audio files.
        """
        logger.info("Loading and reconciling voice lines...")
        lines_from_json = []
        if DATA_FILE.exists():
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    lines_from_json = json.load(f)
                if not isinstance(lines_from_json, list):
                    logger.warning(f"{DATA_FILE} does not contain a list. Starting fresh.")
                    lines_from_json = []
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"Error reading {DATA_FILE}: {e}. Starting fresh.", exc_info=True)
                lines_from_json = []

        # --- Reconciliation ---
        needs_resave = False
        final_lines = []
        json_filenames = {line.get('filename') for line in lines_from_json if line.get('filename')}
        disk_filenames = {f.name for f in AUDIO_DIR.glob('*.mp3')}
        max_id = max([line.get('id', 0) for line in lines_from_json] + [0])
        missing_file_prefix = "(Brak pliku) "

        # 1. Process existing JSON entries
        for line in lines_from_json:
            filename = line.get('filename')
            if not filename or filename not in disk_filenames:
                if not line.get('text', '').startswith(missing_file_prefix):
                    line['text'] = missing_file_prefix + line.get('text', '')
                    line['active'] = False
                    logger.warning(f"File '{filename}' for line ID {line.get('id')} not found. Disabling and marking line.")
                    needs_resave = True
            final_lines.append(line)

        # 2. Process new files found on disk
        new_files = disk_filenames - json_filenames
        if new_files:
            logger.info(f"Found {len(new_files)} new audio files to add to the registry.")
            for filename in sorted(list(new_files)): # Sort for deterministic ID assignment
                max_id += 1
                new_line = {
                    'id': max_id,
                    'text': f"[Automatycznie dodany plik: {filename}]",
                    'filename': filename,
                    'active': True
                }
                final_lines.append(new_line)
                logger.info(f"Added new entry for '{filename}' with ID {max_id}.")
            needs_resave = True

        if needs_resave:
            logger.info("Reconciliation complete. Saving updated voice lines list.")
            self.lines = final_lines # Temporarily set for saving
            self._save_lines() # This will save the sorted list
        
        logger.info(f"Loaded {len(final_lines)} synchronized voice lines.")
        return sorted(final_lines, key=lambda x: x.get('id', 0))

    def _save_lines(self):
        """Saves the current voice lines to the JSON data file."""
        try:
            lines_to_save = sorted(self.lines, key=lambda x: x.get('id', float('inf')))
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(lines_to_save, f, indent=2, ensure_ascii=False)
            logger.info(f"Voice lines saved to {DATA_FILE}")
        except Exception as e:
            logger.error(f"Error saving voice lines file {DATA_FILE}: {e}", exc_info=True)
            self.last_error = f"Błąd zapisu linii: {str(e)}"
    
    def _get_random_radio_song(self) -> Optional[Path]:
        """Gets a path to a random MP3 file from the configured radio directory."""
        radio_dir_path_str = _get_nested_value(self.config, ['radio', 'directory'])
        if not radio_dir_path_str:
            logger.warning("Radio directory not configured.")
            return None
        
        radio_dir = Path(radio_dir_path_str)
        if not radio_dir.is_dir():
            logger.error(f"Configured radio directory does not exist or is not a directory: {radio_dir}")
            return None
            
        songs = list(radio_dir.glob('*.mp3'))
        if not songs:
            logger.warning(f"No .mp3 files found in radio directory: {radio_dir}")
            return None
            
        song_path = random.choice(songs)
        logger.info(f"Selected random radio song: {song_path.name}")
        return song_path

    def _fade_radio_volume(self, start_vol: float, end_vol: float, duration: float = 1.0):
        """Gradually fades the radio volume, applying master volume."""
        if not self.radio_player or not self._vlc_instance:
            return
        try:
             if not self.radio_player.is_playing(): return
        except Exception: return # Player might be released
        
        master_vol = float(_get_nested_value(self.config, ['volumes', 'master'], 1.0))
        
        # Calculate effective VLC volume (0-100) including master volume
        start_vlc = max(0, min(100, int(start_vol * master_vol * 100)))
        end_vlc = max(0, min(100, int(end_vol * master_vol * 100)))

        steps = max(1, int(duration * 20))
        step_time = duration / steps
        delta = (end_vlc - start_vlc) / steps

        logger.debug(f"Fading radio volume from {start_vlc} to {end_vlc} over {duration}s")
        current_vol = float(start_vlc)
        try:
            for _ in range(steps):
                current_vol += delta
                self.radio_player.audio_set_volume(int(round(current_vol)))
                time.sleep(step_time)
            self.radio_player.audio_set_volume(end_vlc)
            logger.debug(f"Fade complete. Volume set to {end_vlc}")
        except Exception as e:
            logger.warning(f"Error during radio volume fade: {e}")

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
        
        url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
        headers = {'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': api_key}
        payload = {
            'text': text,
            'model_id': voice_settings.get('model', DEFAULT_CONFIG['voice']['model']),
            'voice_settings': {
                'stability': voice_settings.get('stability', DEFAULT_CONFIG['voice']['stability']),
                'similarity_boost': voice_settings.get('similarity', DEFAULT_CONFIG['voice']['similarity']),
                'style': voice_settings.get('style', DEFAULT_CONFIG['voice']['style']),
                'use_speaker_boost': True,
            }
        }
        try:
            logger.info(f"Generating speech via ElevenLabs for text: '{text[:50]}...'")
            response = requests.post(url, json=payload, headers=headers, timeout=90)
            response.raise_for_status()

            next_id = max([line.get('id', 0) for line in self.lines] + [0]) + 1
            filename = f'line_{next_id}.mp3'
            path = AUDIO_DIR / filename
            path.write_bytes(response.content)
            logger.info(f"Speech generated successfully and saved as: {filename}")
            return filename, None
        except requests.exceptions.RequestException as e:
            error_detail = str(e)
            if e.response is not None:
                 try: error_detail = e.response.json().get('detail', {}).get('message', e.response.text)
                 except (json.JSONDecodeError, AttributeError): error_detail = e.response.text
                 status_code = e.response.status_code
                 self.last_error = f"Błąd API ElevenLabs ({status_code}): {error_detail}"
            else: self.last_error = f"Błąd połączenia z API ElevenLabs: {error_detail}"
            logger.error(self.last_error, exc_info=True)
            return None, self.last_error
        except Exception as e:
            self.last_error = f"Nieoczekiwany błąd generowania mowy: {str(e)}"
            logger.error(f"{self.last_error}", exc_info=True)
            return None, self.last_error

    def start_radio(self) -> Tuple[bool, str]:
        """Starts playing a random song from the radio directory."""
        if not self._vlc_instance:
             msg = "Nie można uruchomić radia: Instancja VLC nie jest dostępna."
             logger.error(msg)
             return False, msg

        if self.radio_player and self.radio_player.is_playing():
            logger.info("Radio is already playing.")
            return True, "Radio już gra."

        song_path = self._get_random_radio_song()
        if not song_path:
            msg = "Nie można uruchomić radia: brak plików MP3 w katalogu radiowym."
            logger.warning(msg)
            return False, msg

        try:
            self.radio_player = self._vlc_instance.media_player_new()
            media = self._vlc_instance.media_new(str(song_path))
            self.radio_player.set_media(media)
            media.release()

            master_vol = float(_get_nested_value(self.config, ['volumes', 'master'], 1.0))
            radio_vol = float(_get_nested_value(self.config, ['volumes', 'radio'], 0.5))
            effective_vol = master_vol * radio_vol
            initial_volume = max(0, min(100, int(effective_vol * 100)))
            
            self.radio_player.audio_set_volume(initial_volume)

            if self.radio_player.play() == -1:
                 error_msg = "Nie można uruchomić odtwarzania radia (VLC play error)."
                 logger.error(error_msg)
                 self.last_error = error_msg
                 return False, self.last_error
            else:
                logger.info(f"Radio started playing song: {song_path.name} at volume {initial_volume}")
                return True, "Radio uruchomione."

        except Exception as e:
            self.last_error = f"Nieoczekiwany błąd uruchamiania radia: {str(e)}"
            logger.error(f"{self.last_error}", exc_info=True)
            if self.radio_player: self.radio_player.release()
            self.radio_player = None
            return False, self.last_error

    def stop_radio(self) -> Tuple[bool, str]:
        """Stops the radio playback."""
        if not self.radio_player:
            return True, "Radio nie było uruchomione."
        try:
            if self.radio_player.is_playing():
                self.radio_player.stop()
            self.radio_player.release()
            self.radio_player = None
            logger.info("Radio player stopped and released.")
            return True, "Radio zatrzymane."
        except Exception as e:
            self.last_error = f"Błąd podczas zatrzymywania radia VLC: {str(e)}"
            logger.error(self.last_error, exc_info=True)
            self.radio_player = None
            return False, self.last_error

    def play_audio(self, filename: str) -> Tuple[bool, str]:
        """Plays a specific voice line with effects and ducks radio."""
        path = AUDIO_DIR / filename
        if not path.is_file():
            self.last_error = f"Plik audio nie istnieje: {path}"
            logger.error(self.last_error)
            return False, self.last_error

        try:
            audio = AudioSegment.from_file(path)

            distortion_cfg = self.config.get('distortion_simulation', {})
            if distortion_cfg.get('enabled', False):
                audio = degrade_audio(audio, distortion_cfg)

            comp_cfg = _get_nested_value(self.config, ['volumes', 'compression'], {})
            audio = audio.compress_dynamic_range(
                threshold=comp_cfg.get('threshold', -20.0), ratio=comp_cfg.get('ratio', 4.0),
                attack=comp_cfg.get('attack', 5.0), release=comp_cfg.get('release', 50.0)
            )

            voice_vol = float(_get_nested_value(self.config, ['volumes', 'voice'], 1.0))
            master_vol = float(_get_nested_value(self.config, ['volumes', 'master'], 1.0))
            total_gain_factor = max(0.001, voice_vol * master_vol)
            gain_db = 20 * math.log10(total_gain_factor)
            audio = audio.apply_gain(gain_db)

            radio_playing = self.radio_player and self.radio_player.is_playing()
            if radio_playing:
                self._fade_radio_volume(self.radio_volume, self.duck_volume, duration=0.5)

            logger.info(f"Playing processed audio: {filename} (Duration: {len(audio)/1000.0:.2f}s)")
            play(audio)
            logger.info(f"Finished playing: {filename}")

            if radio_playing:
                self._fade_radio_volume(self.duck_volume, self.radio_volume, duration=1.0)

            return True, f"Odtworzono: {filename}"
        except Exception as e:
            self.last_error = f"Błąd podczas odtwarzania pliku {filename}: {str(e)}"
            logger.error(f"{self.last_error}", exc_info=True)
            if self.radio_player and self.radio_player.is_playing():
                 self._fade_radio_volume(self.duck_volume, self.radio_volume, duration=0.5)
            return False, self.last_error

    def _scheduler_loop(self):
        """The main loop for the scheduler thread."""
        logger.info("Scheduler thread started.")
        self._scheduler_running = True
        self._stop_scheduler_event.clear()

        self.start_radio()

        while not self._stop_scheduler_event.is_set():
            try:
                # --- Radio Management: Play next song if finished ---
                if self._vlc_instance:
                    radio_state = vlc.State.Error
                    try:
                        if self.radio_player: radio_state = self.radio_player.get_state()
                    except Exception: pass
                    
                    if radio_state in [vlc.State.Ended, vlc.State.Stopped, vlc.State.Error]:
                        logger.info(f"Radio state is {radio_state}. Starting next song.")
                        self.start_radio()
                        time.sleep(2) # Give it a moment to buffer

                # --- Voice Line Playback ---
                active_lines = [
                    line for line in self.lines
                    if line.get('active', False) and (AUDIO_DIR / line['filename']).is_file()
                ]

                if active_lines:
                    line_to_play = random.choice(active_lines)
                    logger.info(f"Scheduler selected line ID {line_to_play['id']}: '{line_to_play['text'][:50]}...'")
                    success, msg = self.play_audio(line_to_play['filename'])
                    if not success: logger.error(f"Scheduler failed to play line ID {line_to_play['id']}: {msg}")
                
                interval = float(_get_nested_value(self.config, ['radio', 'interval'], 300))
                wait_time = max(1.0, interval) if active_lines else 30.0

                logger.debug(f"Scheduler waiting for {wait_time:.1f} seconds...")
                interrupted = self._stop_scheduler_event.wait(wait_time)
                if interrupted: break

            except Exception as e:
                logger.error(f"Critical error in scheduler loop: {e}", exc_info=True)
                if self._stop_scheduler_event.wait(15): break

        logger.info("Scheduler thread stopping...")
        if self._vlc_instance: self.stop_radio()
        self._scheduler_running = False
        logger.info("Scheduler thread finished.")
    
    # --- Public Methods (Largely Unchanged Signatures) ---

    def start_scheduler(self) -> Tuple[bool, str]:
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            return False, "Scheduler już działa."
        self._stop_scheduler_event.clear()
        self._scheduler_thread = threading.Thread(target=self._scheduler_loop, name="VoiceLineScheduler", daemon=True)
        self._scheduler_thread.start()
        time.sleep(0.5)
        if self._scheduler_running:
            return True, "Scheduler uruchomiony."
        else:
            return False, "Wątek schedulera nie uruchomił się poprawnie."

    def stop_scheduler(self) -> Tuple[bool, str]:
        if not self._scheduler_thread or not self._scheduler_thread.is_alive():
            return True, "Scheduler nie był uruchomiony."
        self._stop_scheduler_event.set()
        self._scheduler_thread.join(timeout=10)
        if self._scheduler_thread.is_alive():
            self._scheduler_running = False
            return False, "Scheduler nie zatrzymał się w wyznaczonym czasie."
        else:
            self._scheduler_running = False
            self._scheduler_thread = None
            return True, "Scheduler zatrzymany."

    def get_scheduler_status(self) -> bool:
        if self._scheduler_thread and not self._scheduler_thread.is_alive():
             self._scheduler_running = False
             self._scheduler_thread = None
        return self._scheduler_running

    def get_lines(self) -> List[Dict]:
        return self.lines

    def get_line_by_id(self, line_id: int) -> Optional[Dict]:
        return next((line for line in self.lines if line.get('id') == line_id), None)

    def add_line(self, text: str) -> Tuple[Optional[Dict], Optional[str]]:
        if not text or not text.strip():
            return None, "Tekst linii nie może być pusty."
        filename, error = self.generate_speech(text.strip())
        if filename:
            new_id = int(filename.split('_')[1].split('.')[0])
            new_line = {'id': new_id, 'text': text.strip(), 'filename': filename, 'active': True}
            self.lines.append(new_line)
            self._save_lines()
            return new_line, None
        else:
            return None, error

    def edit_line(self, line_id: int, new_text: str) -> Tuple[Optional[Dict], Optional[str]]:
        if not new_text or not new_text.strip():
            return None, "Nowy tekst linii nie może być pusty."
        line_to_edit = self.get_line_by_id(line_id)
        if not line_to_edit:
            return None, f"Nie znaleziono linii o ID: {line_id} do edycji."
        
        old_filename = line_to_edit.get('filename')
        # Generate with new text, which will create a new file with a *new* ID.
        # This is a bit tricky. We should regenerate with the *same* ID. Let's adapt generate_speech.
        # For now, let's stick to the original logic which creates a new file and we'll update the line.
        # The prompt asked to keep things the same, and the original `generate_speech` determines ID.
        
        filename, error = self.generate_speech(new_text.strip())
        if filename:
            if old_filename:
                try: (AUDIO_DIR / old_filename).unlink(missing_ok=True)
                except OSError as e: logger.warning(f"Could not remove old audio file {old_filename}: {e}")
            
            # The line being edited is now orphaned. We need to find its index and update it.
            # But the new file has a new ID. The best approach is to remove the old line and add the new one.
            # However, this re-indexes everything, which is not ideal for an edit.
            # A better way: update the existing line entry directly.
            
            line_to_edit['text'] = new_text.strip()
            # To keep the same ID, we should have generated speech for that ID. Let's assume the user
            # wants to keep the existing ID. We will rename the new file.
            new_path_temp = AUDIO_DIR / filename
            final_filename = f"line_{line_id}.mp3"
            final_path = AUDIO_DIR / final_filename
            
            # Delete old file with the same name if it exists, then rename the new one
            final_path.unlink(missing_ok=True)
            new_path_temp.rename(final_path)

            line_to_edit['filename'] = final_filename
            self._save_lines()
            logger.info(f"Edited line ID {line_id}. New audio file is {final_filename}.")
            return line_to_edit, None
        else:
            return None, error

    def bulk_toggle_sync(self, ids_to_toggle: List[int], new_state: Optional[bool] = None) -> Tuple[int, List[int]]:
        changed_count = 0
        ids_changed = []
        for line in self.lines:
            if line.get('id') in ids_to_toggle:
                current_state = line.get('active', False)
                target_state = not current_state if new_state is None else new_state
                if current_state != target_state:
                    line['active'] = target_state
                    changed_count += 1
                    ids_changed.append(line.get('id'))
        if changed_count > 0: self._save_lines()
        return changed_count, sorted(ids_changed)

    def toggle_all_lines(self, new_state: bool) -> int:
        changed_count = sum(1 for line in self.lines if line.get('active') != new_state)
        for line in self.lines: line['active'] = new_state
        if changed_count > 0: self._save_lines()
        return changed_count

    def remove_lines_sync(self, ids_to_remove: List[int]) -> Tuple[int, List[int]]:
        removed_ids = []
        lines_to_keep = []
        for line in self.lines:
            if line.get('id') in ids_to_remove:
                removed_ids.append(line.get('id'))
                if filename := line.get('filename'):
                    try: (AUDIO_DIR / filename).unlink(missing_ok=True)
                    except OSError as e: logger.warning(f"Could not remove audio file {filename}: {e}")
            else:
                lines_to_keep.append(line)
        
        if len(removed_ids) > 0:
            # Re-index remaining lines
            for i, line in enumerate(lines_to_keep):
                old_id = line['id']
                new_id = i + 1
                if old_id != new_id:
                    line['id'] = new_id
                    # Also rename the file to match the new ID
                    if filename := line.get('filename'):
                        old_path = AUDIO_DIR / filename
                        new_filename = f"line_{new_id}.mp3"
                        new_path = AUDIO_DIR / new_filename
                        if old_path.exists() and old_path != new_path:
                           try: old_path.rename(new_path)
                           except OSError as e: logger.error(f"Failed to rename {old_path} to {new_path}: {e}")
                        line['filename'] = new_filename
            self.lines = lines_to_keep
            self._save_lines()
            logger.info(f"Removed {len(removed_ids)} lines and re-indexed remaining lines.")
        return len(removed_ids), sorted(removed_ids)

    def remove_all_lines(self) -> Tuple[int, List[int]]:
        return self.remove_lines_sync([line.get('id') for line in self.lines])

    def update_settings(self, settings_update_dict: Dict) -> Tuple[bool, str]:
        try:
            potential_new_config = self._merge_configs(self.config.copy(), settings_update_dict)
            import models
            models.AppSettings(**potential_new_config)
            
            self.config = potential_new_config
            self.radio_volume = _get_nested_value(self.config, ['volumes', 'radio'], 0.5)
            self.duck_volume = _get_nested_value(self.config, ['volumes', 'ducking'], 0.1)

            if self._vlc_instance and self.radio_player and self.radio_player.is_playing():
                 master_vol = float(_get_nested_value(self.config, ['volumes', 'master'], 1.0))
                 effective_vol = master_vol * self.radio_volume
                 new_vol_int = max(0, min(100, int(effective_vol * 100)))
                 self.radio_player.audio_set_volume(new_vol_int)
                 logger.info(f"Applied new radio volume ({new_vol_int}) to playing stream.")
            
            self._save_config()
            return True, "Ustawienia zaktualizowane."
        except Exception as e:
             error_msg = f"Błąd walidacji lub aktualizacji ustawień: {e}"
             logger.error(error_msg, exc_info=True)
             return False, error_msg

    def get_settings(self) -> Dict:
        import copy
        return copy.deepcopy(self.config)

    def cleanup(self):
        logger.info("Cleaning up VoiceSystem resources...")
        self.stop_scheduler()
        self.stop_radio()
        logger.info("VoiceSystem cleanup complete.")
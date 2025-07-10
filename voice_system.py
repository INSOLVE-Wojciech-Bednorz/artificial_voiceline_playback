import json
import math
import random
import time
import traceback
import logging
import threading
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
import requests
import vlc
import yaml
from pydub import AudioSegment, exceptions as pydub_exceptions
from pydub.playback import play
import numpy as np
from pydub.effects import high_pass_filter, low_pass_filter

CONFIG_FILE = Path('config.yaml')
DATA_FILE = Path('voice_lines.json')
AUDIO_DIR = Path('audio_files')
AUDIO_DIR.mkdir(exist_ok=True)
RADIO_FILES_DIR = Path('radio_files')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

def _get_nested_value(data: Dict, keys: List[str], default: Any = None) -> Any:
    try:
        value = data
        for key in keys:
            value = value[key]
        return value
    except (KeyError, TypeError):
        return default

class RadioPlayer:
    def __init__(self, vlc_instance, config):
        self.vlc = vlc_instance
        self.config = config
        self.player = None
        self.current_file = None
        self.radio_files = []
        self._stop_event = threading.Event()
        self._thread = None
        self._load_radio_files()

    def start(self):
        if self._thread and self._thread.is_alive():
            return False, "Radio is already running"
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return True, "Radio playback started"

    def stop(self):
        self._stop_event.set()
        if self.player:
            self.player.stop()
        if self._thread:
            self._thread.join(timeout=2)
        self.player = None
        self._thread = None
        return True, "Radio stopped"

    def _load_radio_files(self):
        path_str = _get_nested_value(self.config, ['radio', 'playlist'])
        if not path_str:
            return [], "No radio directory configured"
        path = Path(path_str)
        try:
            self.radio_files = [f for f in path.glob('*.mp3') if f.is_file()]
            if not self.radio_files:
                return [], "No MP3 files found in radio directory"
            logger.info(f"[RADIO] Loaded {len(self.radio_files)} tracks")
            return self.radio_files, None
        except Exception as e:
            return [], f"Error loading radio files: {e}"

    def _run(self):
        while not self._stop_event.is_set():
            if not self.radio_files:
                files, error = self._load_radio_files()
                if error:
                    logger.error(f"[RADIO] {error}")
                    time.sleep(10)
                    continue

            file_path = random.choice(self.radio_files)
            self.current_file = file_path.name
            logger.info(f"[RADIO] Now playing: {self.current_file}")

            if self.player:
                self.player.release()
            
            try:
                media = self.vlc.media_new(str(file_path))
                self.player = self.vlc.media_player_new()
                self.player.set_media(media)
                media.release()
                
                vol = int(self.config['volumes']['radio'] * 100)
                self.player.audio_set_volume(vol)
                
                if self.player.play() == -1:
                    logger.error("[RADIO] Failed to start playback")
                    time.sleep(5)
                    continue

                while not self._stop_event.is_set():
                    time.sleep(0.5)
                    state = self.player.get_state()
                    if state in [vlc.State.Ended, vl.State.Stopped, vlc.State.Error]:
                        break

            except Exception as e:
                logger.error(f"[RADIO] Playback error: {e}")
                time.sleep(5)

class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        self.lines = self._load_lines()
        self._radio_player = None
        self.last_error = None
        self._scheduler_thread = None
        self._stop_scheduler_event = threading.Event()
        self._scheduler_running = False
        
        try:
            self._vlc_instance = vlc.Instance('--no-xlib --quiet')
            if self._vlc_instance:
                self._radio_player = RadioPlayer(self._vlc_instance, self.config)
            logger.info("VLC initialized")
        except Exception as e:
            logger.error(f"Failed to initialize VLC: {e}")
            self._vlc_instance = None

    def _load_config(self):
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    loaded_config = yaml.safe_load(f)
                if isinstance(loaded_config, dict):
                    return self._merge_configs(DEFAULT_CONFIG, loaded_config)
                else:
                    self._save_config(DEFAULT_CONFIG)
                    return DEFAULT_CONFIG.copy()
            else:
                self._save_config(DEFAULT_CONFIG)
                return DEFAULT_CONFIG.copy()
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return DEFAULT_CONFIG.copy()

    def _merge_configs(self, default, loaded):
        merged = default.copy()
        for key, value in loaded.items():
            if key in merged:
                if isinstance(value, dict) and isinstance(merged[key], dict):
                    merged[key] = self._merge_configs(merged[key], value)
                elif value is not None:
                    merged[key] = value
        return merged

    def _save_config(self, config_data=None):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_data or self.config, f)
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    def _load_lines(self):
        try:
            if DATA_FILE.exists():
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    lines = json.load(f)
                    if isinstance(lines, list):
                        return [line for line in lines if all(k in line for k in ['id', 'text', 'filename', 'active'])]
            return []
        except Exception as e:
            logger.error(f"Error loading lines: {e}")
            return []

    def _save_lines(self):
        try:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(sorted(self.lines, key=lambda x: x['id']), f, indent=2)
        except Exception as e:
            logger.error(f"Error saving lines: {e}")

    def _fade_radio_volume(self, start, end, duration=1.0):
        if not self._radio_player or not self._radio_player.player:
            return
            
        steps = max(1, int(duration * 10))
        step_time = duration / steps
        delta = (end - start) / steps
        current = start
        
        for _ in range(steps):
            current += delta
            self._radio_player.player.audio_set_volume(int(current * 100))
            time.sleep(step_time)
        self._radio_player.player.audio_set_volume(int(end * 100))

    def start_radio(self):
        if not self._radio_player:
            return False, "Radio not available"
        return self._radio_player.start()

    def stop_radio(self):
        if not self._radio_player:
            return True, "Radio not running"
        return self._radio_player.stop()

    def get_radio_status(self):
        if not self._radio_player:
            return {"status": "disabled", "current_file": None}
        return {
            "status": "playing" if self._radio_player._thread and self._radio_player._thread.is_alive() else "stopped",
            "current_file": self._radio_player.current_file
        }

    def generate_speech(self, text):
        api_key = self.config.get('api_key')
        voice_id = self.config.get('voice', {}).get('id')
        
        if not api_key or api_key == DEFAULT_CONFIG['api_key']:
            return None, "API key not configured"
        if not voice_id or voice_id == DEFAULT_CONFIG['voice']['id']:
            return None, "Voice ID not configured"

        try:
            url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
            headers = {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': api_key
            }

            payload = {
                'text': text,
                'model_id': self.config['voice'].get('model', DEFAULT_CONFIG['voice']['model']),
                'voice_settings': {
                    'stability': self.config['voice'].get('stability'),
                    'similarity_boost': self.config['voice'].get('similarity'),
                    'style': self.config['voice'].get('style'),
                    'use_speaker_boost': True
                }
            }

            response = requests.post(url, json=payload, headers=headers, timeout=90)
            response.raise_for_status()

            next_id = max([line.get('id', 0) for line in self.lines] + [0]) + 1
            filename = f'line_{next_id}.mp3'
            (AUDIO_DIR / filename).write_bytes(response.content)
            return filename, None

        except Exception as e:
            return None, str(e)

    def play_audio(self, filename):
        path = AUDIO_DIR / filename
        if not path.exists():
            return False, f"File not found: {filename}"

        try:
            audio = AudioSegment.from_file(path)
            
            if self.config['distortion_simulation'].get('enabled'):
                audio = degrade_audio(audio, self.config['distortion_simulation'])
            
            audio = audio.compress_dynamic_range(
                threshold=self.config['volumes']['compression']['threshold'],
                ratio=self.config['volumes']['compression']['ratio'],
                attack=self.config['volumes']['compression']['attack'],
                release=self.config['volumes']['compression']['release']
            )
            
            gain_db = 20 * math.log10(self.config['volumes']['voice'] * self.config['volumes']['master'])
            audio = audio.apply_gain(gain_db)

            if self._radio_player and self._radio_player.player:
                current_vol = self.config['volumes']['radio']
                duck_vol = self.config['volumes']['ducking']
                self._fade_radio_volume(current_vol, duck_vol, 0.3)

            logger.info(f"[VOICE] Playing: {filename}")
            play(audio)
            logger.info(f"[VOICE] Finished: {filename}")

            if self._radio_player and self._radio_player.player:
                current_vol = self.config['volumes']['radio']
                duck_vol = self.config['volumes']['ducking']
                self._fade_radio_volume(duck_vol, current_vol, 1.0)

            return True, f"Played: {filename}"

        except Exception as e:
            return False, str(e)

    def _scheduler_loop(self):
        logger.info("Scheduler started")
        self._scheduler_running = True
        self._stop_scheduler_event.clear()

        self.start_radio()

        while not self._stop_scheduler_event.is_set():
            try:
                active_lines = [line for line in self.lines if line.get('active') and (AUDIO_DIR / line['filename']).exists()]
                
                if not active_lines:
                    wait_time = 30.0
                else:
                    line = random.choice(active_lines)
                    logger.info(f"[VOICE] Selected: {line['text'][:50]}... (ID: {line['id']})")
                    
                    success, msg = self.play_audio(line['filename'])
                    if not success:
                        logger.error(f"[VOICE] Failed to play: {msg}")
                    
                    wait_time = float(self.config['radio'].get('interval', 300))

                interrupted = self._stop_scheduler_event.wait(wait_time)
                if interrupted:
                    break

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(15)

        self.stop_radio()
        self._scheduler_running = False
        logger.info("Scheduler stopped")

    def start_scheduler(self):
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            return False, "Scheduler already running"
        
        self._scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self._scheduler_thread.start()
        time.sleep(0.5)
        return True, "Scheduler started"

    def stop_scheduler(self):
        if not self._scheduler_thread:
            return True, "Scheduler not running"
            
        self._stop_scheduler_event.set()
        self._scheduler_thread.join(timeout=10)
        
        if self._scheduler_thread.is_alive():
            return False, "Scheduler didn't stop in time"
        return True, "Scheduler stopped"

    def get_scheduler_status(self):
        return self._scheduler_running

    def get_lines(self):
        return self.lines.copy()

    def get_line_by_id(self, line_id):
        return next((line for line in self.lines if line.get('id') == line_id), None)

    def add_line(self, text):
        if not text.strip():
            return None, "Text cannot be empty"
            
        filename, error = self.generate_speech(text.strip())
        if not filename:
            return None, error or "Failed to generate speech"
            
        new_id = int(filename.split('_')[1].split('.')[0])
        new_line = {
            'id': new_id,
            'text': text.strip(),
            'filename': filename,
            'active': True
        }
        
        self.lines.append(new_line)
        self._save_lines()
        return new_line, None

    def edit_line(self, line_id, new_text):
        line = self.get_line_by_id(line_id)
        if not line:
            return None, f"Line {line_id} not found"
            
        filename, error = self.generate_speech(new_text.strip())
        if not filename:
            return None, error or "Failed to generate speech"
            
        old_path = AUDIO_DIR / line['filename']
        if old_path.exists():
            try:
                old_path.unlink()
            except Exception as e:
                logger.warning(f"Could not delete old file: {e}")
                
        line['text'] = new_text.strip()
        line['filename'] = filename
        self._save_lines()
        return line, None

    def toggle_lines(self, line_ids, new_state=None):
        changed = 0
        for line in self.lines:
            if line['id'] in line_ids:
                target = not line['active'] if new_state is None else new_state
                if line['active'] != target:
                    line['active'] = target
                    changed += 1
                    
        if changed:
            self._save_lines()
        return changed

    def remove_lines(self, line_ids):
        removed = []
        line_ids = set(line_ids)
        
        for line in list(self.lines):
            if line['id'] in line_ids:
                path = AUDIO_DIR / line['filename']
                if path.exists():
                    try:
                        path.unlink()
                    except Exception as e:
                        logger.warning(f"Could not delete {path}: {e}")
                self.lines.remove(line)
                removed.append(line['id'])
                
        if removed:
            for i, line in enumerate(sorted(self.lines, key=lambda x: x['id'])):
                line['id'] = i + 1
            self._save_lines()
            
        return removed

    def update_settings(self, settings_update):
        try:
            updated = self._merge_configs(self.config, settings_update)
            import models
            models.AppSettings(**updated)
            
            self.config = updated
            if self._radio_player:
                self._radio_player.config = updated
                
            self._save_config()
            return True, "Settings updated"
        except Exception as e:
            return False, str(e)

    def get_settings(self):
        return self.config.copy()

    def cleanup(self):
        self.stop_scheduler()
        self.stop_radio()
        if hasattr(self, '_vlc_instance') and self._vlc_instance:
            self._vlc_instance.release()
        logger.info("Cleanup complete")

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

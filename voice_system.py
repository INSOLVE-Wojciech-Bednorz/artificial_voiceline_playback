# voice_system.py
import json
import logging
import math
import os
import random
import threading
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import requests
import vlc
import yaml
from pydub import AudioSegment
from pydub import exceptions as pydub_exceptions
from pydub.effects import high_pass_filter, low_pass_filter
from pydub.playback import play

# Configuration paths
CONFIG_FILE = Path('config.yaml')
DATA_FILE = Path('voice_lines.json')
AUDIO_DIR = Path('audio_files')
AUDIO_DIR.mkdir(exist_ok=True)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("voice_system.log"),
        logging.StreamHandler()
    ]
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
    """Safely get a nested value from a dictionary."""
    try:
        value = data
        for key in keys:
            value = value[key]
        return value
    except (KeyError, TypeError):
        return default

def degrade_audio(audio_segment: AudioSegment, distortion_config: Dict) -> AudioSegment:
    """Applies audio degradation effects based on config."""
    if not distortion_config.get('enabled', False):
        return audio_segment

    logger.debug("Applying distortion simulation effects...")
    degraded = audio_segment

    try:
        if degraded.channels > 1:
            degraded = degraded.set_channels(1)

        target_sr = int(distortion_config.get('sample_rate', degraded.frame_rate))
        if target_sr > 0 and target_sr < degraded.frame_rate:
            degraded = degraded.set_frame_rate(target_sr)

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

        current_sample_width = degraded.sample_width
        samples_np = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        max_amplitude_float = float(2**(current_sample_width * 8 - 1) - 1)

        distortion_level = float(distortion_config.get('distortion', 0.0))
        if distortion_level > 0:
            gain_factor = 1.0 + distortion_level * 5
            samples_np = np.clip(samples_np * gain_factor, -max_amplitude_float, max_amplitude_float)

        low_freq = int(distortion_config.get('filter_low', 0))
        high_freq = int(distortion_config.get('filter_high', degraded.frame_rate / 2))
        if low_freq > 0 or high_freq < degraded.frame_rate / 2:
            temp_audio = create_audio_segment(samples_np, current_sample_width, degraded.frame_rate, 1)
            if low_freq > 0:
                temp_audio = high_pass_filter(temp_audio, low_freq)
            if high_freq > 0 and high_freq < degraded.frame_rate / 2:
                temp_audio = low_pass_filter(temp_audio, high_freq)
            samples_np = np.array(temp_audio.get_array_of_samples(), dtype=np.float32)

        noise_level = float(distortion_config.get('noise_level', 0.0))
        if noise_level > 0:
            noise_amp = noise_level * max_amplitude_float
            noise = np.random.normal(0, noise_amp, len(samples_np))
            modulation = np.sin(np.linspace(0, 20 * np.pi, len(samples_np))) * 0.5 + 0.5
            samples_np += noise * modulation

        target_bit_depth = int(distortion_config.get('bit_depth', current_sample_width * 8))
        if 1 <= target_bit_depth < (current_sample_width * 8):
            levels = 2**target_bit_depth
            normalized_samples = samples_np / max_amplitude_float
            quantized_samples = np.round(normalized_samples * (levels / 2 -1))
            samples_np = (quantized_samples / (levels / 2 - 1)) * max_amplitude_float

        crackle_intensity = float(distortion_config.get('crackle', 0.0))
        if crackle_intensity > 0:
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
            degraded = degraded.set_frame_rate(final_sr)

        return degraded

    except Exception as e:
        logger.error(f"Error during audio degradation: {e}")
        return audio_segment

class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        self.lines = self._load_lines()
        self.radio_player = None
        self.last_error = None
        self._scheduler_thread = None
        self._stop_scheduler_event = threading.Event()
        self._scheduler_running = False
        
        try:
            self._vlc_instance = vlc.Instance('--no-xlib --quiet')
            logger.info("VLC instance initialized")
        except Exception as e:
            logger.error(f"Failed to initialize VLC: {e}")
            self._vlc_instance = None

    def _load_config(self) -> Dict:
        """Load and validate configuration."""
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    loaded_config = yaml.safe_load(f)
                if isinstance(loaded_config, dict):
                    return self._merge_configs(DEFAULT_CONFIG, loaded_config)
            self._save_config(DEFAULT_CONFIG)
            return DEFAULT_CONFIG.copy()
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return DEFAULT_CONFIG.copy()

    def _merge_configs(self, default: Dict, loaded: Dict) -> Dict:
        """Deep merge two config dictionaries."""
        merged = default.copy()
        for key, value in loaded.items():
            if key in merged:
                if isinstance(value, dict) and isinstance(merged[key], dict):
                    merged[key] = self._merge_configs(merged[key], value)
                elif value is not None:
                    merged[key] = value
        return merged

    def _save_config(self, config_data: Optional[Dict] = None):
        """Save configuration to file."""
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_data or self.config, f)
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    def _load_lines(self) -> List[Dict]:
        """Load and validate voice lines."""
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
        """Save voice lines to file."""
        try:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(sorted(self.lines, key=lambda x: x['id']), f, indent=2)
        except Exception as e:
            logger.error(f"Error saving lines: {e}")

    def _fade_radio_volume(self, start_vol: float, end_vol: float, duration: float = 1.0):
        """Gradually fade radio volume."""
        if not self.radio_player:
            return

        steps = max(1, int(duration * 10))
        step_time = duration / steps
        delta = (end_vol - start_vol) / steps
        current = start_vol

        for _ in range(steps):
            current += delta
            self.radio_player.audio_set_volume(int(current * 100))
            time.sleep(step_time)
        self.radio_player.audio_set_volume(int(end_vol * 100))

    def generate_speech(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Generate speech using ElevenLabs API."""
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

    def start_radio(self) -> Tuple[bool, str]:
        """Start radio playback."""
        if not self._vlc_instance:
            return False, "VLC not available"

        if self.radio_player:
            return True, "Radio already running"

        playlist_path = self.config['radio'].get('playlist')
        if not playlist_path:
            return False, "No playlist configured"

        try:
            if not os.path.isdir(playlist_path):
                return False, f"Radio directory does not exist: {playlist_path}"

            files = [f for f in Path(playlist_path).glob('*.mp3') if f.is_file()]
            if not files:
                return False, "No MP3 files found in radio directory"

            self.radio_player = self._vlc_instance.media_player_new()
            file_path = random.choice(files)
            media = self._vlc_instance.media_new(str(file_path))
            self.radio_player.set_media(media)
            
            vol = int(self.config['volumes']['radio'] * 100)
            self.radio_player.audio_set_volume(vol)

            if self.radio_player.play() == -1:
                self.radio_player.release()
                self.radio_player = None
                return False, "Failed to start playback"
            
            return True, f"Playing: {file_path.name}"

        except Exception as e:
            if self.radio_player:
                self.radio_player.release()
                self.radio_player = None
            return False, str(e)

    def stop_radio(self) -> Tuple[bool, str]:
        """Stop radio playback."""
        if not self.radio_player:
            return True, "Radio not running"

        try:
            self.radio_player.stop()
            self.radio_player.release()
            self.radio_player = None
            return True, "Radio stopped"
        except Exception as e:
            return False, str(e)

    def play_audio(self, filename: str) -> Tuple[bool, str]:
        """Play an audio file with effects."""
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

            if self.radio_player:
                current_vol = self.config['volumes']['radio']
                duck_vol = self.config['volumes']['ducking']
                self._fade_radio_volume(current_vol, duck_vol, 0.3)

            play(audio)

            if self.radio_player:
                current_vol = self.config['volumes']['radio']
                duck_vol = self.config['volumes']['ducking']
                self._fade_radio_volume(duck_vol, current_vol, 1.0)

            return True, f"Played: {filename}"

        except Exception as e:
            return False, str(e)

    def _scheduler_loop(self):
        """Main scheduler loop."""
        self._scheduler_running = True
        self._stop_scheduler_event.clear()

        while not self._stop_scheduler_event.is_set():
            try:
                active_lines = [line for line in self.lines if line.get('active') and (AUDIO_DIR / line['filename']).exists()]
                
                if not active_lines:
                    wait_time = 30.0
                else:
                    line = random.choice(active_lines)
                    self.play_audio(line['filename'])
                    wait_time = float(self.config['radio'].get('interval', 300))

                self._stop_scheduler_event.wait(wait_time)

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(15)

        self._scheduler_running = False

    def start_scheduler(self) -> Tuple[bool, str]:
        """Start the scheduler."""
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            return False, "Scheduler already running"
        
        self._scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self._scheduler_thread.start()
        return True, "Scheduler started"

    def stop_scheduler(self) -> Tuple[bool, str]:
        """Stop the scheduler."""
        if not self._scheduler_thread:
            return True, "Scheduler not running"
            
        self._stop_scheduler_event.set()
        self._scheduler_thread.join(timeout=10)
        return True, "Scheduler stopped"

    def get_scheduler_status(self) -> bool:
        """Get scheduler running status."""
        return self._scheduler_running

    def get_lines(self) -> List[Dict]:
        """Get all voice lines."""
        return self.lines.copy()

    def get_line_by_id(self, line_id: int) -> Optional[Dict]:
        """Get a voice line by ID."""
        return next((line for line in self.lines if line.get('id') == line_id), None)

    def add_line(self, text: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Add a new voice line."""
        if not text.strip():
            return None, "Text cannot be empty"
            
        filename, error = self.generate_speech(text.strip())
        if not filename:
            return None, error

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

    def edit_line(self, line_id: int, new_text: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Edit an existing voice line."""
        line = self.get_line_by_id(line_id)
        if not line:
            return None, f"Line {line_id} not found"
            
        filename, error = self.generate_speech(new_text.strip())
        if not filename:
            return None, error
            
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

    def toggle_lines(self, line_ids: List[int], new_state: Optional[bool] = None) -> Tuple[int, List[int]]:
        """Toggle active state of lines."""
        changed = 0
        ids_changed = []
        
        for line in self.lines:
            if line['id'] in line_ids:
                target = not line['active'] if new_state is None else new_state
                if line['active'] != target:
                    line['active'] = target
                    changed += 1
                    ids_changed.append(line['id'])
                    
        if changed:
            self._save_lines()
        return changed, ids_changed

    def remove_lines(self, line_ids: List[int]) -> Tuple[int, List[int]]:
        """Remove voice lines."""
        removed = []
        files_to_delete = []
        
        for line in list(self.lines):
            if line['id'] in line_ids:
                files_to_delete.append(AUDIO_DIR / line['filename'])
                self.lines.remove(line)
                removed.append(line['id'])
                
        for path in files_to_delete:
            try:
                path.unlink()
            except Exception as e:
                logger.warning(f"Could not delete {path}: {e}")
                
        if removed:
            for i, line in enumerate(self.lines):
                line['id'] = i + 1
            self._save_lines()
            
        return len(removed), removed

    def update_settings(self, settings_update: Dict) -> Tuple[bool, str]:
        """Update system settings."""
        try:
            self.config = self._merge_configs(self.config, settings_update)
            self._save_config()
            return True, "Settings updated"
        except Exception as e:
            return False, str(e)

    def get_settings(self) -> Dict:
        """Get current settings."""
        return self.config.copy()

    def cleanup(self):
        """Clean up resources."""
        self.stop_scheduler()
        self.stop_radio()
        if hasattr(self, '_vlc_instance') and self._vlc_instance:
            self._vlc_instance.release()

if __name__ == "__main__":
    vs = VoiceSystem()
    print("VoiceSystem initialized")
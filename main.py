import json
import math
import random
import time
import traceback
from pathlib import Path

import numpy as np
import requests
import vlc
import yaml
from pydub import AudioSegment
from pydub.playback import play

# Configuration
CONFIG_FILE = 'config.yaml'
DATA_FILE = 'voice_lines.json'
AUDIO_DIR = Path('audio_files')
AUDIO_DIR.mkdir(exist_ok=True)

class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        self.lines = self._load_lines()
        self.radio_player = None
        self.radio_volume = self.config['radio']['volume']
        self.duck_volume = self.config['radio']['duck_volume']
        self.sample_rate = 44100
        
    def _load_config(self):
        with open(CONFIG_FILE) as f:
            return yaml.safe_load(f)

    def _load_lines(self):
        try:
            with open(DATA_FILE) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def _save_lines(self):
        with open(DATA_FILE, 'w') as f:
            json.dump(self.lines, f, indent=2)

    def _parse_playlist(self, path):
        try:
            if path.endswith('.m3u'):
                with open(path, 'r', encoding='utf-8') as f:
                    return [line.strip() for line in f if line.startswith('http')]
            elif path.endswith('.pls'):
                with open(path, 'r', encoding='utf-8') as f:
                    return [line.split('=')[1].strip() for line in f if line.lower().startswith('file')]
            return []
        except Exception as e:
            print(f"Playlist error: {str(e)}")
            return []

    def _get_stream_url(self):
        if self.config['radio']['playlist']:
            urls = self._parse_playlist(self.config['radio']['playlist'])
            return urls[0] if urls else ''
        return ''
    
    def _fade_radio_volume(self, start_vol, end_vol, duration=0.5):
        if not self.radio_player:
            return
        
        steps = 20  # More steps for smoother fade
        step_time = duration / steps
        delta = (end_vol - start_vol) / steps
        
        current_vol = start_vol
        for _ in range(steps):
            current_vol += delta
            self.radio_player.audio_set_volume(int(current_vol * 100))
            time.sleep(step_time)

    def generate_speech(self, text):
        url = f'https://api.elevenlabs.io/v1/text-to-speech/{self.config["voice"]["id"]}'
        headers = {'xi-api-key': self.config['api_key']}
        
        data = {
            'text': text,
            'model_id': self.config['voice']['model'],
            'voice_settings': {
                'stability': self.config['voice']['stability'],
                'similarity_boost': self.config['voice']['similarity'],
                'style': self.config['voice']['style'],
                'use_speaker_boost': True,
                'speed': self.config['voice']['speed']
            }
        }

        try:
            response = requests.post(url, json=data, headers=headers)
            if response.ok:
                filename = f'line_{len(self.lines)+1}.mp3'
                path = AUDIO_DIR / filename
                path.write_bytes(response.content)
                return filename
            return None
        except Exception as e:
            print(f"Generation error: {str(e)}")
            return None

    def start_radio(self):
        if not self.radio_player:
            stream_url = self._get_stream_url()
            if stream_url:
                self.radio_player = vlc.MediaPlayer(stream_url)
                self.radio_player.audio_set_volume(int(self.radio_volume * 100))
                self.radio_player.play()

    def stop_radio(self):
        if self.radio_player:
            self.radio_player.stop()
            self.radio_player = None

    def play_audio(self, filename):
        path = AUDIO_DIR / filename
        if path.exists():
            try:
                # Load audio
                audio = AudioSegment.from_file(path)
                
                # Apply degradation and compression only if enabled
                if self.config['degradation'].get('enabled', True):
                    audio = degrade_audio(audio, self.config)  # Apply degradation
                    # Apply compression (part of degradation toggle)
                    comp = self.config['voice']['compression']
                    audio = audio.compress_dynamic_range(
                        threshold=comp['threshold'],
                        ratio=comp['ratio'],
                        attack=comp['attack'],
                        release=comp['release']
                    )
                
                # Volume adjustment (always applied)
                if self.config['voice']['volume'] != 1.0:
                    gain_db = 20 * math.log10(self.config['voice']['volume'])
                    audio = audio.apply_gain(gain_db)
                
                # Handle radio ducking
                if self.radio_player:
                    self._fade_radio_volume(self.radio_volume, self.duck_volume)
                play(audio)
                if self.radio_player:
                    self._fade_radio_volume(self.duck_volume, self.radio_volume)
            except Exception as e:
                print(f"Playback error: {str(e)}")
                traceback.print_exc()
        else:
            print(f"Missing file: {filename}")

    def run_scheduler(self):
        self.start_radio()
        try:
            while True:
                active_lines = [line for line in self.lines if line['active']]
                for line in active_lines:
                    print(f"Playing: {line['text']}")
                    self.play_audio(line['filename'])
                    # Wait the interval after each line
                    time.sleep(self.config['radio']['interval'])
        except KeyboardInterrupt:
            self.stop_radio()

    # Management functions
    def add_line(self, text):
        if filename := self.generate_speech(text):
            self.lines.append({
                'id': len(self.lines)+1,
                'text': text,
                'filename': filename,
                'active': True
            })
            self._save_lines()
            return True
        return False

    def edit_line(self, line_id, new_text):
        if 0 <= line_id < len(self.lines):
            if filename := self.generate_speech(new_text):
                self.lines[line_id]['text'] = new_text
                self.lines[line_id]['filename'] = filename
                self._save_lines()
                return True
        return False

    def remove_line(self, line_id):
        if 0 <= line_id < len(self.lines):
            del self.lines[line_id]
            self._save_lines()
            return True
        return False

    def toggle_line(self, line_id):
        if 0 <= line_id < len(self.lines):
            self.lines[line_id]['active'] = not self.lines[line_id]['active']
            self._save_lines()
            return True
        return False

def degrade_audio(audio_segment, config):
    """
    Enhanced audio degradation using pydub and numpy with perceptible effects
    """
    from pydub import AudioSegment
    from pydub.effects import low_pass_filter, high_pass_filter
    import numpy as np
    import random

    degraded = audio_segment

    # 1. Force mono conversion first
    degraded = degraded.set_channels(1)

    # 2. Sample rate reduction
    if 'sample_rate' in config['degradation']:
        target_sr = config['degradation']['sample_rate']
        degraded = degraded.set_frame_rate(target_sr)

    # Helper function to safely create AudioSegments
    def create_audio_segment(samples, sample_width, frame_rate, channels):
        # Ensure no NaN or inf values
        samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
        # Clip to valid range for the target sample width
        max_amp = 2**(sample_width * 8 - 1) - 1
        samples = np.clip(samples, -max_amp, max_amp)
        return AudioSegment(
            data=samples.astype(np.int16).tobytes(),
            sample_width=sample_width,
            frame_rate=frame_rate,
            channels=channels
        )
    
    # 3. Nonlinear distortion
    if 'distortion' in config['degradation']:
        samples = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        max_amp = 2**(degraded.sample_width * 8 - 1) - 1
        samples = np.clip(samples * (1 + config['degradation']['distortion']), -max_amp, max_amp)
        degraded = create_audio_segment(
            samples,
            sample_width=2,  # 16-bit = 2 bytes
            frame_rate=degraded.frame_rate,
            channels=1
        )

    # 4. Bandpass filtering
    if 'filter_low' in config['degradation'] and 'filter_high' in config['degradation']:
        low = config['degradation']['filter_low']
        high = config['degradation']['filter_high']
        degraded = high_pass_filter(degraded, low)
        degraded = low_pass_filter(degraded, high)
        degraded = high_pass_filter(degraded, low)

    # 5. Modulated noise
    if 'noise_level' in config['degradation']:
        samples = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        max_amp = 2**(degraded.sample_width * 8 - 1) - 1
        noise = np.random.normal(0, config['degradation']['noise_level'] * max_amp, len(samples))
        modulation = np.sin(np.linspace(0, 50*np.pi, len(samples))) * 0.5 + 0.5
        samples = np.clip(samples + noise * modulation, -max_amp, max_amp)
        degraded = create_audio_segment(
            samples,
            sample_width=2,
            frame_rate=degraded.frame_rate,
            channels=1
        )

    # 6. Bit crushing
    if 'bit_depth' in config['degradation']:
        bit_depth = config['degradation']['bit_depth']
        samples = np.array(degraded.get_array_of_samples(), dtype=np.float32)
        scale = (2**bit_depth) / (2**16)
        dither = np.random.uniform(-0.5, 0.5, len(samples))
        samples = np.round((samples + dither) * scale).astype(np.int32) / scale
        degraded = create_audio_segment(
            samples,
            sample_width=2,
            frame_rate=degraded.frame_rate,
            channels=1
        )

    # 7. Crackle effect
    if 'crackle' in config['degradation'] and config['degradation']['crackle'] > 0:
        samples = np.array(degraded.get_array_of_samples(), dtype=np.int32)
        max_amp = 2**(degraded.sample_width * 8 - 1) - 1
        density = int(len(samples) / 500 * config['degradation']['crackle'])
        
        for _ in range(density):
            pos = random.randint(0, len(samples)-50)
            length = random.randint(10, 50)
            amp = random.uniform(0.5, 1.0) * max_amp
            samples[pos:pos+length] += (np.sin(np.linspace(0, np.pi, length)) * amp).astype(np.int32)
        
        degraded = create_audio_segment(
            np.clip(samples, -max_amp, max_amp),
            sample_width=2,
            frame_rate=degraded.frame_rate,
            channels=1
        )

    # 8. Final resampling with explicit format conversion
    try:
        degraded = degraded.set_frame_rate(8000).set_frame_rate(44100)
    except ValueError:
        # Fallback conversion if format issues persist
        samples = np.array(degraded.get_array_of_samples())
        degraded = create_audio_segment(
            samples,
            sample_width=degraded.sample_width,
            frame_rate=44100,
            channels=1
        )

    return degraded

def main():
    vs = VoiceSystem()
    
    while True:
        print("\nVoice Line Manager")
        print("1. Add line 2. Edit line 3. Remove line")
        print("4. Toggle line 5. List lines 6. Start scheduler")
        print("7. Set interval 8. Set volumes 0. Exit")
        
        choice = input("Choice: ")
        
        if choice == '1':
            text = input("Text: ")
            print("Success!" if vs.add_line(text) else "Failed!")
        elif choice == '2':
            line_id = int(input("Line ID: "))-1
            new_text = input("New text: ")
            print("Updated!" if vs.edit_line(line_id, new_text) else "Failed!")
        elif choice == '3':
            line_id = int(input("Line ID: "))-1
            print("Removed!" if vs.remove_line(line_id) else "Failed!")
        elif choice == '4':
            line_id = int(input("Line ID: "))-1
            print("Toggled!" if vs.toggle_line(line_id) else "Failed!")
        elif choice == '5':
            for line in vs.lines:
                status = "Active" if line['active'] else "Inactive"
                print(f"{line['id']}: {status} - {line['text']}")
        elif choice == '6':
            vs.run_scheduler()
        elif choice == '7':
            vs.config['radio']['interval'] = int(input("Minutes: ")) * 60
            print("Interval set!")
        elif choice == '8':
            vs.radio_volume = float(input("Radio volume (0-1): "))
            vs.duck_volume = float(input("Duck volume (0-1): "))
            print("Volumes set!")
        elif choice == '0':
            vs.stop_radio()
            print("Exiting")
            break

if __name__ == "__main__":
    main()
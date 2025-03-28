import json
import math
import random
import shutil
import textwrap
import time
import traceback
from itertools import zip_longest
from pathlib import Path

import requests
import vlc
import yaml
from pydub import AudioSegment
from pydub.playback import play

CONFIG_FILE = 'config.yaml'
DATA_FILE = 'voice_lines.json'
AUDIO_DIR = Path('audio_files')
AUDIO_DIR.mkdir(exist_ok=True)

class VoiceSystem:
    def __init__(self):
        self.config = self._load_config()
        self.lines = self._load_lines()
        self.radio_player = None
        self.radio_volume = self.config['volumes']['radio']
        self.duck_volume = self.config['volumes']['ducking']
        self.last_error = None

    def _load_config(self):
        with open(CONFIG_FILE) as f:
            return yaml.safe_load(f)

    def _save_config(self):
        with open(CONFIG_FILE, 'w') as f:
            yaml.safe_dump(self.config, f)

    def _load_lines(self):
        try:
            with open(DATA_FILE) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            self.last_error = f"Błąd ładowania linii: {str(e)}"
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
            self.last_error = f"Błąd playlisty: {str(e)}"
            return []

    def _get_stream_url(self):
        if self.config['radio']['playlist']:
            urls = self._parse_playlist(self.config['radio']['playlist'])
            return urls[0] if urls else ''
        return ''

    def _fade_radio_volume(self, start_vol, end_vol, duration=4.0):
        if not self.radio_player:
            return
        
        steps = 40
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
            'model_id': self.config["voice"]["model"],
            'voice_settings': {
                'stability': self.config["voice"]["stability"],
                'similarity_boost': self.config["voice"]["similarity"],
                'style': self.config["voice"]["style"],
                'use_speaker_boost': True,
                'speed': self.config["voice"]["speed"]
            }
        }

        try:
            response = requests.post(url, json=data, headers=headers)
            if response.ok:
                filename = f'line_{len(self.lines)+1}.mp3'
                path = AUDIO_DIR / filename
                path.write_bytes(response.content)
                return filename, None
            self.last_error = f"Błąd {response.status_code}: {response.text}"
            return None, self.last_error
        except Exception as e:
            self.last_error = f"Błąd generowania mowy: {str(e)}"
            return None, self.last_error

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
        """Odtwarzanie pliku audio z zastosowaniem wszystkich efektów i ustawień"""
        path = AUDIO_DIR / filename
        if path.exists():
            try:
                audio = AudioSegment.from_file(path)
                
                # 1. Zastosowanie symulacji zniekształceń jeśli włączone
                if self.config['distortion_simulation']['enabled']:
                    audio = self.degrade_audio(audio, self.config)
                    
                # 2. Kompresja dynamiki
                comp = self.config['volumes']['compression']
                audio = audio.compress_dynamic_range(
                    threshold=comp['threshold'],
                    ratio=comp['ratio'],
                    attack=comp['attack'],
                    release=comp['release']
                )
                
                # 3. Regulacja głośności (głos * master)
                gain_db = 20 * math.log10(self.config['volumes']['voice'] * self.config['volumes']['master'])
                audio = audio.apply_gain(gain_db)
                
                # 4. Ducking radia
                if self.radio_player:
                    self._fade_radio_volume(
                        self.config['volumes']['radio'], 
                        self.config['volumes']['ducking']
                    )
                    
                play(audio)
                
                # 5. Przywrócenie głośności radia
                if self.radio_player:
                    self._fade_radio_volume(
                        self.config['volumes']['ducking'], 
                        self.config['volumes']['radio']
                    )
                    
            except Exception as e:
                self.last_error = f"Błąd odtwarzania: {str(e)}"
                traceback.print_exc()
        else:
            self.last_error = f"Brak pliku: {filename}"

    def run_scheduler(self):
        self.start_radio()
        try:
            while True:
                active_lines = [line for line in self.lines if line['active']]
                for line in random.sample(active_lines, len(active_lines)):
                    print(f"Odtwarzam: {line['text']}")
                    self.play_audio(line['filename'])
                    time.sleep(self.config['radio']['interval'])
        except KeyboardInterrupt:
            self.stop_radio()
            print("\nPowrót do menu...")

    def display_in_categories(self):
        term_width = shutil.get_terminal_size().columns
        
        # Prepare sections with wrapped text
        def format_section(lines, title):
            print("_" * term_width)
            print(f"\n{title}:")
            if not lines:
                print("(brak)")
                return
                
            for line in lines:
                print(f"{line['id']:3}. ", end="")
                # Print first line
                first_line = textwrap.shorten(line['text'], width=term_width-5, placeholder="")
                print(first_line)
                # Print remaining wrapped lines (if any)
                remaining = line['text'][len(first_line):]
                for wrapped in textwrap.wrap(remaining, width=term_width-5):
                    print("     " + wrapped)

        # Display sections
        format_section([line for line in self.lines if not line['active']], "NIEAKTYWNE")
        format_section([line for line in self.lines if line['active']], "AKTYWNE")

    def display_in_columns(self):
        term_width = shutil.get_terminal_size().columns
        sep = " │ "
        col_width = (term_width - len(sep)) // 2
        
        # Prepare left and right columns
        left_lines = []
        right_lines = []
        
        for line in self.lines:
            target = right_lines if line['active'] else left_lines
            wrapped = textwrap.wrap(line['text'], width=col_width-5)
            if not wrapped:
                wrapped = [""]
            target.append(f"{line['id']:3}. {wrapped[0]}")
            for extra in wrapped[1:]:
                target.append(f"     {extra}")

        # Print header and lines
        print("\n" + "NIEAKTYWNE".center(col_width) + sep + "AKTYWNE".center(col_width))
        for left, right in zip_longest(left_lines, right_lines, fillvalue=""):
            print(f"{left.ljust(col_width)}{sep}{right.ljust(col_width)}")


    def parse_id_ranges(self, input_str):
        ids = set()
        parts = input_str.replace(' ', '').split(',')
        
        for part in parts:
            if '-' in part:
                try:
                    start, end = map(int, part.split('-'))
                    ids.update(range(start, end+1))
                except:
                    continue
            elif part.lower() in ('all', 'wszystkie'):
                return list(range(1, len(self.lines)+1))
            elif part.isdigit():
                ids.add(int(part))
        
        return [i-1 for i in ids if 1 <= i <= len(self.lines)]

    def add_line(self, text):
        filename, error = self.generate_speech(text)
        if filename:
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
            filename, error = self.generate_speech(new_text)
            if filename:
                self.lines[line_id]['text'] = new_text
                self.lines[line_id]['filename'] = filename
                self._save_lines()
                return True
        return False

    def bulk_toggle(self, ids, state=None):
        changed = 0
        for i in ids:
            if 0 <= i < len(self.lines):
                if state is None:
                    self.lines[i]['active'] = not self.lines[i]['active']
                else:
                    self.lines[i]['active'] = state
                changed += 1
        if changed:
            self._save_lines()
        return changed

    def remove_lines(self, ids):
        valid_ids = sorted(set(ids), reverse=True)
        removed = 0
        for i in valid_ids:
            if 0 <= i < len(self.lines):
                del self.lines[i]
                removed += 1
        if removed:
            for idx in range(len(self.lines)):
                self.lines[idx]['id'] = idx+1
            self._save_lines()
        return removed

def degrade_audio(audio_segment, config):
    """
    Enhanced audio degradation using pydub and numpy with perceptible effects
    """
    import random

    import numpy as np
    from pydub import AudioSegment
    from pydub.effects import high_pass_filter, low_pass_filter

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


def print_menu():
    term_width = shutil.get_terminal_size().columns
    menu_lines = [
        "Menedżer linii głosowych",
        "1. Dodaj linię     2. Edytuj linię   3. Usuń linie",
        "4. Przełącz linie  5. Pokaż linie    6. Rozpocznij cykl",
        "7. Ustawienia      0. Wyjście"
    ]
    max_len = max(len(line) for line in menu_lines)
    padding = (term_width - max_len) // 2
    
    print("\n" + "_"*term_width)
    for line in menu_lines:
        print(' '*padding + line)
    print("_"*term_width + "\n")


def radio_settings(vs):
    while True:
        try:
            print(f"\nUstawienia radia:")
            print(f"1. Głośność radia: {vs.config['volumes']['radio']}")
            print(f"2. Głośność radia podczas grania linii głosowej: {vs.config['volumes']['ducking']}")
            print(f"3. Playlista: {vs.config['radio']['playlist']}")
            print("0. Powrót")
            
            choice = input("Wybierz opcję: ")
            
            if choice == '1':
                new_vol = float(input("Nowa głośność (0.0-1.0): "))
                vs.config['volumes']['radio'] = new_vol
                vs.radio_volume = new_vol
                vs._save_config()
            elif choice == '2':
                new_vol = float(input("Nowa głośność radia podczas grania linii głosowej (0.0-1.0): "))
                vs.config['volumes']['ducking'] = new_vol
                vs._save_config()
            elif choice == '3':
                new_path = input("Ścieżka do playlisty: ")
                vs.config['radio']['playlist'] = new_path
                vs._save_config()
            elif choice == '0':
                return
        except ValueError:
            print("Nieprawidłowa wartość!")
        except KeyboardInterrupt:
            print("\nAnulowano. Wracam do menu ustawień.")
            return
        
def volume_settings(vs):
    """Menu ustawień głośności z kontrolą wszystkich poziomów audio"""
    while True:
        try:
            print(f"\nUstawienia głośności:")
            print(f"1. Głośność główna: {vs.config['volumes']['master']}")
            print(f"2. Głośność radia: {vs.config['volumes']['radio']}")
            print(f"3. Głośność tłumienia: {vs.config['volumes']['ducking']}")
            print(f"4. Głośność głosu: {vs.config['volumes']['voice']}")
            print("5. Kompresja dynamiki")
            print("0. Powrót")
            
            choice = input("Wybierz opcję: ")
            
            if choice == '1':
                # Kontrola głównego poziomu wyjściowego
                new_vol = float(input("Nowa głośność główna (0.0-2.0): "))
                vs.config['volumes']['master'] = max(0.0, min(2.0, new_vol))
                vs._save_config()
                
            elif choice == '2':
                # Ustawienie głośności radia (będzie stosowane po ponownym uruchomieniu strumienia)
                new_vol = float(input("Nowa głośność radia (0.0-1.0): "))
                vs.config['volumes']['radio'] = max(0.0, min(1.0, new_vol))
                vs.radio_volume = new_vol
                vs._save_config()
                
            elif choice == '3':
                # Poziom tłumienia radia podczas odtwarzania komunikatów
                new_vol = float(input("Nowa głośność tłumienia (0.0-1.0): "))
                vs.config['volumes']['ducking'] = max(0.0, min(1.0, new_vol))
                vs.duck_volume = new_vol
                vs._save_config()
                
            elif choice == '4':
                # Wzmacniacz głosu - kontroluje tylko głos bez wpływu na radio
                new_vol = float(input("Nowa głośność głosu (0.5-2.0): "))
                vs.config['volumes']['voice'] = max(0.5, min(2.0, new_vol))
                vs._save_config()
                
            elif choice == '5':
                # Ustawienia kompresora dynamiki
                print("\nUstawienia kompresji:")
                vs.config['volumes']['compression']['threshold'] = float(
                    input(f"Próg (dB) [obecnie: {vs.config['volumes']['compression']['threshold']}]: ") or 
                    vs.config['volumes']['compression']['threshold'])
                vs.config['volumes']['compression']['ratio'] = float(
                    input(f"Ratio [obecnie: {vs.config['volumes']['compression']['ratio']}]: ") or 
                    vs.config['volumes']['compression']['ratio'])
                vs._save_config()
                
            elif choice == '0':
                return
                
        except ValueError:
            print("Nieprawidłowa wartość!")
        except KeyboardInterrupt:
            print("\nAnulowano. Wracam do menu ustawień.")
            return


def distortion_settings(vs):
    """Menu symulacji zniekształceń radiowych i efektów vintage"""
    while True:
        try:
            print("\nSymulacja zniekształceń:")
            print(f"1. Włączone: {'Tak' if vs.config['distortion_simulation']['enabled'] else 'Nie'}")
            print(f"2. Częstotliwość próbkowania: {vs.config['distortion_simulation']['sample_rate']} Hz")
            print(f"3. Poziom zniekształceń: {vs.config['distortion_simulation']['distortion']}")
            print(f"4. Filtr dolnoprzepustowy: {vs.config['distortion_simulation']['filter_high']} Hz")
            print(f"5. Filtr górnoprzepustowy: {vs.config['distortion_simulation']['filter_low']} Hz")
            print(f"6. Szumy: {vs.config['distortion_simulation']['noise_level']}")
            print(f"7. Redukcja bitów: {vs.config['distortion_simulation']['bit_depth']}-bit")
            print(f"8. Efekt trzasków: {vs.config['distortion_simulation']['crackle']}")
            print("0. Powrót")
            
            choice = input("Wybierz opcję: ")
            
            if choice == '1':
                vs.config['distortion_simulation']['enabled'] = not vs.config['distortion_simulation']['enabled']
                vs._save_config()
                print(f"Symulacja zniekształceń {'włączona' if vs.config['distortion_simulation']['enabled'] else 'wyłączona'}")
                
            elif choice == '2':
                new_sr = int(input("Nowa częstotliwość (8000-44100 Hz): ") or vs.config['distortion_simulation']['sample_rate'])
                if 8000 <= new_sr <= 44100:
                    vs.config['distortion_simulation']['sample_rate'] = new_sr
                    vs._save_config()
                    print(f"Ustawiono częstotliwość {new_sr} Hz")
                else:
                    print("Nieprawidłowy zakres (8000-44100 Hz)")
                    
            elif choice == '3':
                new_dist = float(input("Nowy poziom zniekształceń (0.0-1.0): ") or vs.config['distortion_simulation']['distortion'])
                if 0.0 <= new_dist <= 1.0:
                    vs.config['distortion_simulation']['distortion'] = new_dist
                    vs._save_config()
                    print(f"Ustawiono zniekształcenia na poziomie {new_dist}")
                else:
                    print("Nieprawidłowy zakres (0.0-1.0)")
                    
            elif choice == '4':
                new_high = int(input("Nowa górna częstotliwość (100-5000 Hz): ") or vs.config['distortion_simulation']['filter_high'])
                if 100 <= new_high <= 5000:
                    vs.config['distortion_simulation']['filter_high'] = new_high
                    vs._save_config()
                    print(f"Ustawiono filtr dolnoprzepustowy na {new_high} Hz")
                else:
                    print("Nieprawidłowy zakres (100-5000 Hz)")
                    
            elif choice == '5':
                new_low = int(input("Nowa dolna częstotliwość (50-1000 Hz): ") or vs.config['distortion_simulation']['filter_low'])
                if 50 <= new_low <= 1000:
                    vs.config['distortion_simulation']['filter_low'] = new_low
                    vs._save_config()
                    print(f"Ustawiono filtr górnoprzepustowy na {new_low} Hz")
                else:
                    print("Nieprawidłowy zakres (50-1000 Hz)")
                    
            elif choice == '6':
                new_noise = float(input("Nowy poziom szumów (0.0-0.5): ") or vs.config['distortion_simulation']['noise_level'])
                if 0.0 <= new_noise <= 0.5:
                    vs.config['distortion_simulation']['noise_level'] = new_noise
                    vs._save_config()
                    print(f"Ustawiono szumy na poziomie {new_noise}")
                else:
                    print("Nieprawidłowy zakres (0.0-0.5)")
                    
            elif choice == '7':
                new_bits = int(input("Nowa głębia bitowa (4-16 bit): ") or vs.config['distortion_simulation']['bit_depth'])
                if 4 <= new_bits <= 16:
                    vs.config['distortion_simulation']['bit_depth'] = new_bits
                    vs._save_config()
                    print(f"Ustawiono redukcję do {new_bits}-bit")
                else:
                    print("Nieprawidłowy zakres (4-16 bit)")
                    
            elif choice == '8':
                new_crackle = float(input("Nowy poziom trzasków (0.0-0.5): ") or vs.config['distortion_simulation']['crackle'])
                if 0.0 <= new_crackle <= 0.5:
                    vs.config['distortion_simulation']['crackle'] = new_crackle
                    vs._save_config()
                    print(f"Ustawiono trzaski na poziomie {new_crackle}")
                else:
                    print("Nieprawidłowy zakres (0.0-0.5)")
                    
            elif choice == '0':
                return
                
            else:
                print("Nieprawidłowy wybór!")
                
        except ValueError as ve:
            print(f"Błąd wartości: {str(ve)}")
        except KeyError as ke:
            print(f"Błąd konfiguracji: brak klucza {str(ke)}")
            vs.config['distortion_simulation'] = {  # Reset sekcji jeśli brakuje kluczy
                'enabled': False,
                'sample_rate': 32000,
                'distortion': 0.0002,
                'filter_low': 200,
                'filter_high': 4000,
                'noise_level': 0.0001,
                'bit_depth': 16,
                'crackle': 0.0002
            }
            vs._save_config()
        except KeyboardInterrupt:
            print("\nAnulowano. Wracam do menu ustawień.")
            return


def voice_settings(vs):
    while True:
        try:
            print("\nUstawienia głosu:")
            print(f"1. Głośność: {vs.config['volumes']['voice']}")
            print(f"2. Stabilność: {vs.config['voice']['stability']}")
            print(f"3. Podobieństwo: {vs.config['voice']['similarity']}")
            print(f"4. Prędkość: {vs.config['voice']['speed']}")
            print("0. Powrót")
            
            choice = input("Wybierz opcję: ")
            
            if choice == '1':
                new_vol = float(input("Nowa głośność (0.0-2.0): "))
                vs.config['voice']['volume'] = new_vol
                vs._save_config()
            elif choice == '2':
                new_val = float(input("Nowa stabilność (0.0-1.0): "))
                vs.config['voice']['stability'] = new_val
                vs._save_config()
            elif choice == '3':
                new_val = float(input("Nowe podobieństwo (0.0-1.0): "))
                vs.config['voice']['similarity'] = new_val
                vs._save_config()
            elif choice == '4':
                new_val = float(input("Nowa prędkość (0.5-2.0): "))
                vs.config['voice']['speed'] = new_val
                vs._save_config()
            elif choice == '0':
                return
        except ValueError:
            print("Nieprawidłowa wartość!")
        except KeyboardInterrupt:
            print("\nAnulowano. Wracam do menu ustawień.")
            return

def settings_menu(vs):
    while True:
        try:
            print("\nUstawienia główne:")
            print("1. Radio")
            print("2. Głos")
            print("3. Głośności")
            print("4. Symulacja zniekształceń")
            print("5. Interwał radia")
            print("0. Powrót")
            
            choice = input("Wybierz kategorię: ")
            
            if choice == '1':
                radio_settings(vs)
            elif choice == '2':
                voice_settings(vs)
            elif choice == '3':
                volume_settings(vs)
            elif choice == '4':
                distortion_settings(vs)
            elif choice == '5':
                mins = float(input("Nowy interwał (minuty): "))
                vs.config['radio']['interval'] = mins * 60
                vs._save_config()
            elif choice == '0':
                return
        except ValueError:
            print("Nieprawidłowa wartość!")
        except KeyboardInterrupt:
            print("\nAnulowano. Wracam do menu głównego.")
            return


def main():
    vs = VoiceSystem()

    while True:
        try:
            print_menu()
            choice = input("Twój wybór: ")
            
            if choice == '1':
                try:
                    text = input("Tekst linii: ")
                    if vs.add_line(text):
                        print("Dodano linię!")
                    else:
                        print(f"Błąd: {vs.last_error}")
                except KeyboardInterrupt:
                    print("\nAnulowano.")
            
            elif choice == '2':
                vs.display_in_categories()
                try:
                    line_id = int(input("ID linii do edycji: "))-1
                    new_text = input("Nowy tekst: ")
                    if vs.edit_line(line_id, new_text):
                        print("Zaktualizowano!")
                    else:
                        print(f"Błąd: {vs.last_error}")
                except (ValueError, KeyboardInterrupt):
                    print("Nieprawidłowe ID!")
            
            elif choice == '3':
                vs.display_in_columns()
                try:
                    ids = vs.parse_id_ranges(input("ID linii do usunięcia (np. 1,3-5): "))
                    removed = vs.remove_lines(ids)
                    print(f"Usunięto {removed} linii.")
                except KeyboardInterrupt:
                    print("\nAnulowano.")
            
            elif choice == '4':
                vs.display_in_columns()
                try:
                    cmd = input("Komenda (np. 1,3-5, wszystkie): ")
                    if cmd.lower() == 'włącz wszystkie':
                        count = vs.bulk_toggle(range(len(vs.lines)), True)
                    elif cmd.lower() == 'wyłącz wszystkie':
                        count = vs.bulk_toggle(range(len(vs.lines)), False)
                    else:
                        ids = vs.parse_id_ranges(cmd)
                        count = vs.bulk_toggle(ids)
                    print(f"Zmieniono {count} linii.")
                except KeyboardInterrupt:
                    print("\nAnulowano.")
            
            elif choice == '5':
                vs.display_in_columns()
            
            elif choice == '6':
                try:
                    vs.run_scheduler()
                except KeyboardInterrupt:
                    vs.stop_radio()
            
            elif choice == '7':
                settings_menu(vs)
            
            elif choice == '0':
                vs.stop_radio()
                print("Do widzenia!")
                break
            
            else:
                print("Nieznana opcja!")

        except KeyboardInterrupt:
            continue

if __name__ == "__main__":
    main()
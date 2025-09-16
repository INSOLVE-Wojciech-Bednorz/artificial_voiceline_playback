# artificial_voiceline_playback
Program tworzący, zarządzający i odtwarzający linie głosowe wraz z radiem.

---

## Instalacja

1. Sklonuj repozytorium.  
2. Wejdź do katalogu głównego projektu.  
3. Zedytuj **origin IP address** w `main.py`.  
4. Ustaw swój **Eleven Labs API key** w `config.yaml`.  
5. Utwórz i aktywuj wirtualne środowisko:  

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

6. Zainstaluj wymagane pakiety:

   ```bash
   pip install -r requirements.txt
   ```

---

## Uruchomienie strony
Uruchom FastAPI:

   ```bash
   python main.py
   ```

W osobnym terminalu:

```bash
cd nextjs-voiceline-app/
./setup.sh
npm run dev
```

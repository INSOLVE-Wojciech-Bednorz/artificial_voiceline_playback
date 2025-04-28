# Voiceline App - Frontend

Aplikacja do zarządzania liniami głosowymi i odtwarzaniem radia.

## Wymagania systemowe

- Node.js w wersji >= 18.17.0 (zalecana 20.x)
- NPM (najnowsza wersja)
- Dostęp do API backendu

## Szybka instalacja

### Dla systemów Linux/macOS:

```bash
chmod +x setup.sh
./setup.sh
```

### Dla systemów Windows:

```cmd
setup.bat
```

## Ręczna instalacja

1. Upewnij się, że masz prawidłową wersję Node.js:
   ```bash
   node -v
   ```

2. Wyczyść cache NPM:
   ```bash
   npm cache clean --force
   ```

3. Usuń istniejące foldery node_modules i pliki blokad:
   ```bash
   rm -rf node_modules
   rm -f package-lock.json
   ```

4. Zainstaluj zależności:
   ```bash
   npm install
   ```

## Uruchomienie aplikacji

### Standardowe uruchomienie (z Turbopack):

```bash
npm run dev
```

### Alternatywne uruchomienie (bez Turbopack - użyj jeśli masz problemy):

```bash
npm run dev:stable
```

## Rozwiązywanie problemów

### Problemy z hydracją (React Hydration Error)

Jeśli widzisz błąd "Hydration failed because the server rendered HTML didn't match the client":

1. **Usuń folder .next** aby wyczyścić cache:
   ```bash
   rm -rf .next
   ```

2. **Uruchom aplikację bez Turbopack**:
   ```bash
   npm run dev:stable
   ```

3. **Sprawdź dostęp do API**:
   - Upewnij się, że backend jest uruchomiony
   - Sprawdź plik `src/utils/api.ts` czy adres API jest poprawny

4. **Problemy z Node.js**:
   - Upewnij się, że używasz Node.js w wersji 18.17.0 lub wyższej
   - Starsze wersje mogą nie być kompatybilne z React 19 i Next.js 15

5. **Problemy z zależnościami**:
   - Spróbuj użyć innego menedżera pakietów:
     ```bash
     # Używając npm
     npm install
     
     # Używając yarn
     yarn
     
     # Używając pnpm
     pnpm install
     ```

### Inne problemy

- **Wolny system plików**: Jeśli widzisz komunikat "Slow filesystem detected", upewnij się, że projekt nie znajduje się na dysku sieciowym.
- **Błędy kompilacji**: Użyj `npm run lint` aby znaleźć problemy w kodzie.
- **Błędy Network**: Upewnij się, że firewall nie blokuje dostępu do API.

## Struktura projektu

- `src/app` - Strony Next.js i konfiguracja routingu
- `src/components` - Komponenty React
- `src/utils` - Narzędzia i kontekst aplikacji
- `public` - Statyczne pliki

## Kontakt

Jeśli masz problemy z konfiguracją, skontaktuj się z administratorem projektu.

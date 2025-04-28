@echo off
echo === Konfiguracja projektu nextjs-voiceline-app ===
echo Sprawdzanie wersji Node.js...

:: Sprawdzanie wersji Node.js
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Znaleziono Node.js %NODE_VERSION%

:: Czyszczenie cache npm
echo Czyszczenie cache npm...
call npm cache clean --force

:: Usuwanie starych node_modules i lock files
echo Usuwanie istniejących node_modules i plików lock...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json
if exist yarn.lock del /f yarn.lock
if exist pnpm-lock.yaml del /f pnpm-lock.yaml

:: Instalowanie zależności
echo Instalowanie zależności...
call npm install

:: Instalowanie dodatkowych narzędzi deweloperskich
echo Instalowanie dodatkowych narzędzi deweloperskich...
call npm install --save-dev eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-next

:: Rozwiązywanie problemów z hydracją
echo Rozwiązywanie potencjalnych problemów z hydracją...
if exist .next (
  echo Usuwanie katalogu .next dla czystego startu...
  rmdir /s /q .next
)

echo === Instalacja zakończona ===
echo.
echo Aby uruchomić serwer deweloperski, wykonaj:
echo cd %cd%
echo npm run dev
echo.
echo Jeśli nadal występują błędy hydracji, spróbuj:
echo 1. Usuń 'use client' z komponentów, które nie wymagają interakcji po stronie klienta
echo 2. Sprawdź, czy API jest dostępne i poprawnie skonfigurowane
echo 3. Usuń --turbopack z komendy dev w package.json jeśli problemy nadal występują
echo.
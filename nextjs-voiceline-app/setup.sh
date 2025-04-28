#!/bin/bash
# setup.sh - Skrypt konfiguracyjny dla projektu nextjs-voiceline-app

echo "=== Konfiguracja projektu nextjs-voiceline-app ==="
echo "Sprawdzanie wersji Node.js..."

# Sprawdzanie wersji Node.js (wymagane co najmniej 18.17.0 dla Next.js 15)
NODE_VERSION=$(node -v)
echo "Znaleziono Node.js $NODE_VERSION"

NODE_VERSION_NUMBER=$(echo $NODE_VERSION | cut -c 2-)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION_NUMBER | cut -d. -f1)

if [ "$NODE_MAJOR_VERSION" -lt "18" ]; then
  echo "⚠️  UWAGA: Twoja wersja Node.js może być zbyt stara dla Next.js 15 i React 19."
  echo "   Zalecana minimalna wersja to 18.17.0, a optymalna to 20.x.x"
  echo "   Zastanów się nad aktualizacją Node.js przed kontynuowaniem."
  read -p "Kontynuować mimo to? (t/n): " answer
  if [ "$answer" != "t" ]; then
    echo "Instalacja przerwana. Zaktualizuj Node.js i spróbuj ponownie."
    exit 1
  fi
fi

# Czyszczenie cache npm
echo "Czyszczenie cache npm..."
npm cache clean --force

# Usuwanie starych node_modules i lock files, aby zapewnić czystą instalację
echo "Usuwanie istniejących node_modules i plików lock..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock
rm -f pnpm-lock.yaml

# Instalowanie zależności
echo "Instalowanie zależności..."
npm install

# Instalowanie dodatkowych narzędzi deweloperskich, które mogą być pomocne
echo "Instalowanie dodatkowych narzędzi deweloperskich..."
npm install --save-dev eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-next

echo "Rozwiązywanie potencjalnych problemów z hydracją..."
# Sprawdzanie, czy katalog .next istnieje i jego usunięcie dla czystego startu
if [ -d ".next" ]; then
  echo "Usuwanie katalogu .next dla czystego startu..."
  rm -rf .next
fi

echo "=== Instalacja zakończona ==="
echo ""
echo "Aby uruchomić serwer deweloperski, wykonaj:"
echo "cd $(pwd)"
echo "npm run dev"
echo ""
echo "Jeśli nadal występują błędy hydracji, spróbuj:"
echo "1. Usuń 'use client' z komponentów, które nie wymagają interakcji po stronie klienta"
echo "2. Sprawdź, czy API jest dostępne i poprawnie skonfigurowane"
echo "3. Usuń --turbopack z komendy dev w package.json jeśli problemy nadal występują"
echo ""
#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/public/downloads"
TAURI_TARGET="$ROOT/apps/desktop/src-tauri/target/release/bundle"

echo "==> Exporting Expo web build..."
cd "$ROOT/apps/app"
npx expo export --platform web --output-dir dist

echo "==> Building Tauri desktop app..."
cd "$ROOT/apps/desktop"
npm install
npx tauri build

echo "==> Copying binaries to frontend/public/downloads/..."
mkdir -p "$OUT"

# macOS DMG
DMG=$(find "$TAURI_TARGET/dmg" -name "*.dmg" 2>/dev/null | head -1)
if [ -n "$DMG" ]; then
  cp "$DMG" "$OUT/GyanBrige-mac.dmg"
  echo "    macOS  → $OUT/GyanBrige-mac.dmg"
fi

# Windows NSIS installer
EXE=$(find "$TAURI_TARGET/nsis" -name "*-setup.exe" 2>/dev/null | head -1)
if [ -n "$EXE" ]; then
  cp "$EXE" "$OUT/GyanBrige-Setup.exe"
  echo "    Windows → $OUT/GyanBrige-Setup.exe"
fi

# Linux AppImage
APPIMAGE=$(find "$TAURI_TARGET/appimage" -name "*.AppImage" 2>/dev/null | head -1)
if [ -n "$APPIMAGE" ]; then
  cp "$APPIMAGE" "$OUT/GyanBrige.AppImage"
  echo "    Linux   → $OUT/GyanBrige.AppImage"
fi

echo "==> Done."

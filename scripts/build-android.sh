#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/public/downloads"

echo "==> Building Android APK via EAS..."
cd "$ROOT/apps/app"

# Build a preview (internal distribution) APK
npx eas-cli build --platform android --profile preview --non-interactive --local \
  --output "$OUT/gyanbrige-android.apk"

echo "==> Android APK → $OUT/gyanbrige-android.apk"

#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "==> Building all platforms..."
"$DIR/build-android.sh"
"$DIR/build-desktop.sh"
echo "==> All builds complete. Files are in frontend/public/downloads/"

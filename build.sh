#!/usr/bin/env bash
# GyanBrige build helper
# Usage: ./build.sh [ios|android|both] [dev|preview|prod] [--local|--sim]

set -e

PLATFORM="${1:-ios}"
PROFILE="${2:-development}"
EXTRA=""

# Flags
for arg in "$@"; do
  case $arg in
    --local) EXTRA="$EXTRA --local" ;;
    --sim)   PROFILE="development:simulator" ;;
  esac
done

# Set up Java for Android
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

cd "$(dirname "$0")/apps/app"

echo "🏗  Building GyanBrige — platform: $PLATFORM | profile: $PROFILE"
echo ""

case "$PLATFORM" in
  ios)
    eas build --platform ios --profile "$PROFILE" $EXTRA
    ;;
  android)
    eas build --platform android --profile "$PROFILE" $EXTRA
    ;;
  both)
    eas build --platform all --profile "$PROFILE" $EXTRA
    ;;
  *)
    echo "Usage: $0 [ios|android|both] [dev|preview|prod] [--local|--sim]"
    exit 1
    ;;
esac

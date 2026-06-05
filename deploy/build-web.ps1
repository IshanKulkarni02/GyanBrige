# Builds the Expo Web bundle with the PUBLIC URLs baked in.
# EXPO_PUBLIC_* values are inlined at build time, so this MUST be re-run whenever
# PUBLIC_HOST or the LiveKit URL changes.
#
#   powershell -ExecutionPolicy Bypass -File deploy\build-web.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Get-EnvVal($key) {
  $line = Select-String -Path (Join-Path $root ".env") -Pattern "^$key=(.*)$" | Select-Object -First 1
  if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
  return ""
}

$publicHost = Get-EnvVal "PUBLIC_HOST"
$livekitUrl = Get-EnvVal "LIVEKIT_URL"

if (-not $publicHost -or $publicHost -like "*YOUR-DOMAIN*") {
  Write-Error "PUBLIC_HOST is not set in .env (still the placeholder). Set your ngrok static domain first."
}

$env:NODE_ENV = "production"
$env:EXPO_PUBLIC_API_URL = "https://$publicHost"
$env:EXPO_PUBLIC_REALTIME_URL = "wss://$publicHost"
$env:EXPO_PUBLIC_TRANSCRIPTION_URL = "https://$publicHost/transcription"
$env:EXPO_PUBLIC_LIVEKIT_URL = $livekitUrl

Write-Host "Building Expo Web with:" -ForegroundColor Cyan
Write-Host "  API/REALTIME/TRANSCRIPTION host = $publicHost"
Write-Host "  LIVEKIT_URL                     = $livekitUrl"

Push-Location (Join-Path $root "apps\app")
try {
  npx expo export --platform web
} finally {
  Pop-Location
}

Write-Host "Done. Static bundle is at apps\app\dist (served by Caddy)." -ForegroundColor Green

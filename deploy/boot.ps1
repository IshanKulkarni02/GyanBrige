# Boot sequencer for GyanBrige, run at logon by the autostart Scheduled Task.
# Ensures the data layer is fully up BEFORE the app processes resurrect, so the
# services never crash-loop waiting on Redis/Mongo/Postgres.
#
#   1. start Docker Desktop (if not already running) and wait for the engine
#   2. docker compose up -d  (starts postgres/mongo/redis/minio/livekit)
#   3. wait for redis + postgres to accept connections
#   4. pm2 resurrect  (brings back api/realtime/transcription/worker/caddy/ngrok)

$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $PSScriptRoot ".boot.log"
function Log($m) { "$((Get-Date).ToString('s'))  $m" | Out-File -FilePath $log -Append -Encoding utf8 }

Log "boot start"

# 1. Docker engine
$dd = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $dd) { Start-Process $dd; Log "launched Docker Desktop" }
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { Log "docker engine up after ~$($i*5)s"; break }
  }
}

# 2. data containers
docker compose -f (Join-Path $root "infra\docker-compose.yml") up -d *> $null
Log "docker compose up issued"

# 3. wait for redis + postgres
for ($i = 0; $i -lt 40; $i++) {
  $r = (Test-NetConnection localhost -Port 6379 -WarningAction SilentlyContinue).TcpTestSucceeded
  $p = (Test-NetConnection localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded
  if ($r -and $p) { Log "redis+postgres reachable after ~$($i*3)s"; break }
  Start-Sleep -Seconds 3
}

# 4. resurrect the saved pm2 process list
$pm2 = (Get-Command pm2.cmd -ErrorAction SilentlyContinue).Source
if (-not $pm2) { $pm2 = Join-Path $env:APPDATA "npm\pm2.cmd" }
& $pm2 resurrect *> $null
Log "pm2 resurrect issued; boot done"

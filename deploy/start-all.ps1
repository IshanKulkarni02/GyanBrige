# Brings the whole GyanBrige stack online.
#   powershell -ExecutionPolicy Bypass -File deploy\start-all.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/4] Starting Docker infra (postgres, mongo, redis, minio, livekit)..." -ForegroundColor Cyan
docker compose -f infra/docker-compose.yml up -d

Write-Host "[2/4] Generating Prisma client..." -ForegroundColor Cyan
pnpm --filter @gyanbrige/api db:generate | Out-Null

Write-Host "[3/4] Starting all processes under pm2..." -ForegroundColor Cyan
pm2 start deploy/ecosystem.config.cjs
pm2 save

Write-Host "[4/4] Status:" -ForegroundColor Cyan
pm2 status

Write-Host ""
Write-Host "Stack is up. Public URL is your ngrok static domain (PUBLIC_HOST in .env)." -ForegroundColor Green
Write-Host "Tail logs with:  pm2 logs" -ForegroundColor Green

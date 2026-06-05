# Makes the whole GyanBrige stack come back automatically after a reboot.
# Run ONCE, after a successful `pm2 save`.
#   powershell -ExecutionPolicy Bypass -File deploy\install-autostart.ps1
#
# Registers a logon Scheduled Task that runs deploy\boot.ps1, which starts
# Docker + the data containers, waits for them, then `pm2 resurrect`s the apps.

$ErrorActionPreference = "Stop"
$boot = Join-Path $PSScriptRoot "boot.ps1"

$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$boot`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName "GyanBrige-boot" -Description "Start Docker + GyanBrige stack at logon" `
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

# Keep the machine awake so it can serve 24/7 (on AC power). Needs admin; non-fatal.
try { powercfg /change standby-timeout-ac 0 2>$null; powercfg /change hibernate-timeout-ac 0 2>$null } catch {}

Write-Host "Autostart task 'GyanBrige-boot' registered (runs deploy\boot.ps1 at logon)." -ForegroundColor Green
Write-Host "Tip: also enable Docker Desktop > Settings > 'Start Docker Desktop when you log in' as a backup." -ForegroundColor Yellow

# Stops the GyanBrige app processes (leaves Docker infra running).
#   powershell -ExecutionPolicy Bypass -File deploy\stop-all.ps1
pm2 delete deploy/ecosystem.config.cjs 2>$null
pm2 save
Write-Host "App processes stopped. Docker infra left running (use 'pnpm infra:down' to stop it too)." -ForegroundColor Yellow

# Periodic GitHub sync for the deploy branch.
# Stages everything (respecting .gitignore), commits if there are changes,
# and pushes to origin/deploy. Safe to run on a schedule.
#
# SAFETY: only ever acts when the repo is on the `deploy` branch, so dev/main
# are never auto-committed to.
#
# NOTE: deliberately does NOT use `$ErrorActionPreference='Stop'` or `2>&1` on
# git, because git writes normal progress to stderr and PowerShell 5.1 would
# otherwise treat a successful push as a failure. We check $LASTEXITCODE instead.

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$log = Join-Path $PSScriptRoot ".auto-sync.log"
function Log($m) { "$((Get-Date).ToString('s'))  $m" | Out-File -FilePath $log -Append -Encoding utf8 }

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "deploy") { Log "skip: on branch '$branch', not 'deploy'"; exit 0 }

git add -A | Out-Null

if (git status --porcelain) {
  $msg = @"
auto-sync: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
"@
  git commit -m $msg | Out-Null
  if ($LASTEXITCODE -eq 0) { Log "committed local changes" } else { Log "commit failed (exit $LASTEXITCODE)" }
} else {
  Log "no local changes"
}

git push origin deploy | Out-Null
if ($LASTEXITCODE -eq 0) { Log "push ok" } else { Log "push FAILED (exit $LASTEXITCODE)" }

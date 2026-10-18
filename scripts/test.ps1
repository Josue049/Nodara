# Lint + tipos + unitarias + E2E
. "$PSScriptRoot\_common.ps1"
Set-Location "$global:Root\app"
$npm = "$global:Root\tools\node\npm.cmd"
& $npm run lint; if ($LASTEXITCODE) { exit 1 }
& $npm run typecheck; if ($LASTEXITCODE) { exit 1 }
& $npm test; if ($LASTEXITCODE) { exit 1 }
& $npm run test:e2e; exit $LASTEXITCODE

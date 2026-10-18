# Arranca Nodara en desarrollo (http://localhost:3000) con el Node portable del proyecto.
. "$PSScriptRoot\_common.ps1"
Set-Location "$global:Root\app"
if (-not (Test-Path node_modules)) { & "$global:Root\tools\node\npm.cmd" install }
& "$global:Root\tools\node\npm.cmd" run dev

# Instala Node portable (22.x LTS, verificado con SHA256), clona REA y las dependencias de la app.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$v = "v22.23.3"; $zip = "node-$v-win-x64.zip"; $tmp = Join-Path $env:TEMP "nodara-setup"
if (-not (Test-Path "$root\tools\node\node.exe")) {
  New-Item -ItemType Directory -Force $tmp | Out-Null
  Invoke-WebRequest "https://nodejs.org/dist/$v/$zip" -OutFile "$tmp\$zip" -UseBasicParsing
  $sums = (Invoke-WebRequest "https://nodejs.org/dist/$v/SHASUMS256.txt" -UseBasicParsing).Content
  $exp = (($sums -split "`n" | ? { $_ -match [regex]::Escape($zip) } | select -First 1) -split '\s+')[0]
  if ((Get-FileHash "$tmp\$zip" -Algorithm SHA256).Hash.ToLower() -ne $exp) { throw "SHA256 de Node no coincide" }
  Expand-Archive "$tmp\$zip" "$tmp\x" -Force
  Move-Item "$tmp\x\node-$v-win-x64" "$root\tools\node"
}
if (-not (Test-Path "$root\tools\rea")) { git clone https://github.com/morluto/rea.git "$root\tools\rea" }
. "$PSScriptRoot\_common.ps1"
Set-Location "$root\app"; & "$root\tools\node\npm.cmd" install
Write-Host "Listo. Usa scripts\dev.ps1 para arrancar."

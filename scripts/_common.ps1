# Variables comunes de los scripts de investigación de Nodara
$global:Root = Split-Path $PSScriptRoot -Parent
$env:PATH = "$global:Root\tools\node;$env:PATH"   # Node portable 22.x (REA exige >=22.19)
$global:Rea = "rea-agents@6.7.0"
$global:Cdp = "http://127.0.0.1:9222"
$global:Profile = Join-Path $global:Root "research\.browser-profile"   # perfil aislado, ignorado por git
$global:Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
function Invoke-Rea { & "$global:Root\tools\node\npx.cmd" -y $global:Rea @args }




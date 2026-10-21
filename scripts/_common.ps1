# Variables comunes de los scripts de Nodara
$global:Root = Split-Path $PSScriptRoot -Parent
$env:PATH = "$global:Root\tools\node;$env:PATH"   # Node portable 22.x del proyecto

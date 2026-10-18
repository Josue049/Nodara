<# Respaldo de la base de Nodara. Con DATABASE_URL usa pg_dump (formato custom, comprimido); sin ella copia el directorio PGlite.
   Los respaldos van a backups\ (ignorada por Git). Uso: .\scripts\db-backup.ps1 #>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_pg.ps1"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dir = Join-Path $global:Root "backups"; New-Item -ItemType Directory -Force $dir | Out-Null
$url = Get-EnvValue "DATABASE_URL"
if ($url) {
  $c = Split-PgUrl $url; $env:PGPASSWORD = $c.Password
  $out = Join-Path $dir "nodara-$stamp.dump"
  & "$(Get-PgBin)\pg_dump.exe" -h $c.Host -p $c.Port -U $c.User -w -d $c.Db -Fc -f $out
  if ($LASTEXITCODE) { throw "pg_dump falló" }
  Remove-Item Env:PGPASSWORD
} else {
  $src = Join-Path $global:Root ".data\pglite"; $out = Join-Path $dir "pglite-$stamp"
  Copy-Item $src $out -Recurse
}
Write-Host "Respaldo: $out ($([math]::Round((Get-ChildItem $out -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum/1MB,2)) MB)"

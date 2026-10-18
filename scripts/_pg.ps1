# Utilidades PostgreSQL compartidas (rutas de binarios y lectura de app/.env).
. "$PSScriptRoot\_common.ps1"
function Get-PgBin {
  $cands = @($env:NODARA_PG_BIN) + (Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | % { "$($_.FullName)\bin" })
  foreach ($c in $cands) { if ($c -and (Test-Path "$c\psql.exe")) { return $c } }
  throw "No se encontró PostgreSQL. Define NODARA_PG_BIN con la carpeta bin."
}
function Get-EnvValue([string]$name) {
  $f = Join-Path $global:Root "app\.env"
  if (-not (Test-Path $f)) { return $null }
  $line = Get-Content $f | ? { $_ -match "^\s*$name\s*=" } | select -First 1
  if ($line) { return ($line -replace "^\s*$name\s*=\s*", "").Trim().Trim('"') }
}
function Split-PgUrl([string]$url) {
  $u = [Uri]$url
  $cred = $u.UserInfo -split ':', 2
  [pscustomobject]@{ Host = $u.Host; Port = $(if ($u.Port -gt 0) { $u.Port } else { 5432 }); User = [Uri]::UnescapeDataString($cred[0]); Password = [Uri]::UnescapeDataString($cred[1]); Db = $u.AbsolutePath.TrimStart('/') }
}

<#
 Crea en tu PostgreSQL local un rol y bases EXCLUSIVAS de Nodara (nodara y nodara_test) y escribe app\.env.
 No toca otras bases ni roles. Es idempotente: si el rol/base existen, los reutiliza.
 La contraseña del superusuario (postgres) se pide de forma segura y no se guarda.
 Uso:  .\scripts\setup-postgres.ps1            (interactivo)
       $env:NODARA_PG_SUPERPASSWORD="..."; .\scripts\setup-postgres.ps1
#>
param([string]$PgHost = "127.0.0.1", [int]$Port = 5432, [string]$SuperUser = "postgres")
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_pg.ps1"
$bin = Get-PgBin; $psql = "$bin\psql.exe"
$envFile = Join-Path $global:Root "app\.env"

$plain = $env:NODARA_PG_SUPERPASSWORD
if (-not $plain) {
  $sec = Read-Host "Contraseña del superusuario '$SuperUser' de PostgreSQL" -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
$env:PGPASSWORD = $plain
function Sql([string]$db, [string]$q) { & $psql -h $PgHost -p $Port -U $SuperUser -w -d $db -v ON_ERROR_STOP=1 -tA -c $q; if ($LASTEXITCODE) { throw "psql falló" } }

Sql postgres "select 1" | Out-Null
Write-Host "Conexión correcta a PostgreSQL $((Sql postgres 'show server_version'))"

# Contraseña: se reutiliza la de app\.env si ya existe; si no, se genera.
$existing = if (Test-Path $envFile) { Get-EnvValue "DATABASE_URL" } else { $null }
if ($existing) { $appPass = (Split-PgUrl $existing).Password; Write-Host "Se reutiliza la contraseña de app\.env (no se sobrescribe)." }
else { $appPass = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 32 | % { [char]$_ }) }

$roleExists = Sql postgres "select 1 from pg_roles where rolname='nodara'"
if ($roleExists) { if (-not $existing) { Sql postgres "alter role nodara with login password '$appPass'" | Out-Null; Write-Host "Rol 'nodara' ya existía: contraseña actualizada." } }
else { Sql postgres "create role nodara with login password '$appPass' nosuperuser nocreatedb nocreaterole" | Out-Null; Write-Host "Rol 'nodara' creado." }
foreach ($db in "nodara", "nodara_test") {
  if (Sql postgres "select 1 from pg_database where datname='$db'") { Write-Host "Base '$db' ya existe." }
  else { Sql postgres "create database $db owner nodara encoding 'UTF8'" | Out-Null; Write-Host "Base '$db' creada." }
  Sql postgres "revoke all on database $db from public" | Out-Null
}

if (Test-Path $envFile) { Write-Host "app\.env ya existe: no se modifica." }
else {
  @"
DATABASE_URL=postgresql://nodara:$appPass@$PgHost`:$Port/nodara
DATABASE_URL_TEST=postgresql://nodara:$appPass@$PgHost`:$Port/nodara_test
"@ | Set-Content $envFile -Encoding utf8
  Write-Host "app\.env creado (ignorado por Git)."
}
Remove-Item Env:PGPASSWORD
Write-Host "Listo. Siguiente: .\scripts\migrate-to-postgres.ps1"

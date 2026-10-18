<# Restaura un respaldo .dump sobre la base indicada (por defecto nodara_test, para ensayar). Para restaurar sobre la
   base real hay que pasar -Target nodara -Confirm. Sobrescribe el contenido de la base destino.
   Uso: .\scripts\db-restore.ps1 -File backups\nodara-2026….dump [-Target nodara -Confirm] #>
param([Parameter(Mandatory)][string]$File, [string]$Target = "nodara_test", [switch]$Confirm)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_pg.ps1"
if ($Target -eq "nodara" -and -not $Confirm) { throw "Restaurar sobre 'nodara' reemplaza sus datos. Repite con -Confirm si es lo que quieres." }
$c = Split-PgUrl (Get-EnvValue "DATABASE_URL"); $env:PGPASSWORD = $c.Password
& "$(Get-PgBin)\pg_restore.exe" -h $c.Host -p $c.Port -U $c.User -w -d $Target --clean --if-exists --no-owner $File
if ($LASTEXITCODE) { throw "pg_restore falló" }
Remove-Item Env:PGPASSWORD
Write-Host "Restaurado $File en '$Target'."

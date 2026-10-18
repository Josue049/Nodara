<# Migra los datos de PGlite (.data\pglite) a PostgreSQL (DATABASE_URL de app\.env). Antes crea un respaldo del
   directorio PGlite y no modifica el original. Aborta si la base destino ya contiene datos (salvo -Force). #>
param([switch]$Force)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_pg.ps1"
if (-not (Get-EnvValue "DATABASE_URL")) { throw "Falta DATABASE_URL en app\.env (ejecuta setup-postgres.ps1)." }
Set-Location "$global:Root\app"
$args2 = @("--env-file=.env", "scripts/migrate-pglite-to-postgres.mjs") + $(if ($Force) { "--force" })
& "$global:Root\tools\node\node.exe" @args2
exit $LASTEXITCODE

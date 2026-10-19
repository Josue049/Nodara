# Verificación secuencial y con poca memoria: lint -> tipos -> Vitest -> build -> E2E por archivo (1 worker).
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-seq.ps1 [-Only 07,08] [-SkipStatic]
param([string[]]$Only = @(), [switch]$SkipStatic, [switch]$All)
. "$PSScriptRoot\_common.ps1"
Set-Location "$global:Root\app"
$node = "$global:Root\tools\node\node.exe"
$log = "$global:Root\.data\test-seq.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
"== $(Get-Date -Format s) ==" | Set-Content $log
$results = [ordered]@{}

function Step($name, [scriptblock]$run) {
  Write-Host "-> $name"
  & $run 2>&1 | Tee-Object -FilePath $log -Append | Select-Object -Last 6 | Out-Host
  $ok = ($LASTEXITCODE -eq 0)
  $results[$name] = if ($ok) { "OK" } else { "FALLO" }
  "[$name] $($results[$name])" | Add-Content $log
  return $ok
}
function Cleanup-Children {
  # Solo procesos de esta ejecución: node/chrome que cuelgan del servidor E2E o de Playwright de este repo.
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "e2e-server|next[\/]dist|playwright" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

$failed = $false
if (-not $SkipStatic) {
  if (-not (Step "lint" { & $node node_modules\eslint\bin\eslint.js . })) { $failed = $true }
  if (-not (Step "tipos" { & $node node_modules\typescript\bin\tsc --noEmit --incremental false })) { $failed = $true }
  if (-not (Step "vitest" { & $node node_modules\vitest\vitest.mjs run })) { $failed = $true }
  if (-not (Step "build-produccion" { & $node node_modules\next\dist\bin\next build })) { $failed = $true }
}
# Build de pruebas: una sola vez
# La caché de Turbopack puede conservar CSS antiguo: el build de pruebas parte siempre de cero.
Remove-Item -Recurse -Force "$global:Rootpp\.next-e2e" -ErrorAction SilentlyContinue
$env:NODARA_E2E = "1"; $env:NODARA_DIST_DIR = ".next-e2e"; $env:DATABASE_URL = ""
if (-not (Step "build-e2e" { & $node node_modules\next\dist\bin\next build })) { $failed = $true; $results | Format-Table | Out-Host; exit 1 }
Remove-Item Env:NODARA_E2E, Env:NODARA_DIST_DIR -ErrorAction SilentlyContinue
$env:NODARA_E2E_SKIP_BUILD = "1"
if ($All) {
  if (-not (Step "e2e (suite completa)" { & $node node_modules\@playwright\test\cli.js test --workers=1 --reporter=line })) { $failed = $true }
  Cleanup-Children
} else { foreach ($f in Get-ChildItem tests\e2e\*.spec.ts) {
  if ($Only.Count -gt 0 -and -not ($Only | Where-Object { $f.Name -like "$_*" })) { continue }
  if (-not (Step "e2e $($f.Name)" { & $node node_modules\@playwright\test\cli.js test "tests/e2e/$($f.Name)" --workers=1 --reporter=line })) { $failed = $true }
  Cleanup-Children
} }
$results.GetEnumerator() | ForEach-Object { "{0,-34} {1}" -f $_.Key, $_.Value } | Tee-Object -FilePath $log -Append | Out-Host
if ($failed) { exit 1 }



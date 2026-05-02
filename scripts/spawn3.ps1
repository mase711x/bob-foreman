# spawn3.ps1 - Spawn 3 parallel Foreman v2 workers with MAX_COINS=4
param([switch]$Wait)

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\tribe\bob-foreman'
Set-Location $root

$ids = @('estimator','status-server','dashboard-v2')

Write-Host "[$(Get-Date -Format HH:mm:ss)] Foreman v2: spawning 3 parallel workers, MAX_COINS=4 each"
Write-Host "Project root: $root"
Write-Host '---'

$jobs = @()
foreach ($id in $ids) {
  $promptFile = Join-Path $root ".foreman-prompts\$id.txt"
  if (-not (Test-Path $promptFile)) {
    Write-Host "SKIP ${id}: prompt file missing at $promptFile" -ForegroundColor Red
    continue
  }
  $prompt = Get-Content -Raw $promptFile
  Write-Host ("[{0}] spawning {1} ({2} chars prompt)" -f (Get-Date -Format HH:mm:ss), $id, $prompt.Length)
  $job = Start-Job -Name "foreman-$id" -ScriptBlock {
    param($id, $prompt, $root)
    & "$root\scripts\spawn-worker.ps1" -TASK_ID $id -PROMPT $prompt -CHAT_MODE 'code' -MAX_COINS 4
  } -ArgumentList $id, $prompt, $root
  $jobs += $job
}

Write-Host '---'
Write-Host ("Spawned {0} jobs: {1}" -f $jobs.Count, ($jobs.Name -join ', '))
Write-Host ("Job IDs: {0}" -f ($jobs.Id -join ', '))
Write-Host ''
Write-Host 'Monitor:    Get-Job'
Write-Host 'Wait all:   Get-Job | Wait-Job'
Write-Host 'See output: Get-Job | Receive-Job -Keep'
Write-Host 'Stop all:   Get-Job | Stop-Job; Get-Job | Remove-Job'
Write-Host ''

if ($Wait) {
  Write-Host 'Waiting for all workers to finish...'
  $jobs | Wait-Job | Out-Null
  Write-Host 'All workers completed. Output:'
  $jobs | Receive-Job
}

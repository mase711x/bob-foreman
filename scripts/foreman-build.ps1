param(
  [Parameter(Mandatory=$true)][string]$ProjectDescription,
  [string[]]$TaskIds = @('shortener-api','shortener-frontend','shortener-tests','shortener-docs'),
  [int]$MaxCoinsPerWorker = 5,
  [switch]$SkipEstimate
)

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\tribe\bob-foreman'
Set-Location $root

Write-Host ''
Write-Host 'FOREMAN BUILD' -ForegroundColor Cyan
Write-Host "  Project:  $ProjectDescription"
Write-Host "  Tasks:    $($TaskIds -join ', ')"
Write-Host "  Coin cap: $MaxCoinsPerWorker per worker"
Write-Host ''

New-Item -ItemType Directory -Force -Path "$root\.foreman\tasks" | Out-Null

# Step 1: Reset state from any previous run
Remove-Item "$root\.foreman\start_time.txt" -ErrorAction SilentlyContinue
Remove-Item "$root\.foreman\end_time.txt" -ErrorAction SilentlyContinue
Get-ChildItem "$root\.foreman\tasks\*.json" -ErrorAction SilentlyContinue | Remove-Item

# Step 2: Estimate via Bob (plan mode, ~0.3 coins)
if (-not $SkipEstimate) {
    Write-Host '[1/5] Asking Bob for sequential estimate...' -ForegroundColor Yellow
    $estimatePrompt = "You are estimating SEQUENTIAL time for ONE Bob to do these tasks ONE AFTER ANOTHER (not parallel). Project: $ProjectDescription. Tasks: $($TaskIds -join ', '). Per task: ~30s setup + 2-5min coding + tests/docs if applicable. Add 20% buffer. Be honest, no overpromising. Respond ONLY with valid JSON: {\`"total_seconds\`": NUMBER}"
    
    $estimateRaw = & bob $estimatePrompt --trust --yolo `
        --instance-id ibm-coding-challenge-uat `
        --team-id ibm-hackathon-6 `
        --chat-mode plan `
        --max-coins 1 `
        --output-format json 2>&1 | Out-String
    
    $match = [regex]::Match($estimateRaw, '\{[^{}]*total_seconds[^{}]*\}')
    if ($match.Success) {
        $match.Value | Set-Content "$root\.foreman\estimate.json" -NoNewline
        Write-Host "    Estimate written: $($match.Value)" -ForegroundColor Green
    } else {
        Write-Host '    Could not parse estimate, fallback to 600s' -ForegroundColor Yellow
        '{"total_seconds": 600}' | Set-Content "$root\.foreman\estimate.json" -NoNewline
    }
} elseif (-not (Test-Path "$root\.foreman\estimate.json")) {
    '{"total_seconds": 600}' | Set-Content "$root\.foreman\estimate.json" -NoNewline
}

# Step 3: Mark start time
Write-Host '[2/5] Starting timer...' -ForegroundColor Yellow
(Get-Date).ToUniversalTime().ToString('o') | Set-Content "$root\.foreman\start_time.txt" -Encoding ASCII -NoNewline

# Step 4: Spawn workers as background jobs
Write-Host "[3/5] Spawning $($TaskIds.Count) workers..." -ForegroundColor Yellow
$jobs = @()
foreach ($id in $TaskIds) {
    $promptFile = "$root\.foreman-prompts\$id.txt"
    if (-not (Test-Path $promptFile)) {
        Write-Host "    SKIP $id (no prompt at $promptFile)" -ForegroundColor Red
        continue
    }
    $prompt = Get-Content -Raw $promptFile
    
    $job = Start-Job -Name "foreman-$id" -ScriptBlock {
        param($id, $prompt, $root, $maxCoins)
        & "$root\scripts\spawn-worker.ps1" -TASK_ID $id -PROMPT $prompt -CHAT_MODE 'code' -MAX_COINS $maxCoins
    } -ArgumentList $id, $prompt, $root, $MaxCoinsPerWorker
    
    $jobs += $job
    Write-Host "    spawned $id (job $($job.Id))" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

if ($jobs.Count -eq 0) {
    Write-Host 'No workers spawned. Aborting.' -ForegroundColor Red
    Remove-Item "$root\.foreman\start_time.txt" -ErrorAction SilentlyContinue
    return
}

# Step 5: Wait for all workers
Write-Host "[4/5] Waiting for $($jobs.Count) workers (live updates on dashboard)..." -ForegroundColor Yellow
$jobs | Wait-Job | Out-Null

# Step 6: Mark end + show results
(Get-Date).ToUniversalTime().ToString('o') | Set-Content "$root\.foreman\end_time.txt" -Encoding ASCII -NoNewline

Write-Host ''
Write-Host '[5/5] DONE' -ForegroundColor Cyan
$jobs | Receive-Job
Write-Host ''
Write-Host 'Dashboard: http://192.168.178.86:8765/dashboard.html'

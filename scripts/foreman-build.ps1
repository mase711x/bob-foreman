param(
  [Parameter(Mandatory=$true)][string]$ProjectDescription,
  [string[]]$TaskIds = @('shortener-api','shortener-frontend','shortener-tests','shortener-docs'),
  [int]$MaxCoinsPerWorker = 5,
  [switch]$SkipEstimate
)

$ErrorActionPreference = 'Continue'
$root = 'C:\Users\tribe\bob-foreman'
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = "$root\foreman-wave-$timestamp.log"

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
    
    try {
        $estimateRaw = & bob $estimatePrompt --trust --yolo `
            --instance-id ibm-coding-challenge-uat `
            --team-id ibm-hackathon-6 `
            --chat-mode plan `
            --max-coins 1 `
            --output-format json 2>&1 | Out-String
        
        "=== Estimate phase ===" | Add-Content $logFile
        $estimateRaw | Add-Content $logFile
        
        if ($LASTEXITCODE -ne 0) {
            throw "bob estimate failed with exit code $LASTEXITCODE"
        }
        
        $match = [regex]::Match($estimateRaw, '\{[^{}]*total_seconds[^{}]*\}')
        if ($match.Success) {
            $match.Value | Set-Content "$root\.foreman\estimate.json" -NoNewline
            Write-Host "    Estimate written: $($match.Value)" -ForegroundColor Green
        } else {
            Write-Host '    Could not parse estimate, fallback to 600s' -ForegroundColor Yellow
            '{"total_seconds": 600}' | Set-Content "$root\.foreman\estimate.json" -NoNewline
        }
    } catch {
        Write-Host "    Estimate failed: $_" -ForegroundColor Red
        Write-Host '    Using fallback: 600s' -ForegroundColor Yellow
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

# === v3-build-stage: BEGIN reviewer integration ===
$reviewerPrompt = "$root\.foreman-prompts\reviewer.txt"
$reviewerScript = "$PSScriptRoot\foreman-review.ps1"

if (-not (Test-Path $reviewerPrompt) -or -not (Test-Path $reviewerScript)) {
    Write-Host '[foreman] Reviewer stage skipped — prerequisites not present (this is expected on v2 builds).' -ForegroundColor Yellow
} else {
    Write-Host '[foreman] Build complete. Starting reviewer pass...' -ForegroundColor Cyan
    
    $workerCount = $TaskIds.Count
    if ($workerCount -eq 0) { $workerCount = 6 }
    $targetRange = "master~$workerCount..HEAD"
    
    $reviewerExitCode = 0
    try {
        & $reviewerScript -Target $targetRange
        $reviewerExitCode = $LASTEXITCODE
    } catch {
        $reviewerExitCode = 1
        Write-Host "    [foreman] Reviewer invocation error: $_" -ForegroundColor Red
    }
    
    if ($reviewerExitCode -eq 0) {
        $reviewerJson = "$root\.foreman\tasks\reviewer.json"
        if (Test-Path $reviewerJson) {
            try {
                $reviewData = Get-Content $reviewerJson -Raw | ConvertFrom-Json
                $found = $reviewData.summary.issues_found
                $fixed = $reviewData.summary.auto_fixed
                $skipped = $reviewData.summary.skipped
                Write-Host "[foreman] Reviewer: $found found, $fixed fixed, $skipped skipped" -ForegroundColor Green
            } catch {
                Write-Host '    [foreman] Could not parse reviewer.json' -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host '[foreman] Reviewer stage failed — see warning above. Build is still considered successful.' -ForegroundColor Yellow
    }
}
# === v3-build-stage: END reviewer integration ===

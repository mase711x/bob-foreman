param(
  [string]$Target = 'master~6..HEAD',
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$scriptDir = Split-Path -Parent $PSScriptRoot
$root = 'C:\Users\tribe\bob-foreman'
$logDir = "$root\logs"
$tasksDir = "$root\.foreman\tasks"
$worktreePath = "$root\worktrees\reviewer"
$promptFile = "$root\.foreman-prompts\reviewer.txt"
$rulesFile = "$root\.bob\rules-foreman-reviewer\01-reviewer.md"

Write-Host ''
Write-Host 'FOREMAN REVIEWER' -ForegroundColor Cyan
Write-Host "  Target:  $Target"
Write-Host "  DryRun:  $DryRun"
Write-Host ''

# Step 1: Verify prerequisites
Write-Host '[1/6] Verifying prerequisites...' -ForegroundColor Yellow

if (-not (Test-Path $promptFile)) {
    Write-Host "ERROR: Missing prerequisite file: $promptFile" -ForegroundColor Red
    Write-Host 'The reviewer prompt must be created first (by v3-reviewer-prompt worker)' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $rulesFile)) {
    Write-Host "ERROR: Missing prerequisite file: $rulesFile" -ForegroundColor Red
    Write-Host 'The reviewer rules must exist in .bob/rules-foreman-reviewer/' -ForegroundColor Red
    exit 1
}

Write-Host '  Prerequisites OK' -ForegroundColor Green

# Step 2: Clean/create worktree
Write-Host '[2/6] Setting up worktree...' -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path $tasksDir | Out-Null

# Remove existing worktree if present
$worktreeList = git -C $root worktree list --porcelain 2>&1 | Out-String
if ($worktreeList -match "worktree.*reviewer") {
    Write-Host '  Removing existing worktree registration...' -ForegroundColor Yellow
    git -C $root worktree remove -f reviewer 2>&1 | Out-Null
}

if (Test-Path $worktreePath) {
    Write-Host '  Cleaning existing worktree directory...' -ForegroundColor Yellow
    Remove-Item -Recurse -Force $worktreePath 2>&1 | Out-Null
}

# Create fresh worktree
$gitOutput = git -C $root worktree add -B "worker/reviewer" $worktreePath master 2>&1
$gitOutput | Out-File "$logDir\reviewer.git.log"

if (-not (Test-Path $worktreePath)) {
    Write-Host 'ERROR: Failed to create worktree' -ForegroundColor Red
    Write-Host "Git output: $gitOutput" -ForegroundColor Red
    exit 1
}

Write-Host "  Worktree created at $worktreePath" -ForegroundColor Green

# Step 3: Prepare prompt with target context
Write-Host '[3/6] Loading prompt...' -ForegroundColor Yellow

$promptContent = Get-Content -Raw $promptFile
$fullPrompt = "$promptContent`n`nReview target: $Target"

Write-Host "  Prompt loaded ($(($promptContent.Length)) chars + target context)" -ForegroundColor Green

# Step 4: Spawn Bob in reviewer mode
Write-Host '[4/6] Spawning Bob reviewer...' -ForegroundColor Yellow

Set-Location $worktreePath

$startTime = Get-Date

Write-Host '  Running Bob CLI...' -ForegroundColor Green

$result = & bob $fullPrompt --trust --yolo `
    --instance-id ibm-coding-challenge-uat `
    --team-id ibm-hackathon-6 `
    --chat-mode foreman-reviewer `
    --max-coins 10 `
    --output-format json 2>&1

$result | Out-File "$logDir\reviewer.json" -Encoding utf8

$elapsed = (Get-Date) - $startTime
Write-Host "  Bob completed in $([int]$elapsed.TotalSeconds)s" -ForegroundColor Green

# Step 5: Commit changes if not DryRun
Write-Host '[5/6] Committing changes...' -ForegroundColor Yellow

if (-not $DryRun) {
    git -C $worktreePath add . 2>&1 | Out-File "$logDir\reviewer.git.log" -Append
    git -C $worktreePath commit -m "fix: reviewer auto-fixes" 2>&1 | Out-File "$logDir\reviewer.git.log" -Append
    Write-Host '  Changes committed' -ForegroundColor Green
} else {
    Write-Host '  DryRun mode: Skipping commit' -ForegroundColor Yellow
}

# Step 6: Verify and copy output files
Write-Host '[6/6] Collecting results...' -ForegroundColor Yellow

$reviewerJsonPath = "$worktreePath\.foreman\tasks\reviewer.json"
$historyJsonPath = "$worktreePath\.foreman\reviewer-history.json"
$targetReviewerJson = "$root\.foreman\tasks\reviewer.json"
$targetHistoryJson = "$root\.foreman\reviewer-history.json"

if (-not (Test-Path $reviewerJsonPath)) {
    Write-Host 'WARNING: reviewer.json was not created by Bob' -ForegroundColor Yellow
    Write-Host "Expected at: $reviewerJsonPath" -ForegroundColor Yellow
    Write-Host 'This is expected if Bob did not complete the review task' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Reviewer: 0 found, 0 fixed, 0 skipped (no output)' -ForegroundColor Yellow
    Write-Host ''
    exit 0
}

# Copy reviewer.json
Copy-Item $reviewerJsonPath $targetReviewerJson -Force
Write-Host "  Copied reviewer.json to root" -ForegroundColor Green

# Copy reviewer-history.json if it exists
if (Test-Path $historyJsonPath) {
    Copy-Item $historyJsonPath $targetHistoryJson -Force
    Write-Host "  Copied reviewer-history.json to root" -ForegroundColor Green
}

# Parse and display summary
try {
    $reviewerData = Get-Content $targetReviewerJson -Raw | ConvertFrom-Json
    $summary = $reviewerData.summary
    $runId = $reviewerData.run_id
    
    Write-Host ''
    Write-Host "Reviewer: $($summary.issues_found) found, $($summary.auto_fixed) fixed, $($summary.skipped) skipped (run_id $runId)" -ForegroundColor Cyan
    Write-Host ''
    
    if ($DryRun) {
        Write-Host 'DryRun mode: No commits were made' -ForegroundColor Yellow
    }
    
    exit 0
} catch {
    Write-Host 'WARNING: Could not parse reviewer.json summary' -ForegroundColor Yellow
    Write-Host "File exists at: $targetReviewerJson" -ForegroundColor Yellow
    exit 0
}

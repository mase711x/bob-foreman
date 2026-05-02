param(
  [Parameter(Mandatory=$true)][string]$TASK_ID,
  [Parameter(Mandatory=$true)][string]$PROMPT,
  [string]$CHAT_MODE = 'code',
  [int]$MAX_COINS = 5
)

$ErrorActionPreference = 'Continue'
$root = 'C:\Users\tribe\bob-foreman'
$logDir = "$root\logs"
$tasksDir = "$root\.foreman\tasks"
$worktreePath = "$root\worktrees\$TASK_ID"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path $tasksDir | Out-Null

# Status: queued
'{"status":"queued"}' | Out-File "$tasksDir\$TASK_ID.json" -Encoding ASCII -NoNewline

# Setup log marker (for status-server discovery + 60s running detection)
"[setup] Creating worktree for $TASK_ID..." | Out-File "$logDir\$TASK_ID.setup.log" -Encoding ASCII

# Create worktree (-B = create or reset branch even if it exists)
git -C $root worktree add -B "worker/$TASK_ID" $worktreePath master 2>&1 | Out-File "$logDir\$TASK_ID.git.log"

if (-not (Test-Path $worktreePath)) {
    '{"status":"error"}' | Out-File "$tasksDir\$TASK_ID.json" -Encoding ASCII -NoNewline
    Write-Output "Worker $TASK_ID FAILED at worktree creation"
    return
}

# Status: running
'{"status":"running"}' | Out-File "$tasksDir\$TASK_ID.json" -Encoding ASCII -NoNewline

# Run bob INSIDE the worktree (correct CWD = critical fix!)
Set-Location $worktreePath
"[bob] Bob starting in $worktreePath..." | Out-File "$logDir\$TASK_ID.setup.log" -Append -Encoding ASCII

$result = & bob $PROMPT --trust --yolo `
    --instance-id ibm-coding-challenge-uat `
    --team-id ibm-hackathon-6 `
    --chat-mode $CHAT_MODE `
    --max-coins $MAX_COINS `
    --output-format json 2>&1

$result | Out-File "$logDir\$TASK_ID.json" -Encoding utf8

# Commit changes IN the worktree
git -C $worktreePath add . 2>&1 | Out-File "$logDir\$TASK_ID.git.log" -Append
git -C $worktreePath commit -m "worker: $TASK_ID done" 2>&1 | Out-File "$logDir\$TASK_ID.git.log" -Append

# Status: done
'{"status":"done"}' | Out-File "$tasksDir\$TASK_ID.json" -Encoding ASCII -NoNewline

Write-Output "Worker $TASK_ID completed at $worktreePath"

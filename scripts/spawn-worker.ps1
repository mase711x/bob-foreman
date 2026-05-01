param([string]$TASK_ID, [string]$PROMPT, [string]$CHAT_MODE="code", [int]$MAX_COINS=5)
$logDir = "C:\Users\tribe\bob-foreman\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
git -C "C:\Users\tribe\bob-foreman" checkout -b "worker/$TASK_ID" 2>$null
$result = & bob $PROMPT --trust --yolo --instance-id ibm-coding-challenge-uat --team-id ibm-hackathon-6 --chat-mode $CHAT_MODE --max-coins $MAX_COINS --output-format json 2>&1
$result | Out-File "$logDir\$TASK_ID.json" -Encoding utf8
git -C "C:\Users\tribe\bob-foreman" add . 2>$null
git -C "C:\Users\tribe\bob-foreman" commit -m "worker: $TASK_ID done" 2>$null
Write-Output "Worker $TASK_ID completed"

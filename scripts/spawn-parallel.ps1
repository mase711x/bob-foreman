param([string[]]$TASK_IDS, [string[]]$PROMPTS, [string[]]$MODES)
$jobs = @()
for($i=0; $i -lt $TASK_IDS.Count; $i++) {
  $id = $TASK_IDS[$i]; $prompt = $PROMPTS[$i]; $mode = if($MODES[$i]) {$MODES[$i]} else {"code"}
  $jobs += Start-Job -ScriptBlock { param($id,$prompt,$mode)
    & "C:\Users\tribe\bob-foreman\scripts\spawn-worker.ps1" -TASK_ID $id -PROMPT $prompt -CHAT_MODE $mode
  } -ArgumentList $id,$prompt,$mode
}
$jobs | Wait-Job | Receive-Job
Write-Output "All $($TASK_IDS.Count) workers completed"

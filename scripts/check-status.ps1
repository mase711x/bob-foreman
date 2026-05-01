$logDir = "C:\Users\tribe\bob-foreman\logs"
$logs = Get-ChildItem $logDir -Filter "*.json" 2>$null
if(-not $logs) { Write-Output "No workers running"; exit }
Write-Output "Worker Status:"
Write-Output ("-" * 50)
foreach($log in $logs) {
  $id = $log.BaseName
  $size = $log.Length
  $modified = $log.LastWriteTime
  $status = if($size -gt 10) {"done"} else {"running"}
  Write-Output "[$status] $id - $modified"
}

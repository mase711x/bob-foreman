Set-Location C:\Users\tribe\bob-foreman
$f = 'status-server.cjs'
$c = Get-Content -Raw $f
$old = 'res.json(response);'
$new = @'
const aliased = Object.assign({}, response, { started_at: response.start_time, ended_at: response.end_time, estimate_seconds: response.estimate ? response.estimate.total_seconds : null, workers: (response.workers || []).map(function(w) { return Object.assign({}, w, { coins_used: w.coins }); }) });
  res.json(aliased);
'@
$count = ([regex]::Matches($c, [regex]::Escape($old))).Count
Write-Host "Found $count occurrences of res.json(response)"
$c = $c -replace [regex]::Escape($old), $new
Set-Content -Path $f -Value $c -NoNewline
Write-Host 'Patched.'

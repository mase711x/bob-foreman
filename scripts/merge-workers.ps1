$repo = "C:\Users\tribe\bob-foreman"
git -C $repo checkout main 2>$null
$branches = git -C $repo branch | Where-Object { $_ -match "worker/" } | ForEach-Object { $_.Trim() }
foreach($branch in $branches) {
  Write-Output "Merging $branch..."
  git -C $repo merge $branch --no-edit 2>&1
  if($LASTEXITCODE -eq 0) { Write-Output "Merged $branch OK" }
  else { Write-Output "Conflict in $branch - skipping" }
}
Write-Output "Merge complete. Branches: $($branches.Count)"

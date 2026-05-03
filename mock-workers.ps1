Set-Location C:\Users\tribe\bob-foreman
New-Item -ItemType Directory -Force -Path .foreman\tasks | Out-Null
New-Item -ItemType Directory -Force -Path logs | Out-Null

# 3 Worker tasks
'{"status": "done", "name": "shortener-api"}'  | Set-Content .foreman\tasks\shortener-api.json -NoNewline
'{"status": "running", "name": "shortener-frontend"}' | Set-Content .foreman\tasks\shortener-frontend.json -NoNewline
'{"status": "done", "name": "shortener-tests"}' | Set-Content .foreman\tasks\shortener-tests.json -NoNewline

# Setup logs (for discovery)
'[setup] worktree created' | Set-Content logs\shortener-api.setup.log
'[setup] worktree created' | Set-Content logs\shortener-frontend.setup.log
'[setup] worktree created' | Set-Content logs\shortener-tests.setup.log

# Bob output logs (for coin extraction)
'{"coins": 2.10}' | Set-Content logs\shortener-api.json -NoNewline
'{"coins": 1.40}' | Set-Content logs\shortener-frontend.json -NoNewline
'{"coins": 0.95}' | Set-Content logs\shortener-tests.json -NoNewline

# Touch frontend log so 'running' detection works (within 60s)
(Get-Item logs\shortener-frontend.setup.log).LastWriteTime = Get-Date

Write-Host 'Mock workers created.'
Get-ChildItem .foreman\tasks
Get-ChildItem logs | Where-Object { $_.Name -like 'shortener*' }

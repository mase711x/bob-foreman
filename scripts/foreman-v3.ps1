# Bob Foreman v3 - Two-Wave Build
#
# Wave 1: Foundation (no shared file targets) - 3 workers parallel
# Wave 2: Integration (depends on Wave 1) - 3 workers parallel
#
# This wrapper runs both waves sequentially, waiting for Wave 1 to merge
# before Wave 2 starts. Use foreman-build.ps1 directly if you want fine
# control over a single wave.

param(
    [switch]$SkipWave1,   # for re-runs: Wave 1 already done
    [switch]$Wave1Only,   # stop after Wave 1
    [switch]$DryRun       # plan only, don't spawn
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$wave1 = @('v3-coin-fix', 'v3-reviewer-prompt', 'v3-review-script')
$wave2 = @('v3-status-api', 'v3-dashboard-card', 'v3-build-stage')

Write-Host ''
Write-Host '=== Bob Foreman v3 Build ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Wave 1 (foundation):' -ForegroundColor Yellow
$wave1 | ForEach-Object { Write-Host "  - $_" }
Write-Host ''
Write-Host 'Wave 2 (integration, after Wave 1 merged):' -ForegroundColor Yellow
$wave2 | ForEach-Object { Write-Host "  - $_" }
Write-Host ''

if ($DryRun) {
    Write-Host '[dry-run] Stopping here — no spawn.' -ForegroundColor Magenta
    exit 0
}

# === Wave 1 ===
if (-not $SkipWave1) {
    Write-Host '>>> Spawning Wave 1...' -ForegroundColor Green
    & "$PSScriptRoot\foreman-build.ps1" -TaskIds $wave1 `
        -ProjectDescription 'Bob Foreman v3 Wave 1: coin-tracking fix, reviewer prompt template, standalone review runner script'
    if ($LASTEXITCODE -ne 0) {
        Write-Host '>>> Wave 1 failed. Stopping before Wave 2.' -ForegroundColor Red
        exit 1
    }
    Write-Host '>>> Wave 1 merged successfully.' -ForegroundColor Green
} else {
    Write-Host '>>> Skipping Wave 1 (--SkipWave1 set).' -ForegroundColor Magenta
}

if ($Wave1Only) {
    Write-Host '>>> Stopping after Wave 1 (-Wave1Only set).' -ForegroundColor Magenta
    exit 0
}

# Brief pause so the dashboard cleanly transitions Wave 1 -> Wave 2
Start-Sleep -Seconds 5

# === Wave 2 ===
Write-Host '>>> Spawning Wave 2...' -ForegroundColor Green
& "$PSScriptRoot\foreman-build.ps1" -TaskIds $wave2 `
    -ProjectDescription 'Bob Foreman v3 Wave 2: /api/reviewer endpoint, dashboard issues-fixed card, foreman-build reviewer stage integration'
if ($LASTEXITCODE -ne 0) {
    Write-Host '>>> Wave 2 failed.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '=== v3 Build Complete ===' -ForegroundColor Cyan
Write-Host 'Next steps:'
Write-Host '  1. Verify dashboard shows the new "Issues Auto-Fixed" card'
Write-Host '  2. Run .\scripts\foreman-review.ps1 -DryRun to test the reviewer pipeline'
Write-Host '  3. Tag v0.2.0-alpha when verified'
Write-Host ''

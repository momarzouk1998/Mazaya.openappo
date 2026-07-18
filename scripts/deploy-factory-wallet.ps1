# ============================================================
# deploy-factory-wallet.ps1
# Deploy Factory Wallet + Worker Wages to production server.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-factory-wallet.ps1
#
# Steps:
#   1. Local verification (typecheck + tests + build). Stops if any fails.
#   2. git push to main.
#   3. GitHub Actions builds image + deploys to server.
#   4. On the server, prisma migrate deploy runs automatically at container
#      startup, so the payment_kind column is applied with no manual DB work.
# ============================================================

$ErrorActionPreference = "Stop"

# Go to project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Factory Wallet + Worker Wages Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# [1] Local verification
# ============================================================
Write-Host "[1/3] Running local verification..." -ForegroundColor Yellow

$bashCheck = Get-Command bash -ErrorAction SilentlyContinue
if ($bashCheck) {
    Write-Host "  -> Running verify-factory-wallet.sh" -ForegroundColor Gray
    bash scripts/verify-factory-wallet.sh
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "FAIL: Local verification failed. Deploy aborted." -ForegroundColor Red
        Write-Host "  Run manually to see details: bash scripts/verify-factory-wallet.sh" -ForegroundColor Gray
        exit 1
    }
    Write-Host "  OK: All 23 checks passed" -ForegroundColor Green
} else {
    Write-Host "  -> bash not found, running typecheck + build" -ForegroundColor Gray
    Write-Host "  -> typecheck..." -ForegroundColor Gray
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: typecheck failed" -ForegroundColor Red; exit 1 }

    Write-Host "  -> build..." -ForegroundColor Gray
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: build failed" -ForegroundColor Red; exit 1 }
    Write-Host "  OK: typecheck + build passed" -ForegroundColor Green
}

# ============================================================
# [2] git status check
# ============================================================
Write-Host ""
Write-Host "[2/3] Checking git..." -ForegroundColor Yellow

$status = git status --porcelain
if ($status) {
    Write-Host "  WARNING: There are uncommitted changes:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    Write-Host ""
    $answer = Read-Host "  Commit all before push? (y/N)"
    if ($answer -eq "y" -or $answer -eq "Y") {
        git add -A
        $msg = Read-Host "  Commit message (default: feat: factory wallet changes)"
        if (-not $msg) { $msg = "feat: factory wallet changes" }
        git commit -m $msg
        Write-Host "  OK: Committed" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Continuing without commit (local changes will NOT be pushed)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  OK: No pending changes (all committed)" -ForegroundColor Green
}

# ============================================================
# [3] git push
# ============================================================
Write-Host ""
Write-Host "[3/3] Pushing code to GitHub..." -ForegroundColor Yellow

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Write-Host "  WARNING: You are on branch '$branch' not 'main'" -ForegroundColor Yellow
    $answer = Read-Host "  Continue anyway? (y/N)"
    if ($answer -ne "y" -and $answer -ne "Y") {
        Write-Host "  Aborted." -ForegroundColor Gray
        exit 0
    }
}

git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "FAIL: Push failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  OK: Code pushed successfully" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Monitor the pipeline at:" -ForegroundColor Cyan
Write-Host "  https://github.com/momarzouk1998/Mazaya.openappo/actions" -ForegroundColor White
Write-Host ""
Write-Host "ETA: 3-5 minutes" -ForegroundColor Yellow
Write-Host ""
Write-Host "Notes:" -ForegroundColor Yellow
Write-Host "  - The migration (payment_kind) is applied automatically on the server" -ForegroundColor Gray
Write-Host "    when the container starts (prisma migrate deploy in Dockerfile)" -ForegroundColor Gray
Write-Host "  - Factory Wallet appears for admins in the sidebar automatically" -ForegroundColor Gray
Write-Host "  - Worker Wages tab appears in /workers page" -ForegroundColor Gray
Write-Host ""

# ============================================================
# deploy-factory-wallet.ps1
# ============================================================
# سكربت PowerShell لنشر محفظة المصنع + أجور العمال على السيرفر.
#
# الاستخدام:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-factory-wallet.ps1
#
# بيعمل:
#   1. فحص محلي كامل (typecheck + tests + build) — لو أي فحص فشل يقف
#   2. git push لـ main
#   3. GitHub Actions يبني الصورة + يـ deploy على السيرفر
#   4. على السيرفر، prisma migrate deploy بيتطبّق اوتوماتيك عند إقلاع الـ container
#      → العمود payment_kind هيـ apply من نفسه
#
# ملاحظة: الـ migration بيـ apply اوتوماتيك على السيرفر بفضل السطر ده في Dockerfile:
#   prisma migrate deploy 2>/dev/null || echo '...'
# ============================================================

$ErrorActionPreference = "Stop"

# رجّع لـ root المشروع
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  نشر محفظة المصنع + أجور العمال" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# [1] فحص محلي (لو أي حاجة فشلت، يقف وميرفعش)
# ============================================================
Write-Host "[1/3] تشغيل الفحص المحلي..." -ForegroundColor Yellow

# شغّل سكربت bash للفحص (Git Bash لازم يكون موجود)
$bashCheck = Get-Command bash -ErrorAction SilentlyContinue
if ($bashCheck) {
    Write-Host "  → تشغيل verify-factory-wallet.sh" -ForegroundColor Gray
    bash scripts/verify-factory-wallet.sh
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ الفحص المحلي فشل. تم إيقاف النشر." -ForegroundColor Red
        Write-Host "   شغّل السكربت يدويًا لتحديد المشكلة: bash scripts/verify-factory-wallet.sh" -ForegroundColor Gray
        exit 1
    }
    Write-Host "  ✅ الفحص عدى (23/23)" -ForegroundColor Green
} else {
    # fallback: typecheck + build فقط لو bash مش موجود
    Write-Host "  → bash مش موجود، تشغيل typecheck + build" -ForegroundColor Gray
    Write-Host "  → typecheck..." -ForegroundColor Gray
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { Write-Host "❌ typecheck فشل" -ForegroundColor Red; exit 1 }

    Write-Host "  → build..." -ForegroundColor Gray
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "❌ build فشل" -ForegroundColor Red; exit 1 }
    Write-Host "  ✅ typecheck + build عدّوا" -ForegroundColor Green
}

# ============================================================
# [2] git status — تأكد إن في تغييرات متـ commit
# ============================================================
Write-Host ""
Write-Host "[2/3] فحص git..." -ForegroundColor Yellow

$status = git status --porcelain
if ($status) {
    Write-Host "  ⚠️  فيه تغييرات مش متـ commit:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    Write-Host ""
    $answer = Read-Host "  تعمل commit للكل قبل الـ push؟ (y/N)"
    if ($answer -eq "y" -or $answer -eq "Y") {
        git add -A
        $msg = Read-Host "  رسالة الـ commit (افتراضي: 'feat: factory wallet changes')"
        if (-not $msg) { $msg = "feat: factory wallet changes" }
        git commit -m $msg
        Write-Host "  ✅ تم الـ commit" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  كملنا من غير commit (التغييرات المحلية مش هتترفع)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✅ مفيش تغييرات معلّقة (كل حاجة متـ commit)" -ForegroundColor Green
}

# ============================================================
# [3] git push
# ============================================================
Write-Host ""
Write-Host "[3/3] رفع الكود لـ GitHub..." -ForegroundColor Yellow

# تأكد إن على branch main
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Write-Host "  ⚠️  أنت على branch '$branch' مش 'main'" -ForegroundColor Yellow
    $answer = Read-Host "  تكمل برضه؟ (y/N)"
    if ($answer -ne "y" -and $answer -ne "Y") {
        Write-Host "  تم الإيقاف." -ForegroundColor Gray
        exit 0
    }
}

git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ الـ push فشل." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ الكود اترفع بنجاح" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 راقب الـ pipeline هنا:" -ForegroundColor Cyan
Write-Host "   https://github.com/momarzouk1998/Elnazlawy.openappo/actions" -ForegroundColor White
Write-Host "   (أو repo الـ mazaya اللي بتشتغل عليه)" -ForegroundColor Gray
Write-Host ""
Write-Host "⏱️  الوقت المتوقع: 3-5 دقايق" -ForegroundColor Yellow
Write-Host ""
Write-Host "🏥 بعد ما يخلّص، تأكد من الموقع:" -ForegroundColor Cyan
$remoteUrl = git remote get-url origin
Write-Host "   $remoteUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 ملاحظات:" -ForegroundColor Yellow
Write-Host "   - الـ migration (payment_kind) بيتـ apply اوتوماتيك على السيرفر" -ForegroundColor Gray
Write-Host "     لما الـ container يقلع (prisma migrate deploy في Dockerfile)" -ForegroundColor Gray
Write-Host "   - محفظة المصنع هتظهر للأدمن في السايدبار تلقائيًا" -ForegroundColor Gray
Write-Host "   - تبويب 'أجور العمال' هتظهر في صفحة /workers" -ForegroundColor Gray
Write-Host ""

#!/usr/bin/env bash
# ============================================================
# verify-factory-wallet.sh
# ============================================================
# سكربت التحقق من تنفيذ "محفظة المصنع + أجور العمال".
# يشغّل كل الفحوصات بالترتيب ويعمل apply للـ migration.
#
# الاستخدام:
#   bash scripts/verify-factory-wallet.sh          # فحص فقط
#   bash scripts/verify-factory-wallet.sh --apply  # فحص + apply migration
#
# يعمل على Windows/Git Bash وLinux/macOS.
# ============================================================

set -u  # أخطأ لو متغير مش مستخدم (لا -e عشان نكمّل الفحوصات ونلخّب النتيجة)

# ألوان للطباعة (تتعطل تلقائيًا لو الـ terminal مش مدعوم)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BLUE=''; NC=''
fi

PASS=0
FAIL=0
STEP=0

# اطبع عنوان خطوة
step() {
  STEP=$((STEP + 1))
  echo ""
  echo -e "${BLUE}━━━ [$STEP] $1 ━━━${NC}"
}

# نتيجة OK/FAIL مع عدّاد
ok()   { echo -e "${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL + 1)); }

# تتبع هل نعمل apply للـ migration ولا فحص بس
DO_APPLY=false
if [ "${1:-}" = "--apply" ]; then
  DO_APPLY=true
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  التحقق من محفظة المصنع + أجور العمال                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
[ "$DO_APPLY" = true ] && echo -e "${YELLOW}الوضع: فحص + apply migration${NC}" || echo -e "${YELLOW}الوضع: فحص فقط (للـ apply استخدم --apply)${NC}"

# لازم نكون جوّا root المشروع
cd "$(dirname "$0")/.." || { echo "تعذّر تحديد root المشروع"; exit 1; }

# ============================================================
# [1] فحص إن الملفات الأساسية موجودة
# ============================================================
step "فحص وجود الملفات الأساسية"

check_file() {
  if [ -f "$1" ]; then ok "موجود: $1"; else fail "ناقص: $1"; fi
}

check_file "src/app/factory-wallet/page.tsx"
check_file "src/app/factory-wallet/_wallet-cards.tsx"
check_file "src/app/factory-wallet/_wallet-table.tsx"
check_file "src/app/api/factory-wallet/route.ts"
check_file "src/app/workers/_wages-tab.tsx"
check_file "tests/finance-wages.test.ts"
check_file "prisma/migrations/20260718_add_overhead_payment_kind/migration.sql"

# ============================================================
# [2] فحص محتوى الكود (grep على النقاط الحساسة)
# ============================================================
step "فحص محتوى الكود"

if grep -q "'أجور عمال'" src/lib/finance.ts; then
  ok "finance.ts فيه نوع 'أجور عمال'"
else
  fail "finance.ts ناقص نوع 'أجور عمال'"
fi

if grep -q "أجور عمال" src/lib/format.ts; then
  ok "format.ts فيه label/color لـ 'أجور عمال'"
else
  fail "format.ts ناقص label/color لـ 'أجور عمال'"
fi

if grep -q "factory_wallet" src/lib/auth.ts; then
  ok "auth.ts مسجّل موديول factory_wallet"
else
  fail "auth.ts ناقص موديول factory_wallet"
fi

# التمريري مستثنى من المحفظة
if grep -q "is_pass_through" src/app/api/factory-wallet/route.ts; then
  ok "factory-wallet API بيستثني التمريري"
else
  fail "factory-wallet API مش بيتعامل مع التمريري"
fi

# أجور العمال اتشالت من مداخل النثريات
if grep -q "أجور عمال" src/app/overhead/_new-overhead-form.tsx; then
  fail "أجور العمال لسه في فورم النثريات (المفروض نشيلها)"
else
  ok "أجور العمال اتشالت من فورم النثريات"
fi

if grep -q 'value: "أجور عمال"' src/app/journal/_panels.tsx; then
  fail "أجور العمال لسه في journal panel (CATS)"
else
  ok "أجور العمال اتشالت من journal panel"
fi

# أجور العمال بتربط بـ entry_type صح في الـ API
if grep -q "isWages ? 'أجور عمال'" src/app/api/overhead/route.ts; then
  ok "overhead API بيربط category بأجور العمال بـ entry_type الصحيح"
else
  fail "overhead API مش بيربط category بأجور العمال"
fi

# payment_kind في schema
if grep -q "payment_kind" prisma/schema.prisma; then
  ok "schema.prisma فيه payment_kind"
else
  fail "schema.prisma ناقص payment_kind"
fi

# تبويب أجور في صفحة العمال
if grep -q "WagesTab" src/app/workers/page.tsx; then
  ok "workers/page.tsx فيه تبويب WagesTab"
else
  fail "workers/page.tsx ناقص تبويب WagesTab"
fi

# ============================================================
# [3] typecheck
# ============================================================
step "TypeScript typecheck"
if npm run typecheck > /tmp/mz_typecheck.log 2>&1; then
  ok "typecheck ناجح"
else
  fail "typecheck فشل — آخر 15 سطر:"
  tail -15 /tmp/mz_typecheck.log | sed 's/^/    /'
fi

# ============================================================
# [4] اختبار finance-wages
# ============================================================
step "اختبار finance-wages"
if node --experimental-strip-types --no-warnings=ExperimentalWarning tests/finance-wages.test.ts > /tmp/mz_wages.log 2>&1; then
  ok "finance-wages.test.ts عدى"
else
  fail "finance-wages.test.ts فشل:"
  tail -10 /tmp/mz_wages.log | sed 's/^/    /'
fi

# ============================================================
# [5] اختبار inventory (تأكد إن مفيش كسر)
# ============================================================
step "اختبار inventory flow (لا كسر)"
if npm run test:inventory > /tmp/mz_inv.log 2>&1; then
  ok "test:inventory عدى"
else
  fail "test:inventory فشل:"
  tail -10 /tmp/mz_inv.log | sed 's/^/    /'
fi

# ============================================================
# [6] prisma generate
# ============================================================
step "Prisma client generate"
if npx prisma generate > /tmp/mz_prisma.log 2>&1; then
  ok "prisma generate ناجح"
else
  fail "prisma generate فشل:"
  tail -10 /tmp/mz_prisma.log | sed 's/^/    /'
fi

# ============================================================
# [7] migration (deploy) — لو --apply
# ============================================================
step "Migration (overhead_expenses.payment_kind)"
if [ "$DO_APPLY" = true ]; then
  if npx prisma migrate deploy > /tmp/mz_migrate.log 2>&1; then
    ok "prisma migrate deploy ناجح"
    # اطبع ملخص الـ migrations المطبّقة
    grep -E "applied|Already at" /tmp/mz_migrate.log | sed 's/^/    /' || true
  else
    fail "prisma migrate deploy فشل:"
    tail -15 /tmp/mz_migrate.log | sed 's/^/    /'
  fi
else
  if grep -q "payment_kind" prisma/migrations/20260718_add_overhead_payment_kind/migration.sql 2>/dev/null; then
    ok "ملف الـ migration موجود وصحيح (للتطبيق استخدم --apply)"
  else
    fail "ملف الـ migration ناقص أو تالف"
  fi
fi

# ============================================================
# [8] build (إنتاج) — أثقل فحص
# ============================================================
step "Build الإنتاجي"
if npm run build > /tmp/mz_build.log 2>&1; then
  ok "build ناجح"
  # تأكد إن factory-wallet route موجود في المخرجات
  if grep -q "factory-wallet" /tmp/mz_build.log; then
    ok "route /factory-wallet موجود في build"
  else
    fail "route /factory-wallet مش موجود في build"
  fi
else
  fail "build فشل — آخر 20 سطر:"
  tail -20 /tmp/mz_build.log | sed 's/^/    /'
fi

# ============================================================
# النتيجة النهائية
# ============================================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ كل الفحوصات عدت بنجاح ($PASS/$TOTAL)${NC}"
  EXIT_CODE=0
else
  echo -e "${RED}❌ فشل $FAIL من $TOTAL فحص${NC}"
  EXIT_CODE=1
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

exit $EXIT_CODE

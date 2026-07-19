#!/usr/bin/env bash
# ============================================================
# fix-db-permissions.sh
# ============================================================
# إصلاح صلاحيات قاعدة البيانات لمستخدم تطبيق مازايا.
#
# المشكلة: الجدول customer_payments (وقد يحصل لجداول أخرى) أنشأه
# migration بـ مستخدم مختلف، فتطبيق مازايا مابيقدرش يقرأه
# → "permission denied for table customer_payments" (PostgreSQL 42501)
# → صفحات بيضاء.
#
# الحل: منح صلاحيات كاملة لكل الجداول في schema mazaya للمستخدم
#        اللي بيتصل بيه التطبيق + ضبط default privileges للجداول الجاية.
#
# طريقة الاستخدام: على السيرفر (root@64.226.118.40) الصق السكربت ده.
# ============================================================

set +e

echo "================================================"
echo "  إصلاح صلاحيات DB لمستخدم مازايا"
echo "  $(date)"
echo "================================================"
echo ""

# ---------- [1] استخراج DATABASE_URL من حاوية مازايا ----------
echo "=== [1] استخراج DATABASE_URL من furniture-xhl2yk ==="
# الطريقة 1: من env الحاوية
DB_URL=$(docker service inspect furniture-xhl2yk \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep '^DATABASE_URL=' | head -1 | sed 's/^DATABASE_URL=//')

# الطريقة 2: من ملف .env لو الأولانية فشلت
if [ -z "$DB_URL" ]; then
  for envfile in /opt/mazaya/.env /opt/furniture/.env /root/.mazaya.env; do
    if [ -f "$envfile" ]; then
      DB_URL=$(grep '^DATABASE_URL=' "$envfile" 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"')
      if [ -n "$DB_URL" ]; then
        echo "  (تم القراءة من $envfile)"
        break
      fi
    fi
  done
fi

if [ -z "$DB_URL" ]; then
  echo "  ⚠️  تعذّر استخراج DATABASE_URL تلقائيًا."
  echo "  اكتب DATABASE_URL يدويًا (شكل: postgresql://USER:PASS@HOST:PORT/DB):"
  read -r DB_URL
fi

# نخفي كلمة السر من العرض
SAFE_URL=$(echo "$DB_URL" | sed 's|://[^@]*@|://***@|')
echo "  DATABASE_URL: $SAFE_URL"
echo ""

# ---------- [2] استخراج USER و DB و HOST من الـ URL ----------
# postgresql://USER:PASS@HOST:PORT/DB
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
[ "$DB_PORT" = "$DB_URL" ] && DB_PORT=5432

echo "  DB User: $DB_USER"
echo "  DB Name: $DB_NAME"
echo "  DB Host: $DB_HOST:$DB_PORT"
echo ""

# ---------- [3] التشخيص قبل الإصلاح ----------
echo "=== [2] قبل الإصلاح: من يملك customer_payments؟ ==="

# نحدد اسم حاوية postgres
PG_CONTAINER=""
for c in mazaya-postgres postgres db; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^$c"; then
    PG_CONTAINER="$c"
    break
  fi
done
# fallback: أول حاوية فيها postgres في اسمها
if [ -z "$PG_CONTAINER" ]; then
  PG_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'postgres|pg-|db' | head -1)
fi

if [ -z "$PG_CONTAINER" ]; then
  echo "  ⚠️  ما لقيتش حاوية postgres. الجداول بـ psql مباشرة لو متسطب."
  PSQL_CMD="psql"
else
  echo "  حاوية postgres: $PG_CONTAINER"
  PSQL_CMD="docker exec -i $PG_CONTAINER psql"
  # نستخدم يوزر postgres السوبر داخل الحاوية عشان نقدر نعمل GRANT
  PSQL_CMD="docker exec -i $PG_CONTAINER psql -U postgres -d $DB_NAME"
fi
echo ""

echo "  --- مالك الجداول في schema mazaya ---"
$PSQL_CMD -c "
  SELECT tablename, tableowner
  FROM pg_tables
  WHERE schemaname = 'mazaya'
  ORDER BY tablename;
" 2>&1 | head -40
echo ""

echo "  --- صلاحيات customer_payments ---"
$PSQL_CMD -c "
  SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mazaya' AND table_name = 'customer_payments'
  ORDER BY grantee, privilege_type;
" 2>&1 | head -20
echo ""

# ---------- [4] الإصلاح: GRANT على كل الجداول ----------
echo "=== [3] تطبيق الإصلاح (GRANT ALL على كل جداول mazaya) ==="

# منح صلاحيات كاملة للمستخدم على كل الجداول الموجودة في الـ schema
$PSQL_CMD <<EOF
-- صلاحيات على الـ schema نفسه
GRANT USAGE, CREATE ON SCHEMA mazaya TO $DB_USER;

-- صلاحيات كاملة على كل الجداول الموجودة
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mazaya TO $DB_USER;

-- صلاحيات على السلاسل (sequences)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA mazaya TO $DB_USER;

-- مهم: صلاحيات افتراضية للجداول الجاية (لو migration ضاف جدول جديد)
ALTER DEFAULT PRIVILEGES IN SCHEMA mazaya
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA mazaya
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $DB_USER;

-- لو الجدول مملوك لمستخدم تاني، خلّي الـ owner هو superuser الحالي
-- (مش ضروري بس نضمن إن migrations جاية تشتغل صح)
EOF

echo "  تم تنفيذ GRANT."
echo ""

# ---------- [5] التحقق بعد الإصلاح ----------
echo "=== [4] بعد الإصلاح: صلاحيات customer_payments ==="
$PSQL_CMD -c "
  SELECT grantee, string_agg(privilege_type, ', ') AS privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mazaya' AND table_name = 'customer_payments'
  GROUP BY grantee
  ORDER BY grantee;
" 2>&1 | head -20
echo ""

echo "=== [5] اختبار: هل المستخدم يقدر يقرأ customer_payments؟ ==="
# نجرب نقرا باليوزر الفعلي
PG_CONTAINER_EXEC=""
if [ -n "$PG_CONTAINER" ]; then
  PG_CONTAINER_EXEC="$PG_CONTAINER"
fi

if [ -n "$PG_CONTAINER_EXEC" ]; then
  TEST_RESULT=$(docker exec -i "$PG_CONTAINER_EXEC" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM mazaya.customer_payments;" 2>&1)
  echo "  SELECT COUNT(*) FROM mazaya.customer_payments (كمستخدم $DB_USER):"
  echo "  → $TEST_RESULT"
else
  echo "  (تعذّر الاختبار المباشر — تأكد من الـ logs بعد كده)"
fi
echo ""

# ---------- [6] اختبار HTTP على customer-payments API ----------
echo "=== [6] اختبار /api/customer-payments ==="
for port in 3000 3001 3002; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$port/api/customer-payments" 2>/dev/null)
  echo "  http://127.0.0.1:$port/api/customer-payments → HTTP $CODE"
done
echo ""

echo "================================================"
echo "  تم الإصلاح — لو كل حاجة فوق ظهرت صح،"
echo "  الصفحات البيضاء هتختفي فورًا من غير restart."
echo "  (العميل محتاج يعمل refresh للموقع)"
echo "================================================"

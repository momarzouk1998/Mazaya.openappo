#!/usr/bin/env bash
# ============================================================
# fix-db-permissions-v2.sh
# ============================================================
# النسخة المصححة: نستخدم DATABASE_URL بالظبط عشان الـ connection،
# مش بنعتمد على role "root" أو unix socket.
#
# بندوّر على superuser عشان نقدر نعمل GRANT (user الـ app مابيقدرش
# يعمل GRANT على جداول مش بتاعته).
# ============================================================

set +e

echo "================================================"
echo "  إصلاح صلاحيات DB — النسخة 2"
echo "  $(date)"
echo "================================================"
echo ""

# ---------- [1] استخراج DATABASE_URL ----------
DB_URL=$(docker service inspect furniture-xhl2yk \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep '^DATABASE_URL=' | head -1 | sed 's/^DATABASE_URL=//;s/^"//;s/"$//')

if [ -z "$DB_URL" ]; then
  for envfile in /opt/mazaya/.env /opt/furniture/.env /root/.mazaya.env /root/mazaya.env; do
    if [ -f "$envfile" ]; then
      DB_URL=$(grep '^DATABASE_URL=' "$envfile" 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//;s/^"//;s/"$//')
      [ -n "$DB_URL" ] && break
    fi
  done
fi

if [ -z "$DB_URL" ]; then
  echo "❌ تعذّر استخراج DATABASE_URL."
  exit 1
fi

DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
[ "$DB_PORT" = "$DB_URL" ] && DB_PORT=5432

echo "  DB User: $DB_USER"
echo "  DB Name: $DB_NAME"
echo "  DB Host: $DB_HOST:$DB_PORT"
echo ""

# ---------- [2] دوّر على حاوية postgres أو psql ----------
echo "=== [2] دوّر على postgres ==="

# كل حاويات docker
echo "  --- كل حاويات docker ---"
docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null
echo ""

# هل psql متسطب على السيرفر؟
if command -v psql &>/dev/null; then
  echo "  ✅ psql متسطب على السيرفر."
  PSQL_BASE="psql"
else
  echo "  ❌ psql مش متسطب على السيرفر نفسه."
  PSQL_BASE=""
fi

# دوّر على حاوية postgres
PG_CONTAINER=""
for c in $(docker ps --format '{{.Names}}' 2>/dev/null); do
  IMG=$(docker inspect --format '{{.Config.Image}}' "$c" 2>/dev/null)
  if echo "$IMG" | grep -qiE 'postgres|pg'; then
    PG_CONTAINER="$c"
    echo "  ✅ لقيت حاوية postgres: $c ($IMG)"
    break
  fi
done

if [ -z "$PG_CONTAINER" ] && [ -z "$PSQL_BASE" ]; then
  echo "❌ مالقيتش psql ولا حاوية postgres. محتاج تركّب واحدة."
  echo "   جرّب: docker run --rm -it --network host postgres:16 psql \"$DB_URL\""
  exit 1
fi
echo ""

# ---------- [3] قبل الإصلاح: عرض ملكية الجداول ----------
echo "=== [3] قبل الإصلاح: ملكية الجداول وصلاحيات customer_payments ==="

if [ -n "$PG_CONTAINER" ]; then
  # جرّب superusers شائعين جوّا الحاوية
  for superuser in postgres root mazaya; do
    echo "  --- جرّب superuser=$superuser ---"
    RESULT=$(docker exec "$PG_CONTAINER" psql -U "$superuser" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -tAc "SELECT 1" 2>&1)
    if echo "$RESULT" | grep -q "^1$"; then
      echo "  ✅ superuser شغّال: $superuser"
      SUPERUSER="$superuser"
      PSQL_ADMIN="docker exec $PG_CONTAINER psql -U $SUPERUSER -d $DB_NAME -h $DB_HOST -p $DB_PORT"
      break
    else
      echo "  → $RESULT" | head -2
    fi
  done
elif [ -n "$PSQL_BASE" ]; then
  PSQL_ADMIN="$PSQL_BASE \"$DB_URL\""
fi

if [ -z "${PSQL_ADMIN:-}" ]; then
  echo "❌ ما قدرتش أدخل postgres بـ superuser."
  echo "   جرّب يدوي: docker run --rm -it --network host postgres:16 psql \"$DB_URL\""
  exit 1
fi

echo ""
echo "  --- ملكية الجداول ---"
eval "$PSQL_ADMIN -c \"SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'mazaya' ORDER BY tablename;\"" 2>&1 | head -25
echo ""

echo "  --- صلاحيات customer_payments الحالية ---"
eval "$PSQL_ADMIN -c \"SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='mazaya' AND table_name='customer_payments' ORDER BY grantee;\"" 2>&1 | head -15
echo ""

# ---------- [4] الإصلاح ----------
echo "=== [4] تطبيق GRANT على كل جداول mazaya ==="
eval "$PSQL_ADMIN" <<EOF
GRANT USAGE, CREATE ON SCHEMA mazaya TO $DB_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mazaya TO $DB_USER;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA mazaya TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA mazaya GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA mazaya GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $DB_USER;
EOF
echo "  تم."
echo ""

# ---------- [5] تحقق ----------
echo "=== [5] تحقق: صلاحيات customer_payments بعد الإصلاح ==="
eval "$PSQL_ADMIN -c \"SELECT grantee, string_agg(privilege_type, ', ') FROM information_schema.role_table_grants WHERE table_schema='mazaya' AND table_name='customer_payments' GROUP BY grantee;\"" 2>&1 | head -10
echo ""

echo "=== [6] اختبار قراءة customer_payments بـ user الـ app ==="
# نختبر بيوزر التطبيق نفسه مش السوبر
if [ -n "$PG_CONTAINER" ]; then
  TEST=$(docker exec "$PG_CONTAINER" PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -tAc "SELECT COUNT(*) FROM mazaya.customer_payments;" 2>&1)
else
  TEST=$(PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -tAc "SELECT COUNT(*) FROM mazaya.customer_payments;" 2>&1)
fi
echo "  SELECT COUNT(*) من customer_payments:"
echo "  → $TEST"
echo ""

echo "=== [7] اختبار HTTP على customer-payments API ==="
# 3001 هو PORT بتاع مازايا
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:3001/api/customer-payments" 2>/dev/null)
echo "  http://127.0.0.1:3001/api/customer-payments → HTTP $CODE (401 = تمام، محتاج login)"
echo ""

echo "================================================"
echo "  تم. لو الاختبار رقم 6 رجّع رقم (مش error)،"
echo "  المشكلة اتحلّت — العميل يعمل refresh للموقع."
echo "================================================"

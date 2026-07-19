#!/usr/bin/env bash
# ============================================================
# diagnose-503.sh — يشتغل على السيرفر (root@64.226.118.40)
# ============================================================
# الهدف: نعرف ليه الموقع بيرجّع 503 (الـ container ميت أو restart loop).
#
# طريقة الاستخدام:
#   ssh root@64.226.118.40 'bash -s' < scripts/diagnose-503.sh
#
# أو لو انت داخل SSH فعلاً:
#   bash <(curl -s https://raw.githubusercontent.com/.../diagnose-503.sh)
#   (أو انسخ الملف للسيرفر وشغّله)
# ============================================================

set +e  # متموتش على أول خطأ — عايزين نشوف كل حاجة

echo "================================================"
echo "  تشخيص 503 Service Unavailable"
echo "  $(date)"
echo "================================================"
echo ""

# ---------- [1] استهلاك الموارد ----------
echo "=== [1] الذاكرة (RAM) ==="
free -h
echo ""

echo "=== [2] المساحة على القرص ==="
df -h /
echo ""

echo "=== [3] استهلاك Docker ==="
docker stats --no-stream 2>/dev/null | head -10
echo ""

# ---------- [2] حالة الـ Swarm service ----------
echo "=== [4] خدمات Docker Swarm ==="
docker service ls
echo ""

# دور على اسم خدمة mazaya (ممكن mazaya أو غيره)
SERVICE=$(docker service ls --format '{{.Name}}' 2>/dev/null | grep -iE 'mazaya|elnazlawy' | head -1)
if [ -z "$SERVICE" ]; then
  echo "⚠️  ما لقيتش خدمة باسم mazaya. كل الخدمات فوق."
  echo "  اكتب اسم الخدمة يدويًا في الخطوة الجاية."
  SERVICE="<اكتب-اسم-الخدمة-هنا>"
fi
echo "الخدمة المكتشفة: $SERVICE"
echo ""

echo "=== [5] حالة الـ container ($SERVICE) ==="
docker service ps "$SERVICE" --no-trunc 2>&1 | head -10
echo ""

echo "=== [6] آخر 50 سطر من logs الـ container ==="
docker service logs "$SERVICE" --tail 50 2>&1 | tail -50
echo ""

# ---------- [3] بحث عن أسباب الـ crash ----------
echo "=== [7] هل فيه OOM kills؟ ==="
dmesg | grep -iE "out of memory|oom|killed process" | tail -10
echo ""

echo "=== [8] الـ container بيعمل restart loop؟ ==="
RESTART_COUNT=$(docker service ps "$SERVICE" --filter desired-state=running --format '{{.ID}}' 2>/dev/null | wc -l)
FAILED_COUNT=$(docker service ps "$SERVICE" --filter desired-state=shutdown 2>/dev/null | wc -l)
echo "  Containers running: $RESTART_COUNT"
echo "  Containers shutdown/failed: $FAILED_COUNT"
echo ""

# ---------- [4] اختبار HTTP ----------
echo "=== [9] اختبار HTTP على localhost ==="
PORTS="3000 3005 3006"
for port in $PORTS; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null)
  echo "  http://127.0.0.1:$port/ → HTTP $CODE"
done
echo ""

echo "=== [10] اختبار /api/health ==="
for port in $PORTS; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$port/api/health" 2>/dev/null)
  echo "  http://127.0.0.1:$port/api/health → HTTP $CODE"
done
echo ""

echo "================================================"
echo "  انتهى التشخيص"
echo "================================================"
echo ""
echo "ابعتّلي الـ output كله، وأنا هقولك السبب والحل."

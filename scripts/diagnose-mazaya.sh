#!/usr/bin/env bash
# ============================================================
# diagnose-mazaya.sh — سجلات (logs) مازايا (furniture-xhl2yk)
# ============================================================
# الهدف: نشوف سجلات مازايا نفسه (مش إلنزلاوي).
#
# طريقة الاستخدام (داخل SSH على السيرفر):
#   انسخ ده كله والصقه في التيرمنال
# ============================================================

set +e

SERVICE="furniture-xhl2yk"

echo "================================================"
echo "  تشخيص مازايا ($SERVICE)"
echo "  $(date)"
echo "================================================"
echo ""

echo "=== [1] حالة الـ container ==="
docker service ps "$SERVICE" --no-trunc 2>&1 | head -8
echo ""

echo "=== [2] آخر 60 سطر من سجلات (logs) مازايا ==="
docker service logs "$SERVICE" --tail 60 2>&1 | tail -60
echo ""

echo "=== [3] فيه errors في السجلات (logs)؟ ==="
docker service logs "$SERVICE" --tail 500 2>&1 | grep -iE "error|fail|exception|cannot|undefined|chunkload" | tail -20
echo ""

echo "=== [4] المنفذ (port) بتاع مازايا ==="
docker service inspect "$SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null | grep -iE "PORT|HOSTNAME|NODE_ENV" | head
echo ""

echo "=== [5] اختبار /journal من داخل السيرفر ==="
# نجرب المنفذ (port) 3000 (اللي ظهر HTTP 200)
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/journal" 2>/dev/null)
echo "  http://127.0.0.1:3000/journal → HTTP $CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/factory-wallet" 2>/dev/null)
echo "  http://127.0.0.1:3000/factory-wallet → HTTP $CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/workers" 2>/dev/null)
echo "  http://127.0.0.1:3000/workers → HTTP $CODE"
echo ""

echo "=== [6] الحجم/الرقم النهائي للـ domain ==="
echo "  اكتب: cat /etc/nginx/sites-enabled/* 2>/dev/null | grep -A2 'server_name' | head -20"
echo "  (عشان نشوف الـ domain بتاع مازايا)"
echo ""

echo "================================================"
echo "  انتهى"
echo "================================================"

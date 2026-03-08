#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OPENCLAW_ADMIN_BASE_URL:-https://luxuryootd.com}"
ADMIN_TOKEN="${OPENCLAW_ADMIN_TOKEN:?OPENCLAW_ADMIN_TOKEN is required}"
BATCH_LIMIT="${BATCH_LIMIT:-50}"
MAX_ROUNDS="${MAX_ROUNDS:-40}"
SLEEP_SEC="${SLEEP_SEC:-20}"

echo "[nightly-batch] start $(date '+%F %T')"
echo "[nightly-batch] base=$BASE_URL limit=$BATCH_LIMIT max_rounds=$MAX_ROUNDS sleep=$SLEEP_SEC"

for ((i=1; i<=MAX_ROUNDS; i++)); do
  echo "[nightly-batch] round=$i queueing..."
  RESP=$(curl -sS -X POST "$BASE_URL/api/admin/optimize-products" \
    -H "x-openclaw-token: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"auto\",\"limit\":$BATCH_LIMIT}")

  echo "[nightly-batch] resp=$RESP"
  QUEUED=$(printf '%s' "$RESP" | python3 -c 'import sys,json; 
try:
 d=json.load(sys.stdin); print(int(d.get("queued",0)))
except Exception:
 print(-1)')

  if [[ "$QUEUED" -le 0 ]]; then
    echo "[nightly-batch] no more products to queue, stop."
    break
  fi

  sleep "$SLEEP_SEC"
done

echo "[nightly-batch] done $(date '+%F %T')"
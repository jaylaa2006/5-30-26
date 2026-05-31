#!/usr/bin/env bash
# Post-deploy smoke — assert prod is serving what we just shipped.
# Binding from docs/superpowers/round-tables/2026-04-29-enterprise-stability-audit.md (Ptah).
#
# Run automatically by scripts/deploy.sh after rsync + pm2 restart.
# Exits 1 on any failure; .agent/STATE.md SHIPPED entry should only be marked
# after this script exits 0.
#
# Each check captures: HTTP status + (where applicable) a payload assertion.
# When a check fails, prints the failing URL + the actual response so the next
# question — "is this a Cloudflare cache issue, an nginx alias issue, or an
# app-level regression?" — can be answered without re-running anything.

set -uo pipefail

BASE="${PROD_BASE:-https://perankh.osiriscare.net}"
FAIL=0
declare -a FAILED_CHECKS=()

ts() { date -u +%H:%M:%S; }

fail() {
  FAIL=$((FAIL + 1))
  FAILED_CHECKS+=("$1")
  printf "  [%s] ✗ %s\n" "$(ts)" "$1"
}

ok() { printf "  [%s] ✓ %s\n" "$(ts)" "$1"; }

# ─── Check 1: health endpoint ────────────────────────────────────────
check_health() {
  local code
  code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    ok "health 200"
  else
    fail "health returned $code (expected 200)"
  fi
}

# ─── Check 2: user-visible HTML route served + non-trivially sized ──
# Hit '/' (the user-visible route, proxied through nginx with
# Cache-Control: no-cache, must-revalidate) NOT '/maat-reader.html'
# (direct-asset route, has Express's default 1h public cache and gets
# stuck behind Cloudflare's edge cache).
check_html() {
  # Stream curl output to a temp file (avoids bash command-substitution
  # corruption on large UTF-8 bodies + lets grep operate on real bytes).
  local tmp size
  tmp=$(mktemp -t pdsmoke.XXXXXX)
  trap "rm -f '$tmp'" RETURN

  if ! curl -fsS --max-time 15 \
      -H "Cache-Control: no-cache" -H "Pragma: no-cache" \
      "$BASE/?nocache=$(date +%s%N)" -o "$tmp" 2>/dev/null; then
    fail "maat-reader.html: curl failed (network/HTTP error)"
    return
  fi

  size=$(wc -c < "$tmp" | tr -d ' ')
  if [ "$size" -lt 1000000 ]; then
    fail "maat-reader.html size=$size bytes (expected ≥1MB; deploy may have shipped truncated file)"
    return
  fi
  ok "maat-reader.html size=$size bytes"

  # Sentinel grep — prove we shipped THE BUILD WE THINK we shipped.
  # If a sentinel goes missing, the rsync didn't actually update the file,
  # OR a build step stripped content, OR Cloudflare is serving a stale copy.
  if [ -n "${REQUIRE_SENTINEL:-}" ]; then
    if ! grep -q "$REQUIRE_SENTINEL" "$tmp"; then
      fail "maat-reader.html missing required sentinel: $REQUIRE_SENTINEL"
      return
    fi
    ok "sentinel '$REQUIRE_SENTINEL' present"
  fi
}

# ─── Check 3: elder-hint API returns AI hint with citation ──────────
check_elder_hint_api() {
  local payload resp hint maxim_id source
  payload='{"checkpointType":"reflection","question":"What does it mean to act with maat?","prompt":"What does it mean to act with maat?","principle":"truth","storyTitle":"Smoke Test","childName":"smoke","childLevel":3,"hintNumber":0,"virtueProgress":null,"recentScores":null,"previousHint":null}'

  resp=$(curl -fsS -X POST --max-time 15 "$BASE/api/seba-elder-hint" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null || echo "")

  if [ -z "$resp" ]; then
    fail "elder-hint API: no response (network/timeout)"
    return
  fi

  hint=$(echo "$resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('hint','') or '')" 2>/dev/null || echo "")
  source=$(echo "$resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('source','') or '')" 2>/dev/null || echo "")
  maxim_id=$(echo "$resp" | python3 -c "import json,sys; d=json.load(sys.stdin); c=d.get('citation') or {}; print(c.get('maximId',''))" 2>/dev/null || echo "")

  if [ -z "$hint" ]; then
    fail "elder-hint API: empty hint field — response was: $(echo "$resp" | head -c 300)"
    return
  fi
  ok "elder-hint hint length=${#hint}"
  ok "elder-hint source=$source"

  # If env enforces citation, maxim_id must be present + non-empty.
  # When ELDER_HINT_REQUIRE_CITATION=true is set on prod, AI-source hints
  # MUST include citation.maximId — if not, the env flag isn't being honored.
  if [ "$source" = "ai" ] && [ -n "${REQUIRE_CITATION:-1}" ]; then
    if [ -z "$maxim_id" ]; then
      fail "elder-hint AI hint missing citation.maximId (env flag may not be loaded)"
      return
    fi
    ok "elder-hint citation maximId=$maxim_id"
  fi
}

# ─── Check 3b: elder-hint validation — missing checkpointType MUST 400 ───
# v3.40.3 audit binding (Process learning): the bug that hid for 30 days
# (frontend sent checkpointType:undefined → server returned 400 → no metric)
# would have been caught by this 1-second smoke had it been wired in. Now it is.
check_elder_hint_validation() {
  local code
  code=$(curl -s -X POST --max-time 5 "$BASE/api/seba-elder-hint" \
    -H "Content-Type: application/json" \
    -d '{}' \
    -o /dev/null -w '%{http_code}' 2>/dev/null || echo "000")
  if [ "$code" = "400" ]; then
    ok "elder-hint validation: empty body → 400"
  else
    fail "elder-hint validation: empty body returned $code (expected 400) — schema validation regressed"
  fi

  code=$(curl -s -X POST --max-time 5 "$BASE/api/seba-elder-hint" \
    -H "Content-Type: application/json" \
    -d '{"question":"x","childName":"y","childLevel":3,"hintNumber":0}' \
    -o /dev/null -w '%{http_code}' 2>/dev/null || echo "000")
  if [ "$code" = "400" ]; then
    ok "elder-hint validation: missing checkpointType → 400"
  else
    fail "elder-hint validation: missing checkpointType returned $code (expected 400) — this was the v3.40.2 silent bug"
  fi
}

# ─── v3.41.0 — Vocab popup gate is shipped (otherwise dead-end clicks) ─
# Per impl-gate RT 2026-05-02 binding 1 (Sam): static-pattern tests for the
# render-time gate must run on prod, not just in npm test. This catches the
# case where a deploy shipped without the gate (e.g. partial rsync, stale
# Cloudflare cache, or someone reverted the renderer).
check_vocab_gate() {
  local tmp
  tmp=$(mktemp -t pdsmoke.XXXXXX)
  trap "rm -f '$tmp'" RETURN
  if ! curl -fsS --max-time 15 \
      -H "Cache-Control: no-cache" -H "Pragma: no-cache" \
      "$BASE/?nocache=$(date +%s%N)" -o "$tmp" 2>/dev/null; then
    fail "vocab-gate: curl failed"
    return
  fi
  if ! grep -q "_resolveVocab" "$tmp"; then
    fail "vocab-gate: _resolveVocab function missing — the v3.41.0 fix is not deployed"
    return
  fi
  if ! grep -q "v3.41.0 — single source of truth" "$tmp"; then
    fail "vocab-gate: gate-marker comment missing — renderer change not deployed"
    return
  fi
  if ! grep -q "isPharaoh = _PHARAOH_NAMES.has(clean) && !!ref" "$tmp"; then
    fail "vocab-gate: pharaoh-class gate missing — pharaoh names will dead-end on click"
    return
  fi
  ok "vocab-gate: _resolveVocab + renderer + pharaoh gate all present (v3.41.0)"
}

# ─── Check 4: critical static assets ────────────────────────────────
check_asset() {
  local path="$1" code attempt
  for attempt in 1 2 3; do
    code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 \
      -H "Cache-Control: no-cache" \
      "$BASE$path?nocache=$(date +%s%N)" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
      ok "asset $path → 200 (attempt $attempt)"
      return
    fi
    [ "$attempt" -lt 3 ] && sleep 2
  done
  fail "asset $path → $code (nginx alias missing OR file not deployed OR Cloudflare cached an earlier 404)"
}

# ─── Run ─────────────────────────────────────────────────────────────
echo "▶ post-deploy-smoke against $BASE"

check_health
check_html
check_vocab_gate
check_elder_hint_api
check_elder_hint_validation
check_asset "/images/elder-hint/papyrus-tile.png"
check_asset "/fonts/NotoSansEgyptianHieroglyphs.ttf"
check_asset "/fonts/NotoSansEgyptianHieroglyphs.woff2"
# Phase 1.3 (v3.35.0) — Senebty tier sigils + tier-sting videos.
# 4 sigil PNGs (Imagen 4 Ultra) + 2 sting MP4s. Each is referenced from
# senebty/lib/{tiers,render}.js — if any 404s, the Senebty tier UI falls
# back to a broken-image placeholder for that tier.
check_asset "/images/senebty/sigils/hem-sba.png"
check_asset "/images/senebty/sigils/seba-en-seneb.png"
check_asset "/images/senebty/sigils/sunu-sba.png"
check_asset "/images/senebty/sigils/shemes-imhotep.png"
check_asset "/videos/senebty/tier-sting-hem-sba.mp4"
check_asset "/videos/senebty/tier-sting-seba-en-seneb.mp4"

# v1.0 (M5 close-out) — assert the Senebty engine + Bridge Mode assets are
# served, not just the sigils. If senebty/lib/*.js is 404, the entire
# Senebty wing falls through to "soon" modal + Bridge Mode toggle silently
# fails to render. Lock both.
check_senebty_v1() {
  check_asset "/senebty/lib/tiers.js"
  check_asset "/senebty/lib/iri.js"
  check_asset "/senebty/lib/render.js"
  check_asset "/senebty/lib/heka-phrase.js"
  check_asset "/senebty/lib/foundation-heka.js"
  check_asset "/senebty/lib/parent-dashboard.js"
  check_asset "/senebty/lib/bridge-mode.js"
  check_asset "/senebty/styles/bridge-mode.css"

  # Bridge Mode endpoint mounted (POST {} → 400 means route is up + validating).
  # Note: NO `-f` flag here — `-f` makes curl exit non-zero on 4xx, but a 400
  # is the EXPECTED success signal for this check. Use plain curl + parse code.
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
    -X POST -H "Content-Type: application/json" -d '{}' \
    "$BASE/api/seba-bridge-hint" 2>/dev/null || echo "000")
  if [ "$code" = "400" ]; then
    ok "bridge-hint route 400 on empty (route mounted + validating)"
  else
    fail "bridge-hint route returned $code (expected 400 on empty body)"
  fi

  # v3.44.0 — parent learn-more video feed must return ≥1 video. If yt-dlp
  # is stale or misresolved, the in-memory + disk cache fallbacks should
  # still serve videos. A 503 here means cold-start failure — surface loud.
  local body
  body=$(curl -sS --max-time 15 "$BASE/api/learn-more-library/feed" 2>/dev/null || echo '{}')
  local videoCount
  videoCount=$(echo "$body" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('videos',[])))" 2>/dev/null || echo 0)
  if [ "$videoCount" -ge 1 ]; then
    ok "learn-more feed serves $videoCount videos"
  else
    fail "learn-more feed empty (videoCount=$videoCount). yt-dlp may be misresolved or stale; check pm2 logs perankh"
  fi
}
check_senebty_v1

echo
if [ "$FAIL" -gt 0 ]; then
  echo "✗ $FAIL check(s) failed:"
  for c in "${FAILED_CHECKS[@]}"; do echo "  - $c"; done
  echo
  echo "Triage:"
  echo "  - 4xx on a static asset that exists locally → bump cache-buster query string in maat-reader.html"
  echo "  - empty elder-hint or missing citation → check ELDER_HINT_REQUIRE_CITATION on prod, then 'pm2 restart seba-api --update-env'"
  echo "  - missing sentinel → rsync didn't update the file, or the local file is stale"
  exit 1
fi

echo "✓ post-deploy-smoke OK ($BASE)"
exit 0

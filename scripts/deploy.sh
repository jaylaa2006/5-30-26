#!/usr/bin/env bash
# Pre-deploy gate + tar-pipe deploy to prod.
#
# Gate order — fail closed, each step must pass before the next runs:
#   1. git status clean (warn only; set FORCE=1 to skip)
#   2. node scripts/syntax-check.mjs maat-reader.html
#   3. node -c seba-story-api.mjs  (server-side JS parse check)
#   4. node -c server.js
#   5. Optional: PIN integration test (RUN_PIN_TEST=1)
#
# Then tar-pipes the named files to prod and restarts the affected PM2 services.
#
# Usage:
#   scripts/deploy.sh maat-reader.html seba-story-api.mjs server.js
#   scripts/deploy.sh --all    # deploys all three + public/js/*
#
set -euo pipefail

PROD_HOST="${PROD_HOST:-root@89.167.47.23}"
PROD_APP_DIR="${PROD_APP_DIR:-/var/www/perankh}"

cd "$(dirname "$0")/.."

# ─── Gate 1: git status ───────────────────────────────────────────────
if [ -z "${FORCE:-}" ]; then
  if ! git diff --quiet --exit-code 2>/dev/null; then
    echo "⚠  Uncommitted changes present (set FORCE=1 to skip):"
    git status --short | head -10
  fi
fi

# ─── Gate 2: HTML inline script parse ────────────────────────────────
echo "▶ syntax-check maat-reader.html"
node scripts/syntax-check.mjs maat-reader.html

# ─── Gate 2b: elder-hint UI regression suite ─────────────────────────
# Asserts the v3.34.1 fix patterns (Bug 1-4) haven't been silently reverted.
# Binding from 2026-04-29 enterprise-stability round-table (Sam).
echo "▶ elder-hint UI regression"
node tests/elder-hint-ui-regression.test.mjs

# ─── Gate 2c: reader UI regression suite ─────────────────────────────
# Asserts the SIX post-v3.34.1 UX fix patterns + window.App=App + glossary
# backdrop element haven't silently reverted. Binding from 2026-04-30
# session enterprise-quality audit (Sam, RED #2 closure).
echo "▶ reader UI regression"
node tests/reader-ui-regression.test.mjs

# ─── Gate 2d: Senebty UI jsdom integration suite ─────────────────────
# True DOM-render integration tests for Senebty wiring (render.gate,
# ring click handlers, glossary panel toggle, foundation-mu.complete).
# Catches the class of bug that surfaced in user walkthroughs: runtime
# DOM behavior the static-pattern suites can't see. Imani's binding from
# the v3.35.0 2nd-eyes deploy-gate round-table.
echo "▶ Senebty UI integration (jsdom)"
node tests/senebty-ui-integration.test.mjs

# ─── Gate 2e: Medium-confidence info-btn render assertions ──────────
# Ensures the "verification pending" info button stays wired for the 3
# medium-confidence Senebty glyphs (tjau / hesi / sunu) — without it the
# child sees a glyph that looks confident but is honestly uncertain.
# Cultural Consensus binding from the v3.37.0 2nd-eyes deploy-gate RT
# (docs/superpowers/round-tables/2026-05-01-v3-37-0-2nd-eyes-deploy-gate.md):
# "the honest framing should reach the child, not just the engineer."
echo "▶ Senebty medium-confidence info-btn render"
node tests/senebty-medium-info-btn.test.mjs

# ─── Gate 2f: vocab-popup contract ───────────────────────────────────
# v3.41.0 — asserts the render-time gate is in source AND that the vocab
# orphan rate has not regressed beyond the gate's design tolerance.
# Catches the class of bug v3.40.0 shipped (defensive null-guards without
# closing root cause) — every render path now agrees with wordTap on
# whether a word is clickable. Sam's binding 1 from the impl-gate RT.
echo "▶ vocab-popup contract"
node tests/vocab-popup-contract.test.mjs

# ─── Gate 3-4: server JS parse ───────────────────────────────────────
echo "▶ node -c seba-story-api.mjs"
node --check seba-story-api.mjs
echo "▶ node -c server.js"
node --check server.js

# ─── Gate 5: optional PIN test ───────────────────────────────────────
if [ -n "${RUN_PIN_TEST:-}" ]; then
  echo "▶ PIN integration test"
  JWT_SECRET="${JWT_SECRET:-test-secret-$(date +%s)}"
  node server.js > /tmp/deploy-server.log 2>&1 &
  S1=$!
  JWT_SECRET="$JWT_SECRET" node seba-story-api.mjs > /tmp/deploy-seba.log 2>&1 &
  S2=$!
  sleep 3
  trap "kill $S1 $S2 2>/dev/null || true" EXIT
  AUTH_BASE=http://localhost:3456 API_BASE=http://localhost:3847 \
    JWT_SECRET="$JWT_SECRET" node tests/pin-email-flow.test.mjs
  kill $S1 $S2 2>/dev/null || true
  trap - EXIT
fi

# ─── Ship ────────────────────────────────────────────────────────────
if [ $# -eq 0 ]; then
  echo "no files to deploy; pass filenames or --all"
  exit 2
fi
if [ "$1" = "--all" ]; then
  shift
  set -- maat-reader.html seba-story-api.mjs server.js public/js/google-gsi-client.js
fi

echo "▶ tar-pipe $* → $PROD_HOST:$PROD_APP_DIR"
# Backup affected files BEFORE overwriting — keeps the last 5 timestamped
# copies so a rollback (see docs/runbooks/rollback.md) is `cp` + pm2 restart.
TS=$(date -u +%Y%m%dT%H%M%SZ)
ssh -o ConnectTimeout=30 "$PROD_HOST" "set -eu; mkdir -p '$PROD_APP_DIR/backups/$TS'; cd '$PROD_APP_DIR'; for f in $*; do if [ -f \"\$f\" ]; then mkdir -p \"backups/$TS/\$(dirname \$f)\"; cp -p \"\$f\" \"backups/$TS/\$f\"; fi; done; ls -1dt backups/* | tail -n +6 | xargs -r rm -rf"
tar cf - "$@" | ssh -o ConnectTimeout=30 "$PROD_HOST" "cd '$PROD_APP_DIR' && tar xf -"

# ─── Restart affected services ───────────────────────────────────────
restart=()
for f in "$@"; do
  case "$f" in
    server.js|maat-reader.html|public/*|senebty/*) restart+=("perankh") ;;
    seba-story-api.mjs) restart+=("seba-api") ;;
  esac
done
# dedupe
uniq_restart=$(printf '%s\n' "${restart[@]}" | awk '!seen[$0]++' | tr '\n' ' ')
if [ -n "$uniq_restart" ]; then
  echo "▶ pm2 restart $uniq_restart"
  ssh -o ConnectTimeout=30 "$PROD_HOST" "pm2 restart $uniq_restart"
fi

# ─── Post-deploy smoke ───────────────────────────────────────────────
# Comprehensive prod-side verification — see scripts/post-deploy-smoke.sh.
# Exits 1 on any failure; STATE.md SHIPPED entry should only be marked after
# this exits 0. Pass REQUIRE_SENTINEL=<string> to assert specific build identity.
# 5-second sleep first to absorb pm2-restart Express-init latency. Without it,
# the v3.35.0 first-deploy hit "health 000 + elder-hint 000" because the smoke
# fired 0 seconds after pm2 restart, before Express finished binding to ports.
# Manual retry 10s later cleared. 5s is a safe middle ground (Ptah's binding
# from the v3.35.0 deploy-gate round-table).
echo "▶ post-deploy-smoke (5s warmup first)"
sleep 5
if ! "$(dirname "$0")/post-deploy-smoke.sh"; then
  echo "✗ post-deploy-smoke failed — see triage above"
  exit 1
fi
echo "✓ deploy OK"

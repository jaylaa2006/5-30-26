#!/usr/bin/env bash
# heka-stability-report — daily aggregate of elder-hint telemetry beacons.
# Binding from docs/superpowers/round-tables/2026-04-29-enterprise-stability-audit.md (Tehuti).
#
# Reads PM2 stdout (perankh) — server.js logs each beacon as a single line
# prefixed `[ELDER-HINT-TEL] {...json...}` (see server.js around line 1486).
# This script extracts the JSON, aggregates the last 24h, and writes a stability
# summary to stdout (and, when run by cron, to /var/log/heka/daily-stability.log).
#
# Run on the prod box. Local dry-run: pass a path as $1 to read instead of PM2.
#
# Alerts (printed prominently when crossed):
#   - any   `fallback_reason: no-hint-available` event = RED (means both AI + pool
#                                                        returned empty for a child)
#   - <80%  AI source ratio over 24h                  = YELLOW (Gemini availability)
#   - p95   time_on_question_ms > 90000               = YELLOW (children stuck)

set -uo pipefail

LOG_PATH="${1:-/root/.pm2/logs/perankh-out.log}"
WINDOW_HOURS="${WINDOW_HOURS:-24}"
PREFIX='\[ELDER-HINT-TEL\] '

if [ ! -r "$LOG_PATH" ]; then
  echo "✗ cannot read log: $LOG_PATH" >&2
  exit 2
fi

cutoff_ms=$(( ($(date +%s) - WINDOW_HOURS * 3600) * 1000 ))

# Extract JSON from each matching line, filter by ts >= cutoff_ms.
# Then pipe through python for aggregation (jq isn't guaranteed on the prod box).
filtered=$(grep -E "$PREFIX" "$LOG_PATH" | sed -E "s/.*$PREFIX//")

if [ -z "$filtered" ]; then
  echo "─── elder-hint stability — last ${WINDOW_HOURS}h ───"
  echo "no events captured in window"
  exit 0
fi

python3 <<PY
import json, sys, statistics
from collections import Counter

cutoff_ms = $cutoff_ms
events = []
parse_errors = 0
for line in """$filtered""".splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        e = json.loads(line)
        if isinstance(e.get("ts"), int) and e["ts"] >= cutoff_ms:
            events.append(e)
    except Exception:
        parse_errors += 1

print(f"─── elder-hint stability — last $WINDOW_HOURS h ───")
print(f"events_in_window: {len(events)}")
print(f"parse_errors: {parse_errors}")
if not events:
    sys.exit(0)

# By action
actions = Counter(e.get("action", "?") for e in events)
print(f"\\nactions:")
for a in ("shown", "tapped", "dismissed"):
    print(f"  {a:12s}: {actions.get(a, 0)}")
for a, n in actions.items():
    if a not in ("shown", "tapped", "dismissed"):
        print(f"  {a:12s}: {n}  (unknown — investigate)")

# Tap-through rate (engagement health)
shown = actions.get("shown", 0)
tapped = actions.get("tapped", 0)
ttr = (100 * tapped / shown) if shown else 0
print(f"\\ntap_through_rate: {ttr:.1f}%  ({tapped}/{shown})")

# Source distribution (target ≥80% AI per spec)
sources = Counter(e.get("source", "?") for e in events if e.get("action") == "shown")
total_shown = sum(sources.values())
ai_pct = (100 * sources.get("ai", 0) / total_shown) if total_shown else 0
print(f"\\nsources (shown):")
for src, n in sources.most_common():
    pct = (100 * n / total_shown) if total_shown else 0
    print(f"  {src:12s}: {n} ({pct:.1f}%)")
if ai_pct < 80 and total_shown >= 10:
    print(f"  ⚠ YELLOW: AI source <80% (Gemini availability or token budget?)")

# Fallback reason distribution (no-hint-available = RED)
fallbacks = Counter(e.get("fallback_reason") for e in events if e.get("fallback_reason"))
if fallbacks:
    print(f"\\nfallback_reasons:")
    for reason, n in fallbacks.most_common():
        marker = "  🚨 RED ALERT" if reason == "no-hint-available" else ""
        print(f"  {reason:28s}: {n}{marker}")
else:
    print(f"\\nfallback_reasons: none")

# Engagement timing (only on tapped events — dismissed without tap is a different signal)
times = [e["time_on_question_ms"] for e in events
         if e.get("action") == "tapped" and isinstance(e.get("time_on_question_ms"), int)]
if times:
    times.sort()
    p50 = times[len(times)//2]
    p95 = times[int(len(times) * 0.95)]
    p99 = times[min(len(times) - 1, int(len(times) * 0.99))]
    print(f"\\ntime_on_question_ms (taps only):")
    print(f"  p50: {p50:6d}  p95: {p95:6d}  p99: {p99:6d}")
    if p95 > 90000:
        print(f"  ⚠ YELLOW: p95 >90s (children stuck on questions before tapping ankh)")

# Citation coverage (proxy for env flag honored)
# We only know citation:true via dispatcher 'pool' or via 'ai' returning a maxim.
# Beacon doesn't carry citation — but we can infer from hint_id format:
#   ai/<8hex>      → AI hint (citation should be on the API response, not beacon)
#   <virtue>:<n>   → pool hint (citation is in the pool dataset)
ai_ids = sum(1 for e in events if str(e.get("hint_id", "")).startswith("ai/"))
print(f"\\nai_hint_ids_emitted: {ai_ids}")

# Register/level distribution (where children are using hints)
print(f"\\nregister × level (shown):")
rl = Counter((e.get("register","?"), e.get("level","?")) for e in events if e.get("action") == "shown")
for (r, l), n in sorted(rl.items()):
    print(f"  {r:14s} L{l}: {n}")
PY

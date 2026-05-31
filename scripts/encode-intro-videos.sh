#!/bin/bash
# Re-encode the 128 /videos/intros/*.mp4 pool (v3.51.53)
# These feed library backdrop, gov backdrop, reader section-backdrop, and the
# library/yw featured-video tiles. Broadcast-grade source (~19 MB avg) →
# H.264 CRF 23 + audio strip + faststart + bt709 (~40% reduction target).
# Originals backed up to videos/_backup-20260519-intros/.
#
# Idempotent: skips files already re-encoded (checks for a .reencoded marker).
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP=videos/_backup-20260519-intros
mkdir -p "$BACKUP"
LOG="$BACKUP/encode.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== Intro re-encode batch started $(date -u +%FT%TZ) ==="

count=0
total=$(ls videos/intros/*.mp4 2>/dev/null | wc -l | tr -d ' ')

for src in videos/intros/*.mp4; do
  base=$(basename "$src" .mp4)
  marker="$BACKUP/${base}.reencoded"
  count=$((count + 1))
  if [ -f "$marker" ]; then
    echo "[$count/$total] SKIP (already done): $base"
    continue
  fi
  # Back up original if not already backed up
  if [ ! -f "$BACKUP/${base}.mp4" ]; then
    cp "$src" "$BACKUP/${base}.mp4"
  fi
  echo "[$count/$total] Encoding: $base"
  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -an -movflags +faststart \
    "${src}.optimized.mp4"
  mv "${src}.optimized.mp4" "$src"
  touch "$marker"
done

echo "=== Intro re-encode batch done $(date -u +%FT%TZ) ==="
echo "--- Before/after totals ---"
echo "Backup (originals): $(du -sh "$BACKUP" | cut -f1)"
echo "Current (re-encoded): $(du -sh videos/intros | cut -f1)"

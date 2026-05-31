#!/bin/bash
# Extract optimized JPEG posters from the 128 intro videos (v3.51.54)
# Replaces the 1.78 MB chunk-0.png posters used by library/reader/gov/peh
# with ~110 KB first-frame JPEGs. Source-of-truth: the intro video's own
# first frame (matches the video content better than chunk-0 art anyway).
# Reads from backup originals when present (re-encode may be mid-flight),
# else from the live file (atomic mv guarantees completeness).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/images/landing

BACKUP=videos/_backup-20260519-intros
count=0
for src in videos/intros/*.mp4; do
  base=$(basename "$src" .mp4)
  # Prefer backup original (stable) if present
  poster_src="$src"
  if [ -f "$BACKUP/${base}.mp4" ]; then
    poster_src="$BACKUP/${base}.mp4"
  fi
  dst="public/images/landing/intro-${base}.jpg"
  if [ -f "$dst" ]; then continue; fi
  if ffmpeg -y -hide_banner -loglevel error -ss 1 -i "$poster_src" \
      -frames:v 1 -q:v 5 -vf scale=960:-2 "$dst" 2>/dev/null; then
    count=$((count + 1))
  else
    echo "SKIP (extract failed): $base"
  fi
done
echo "Extracted $count intro posters."
echo "Total poster dir size: $(du -sh public/images/landing | cut -f1)"

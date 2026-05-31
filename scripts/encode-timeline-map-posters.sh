#!/bin/bash
# Extract 4 timeline + 6 map poster JPEGs (v3.51.52)
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p public/images/landing

extract_poster() {
  local src="$1" dst="$2"
  echo "--- Poster: $src -> $dst"
  ffmpeg -y -hide_banner -loglevel error -ss 1 -i "$src" \
    -frames:v 1 -q:v 4 -vf scale=1280:-2 \
    "$dst"
}

TIMELINE=(ankh-spiral time-cycle sacred-geometry cosmic-nile)
MAP=(great-pyramids great-zimbabwe lalibela timbuktu meroe-pyramids benin-walls)

for f in "${TIMELINE[@]}"; do
  if [ -f "videos/timeline/${f}.mp4" ]; then
    extract_poster "videos/timeline/${f}.mp4" "public/images/landing/timeline-${f}.jpg"
  else
    echo "SKIP: videos/timeline/${f}.mp4 not on disk"
  fi
done

for f in "${MAP[@]}"; do
  if [ -f "videos/map/${f}.mp4" ]; then
    extract_poster "videos/map/${f}.mp4" "public/images/landing/map-${f}.jpg"
  else
    echo "SKIP: videos/map/${f}.mp4 not on disk"
  fi
done

ls -la public/images/landing/{timeline-,map-}*.jpg 2>/dev/null

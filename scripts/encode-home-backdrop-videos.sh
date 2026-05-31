#!/bin/bash
# Re-encode home-page backdrop videos (v3.51.47)
# Visually-transparent (CRF 23) + audio stripped + AV1-deferred + faststart.
# Originals backed up in videos/_backup-20260519-home/
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p videos/_backup-20260519-home public/images/landing
cp videos/sets/level1-intro.mp4 videos/sets/seeds-outro.mp4 videos/sets/battle-outro.mp4 videos/_backup-20260519-home/ 2>/dev/null || true

LOG=videos/_backup-20260519-home/encode.log
exec > >(tee -a "$LOG") 2>&1
echo "=== Home backdrop encode batch started $(date -u +%FT%TZ) ==="

encode_h264() {
  local src="$1" dst="$2"
  echo "--- H.264: $src -> $dst"
  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -an -movflags +faststart \
    "$dst"
}

extract_poster() {
  local src="$1" dst="$2"
  echo "--- Poster: $src -> $dst"
  ffmpeg -y -hide_banner -loglevel error -ss 1 -i "$src" \
    -frames:v 1 -q:v 4 -vf scale=1280:-2 \
    "$dst"
}

HOME=(level1-intro seeds-outro battle-outro)

for f in "${HOME[@]}"; do
  encode_h264 "videos/sets/${f}.mp4" "videos/sets/${f}.optimized.mp4"
  extract_poster "videos/sets/${f}.mp4" "public/images/landing/${f}.jpg"
done

echo "--- Atomic swap optimized -> primary"
for f in "${HOME[@]}"; do
  mv "videos/sets/${f}.optimized.mp4" "videos/sets/${f}.mp4"
done

echo "=== Home backdrop encode batch done $(date -u +%FT%TZ) ==="
ls -la videos/sets/{level1-intro,seeds-outro,battle-outro}.mp4
ls -la public/images/landing/{level1-intro,seeds-outro,battle-outro}.jpg

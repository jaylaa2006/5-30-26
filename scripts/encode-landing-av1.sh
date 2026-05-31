#!/bin/bash
# AV1/WebM siblings for the 7 landing videos (v3.51.56).
# SVT-AV1 preset 5 + CRF 40 → ~50% smaller than the already-optimized H.264.
# (Previous attempt used CRF 30 — too low, came out LARGER. CRF is the key.)
# Hero (battle-intro) plays at full opacity → CRF 36 for a quality margin;
# the rest play at 0.22-0.35 backdrop opacity → CRF 40 is imperceptible.
# Browsers that decode AV1/WebM (Chrome/FF/Edge/Safari 17.4+) pick the .webm
# via the <source> ladder; older Safari falls back to the H.264 .mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== Landing AV1 batch started $(date -u +%FT%TZ) ==="

av1() {
  local src="$1" dst="$2" crf="$3"
  echo "--- AV1 crf$crf: $src -> $dst"
  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libsvtav1 -crf "$crf" -preset 5 -pix_fmt yuv420p -g 240 -an "$dst"
}

# Hero — full opacity, CRF 36
av1 videos/sets/battle-intro.mp4 videos/sets/battle-intro.webm 36
# Section backdrops — 0.22-0.35 opacity, CRF 40
av1 videos/sets/seeds-intro.mp4         videos/sets/seeds-intro.webm 40
av1 videos/sets/benin-intro.mp4         videos/sets/benin-intro.webm 40
av1 videos/sets/seba-living-library.mp4 videos/sets/seba-living-library.webm 40
# Karnak sign-in trio — 0.3 opacity, CRF 40
av1 videos/karnak/karnak-hypostyle.mp4 videos/karnak/karnak-hypostyle.webm 40
av1 videos/karnak/karnak-avenue.mp4    videos/karnak/karnak-avenue.webm 40
av1 videos/karnak/karnak-obelisk.mp4   videos/karnak/karnak-obelisk.webm 40

echo "=== Landing AV1 batch done $(date -u +%FT%TZ) ==="
echo "--- H.264 vs AV1 ---"
for f in videos/sets/battle-intro videos/sets/seeds-intro videos/sets/benin-intro videos/sets/seba-living-library videos/karnak/karnak-hypostyle videos/karnak/karnak-avenue videos/karnak/karnak-obelisk; do
  mp4=$(stat -f%z "${f}.mp4" 2>/dev/null || echo 0)
  webm=$(stat -f%z "${f}.webm" 2>/dev/null || echo 0)
  echo "$(basename $f): mp4=$((mp4/1024))KB webm=$((webm/1024))KB"
done

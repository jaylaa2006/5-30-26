#!/bin/bash
# Re-encode landing-page backdrop videos (v3.51.45)
# Visually-transparent (CRF 23) + audio stripped (videos are muted) + VP9/WebM siblings
# Originals backed up in videos/_backup-20260519/
#
# Why CRF 23: visually-lossless to near-lossless at this resolution/content.
# Why -an: every landing video plays muted; audio track is dead weight.
# Why bt709: locks color space (sources had `unknown` tags; prevents browser drift).
# Why faststart: moves moov atom to front so playback starts before full download.
# Why VP9 sibling: Chrome/FF/Edge mobile pick WebM/VP9 (~30-40% smaller than H.264).
set -euo pipefail
cd "$(dirname "$0")/.."

LOG=videos/_backup-20260519/encode.log
exec > >(tee -a "$LOG") 2>&1
echo "=== Encode batch started $(date -u +%FT%TZ) ==="

encode_h264() {
  local src="$1" dst="$2"
  echo "--- H.264: $src -> $dst"
  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -an -movflags +faststart \
    "$dst"
}

encode_av1() {
  local src="$1" dst="$2"
  echo "--- AV1:   $src -> $dst"
  # libsvtav1: preset 8 = fast encode, crf 30 ≈ visual parity with H.264 CRF 23.
  # WebM container — Safari 17.4+ supports AV1 in WebM; older Safari falls back
  # to the H.264 MP4 via the <source> ladder.
  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libsvtav1 -crf 30 -preset 8 -pix_fmt yuv420p \
    -an "$dst"
}

extract_poster() {
  local src="$1" dst="$2"
  echo "--- Poster: $src -> $dst"
  ffmpeg -y -hide_banner -loglevel error -ss 1 -i "$src" \
    -frames:v 1 -q:v 4 -vf scale=1280:-2 \
    "$dst"
}

SETS=(battle-intro seeds-intro benin-intro seba-living-library)
KARNAK=(karnak-hypostyle karnak-avenue karnak-obelisk)

for f in "${SETS[@]}"; do
  encode_h264 "videos/sets/${f}.mp4" "videos/sets/${f}.optimized.mp4"
  encode_av1  "videos/sets/${f}.mp4" "videos/sets/${f}.webm"
  extract_poster "videos/sets/${f}.mp4" "public/images/landing/${f}.jpg"
done

for f in "${KARNAK[@]}"; do
  encode_h264 "videos/karnak/${f}.mp4" "videos/karnak/${f}.optimized.mp4"
  encode_av1  "videos/karnak/${f}.mp4" "videos/karnak/${f}.webm"
  extract_poster "videos/karnak/${f}.mp4" "public/images/landing/${f}.jpg"
done

echo "--- Atomic swap optimized -> primary"
for f in "${SETS[@]}"; do
  mv "videos/sets/${f}.optimized.mp4" "videos/sets/${f}.mp4"
done
for f in "${KARNAK[@]}"; do
  mv "videos/karnak/${f}.optimized.mp4" "videos/karnak/${f}.mp4"
done

echo "=== Encode batch done $(date -u +%FT%TZ) ==="
echo "--- Final sizes ---"
ls -la videos/sets/{battle-intro,seeds-intro,benin-intro,seba-living-library}.{mp4,webm} 2>/dev/null
ls -la videos/karnak/{karnak-hypostyle,karnak-avenue,karnak-obelisk}.{mp4,webm} 2>/dev/null
ls -la public/images/landing/

#!/usr/bin/env python3
"""Convert near-black backgrounds in a PNG to transparent alpha.

For each pixel: alpha = max(R,G,B) scaled. Pure black -> alpha=0,
bright pixels -> alpha=255. Preserves all color info exactly.

Use this for luminous figures (Ka/Ba/Akh) rendered on black backgrounds
so they composite cleanly onto any arena background without visible
rectangular frames.

Usage: python3 scripts/black-to-alpha.py in.png out.png
"""
import sys
from PIL import Image

def main():
    if len(sys.argv) != 3:
        print("usage: black-to-alpha.py in.png out.png", file=sys.stderr)
        sys.exit(2)
    src_path, dst_path = sys.argv[1], sys.argv[2]
    img = Image.open(src_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            # Alpha tracks the brightest channel (luminance proxy).
            # Higher threshold (50) cuts the dark Imagen-vignette around the
            # figure cleanly so it reads transparent over the dark sema arena
            # instead of as a rectangular halo. Figure center sits at max=150+
            # so the subject stays intact.
            m = max(r, g, b)
            if m < 50:
                alpha = 0
            else:
                alpha = min(255, int((m - 50) * 255 / (255 - 50) * 1.2))
            pixels[x, y] = (r, g, b, alpha)
    img.save(dst_path, "PNG")
    print(f"wrote {dst_path} ({w}x{h})")

if __name__ == "__main__":
    main()

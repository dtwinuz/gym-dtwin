"""Shrink the exercise photos of the static demo build (dist-demo/ex) to 240 px.

    python -I scripts/demo-images.py dist-demo/ex

The demo is copied to a static host with a size budget; the app itself keeps 480 px.
"""
import io
import sys
from pathlib import Path

from PIL import Image

SIDE = 240
QUALITY = 55


def main(root: str) -> None:
    before = after = 0
    for f in sorted(Path(root).glob("*/*.webp")):
        raw = f.read_bytes()
        before += len(raw)
        with Image.open(io.BytesIO(raw)) as im:
            im.thumbnail((SIDE, SIDE))
            out = io.BytesIO()
            im.save(out, "WEBP", quality=QUALITY, method=6)
        f.write_bytes(out.getvalue())
        after += out.tell()
    print(f"demo images: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "dist-demo/ex")

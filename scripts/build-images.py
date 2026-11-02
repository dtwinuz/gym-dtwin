"""Convert free-exercise-db photos to small webp files we host ourselves.

    python -I scripts/build-images.py <free-exercise-db dir> public/ex

Writes <out>/<id>/<n>.webp (480 px wide). Existing files are skipped.
"""
import sys
from pathlib import Path

from PIL import Image

WIDTH = 480
QUALITY = 70


def main(src: str, out: str) -> None:
    root = Path(src) / "exercises"
    dest = Path(out)
    done = 0
    for img in sorted(root.glob("*/*.jpg")):
        target = dest / img.parent.name / (img.stem + ".webp")
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(img) as im:
            im = im.convert("RGB")
            h = round(im.height * WIDTH / im.width)
            im.resize((WIDTH, h), Image.LANCZOS).save(target, "WEBP", quality=QUALITY, method=6)
        done += 1
    print(f"{done} images written to {dest}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

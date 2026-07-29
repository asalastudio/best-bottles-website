#!/usr/bin/env python3
"""Export flattened Empire product references for Higgsfield integration."""

from pathlib import Path

from PIL import Image
from psd_tools import PSDImage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    "/Users/jordanrichter/Projects/Clients/Nemat-International/"
    "Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles/"
    "21. Empire 50ml/1. Empire 50ml PSD"
)
OUTPUT = ROOT / "public/cinematic/references/higgsfield-fitments"

FITMENTS = {
    "reducer-gold": "1. GBEmp50RdcrShnGl...psd",
    "sprayer-gold": "15. GBEmp50SpryShnGl.psd",
    "sprayer-black": "19. GBEmp50SpryShnBlk.psd",
    "sprayer-silver": "29. GBEmp50SpryShnSl.psd",
    "atomizer-pink": "34. GBEmp50AnSpPnk.psd",
    "atomizer-black": "39. GBEmp50AnSpBlk.psd",
    "tassel-red": "47. GBEmp50AnSpTslRed.psd",
    "tassel-black": "48. GBEmp50AnSpTslBlk.psd",
}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for slug, filename in FITMENTS.items():
        composite = PSDImage.open(SOURCE / filename).composite()
        if composite is None:
            raise SystemExit(f"Unable to composite {filename}")
        composite = composite.convert("RGBA")
        if composite.height > 1600:
            width = round(composite.width * 1600 / composite.height)
            composite = composite.resize((width, 1600), Image.Resampling.LANCZOS)
        path = OUTPUT / f"{slug}.png"
        composite.save(path, optimize=True)
        print(path)


if __name__ == "__main__":
    main()

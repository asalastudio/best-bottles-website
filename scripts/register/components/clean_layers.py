#!/usr/bin/env python3
"""
Clear specks from a neck's already-cut component layers in place, without re-cutting them.

  python3 scripts/register/components/clean_layers.py --neck 18-415

Applies cut_components.drop_specks to every front layer (not dip tubes or pipettes) listed in
data/register/components/<neck>-measurements.json. The canvas keeps its size, so every anchor holds; a changed
layer gets its new sha256 and checks.specksClearedPx. Reload with push-components.ts afterwards.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_components import REGISTER, ROOT, drop_specks, sha  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--neck", required=True)
    args = ap.parse_args()
    path = REGISTER / "components" / f"{args.neck}-measurements.json"
    m = json.loads(path.read_text())
    out_dir = ROOT / "output" / "register-components" / args.neck
    changed = 0
    for c in m["components"]:
        for layer in c["layers"]:
            if layer["z"] != "front":
                continue
            file = out_dir / layer["file"]
            img = Image.open(file).convert("RGBA")
            clean, cleared = drop_specks(img, layer["slot"])
            if not cleared:
                continue
            clean.save(file, optimize=True)
            layer["sha256"] = sha(clean)
            c["checks"].setdefault("specksClearedPx", {})[layer["slot"]] = cleared
            changed += 1
            print(f"{c['componentId']:26} {layer['slot']:8} cleared {cleared} px")
    path.write_text(json.dumps(m, indent=1) + "\n")
    print(f"{changed} layer(s) cleaned in {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

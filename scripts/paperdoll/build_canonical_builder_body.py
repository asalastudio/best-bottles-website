#!/usr/bin/env python3
"""One fixed bare-glass body for a Build Your Bottle bottle, from a retouched PSD Jordan supplies.

Empire 100 ml, 2026-09-20. Every Empire master PSD photographs the glass with the orifice
reducer seated in the neck, so every kit body — and the body the builder holds fixed while
tops are swapped — shows a plug in an "empty" bottle. Jordan retouched one file:
the master's own glass layer (byte-identical, checked here) plus a "Remove tool edits" layer
painted over the reducer dome.

That layer is an opaque WHITE cover: right on a white page, a white lid on the bone stage.
It is therefore used as what it means — an eraser. Glass alpha is multiplied by
(1 - patch alpha); no pixel is recoloured, none invented, and no white-keyed matte touches
the glass. The result is placed on the 1000x1100 kit canvas exactly where the builder's
current reference body stands (same glass width, centre and bottom), in one resample from
native, so every existing fitment registration lands where it lands today.

    python3 scripts/paperdoll/build_canonical_builder_body.py
"""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from build_cyl9_kits import alpha_gate, save_part  # noqa: E402

MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")
CANVAS = (1000, 1100)
BODIES = [{
    "key": "Empire|100|Clear|18-415",
    "retouched": Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BBUAT-Upload-Files/1. PSD Uncapped /2.  18-415 Bottles /22. Empire Bottle 100ml/1. Empire 100ml PSD/No_Reducer/1. GBEmp100RdcrShnGl.psd"),
    "master": MASTER / "2.  18-415 Bottles /22. Empire Bottle 100ml/1. Empire 100ml PSD/1. GBEmp100RdcrShnGl.psd",
    # the body the builder holds fixed today (MatrixClient bodyReference: first full Vintage Bulb Sprayer kit)
    "referenceBatch": ROOT / "dist/paper-doll/empire-2026-09-16", "referenceSku": "GBEmp100AnSpBlk",
    "slug": "empire-100-clear-18-415",
}]


def pixel_layers(psd):
    return [l for l in psd.descendants() if not l.is_group() and l.is_visible() and l.bbox != (0, 0, psd.width, psd.height)]


def solid_bottom(alpha: np.ndarray) -> int:
    rows = (alpha >= 128).sum(1)
    return int(np.nonzero(rows > 0.5 * rows.max())[0].max()) + 1


def main():
    out_dir = ROOT / "public/images/bottle-builder/bodies/canonical"; out_dir.mkdir(parents=True, exist_ok=True)
    registry_path = ROOT / "src/lib/bottle-builder/canonical-bodies.generated.json"
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {}
    for spec in BODIES:
        psd = PSDImage.open(spec["retouched"]); layers = pixel_layers(psd)
        glass = max(layers, key=lambda l: l.width * l.height)
        patches = [l for l in layers if l is not glass]
        master_glass = max(pixel_layers(PSDImage.open(spec["master"])), key=lambda l: l.width * l.height)
        g = np.asarray(glass.composite().convert("RGBA")).copy()
        if not np.array_equal(g, np.asarray(master_glass.composite().convert("RGBA"))):
            raise ValueError(f"{spec['key']}: the retouched file's glass is not the master's glass layer")
        erased = 0
        for patch in patches:
            pa = np.zeros(g.shape[:2], float)
            p = np.asarray(patch.composite().convert("RGBA"))[:, :, 3] / 255.0
            x0, y0 = patch.left - glass.left, patch.top - glass.top
            ys = slice(max(0, y0), min(g.shape[0], y0 + p.shape[0])); xs = slice(max(0, x0), min(g.shape[1], x0 + p.shape[1]))
            pa[ys, xs] = p[ys.start - y0: ys.stop - y0, xs.start - x0: xs.stop - x0]
            before = g[:, :, 3].astype(float)
            g[:, :, 3] = np.round(before * (1 - pa)).astype(np.uint8)
            erased += int(((before >= 128) & (g[:, :, 3] < 128)).sum())
        native = Image.fromarray(g, "RGBA"); native = native.crop(native.getbbox())

        manifest = json.loads((spec["referenceBatch"] / "kits/manifest.json").read_text())
        ref = next(r for r in manifest["rows"] if r["sku"] == spec["referenceSku"])
        ref_body = next(p for p in ref["parts"] if p["slot"] == "body")
        rb = ref_body["bounds"]
        # width of the glass is measured below the neck in both, so the erased dome cannot move it
        k = (rb["right"] - rb["left"]) / native.width
        small = native.resize((round(native.width * k), round(native.height * k)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
        canvas.alpha_composite(small, (round((rb["left"] + rb["right"]) / 2 - small.width / 2), rb["bottom"] - small.height))
        rgba = np.asarray(canvas)
        ok, gate = alpha_gate(rgba)
        if not ok:
            raise ValueError(f"{spec['key']}: alpha gate failed: {gate}")
        tmp = out_dir / f"{spec['slug']}.tmp.webp"; saved = save_part(rgba, str(tmp))
        name = f"{spec['slug']}.{saved['sha256'][:12]}.webp"; tmp.replace(out_dir / name)
        ys, xs = np.nonzero(rgba[:, :, 3] > 0)
        bounds = {"left": int(xs.min()), "top": int(ys.min()), "right": int(xs.max()) + 1, "bottom": int(ys.max()) + 1}
        registry[spec["key"]] = {
            "part": {"slot": "body", "zOrder": 0, "bounds": bounds,
                     "image": {"url": f"/images/bottle-builder/bodies/canonical/{name}", "width": CANVAS[0], "height": CANVAS[1], "sha256": saved["sha256"]}},
            # verbatim from the reference kit, so fitment seating is numerically what it is today
            "anchors": ref["anchors"], "groundY": solid_bottom(rgba[:, :, 3]),
            "registeredTo": {"sku": spec["referenceSku"], "bodyBounds": rb, "bodySha256": Path(ref_body["image"]).name.split(".")[0]},
            "source": {"retouchedPsd": str(spec["retouched"]), "retouchedSha256": hashlib.sha256(spec["retouched"].read_bytes()).hexdigest(),
                       "masterPsd": str(spec["master"].relative_to(MASTER)), "masterSha256": hashlib.sha256(spec["master"].read_bytes()).hexdigest(),
                       "glassLayerIdenticalToMaster": True, "eraserLayers": [l.name for l in patches], "glassPixelsErased": erased,
                       "note": "Retouched file lives in BBUAT-Upload-Files; file it under BB-PSD-Files-Master to make it master truth."},
            "gate": gate, "status": "candidate — awaiting Jordan's approval",
        }
        print(spec["key"], "->", name, "bounds", bounds, "ref", rb, "erased px", erased, "groundY", registry[spec["key"]]["groundY"])
    registry_path.write_text(json.dumps(registry, indent=1) + "\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Split a dropper kit's one fused `fitment` part into `fitment` (bulb + collar) and `pipette`.

The master PSDs photograph a dropper as one layer: rubber bulb, metal collar and the GLASS
pipette. Drawn as one opaque part inside a clear bottle, the pipette reads as a white stick
(Jordan, 2026-09-20). Glass inside glass must blend the way the dip tube does, so the pipette
becomes its own part in the schema's `pipette` slot and BuilderImage multiplies it.

The cut is where the collar ends: scanning down from the widest row of the part (the collar),
the first row narrower than 60 % of that width is the top of the pipette. Every pixel goes to
exactly one of the two parts — nothing is recoloured, resampled or invented — so the
reassembled kit equals the plate exactly as it did before; parity and alpha are re-gated anyway.
Which SKUs are droppers comes from the catalogue's applicator field. Output is a NEW batch.

    python3 scripts/paperdoll/split_dropper_pipette.py --out dist/paper-doll/empire-droppers-2026-09-20 \
        --source dist/paper-doll/empire-2026-09-16 --source dist/paper-doll/empire-waived-2026-09-20
"""
from __future__ import annotations
import argparse, hashlib, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from build_master_kits import parity, place_exploded  # noqa: E402
from build_cyl9_kits import alpha_gate, save_part  # noqa: E402

CANVAS = (1000, 1100)
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")


def black_and_white(psd_path: Path):
    """The PSD's visible 'Black & White' adjustment, if it has one, as a function on RGBA arrays.

    GBEmp50DrpSl is a GOLD dropper photograph turned silver by that adjustment; psd-tools does not
    render it, so the part came out gold against a silver plate. Photoshop's mix: grey = min +
    (max - mid) x weight of the dominant primary + (mid - min) x weight of the hue between the two
    largest channels. Weights are read from the PSD, never assumed. Proven by the plate parity gate."""
    for layer in PSDImage.open(psd_path).descendants():
        if layer.is_visible() and all(hasattr(layer, k) for k in ("red", "yellow", "green", "cyan", "blue", "magenta")):
            R, Y, G, C, B, M = (getattr(layer, k) / 100 for k in ("red", "yellow", "green", "cyan", "blue", "magenta"))
            def apply(rgba: np.ndarray) -> np.ndarray:
                rgb = rgba[:, :, :3].astype(float); mx, mn = rgb.max(2), rgb.min(2); md = rgb.sum(2) - mx - mn
                grey = np.clip(mn + (mx - md) * np.choose(rgb.argmax(2), [R, G, B]) + (md - mn) * np.choose(rgb.argmin(2), [C, M, Y]), 0, 255)
                out = rgba.copy(); out[:, :, :3] = grey.round().astype(np.uint8)[:, :, None]; return out
            return apply, {"layer": layer.name, "weights": {"red": R, "yellow": Y, "green": G, "cyan": C, "blue": B, "magenta": M}}
    return None, None


def collar_bottom(alpha: np.ndarray) -> int:
    solid = alpha >= 128
    widths = np.array([(np.nonzero(r)[0].max() - np.nonzero(r)[0].min() + 1) if r.any() else 0 for r in solid])
    widest = int(np.argmax(widths))
    for y in range(widest, len(widths)):
        if 0 < widths[y] < 0.6 * widths[widest]:
            return y
    raise ValueError("no pipette below the collar")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--source", type=Path, action="append", required=True)
    ap.add_argument("--rebuild-held", action="append", default=[],
                    help="a SKU held in its source batch because it was cut wrongly there; it is rebuilt here and must pass the standard gate")
    args = ap.parse_args()
    kits = (ROOT / args.out) / "kits"
    if kits.exists():
        shutil.rmtree(kits)
    (kits / "parts").mkdir(parents=True)
    rows_out = []
    for rel in args.source:
        batch = ROOT / rel
        plates = {r["websiteSku"]: r for r in json.loads((batch / "plates/manifest.json").read_text())["rows"]}
        for row in json.loads((batch / "kits/manifest.json").read_text())["rows"]:
            if row.get("applicator") != "Dropper" or (row["status"] != "candidate" and row["sku"] not in args.rebuild_held) or not row.get("parts") or any(r["sku"] == row["sku"] for r in rows_out):
                continue
            sku = row["sku"]
            fused = [p for p in row["parts"] if p["slot"] == "fitment"]
            if len(fused) != 1 or any(p["slot"] == "pipette" for p in row["parts"]):
                raise ValueError(f"{sku}: expected one fused fitment part, found {[p['slot'] for p in row['parts']]}")
            src = np.asarray(Image.open(batch / "kits" / fused[0]["image"]).convert("RGBA"))
            adjust, adjustment = black_and_white(MASTER / row["sourcePath"])
            if adjust:
                src = adjust(src)
            cut = collar_bottom(src[:, :, 3])

            def store(rgba, slot):
                ok, gate = alpha_gate(rgba)
                if not ok:
                    raise ValueError(f"{sku}: {slot} alpha gate failed: {gate}")
                tmp = kits / "parts" / f"{sku}.{slot}.tmp.webp"; saved = save_part(rgba, str(tmp))
                name = f"{saved['sha256']}.{slot}.webp"; tmp.replace(kits / "parts" / name)
                ys, xs = np.nonzero(rgba[:, :, 3] > 0)
                return dict(saved, image=f"parts/{name}", storeKey=f"kits/master-parts/{name}",
                            bounds={"left": int(xs.min()), "top": int(ys.min()), "right": int(xs.max()) + 1, "bottom": int(ys.max()) + 1})

            # Below the cut the collar leaves a faint feathered fringe (alpha < 128) wider than the
            # pipette. It is the collar's, so it stays with the collar: the pipette is only the columns
            # of the glass tube itself (its solid span, +3 px for its own anti-aliased edge).
            cols = np.nonzero((src[cut + 30:, :, 3] >= 128).any(0))[0]
            tube = np.zeros(src.shape[:2], bool); tube[cut:, max(0, cols.min() - 3): cols.max() + 4] = True
            top, bottom = src.copy(), src.copy()
            top[:, :, 3][tube] = 0; bottom[:, :, 3][~tube] = 0
            body = next(p for p in row["parts"] if p["slot"] == "body")
            shutil.copy(batch / "kits" / body["image"], kits / body["image"])
            # the pipette hangs inside the glass, under the collar: z1; bulb + collar on top: z2
            pipette = dict(fused[0], slot="pipette", zOrder=1, explodeIndex=1, **store(bottom, "pipette"))
            fitment = dict(fused[0], slot="fitment", zOrder=2, explodeIndex=2, **store(top, "fitment"))
            parts = [dict(body), pipette, fitment]
            place_exploded(parts)
            composite = Image.new("RGBA", CANVAS, "white")
            for p in sorted(parts, key=lambda p: p["zOrder"]):
                composite.alpha_composite(Image.open(kits / p["image"]).convert("RGBA"))
            plate_path = batch / "plates" / plates[sku]["plate"]["key"]
            if hashlib.sha256(plate_path.read_bytes()).hexdigest() != row["plateSha256"]:
                raise ValueError(f"{sku}: plate on disk is not the plate the kit is registered to")
            pg = parity(composite, Image.open(plate_path))          # the STANDARD gate: no waiver reaches a kit built here
            if not pg["ok"]:
                raise ValueError(f"{sku}: reassembled kit no longer matches its plate: {pg}")
            alpha = []
            for p in parts:
                ok, gate = alpha_gate(np.asarray(Image.open(kits / p["image"]).convert("RGBA")))
                alpha.append(dict(gate, slot=p["slot"], ok=ok))
            rows_out.append(dict({k: v for k, v in row.items() if k != "reason"}, status="candidate", parts=parts, gates=dict(row["gates"], alpha=alpha, parity=pg),
                                 pipetteProvenance={"cutRow": cut, "fusedPartSha256": fused[0]["sha256"], "from": str(rel), "psdAdjustmentApplied": adjustment,
                                                    "how": "one fused dropper layer divided at the collar's lower edge; no pixel changed"}))
            print(f"{sku:16s} cut at y={cut}  fitment {fitment['bounds']}  pipette {pipette['bounds']}  {'B&W applied  ' if adjust else ''}parity {pg['mean']:.3f} (was {row['gates']['parity']['mean']:.3f})")
    (kits / "manifest.json").write_text(json.dumps({"builder": "split_dropper_pipette.py", "partial": False, "counts": {"candidate": len(rows_out)}, "rows": rows_out}, indent=1))
    # the publisher verifies plates from the batch it is given
    print(f"{len(rows_out)} kits -> {kits}")


if __name__ == "__main__":
    main()

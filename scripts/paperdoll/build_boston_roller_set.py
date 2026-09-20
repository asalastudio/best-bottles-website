#!/usr/bin/env python3
"""Give every Boston Round roller kit the roller its SKU actually has.

The master PSDs hold ONE roller photograph per bottle size and reuse it across
finishes: every 1 oz PSD carries a steel ball (with a retoucher's white cover
patch behind it), every 2 oz PSD carries the plastic roller. A capped plate never
showed it. Build Your Bottle takes the cap off, so a plastic-roller SKU shows a
steel ball at 1 oz, a metal-roller SKU shows a plastic one at 2 oz, and the patch
reads as a white blotch on the bone stage.

Both photographs are real and both fitments plug the same 20-400 finish: measured
against the neck they sit in, the metal flange is 0.9175 of the neck and the
plastic flange 0.9231 — the same diameter within 0.6 %. So nothing is invented:

  * right ball already, patch behind it  ->  strip the patch in place, no resample
  * wrong ball                           ->  take the OTHER size's roller from its
                                             native PSD layer, scale it by flange
                                             width in one resample, and seat it on
                                             this SKU's own flange centre and bottom

Which ball a SKU has comes from the catalogue's applicator field, never from the
SKU's spelling. Every row is re-gated: the part's alpha, and parity of the
reassembled kit against the published plate. Output is a NEW batch the publisher
can read; the published batches are not touched. Nothing here publishes.

    python3 scripts/paperdoll/build_boston_roller_set.py --out dist/paper-doll/boston-rollers-2026-09-20
"""
from __future__ import annotations
import argparse, hashlib, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from family_batch import MASTER, checked_source  # noqa: E402
from build_master_kits import layer_inventory, parity  # noqa: E402
from build_cyl9_kits import alpha_gate, save_part  # noqa: E402
from strip_retouch_patch import strip_retouch_patch  # noqa: E402

ROOT = HERE.parents[1]
SOURCES = [
    "dist/paper-doll/boston-current-2026-09-16",
    "dist/paper-doll/boston-remaining-2026-09-16",
    "dist/paper-doll/kits-from-published-2026-09-19/families/boston-round",
]
CANVAS = (1000, 1100)


def flange(alpha: np.ndarray) -> dict:
    """The widest row in the part's lowest 30 %: the flange that sits on the neck rim."""
    ys, _ = np.nonzero(alpha > 128)
    y0, y1 = int(ys.min()), int(ys.max())
    best = (0, 0.0)
    for y in range(int(y1 - 0.30 * (y1 - y0 + 1)), y1 + 1):
        cols = np.nonzero(alpha[y] > 128)[0]
        if len(cols) and cols.max() - cols.min() + 1 > best[0]:
            best = (int(cols.max() - cols.min() + 1), float((cols.max() + cols.min()) / 2))
    return {"width": best[0], "cx": best[1], "bottom": y1}


def native_roller(row: dict, part: dict, strip: bool) -> Image.Image:
    """The roller layer at the PSD's own resolution, coloured as the plate is, cropped.

    `strip` removes the retouch patch and is only ever true for the steel-ball
    photograph. The plastic roller IS white: a white-keyed matte has no business
    near it, and parity cannot catch the damage because the roller sits under the cap."""
    path = checked_source(MASTER / row["sourcePath"])
    if hashlib.sha256(path.read_bytes()).hexdigest() != row["sourceSha256"]:
        raise ValueError(f"{row['sku']}: master PSD changed since the kit was cut")
    psd = PSDImage.open(path)
    layers = list(psd.descendants())
    adjustments = {l["index"] for l in layer_inventory(psd) if l.get("adjustment") and l.get("visible", True)}
    chosen = {id(layers[i]) for i in list(part["sourceLayerIndices"]) + sorted(adjustments)}
    im = psd.composite(force=True, ignore_preview=True, alpha=0.0, color=1.0,
                       layer_filter=lambda l: l.is_group() or id(l) in chosen).convert("RGBA")
    clean = strip_retouch_patch(im)[0] if strip else im
    return clean.crop(clean.getbbox())


def seat(native: Image.Image, target: dict) -> Image.Image:
    """Scale the native roller to the target flange width and stand it on the target's flange."""
    src = flange(np.asarray(native)[:, :, 3])
    scale = target["width"] / src["width"]
    size = (max(1, round(native.width * scale)), max(1, round(native.height * scale)))
    small = native.resize(size, Image.Resampling.LANCZOS)     # one prefiltered resample from native
    placed_flange = flange(np.asarray(small)[:, :, 3])
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    canvas.alpha_composite(small, (round(target["cx"] - placed_flange["cx"]), target["bottom"] - placed_flange["bottom"]))
    return canvas


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    out = (ROOT / args.out if not args.out.is_absolute() else args.out)
    kits = out / "kits"
    if kits.exists():
        shutil.rmtree(kits)
    (kits / "parts").mkdir(parents=True)

    # every published Boston roller kit, with where it lives
    found = []
    for rel in SOURCES:
        batch = ROOT / rel
        manifest = json.loads((batch / "kits/manifest.json").read_text())
        approved = set(json.loads((batch / "kits/approval.json").read_text())["skus"])
        plates = {r["websiteSku"]: r for r in json.loads((batch / "plates/manifest.json").read_text())["rows"]}
        for row in manifest["rows"]:
            if row["status"] != "candidate" or row["sku"] not in approved:
                continue
            roller = next((p for p in row["parts"] if p["slot"] == "roller"), None)
            if roller:
                found.append({"batch": batch, "row": row, "roller": roller, "plate": plates[row["sku"]]})

    def material(row):
        app = (row.get("applicator") or "").lower()
        if "metal" in app: return "metal"
        if "plastic" in app: return "plastic"
        raise ValueError(f"{row['sku']}: applicator {row.get('applicator')!r} names no roller material")

    def carries(item):
        im = Image.open(item["batch"] / "kits" / item["roller"]["image"]).convert("RGBA")
        return "metal" if strip_retouch_patch(im)[1] > 1000 else "plastic"   # only the steel-ball photo has the patch

    # one native source per material: the first kit that already carries it
    donors = {}
    for item in found:
        donors.setdefault(carries(item), item)
    natives = {m: native_roller(d["row"], d["roller"], strip=(m == "metal")) for m, d in donors.items()}
    print("donors:", {m: d["row"]["sku"] for m, d in donors.items()}, {m: n.size for m, n in natives.items()})

    rows_out, report = [], []
    for item in found:
        row, old = item["row"], item["roller"]
        want, has = material(row), carries(item)
        original = Image.open(item["batch"] / "kits" / old["image"]).convert("RGBA")
        # the patch exists only behind the steel ball; never run a white matte on white plastic
        stripped, patch_px = strip_retouch_patch(original) if has == "metal" else (original, 0)
        if want == has and patch_px == 0:
            continue                                   # already right and clean: leave the live kit alone
        if want == has:
            new, how = stripped, "patch stripped in place; pixels otherwise untouched"
            derivation = "background-matte"
        else:
            new = seat(natives[want], flange(np.asarray(stripped)[:, :, 3]))
            how = (f"{want} roller from {donors[want]['row']['sku']}'s native PSD layer, scaled by flange width "
                   f"and seated on this SKU's flange")
            derivation = "psd-layer"
        rgba = np.asarray(new)
        ok, gate = alpha_gate(rgba)
        if not ok:
            raise ValueError(f"{row['sku']}: roller alpha gate failed: {gate}")
        tmp = kits / "parts" / f"{row['sku']}.roller.tmp.webp"
        saved = save_part(rgba, str(tmp))
        name = f"{saved['sha256']}.roller.webp"
        tmp.replace(kits / "parts" / name)
        ys, xs = np.nonzero(rgba[:, :, 3] > 0)
        part = dict(old, image=f"parts/{name}", storeKey=f"kits/master-parts/{name}", **saved,
                    bounds={"left": int(xs.min()), "top": int(ys.min()), "right": int(xs.max()) + 1, "bottom": int(ys.max()) + 1},
                    derivation=derivation, whiteGroundPixelsDropped=patch_px if want == has else 0)
        parts = [part if p["slot"] == "roller" else p for p in row["parts"]]
        for p in parts:                                  # the batch must carry every file the publisher will hash
            if p["slot"] != "roller":
                shutil.copy(item["batch"] / "kits" / p["image"], kits / p["image"])
        composite = Image.new("RGBA", CANVAS, "white")
        for p in sorted(parts, key=lambda p: p["zOrder"]):
            composite.alpha_composite(Image.open(kits / p["image"]).convert("RGBA"))
        plate = Image.open(item["batch"] / "plates" / item["plate"]["plate"]["key"])
        if hashlib.sha256((item["batch"] / "plates" / item["plate"]["plate"]["key"]).read_bytes()).hexdigest() != row["plateSha256"]:
            raise ValueError(f"{row['sku']}: plate on disk is not the plate the kit is registered to")
        pg = parity(composite, plate)
        if not pg["ok"]:
            raise ValueError(f"{row['sku']}: reassembled kit no longer matches its plate: {pg}")
        gates = dict(row["gates"], parity=pg,
                     alpha=[dict(gate, slot="roller", ok=True) if g.get("slot") == "roller" else g
                            for g in row["gates"]["alpha"]])
        new_row = dict(row, parts=parts, gates=gates, rollerProvenance={
            "catalogueApplicator": row["applicator"], "carriedBefore": has, "carriesNow": want, "how": how,
            "donorSku": None if want == has else donors[want]["row"]["sku"],
            "donorPsd": None if want == has else donors[want]["row"]["sourcePath"],
            "donorPsdSha256": None if want == has else donors[want]["row"]["sourceSha256"],
            "previousRollerSha256": old["sha256"], "patchPixelsRemoved": patch_px,
            "sameFinishEvidence": "20-400 both sizes; flange/neck 0.9175 (metal, 1 oz) vs 0.9231 (plastic, 2 oz)"})
        rows_out.append(new_row)
        report.append((row["sku"], row["applicator"], has, want, pg["mean"], row["gates"]["parity"]["mean"]))

    (kits / "manifest.json").write_text(json.dumps({"builder": "build_boston_roller_set.py", "partial": False,
        "counts": {"candidate": len(rows_out)}, "rows": rows_out}, indent=1))
    print(f"\n{'sku':34s} {'catalogue says':20s} {'was':8s} {'now':8s} {'parity':>7s} {'(before)':>9s}")
    for sku, app, has, want, mean, before in sorted(report):
        print(f"{sku:34s} {app:20s} {has:8s} {want:8s} {mean:7.3f} {before:9.3f}")
    print(f"\n{len(rows_out)} kits rebuilt -> {kits.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

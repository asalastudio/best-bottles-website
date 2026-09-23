#!/usr/bin/env python3
"""Give the Empire perfume-sprayer and lotion-pump kits the pump they were cut without.

The capped master PSDs show a bottle wearing its overcap, so the kit extractor found a
glass, a dip tube and ONE piece of hardware — the overcap — and called it `sprayer`. At
50 ml it also called the dip tube `overcap`. Build Your Bottle takes the cover off and
finds nothing underneath. Only GBEmp100SpryCu's capped PSD happens to hold its pump.

Roles are read from geometry, never from the label that is wrong:

  diptube   the tall thin part (height > 4 x width)
  overcap   the widest remaining part — the cover the plate shows
  sprayer   the exposed pump. If the kit already holds one (a second, narrower piece of
            hardware under the cover) it is KEPT: it is this SKU's own photograph.
            Otherwise it comes from the master component library,
            20. Caps/7. 18-415 Sprayers/Spry18-415<finish>.psd, scaled to the collar width
            and stood on the bottom-centre of the pump in this SKU's uncapped twin PSD,
            carried through the kit's own plate registration. Nothing is guessed.

Which SKUs are perfume sprayers comes from the catalogue's applicator field. The finish
comes from the library file the SKU's own twin pump matches by name in the catalogue row.
The overcap stays in its assembled position (the builder stands it beside the bottle), so
the reassembled kit must still equal the published plate: every row is re-gated on part
alpha and on parity. Copper's overcap carries a retoucher's white shards; the white-keyed
matte is run on that one finish only. Output is a NEW batch; nothing here publishes.

Lotion pumps (2026-09-20, Jordan: "the same thing we did just for the spray pumps") are the same
defect under another name: the cover was filed as `pump`. The library's 8. 18-415 Lotion supplies
the exposed pump. The two clear-overcap SKUs are left alone: their one photograph is the pump SEEN
THROUGH its clear cover, the library's Ltn18-415MtSlCl is not isolated from its white ground, and a
white-keyed matte must never touch clear plastic — there is no honest way to split them.

    python3 scripts/paperdoll/build_empire_pump_kits.py --out dist/paper-doll/empire-pumps-2026-09-20
    python3 scripts/paperdoll/build_empire_pump_kits.py --applicator "Lotion Pump" --out dist/paper-doll/empire-lotion-pumps-2026-09-20
"""
from __future__ import annotations
import argparse, hashlib, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(ROOT / "scripts/bottle-builder-pilot"))
from build_master_kits import parity, place_exploded  # noqa: E402
from build_cyl9_kits import alpha_gate, save_part  # noqa: E402
from strip_retouch_patch import strip_retouch_patch  # noqa: E402
from empire_library_pumps import (BATCHES, CANVAS, FINISHES, MASTER, beside, collar,  # noqa: E402
                                  fg_layers, kit_for, largest_component, to_canvas, twin_of)


# catalogue applicator -> the kit slot its mechanism lives in, and where the library keeps it
KINDS = {
    "Perfume Spray Pump": {"slot": "sprayer", "dir": MASTER / "20. Caps" / "7. 18-415 Sprayers ", "file": "*Spry18-415{finish}.psd"},
    "Lotion Pump": {"slot": "pump", "dir": MASTER / "20. Caps" / "8. 18-415 Lotion", "file": "*Ltn18-415{finish}.psd"},
}


def bounds_of(rgba: np.ndarray) -> dict:
    ys, xs = np.nonzero(rgba[:, :, 3] > 0)
    return {"left": int(xs.min()), "top": int(ys.min()), "right": int(xs.max()) + 1, "bottom": int(ys.max()) + 1}


def roles(parts: list[dict]) -> dict:
    """diptube / overcap / pump by shape. The labels on these kits are what is wrong."""
    size = lambda p: (p["bounds"]["right"] - p["bounds"]["left"], p["bounds"]["bottom"] - p["bounds"]["top"])
    rest = [p for p in parts if p["slot"] != "body"]
    tube = [p for p in rest if size(p)[1] > 4 * size(p)[0]]
    hardware = sorted((p for p in rest if p not in tube), key=lambda p: -size(p)[0])
    if len(tube) != 1 or not 1 <= len(hardware) <= 2:
        raise ValueError(f"unexpected parts: {[(p['slot'], size(p)) for p in rest]}")
    return {"diptube": tube[0], "overcap": hardware[0], "pump": hardware[1] if len(hardware) == 2 else None}


def library_pump(sku: str, row: dict, reg, lib_path: Path):
    capped_path = MASTER / row["sourcePath"]
    if hashlib.sha256(capped_path.read_bytes()).hexdigest() != row["sourceSha256"]:
        raise ValueError(f"{sku}: master PSD changed since the kit was cut")
    twin_path = twin_of(capped_path, sku)
    area = lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1])
    cb = max(fg_layers(PSDImage.open(capped_path)), key=area)
    twin = PSDImage.open(twin_path); tb = max(fg_layers(twin), key=area)
    others = [l for l in fg_layers(twin) if l is not tb]
    overcap = next(l for l in others if beside(l, tb))
    pump = min((l for l in others if l is not overcap and l.top < tb.top and l.width > 0.25 * tb.width), key=lambda l: l.top)
    footprint = to_canvas(pump.composite().convert("RGBA"), pump.left + cb.left - tb.left, pump.top + cb.top - tb.top, reg)
    target = collar(np.asarray(footprint)[:, :, 3])
    lib = largest_component(fg_layers(PSDImage.open(lib_path))[0].composite().convert("RGBA"))
    k = target["width"] / collar(np.asarray(lib)[:, :, 3])["width"]
    small = lib.resize((max(1, round(lib.width * k)), max(1, round(lib.height * k))), Image.Resampling.LANCZOS)  # one resample from native
    placed = collar(np.asarray(small)[:, :, 3])
    out = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    out.alpha_composite(small, (round(target["cx"] - placed["cx"]), target["bottom"] - placed["bottom"]))
    return out, {"libraryPsd": str(lib_path.relative_to(MASTER)), "libraryPsdSha256": hashlib.sha256(lib_path.read_bytes()).hexdigest(),
                 "twinPsd": str(twin_path.relative_to(MASTER)), "twinPsdSha256": hashlib.sha256(twin_path.read_bytes()).hexdigest(),
                 "scale": round(k, 4), "collarTarget": target}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--applicator", default="Perfume Spray Pump", choices=sorted(KINDS))
    args = ap.parse_args()
    out = ROOT / args.out if not args.out.is_absolute() else args.out
    kits = out / "kits"
    if kits.exists():
        shutil.rmtree(kits)
    (kits / "parts").mkdir(parents=True)

    def store(rgba: np.ndarray, sku: str, slot: str) -> dict:
        ok, gate = alpha_gate(rgba)
        if not ok:
            raise ValueError(f"{sku}: {slot} alpha gate failed: {gate}")
        tmp = kits / "parts" / f"{sku}.{slot}.tmp.webp"
        saved = save_part(rgba, str(tmp))
        name = f"{saved['sha256']}.{slot}.webp"
        tmp.replace(kits / "parts" / name)
        return dict(saved, image=f"parts/{name}", storeKey=f"kits/master-parts/{name}", bounds=bounds_of(rgba))

    def relabel(batch: Path, part: dict, slot: str) -> dict:
        """Same pixels under the right name. The file is named by slot, so it is re-filed, not re-encoded."""
        if part["slot"] == slot:
            shutil.copy(batch / "kits" / part["image"], kits / part["image"])
            return dict(part)
        name = f"{part['sha256']}.{slot}.webp" if "sha256" in part else Path(part["image"]).name.split(".")[0] + f".{slot}.webp"
        shutil.copy(batch / "kits" / part["image"], kits / "parts" / name)
        return dict(part, slot=slot, image=f"parts/{name}", storeKey=f"kits/master-parts/{name}")

    kind = KINDS[args.applicator]; slot = kind["slot"]
    rows_out, report, left_alone = [], [], []
    for batch in BATCHES:
        for listed in json.loads((batch / "kits/manifest.json").read_text())["rows"]:
            if listed.get("applicator") != args.applicator or listed["status"] != "candidate":
                continue
            sku = listed["sku"]
            try:
                found_batch, row, reg = kit_for(sku)
            except KeyError:
                continue                               # a candidate nobody approved is not a live kit
            if found_batch != batch or any(r["sku"] == sku for r in rows_out):
                continue
            finish = next((f for f in sorted(FINISHES, key=len, reverse=True) if sku.endswith(f)), None)
            lib = sorted(kind["dir"].glob(kind["file"].format(finish=finish))) if finish else []
            if len(lib) != 1:
                left_alone.append((sku, "no isolated library pump for this finish"))
                continue
            was = roles(row["parts"])
            body = relabel(batch, next(p for p in row["parts"] if p["slot"] == "body"), "body")
            tube = dict(relabel(batch, was["diptube"], "diptube"), zOrder=1, explodeIndex=1)

            provenance = {"labelsBefore": {p["slot"]: [p["bounds"]["right"] - p["bounds"]["left"], p["bounds"]["bottom"] - p["bounds"]["top"]]
                                           for p in row["parts"] if p["slot"] != "body"}}
            if was["pump"] is not None:
                pump = dict(relabel(batch, was["pump"], slot), zOrder=2, explodeIndex=2)
                provenance["pump"] = "kept: this SKU's own photographed pump, already in its capped PSD"
            else:
                img, how = library_pump(sku, row, reg, lib[0])
                pump = dict(was["overcap"], slot=slot, variantKey=None, zOrder=2, explodeIndex=2, derivation="psd-layer",
                            sourceLayerIndices=[], whiteGroundPixelsDropped=0, **store(np.asarray(img), sku, slot))
                provenance.update(pump="master component library, seated on the uncapped twin's pump footprint", **how)

            cap_src = Image.open(batch / "kits" / was["overcap"]["image"]).convert("RGBA")
            stripped, patch_px = strip_retouch_patch(cap_src) if finish == "Cu" else (cap_src, 0)
            if patch_px:
                cap = dict(was["overcap"], slot="overcap", zOrder=3, explodeIndex=3, derivation="background-matte",
                           whiteGroundPixelsDropped=patch_px, **store(np.asarray(stripped), sku, "overcap"))
            else:
                cap = dict(relabel(batch, was["overcap"], "overcap"), zOrder=3, explodeIndex=3)
            provenance["overcapPatchPixelsRemoved"] = patch_px

            parts = [body, tube, pump, cap]
            place_exploded(parts)
            # the pump must be wholly under the cover, or the capped plate would show it
            pa = np.asarray(Image.open(kits / pump["image"]).convert("RGBA"))[:, :, 3] >= 128
            ca = np.asarray(Image.open(kits / cap["image"]).convert("RGBA"))[:, :, 3] >= 128
            provenance["pumpPixelsOutsideCover"] = int((pa & ~ca).sum())

            composite = Image.new("RGBA", CANVAS, "white")
            for p in sorted(parts, key=lambda p: p["zOrder"]):
                composite.alpha_composite(Image.open(kits / p["image"]).convert("RGBA"))
            plate_row = next(p for p in json.loads((batch / "plates/manifest.json").read_text())["rows"] if p["websiteSku"] == sku)
            plate_path = batch / "plates" / plate_row["plate"]["key"]
            if hashlib.sha256(plate_path.read_bytes()).hexdigest() != row["plateSha256"]:
                raise ValueError(f"{sku}: plate on disk is not the plate the kit is registered to")
            pg = parity(composite, Image.open(plate_path))
            if not pg["ok"]:
                raise ValueError(f"{sku}: reassembled kit no longer matches its plate: {pg}")
            alpha = []
            for p in parts:
                ok, gate = alpha_gate(np.asarray(Image.open(kits / p["image"]).convert("RGBA")))
                if not ok:
                    raise ValueError(f"{sku}: {p['slot']} alpha gate failed: {gate}")
                alpha.append(dict(gate, slot=p["slot"], ok=True))
            rows_out.append(dict(row, parts=parts, gates=dict(row["gates"], alpha=alpha, parity=pg), pumpProvenance=provenance))
            report.append((sku, "kept own" if was["pump"] is not None else f"library x{provenance['scale']:.3f}",
                           patch_px, provenance["pumpPixelsOutsideCover"], pg["mean"], row["gates"]["parity"]["mean"]))

    (kits / "manifest.json").write_text(json.dumps({"builder": "build_empire_pump_kits.py", "partial": False,
        "counts": {"candidate": len(rows_out)}, "rows": rows_out}, indent=1))
    print(f"{'sku':20s} {'pump':16s} {'cap patch px':>12s} {'pump px outside cover':>22s} {'parity':>7s} {'(before)':>9s}")
    for r in sorted(report):
        print(f"{r[0]:20s} {r[1]:16s} {r[2]:12d} {r[3]:22d} {r[4]:7.3f} {r[5]:9.3f}")
    for sku, why in left_alone:
        print(f"{sku:20s} LEFT ALONE: {why}")
    print(f"\n{len(rows_out)} kits rebuilt -> {kits}")


if __name__ == "__main__":
    main()

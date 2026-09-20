#!/usr/bin/env python3
"""Seat the master component library's exposed 18-415 pumps on the Empire 50 and 100 ml.

Jordan, 2026-09-20: the finish tiles "need to have the actual pumps exposed, not the
overcaps. The overcaps are going to be the sidecars" — and build from
BB-PSD-Files-Master/20. Caps "if the layers and images supply it".

  ART        the pump comes from the library: 20. Caps/7. 18-415 Sprayers/Spry18-415<finish>.psd,
             its one foreground layer, keeping only the pump's own connected shape (Copper
             carries stray white fragments beside it).
  POSITION   where a pump sits is not guessed. Every Empire sprayer SKU has an UNCAPPED twin PSD
             photographed with the pump exposed. The twin's pump layer, carried into the capped
             PSD by the identical body layer and then through the kit's own plate registration,
             gives the footprint on the builder canvas. The library pump is scaled to that
             collar width and stood on that bottom-centre.
  SIDECAR    the overcap is the twin's own overcap layer, stood on the baseline beside the glass.

Review sheet only. Reads dist/ and the master library. Publishes nothing.
"""
from __future__ import annotations
import hashlib, json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageDraw
from psd_tools import PSDImage
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/paperdoll"))
from strip_retouch_patch import strip_retouch_patch  # noqa: E402
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")
LIBRARY = MASTER / "20. Caps" / "7. 18-415 Sprayers "
BATCHES = [ROOT / "dist/paper-doll/empire-2026-09-16", ROOT / "dist/paper-doll/kits-from-published-2026-09-19/families/empire"]
STAGE = (238, 235, 229)                     # .preview background in Builder.module.css
CANVAS = (1000, 1100)
FINISHES = {"Cu": "Copper", "MtGl": "Matte Gold", "MtSl": "Matte Silver", "ShnBlk": "Shiny Black", "ShnGl": "Shiny Gold", "ShnSl": "Shiny Silver"}


def fg_layers(psd):
    return [l for l in psd.descendants() if not l.is_group() and l.is_visible() and l.bbox != (0, 0, psd.width, psd.height)]


def largest_component(im: Image.Image) -> Image.Image:
    arr = np.asarray(im.convert("RGBA")).copy()
    labels, n = ndimage.label(arr[:, :, 3] > 8, structure=np.ones((3, 3), bool))
    if n > 1:
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        arr[:, :, 3][labels != (int(np.argmax(sizes)) + 1)] = 0
    out = Image.fromarray(arr, "RGBA")
    return out.crop(out.getbbox())


def collar(alpha: np.ndarray) -> dict:
    """Widest solid row in the lowest 30 %: the pump's skirt, which is what meets the bottle."""
    ys, _ = np.nonzero(alpha >= 128)
    y0, y1 = int(ys.min()), int(ys.max())
    best = (0, 0.0)
    for y in range(int(y1 - 0.30 * (y1 - y0 + 1)), y1 + 1):
        cols = np.nonzero(alpha[y] >= 128)[0]
        if len(cols) and cols.max() - cols.min() + 1 > best[0]:
            best = (int(cols.max() - cols.min() + 1), float((cols.max() + cols.min()) / 2))
    return {"width": best[0], "cx": best[1], "bottom": y1}


def kit_for(sku: str):
    for batch in BATCHES:
        rows = json.loads((batch / "kits/manifest.json").read_text())["rows"]
        approved = set(json.loads((batch / "kits/approval.json").read_text())["skus"])
        row = next((r for r in rows if r["sku"] == sku and r["status"] == "candidate" and r["sku"] in approved), None)
        if row:
            plate = next(p for p in json.loads((batch / "plates/manifest.json").read_text())["rows"] if p["websiteSku"] == sku)
            reg = json.loads((batch / "plates" / plate["familyId"] / f"_registration-{plate['body']}.json").read_text())
            t = reg["plates"][f"{sku}.front-on"]
            s = reg["scale"] * next(x["scaleFactor"] for x in reg["sessions"] if x["index"] == t["session"])
            return batch, row, (s, t["ox"], t["oy"])
    raise KeyError(sku)


_INDEX: dict[str, list[Path]] = {}


def beside(layer, body) -> bool:
    """A part stood on the ground next to the bottle: its centre is beyond the glass's right edge."""
    return (layer.left + layer.right) / 2 > body.right


def twin_of(capped_path: Path, sku: str) -> Path:
    """The uncapped twin: same name anywhere in the master, a body layer of identical size, and
    an overcap STANDING BESIDE the glass. Told apart by what it shows — never by folder, file
    number or layer count (Copper's capped file already contains its pump, so the counts match)."""
    if not _INDEX:
        for q in MASTER.rglob("*.psd"):
            key = re.sub(r"\s+copy(\s+\d+)?$", "", re.sub(r"^\s*\d+[.-]?\s*", "", q.stem).strip(), flags=re.I).lower()
            _INDEX.setdefault(key, []).append(q)
    area = lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1])
    body = max(fg_layers(PSDImage.open(capped_path)), key=area)
    twins = {}
    for q in _INDEX.get(sku.lower(), []):
        layers = fg_layers(PSDImage.open(q)); qb = max(layers, key=area)
        # the same glass re-saved can differ by a pixel (LBEmp50LtnMtSl: 531x1268 vs 531x1269)
        if abs(qb.width - body.width) > 2 or abs(qb.height - body.height) > 2 or not any(beside(l, qb) for l in layers if l is not qb):
            continue
        # the same photograph filed in two folders is one twin: key it by its layer geometry
        twins[tuple(sorted((l.left - qb.left, l.top - qb.top, l.width, l.height) for l in layers))] = q
    if len(twins) != 1:
        raise ValueError(f"{sku}: expected one uncapped twin, found {len(twins)}")
    return next(iter(twins.values()))


def to_canvas(layer_img: Image.Image, x: float, y: float, reg) -> Image.Image:
    """Place a PSD-space image (top-left at x,y in CAPPED PSD coordinates) on the builder canvas."""
    s, ox, oy = reg
    w, h = max(1, round(layer_img.width * s)), max(1, round(layer_img.height * s))
    small = layer_img.resize((w, h), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    out.alpha_composite(small, (round(x * s + ox), round(y * s + oy)))
    return out


def build(sku: str, finish: str):
    batch, row, reg = kit_for(sku)
    capped_path = MASTER / row["sourcePath"]
    if hashlib.sha256(capped_path.read_bytes()).hexdigest() != row["sourceSha256"]:
        raise ValueError(f"{sku}: master PSD changed since the kit was cut")
    twin_path = twin_of(capped_path, sku)
    capped, twin = PSDImage.open(capped_path), PSDImage.open(twin_path)
    area = lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1])
    cb, tb = max(fg_layers(capped), key=area), max(fg_layers(twin), key=area)
    if (cb.width, cb.height) != (tb.width, tb.height):
        raise ValueError(f"{sku}: the twins' body layers differ, cannot carry positions across")
    dx, dy = cb.left - tb.left, cb.top - tb.top                       # twin PSD -> capped PSD
    others = [l for l in fg_layers(twin) if l is not tb]
    overcap = next(l for l in others if beside(l, tb))                 # stood beside the glass
    pump = min((l for l in others if l is not overcap and l.top < tb.top and l.width > 0.25 * tb.width), key=lambda l: l.top)
    tube = next((l for l in others if l not in (overcap, pump) and l.height > 2.5 * l.width), None)

    twin_pump = to_canvas(pump.composite().convert("RGBA"), pump.left + dx, pump.top + dy, reg)
    target = collar(np.asarray(twin_pump)[:, :, 3])

    lib_psd = PSDImage.open(next(LIBRARY.glob(f"*Spry18-415{finish}.psd")))
    lib = largest_component(fg_layers(lib_psd)[0].composite().convert("RGBA"))
    src = collar(np.asarray(lib)[:, :, 3])
    k = target["width"] / src["width"]
    small = lib.resize((max(1, round(lib.width * k)), max(1, round(lib.height * k))), Image.Resampling.LANCZOS)
    placed = collar(np.asarray(small)[:, :, 3])
    lib_pump = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    lib_pump.alpha_composite(small, (round(target["cx"] - placed["cx"]), target["bottom"] - placed["bottom"]))

    body_part = next(p for p in row["parts"] if p["slot"] == "body")
    body = Image.open(batch / "kits" / body_part["image"]).convert("RGBA")
    solid = np.asarray(body)[:, :, 3] >= 128
    ys, xs = np.nonzero(solid)
    baseline, right = int(ys.max()), int(xs.max())
    cap_img = overcap.composite().convert("RGBA")
    patch_px = 0
    if finish == "Cu":
        # Copper's overcap layer carries a retoucher's white shards at its top corners. The matte is
        # white-keyed, so it is named here for the one finish that needs it and is NEVER run on the
        # silver overcaps, whose highlights are genuinely white and reach the cap's own edge.
        cap_img, patch_px = strip_retouch_patch(cap_img)
    s = reg[0]
    cap_small = cap_img.resize((max(1, round(cap_img.width * s)), max(1, round(cap_img.height * s))), Image.Resampling.LANCZOS)
    sidecar = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    gap = max(18, round((right - int(xs.min())) * .08))
    sidecar.alpha_composite(cap_small, (min(right + gap, CANVAS[0] - cap_small.width - 4), baseline - cap_small.height + 1))
    tube_img = to_canvas(tube.composite().convert("RGBA"), tube.left + dx, tube.top + dy, reg) if tube else None

    def stage(tops):
        bg = Image.new("RGB", CANVAS, STAGE)
        white = Image.new("RGB", CANVAS, "white"); white.paste(body, (0, 0), body)
        out = ImageChops.multiply(bg, white).convert("RGBA")           # clear glass takes the stage colour
        for t in tops:
            if t is not None:
                out.alpha_composite(t)
        return out.convert("RGB")

    today = stage([Image.open(batch / "kits" / p["image"]).convert("RGBA") for p in sorted(row["parts"], key=lambda p: p["zOrder"]) if p["slot"] != "body"])
    pump_rows = np.nonzero(np.asarray(lib_pump)[:, :, 3] >= 128)[0]
    agree = {"pumpTopOnCanvas": int(pump_rows.min()), "overcapPatchPxRemoved": patch_px, "scale": round(k, 4), "libraryPx": list(lib.size), "collarTarget": target,
             "heightDiffPx": int(np.nonzero(np.asarray(lib_pump)[:, :, 3] >= 128)[0].min() - np.nonzero(np.asarray(twin_pump)[:, :, 3] >= 128)[0].min())}
    return {"sku": sku, "finish": finish, "twin": twin_path.name, "capped": capped_path.name, "fit": agree,
            "today": today, "library": stage([tube_img, lib_pump, sidecar]), "twinRender": stage([tube_img, twin_pump, sidecar])}


def main():
    results = []
    for size in (50, 100):
        for finish in FINISHES:
            sku = f"GBEmp{size}Spry{finish}"
            try:
                r = build(sku, finish)
                results.append((size, r))
                f = r["fit"]
                print(f"{sku:22s} twin {r['twin']:28s} library x{f['scale']:.3f}  collar {f['collarTarget']['width']:4d}px  top vs twin's own pump: {f['heightDiffPx']:+d}px")
            except Exception as e:
                print(f"{sku:22s} SKIPPED: {type(e).__name__}: {e}")
    # sheet: per size, a row of finishes; each cell = today | library pump + sidecar
    crop_for = {50: (230, 0, 990, 1100), 100: (230, 0, 990, 1100)}
    CW = 300
    for size in (50, 100):
        cells = [r for s, r in results if s == size]
        if not cells:
            continue
        box = crop_for[size]; ch = round(CW * (box[3] - box[1]) / (box[2] - box[0]))
        per_row, cell_w, cell_h = 3, 2 * CW + 26, ch + 78
        sheet = Image.new("RGB", (per_row * cell_w + 14, ((len(cells) + per_row - 1) // per_row) * cell_h), "white"); d = ImageDraw.Draw(sheet)
        for i, r in enumerate(cells):
            x, y = 14 + (i % per_row) * cell_w, (i // per_row) * cell_h
            for j, (key, label, colour) in enumerate([("today", "TODAY (what the kit holds)", "#b00"), ("library", "LIBRARY PUMP + overcap sidecar", "#060")]):
                sheet.paste(r[key].crop(box).resize((CW, ch), Image.Resampling.LANCZOS), (x + j * (CW + 4), y + 46))
                d.text((x + j * (CW + 4), y + 30), label, fill=colour)
            d.text((x, y + 8), f"{size} ml Empire · {FINISHES[r['finish']]}   ({r['sku']})", fill="#111")
            d.text((x, y + 50 + ch), f"library pump x{r['fit']['scale']:.3f} · top lands {r['fit']['heightDiffPx']:+d}px vs the twin's own pump", fill="#777")
        out = ROOT / f"public/reviews/builder-review-2026-09-19/empire{size}-library-pumps.jpg"
        sheet.save(out, quality=90); print("sheet:", out.relative_to(ROOT), sheet.size)
    (ROOT / "dist/paper-doll/empire-library-pumps.json").write_text(json.dumps(
        [{k: v for k, v in r.items() if k not in ("today", "library", "twinRender")} for _, r in results], indent=1))


if __name__ == "__main__":
    main()

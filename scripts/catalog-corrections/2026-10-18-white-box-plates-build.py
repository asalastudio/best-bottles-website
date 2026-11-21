#!/usr/bin/env python3
"""
2026-10-18: product pages whose stage shows a flat photo inside its own white box.

The main product page (src/components/pdp/PdpStage.tsx) draws the selected SKU's kit (productKits); without
one it falls back to pdpFallbackMedia: a released Sunburst hero, then the SKU's plate (productPlates.front).
The SKUs below have neither kit nor released hero, so the stage shows the plate, and every plate is a
1000x1100 RGB WebP flattened onto white (scripts/paperdoll/build_plates.py `flatten`). On the page's pearl
canvas that reads as a white box.

For each SKU this builds a replacement front in the same contract (1000x1100 WebP), from one of two sources:

  psd-cutout    The SKU's own master PSD. Its sha256 must equal productPlates.source.psdSha256, i.e. the very
                file the live plate was rendered from. It is composited without its full-canvas white
                background layer and placed with the live plate's own affine, recovered by fitting. Gate: laid
                over white it must reproduce the live plate (mean |diff| <= 6/255 over the ink, the kit
                composite gate). The result is the live plate with its white made transparent. Pure-white
                retouch paint standing apart from the product (invisible on white, a floating shard on pearl)
                loses its alpha; its colour stays, so over white the plate is unchanged.
  catalog-hero  The bone-background hero the catalogue card already shows for the SKU
                (src/lib/products/catalog-heroes.json), 1560x1716 scaled to 1000x1100. Its sha256 must equal
                the asset ledger's.

Nothing is generated or repainted. A SKU whose source cannot be verified stops the build.

    python3 scripts/catalog-corrections/2026-10-18-white-box-plates-build.py \\
        --snapshot DIR    # productPlates.jsonl from `npx convex data productPlates --prod --format jsonl --limit 8000`
        --psd-root DIR    # BB-PSD-Files-Master, or a mirror such as pipeline/paper-doll/reference-images

Writes data/catalog-corrections/2026-10-18-white-box-plates/{plates/*.webp, plan.json, rollback.json}.
Reads production only through the snapshot; uploads and writes nothing.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "data" / "catalog-corrections" / "2026-10-18-white-box-plates"
PLATE_HOST = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com"
OUT_W, OUT_H = 1000, 1100
WEBP_QUALITY = 88            # build_plates.py's plate quality
RESIDUAL_MAX = 6.0           # /255 over the ink: the kit composite gate (bestbottles-plate-kit-lane)

# page: the product page the SKU appears on; first: the variant that page shows when it opens.
ROWS = [
    {"sku": "GBHeartFrst4TslRed", "page": "heart-4ml-frosted-8mm-tassel", "first": True, "method": "catalog-hero",
     "hero": "public/images/catalog/bone-review/GBHeartFrst4TslRed.72085c2aa183.png",
     "heroSha256": "72085c2aa1830c424b586ce9dd5abab7179bafce0d7b2899c7854c62058259b5", "ledger": "sunburst-approved (release-3 lock)"},
    {"sku": "Alu100mlSprayBlack", "page": "aluminum-bottle-100ml-mixed-20-410", "first": True, "method": "catalog-hero",
     "hero": "public/images/catalog/bone-review/Alu100mlSprayBlack.560df11fa2c4.png",
     "heroSha256": "560df11fa2c4afc135de1e852a86a5fb1526474810b5b219c2e51993d44c7198", "ledger": "prior-release, indexed"},
    {"sku": "Alu500", "page": "aluminum-bottle-500ml-mixed-20-410", "first": True, "method": "catalog-hero",
     "hero": "public/images/catalog/bone-review/Alu500.8cd5134acf51.png",
     "heroSha256": "8cd5134acf51526a0c57625dfb2c4392617168c38a1fb61dddc7e33ac15310ce", "ledger": "prior-release, indexed"},
    {"sku": "GBMtlCylGl", "page": "royal-14ml-clear-11mm", "first": True, "method": "catalog-hero",
     "hero": "public/images/catalog/bone-review/GBMtlCylGl.1103c802f122.png",
     "heroSha256": "1103c802f122a99b7b0f7824a3188dc60262c7f0e9c4b278c2b7f67c33a7d310", "ledger": "prior-release, indexed"},
    {"sku": "GBBstnBlu15BlkDrpr", "page": "boston-round-15ml-cobalt-blue-18-400-dropper", "first": True, "method": "psd-cutout",
     # the mirror keeps this file under its 8.3 name, in a folder whose "/" became U+F022
     "mirror": "Boston Rnd Bottles 20-400 (1oz and 2oz) + 18-400 half oz/2. Cobalt Blue Bottle (half ounce15 ml) Dropper/5GBBST~1.PSD"},
    {"sku": "GBV1DrmBlackCapSht", "page": "vial-4ml-clear-13-425", "first": True, "method": "psd-cutout",
     "mirror": "12. Vials/0. All Vials/Capped/GBVial1DrmBlackCapSht copy.psd"},
    {"sku": "GBElg30SpryBlk", "page": "elegant-30ml-clear-15-415-perfumespray", "first": True, "method": "psd-cutout",
     "mirror": "15-415 Bottles/5. Elegant Clear 30ml - Capped/Elegant Clear 30/1. GBElg30SpryBlk..psd"},
    {"sku": "GBElg30SpryShnSl", "page": "elegant-30ml-clear-15-415-perfumespray", "first": False, "method": "psd-cutout",
     "mirror": "15-415 Bottles/5. Elegant Clear 30ml - Capped/Elegant Clear 30/3. GBElg30SpryShSl.psd"},
    {"sku": "GBElg30SpryShGl", "page": "elegant-30ml-clear-15-415-perfumespray", "first": False, "method": "psd-cutout",
     "mirror": "15-415 Bottles/5. Elegant Clear 30ml - Capped/Elegant Clear 30/2. GBElg30SpryShnGl.psd"},
    {"sku": "GBCrcl30SpryMattSl", "page": "circle-30ml-clear-15-415-perfumespray", "first": False, "method": "psd-cutout",
     "mirror": "15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml/4. GBCrcl30SpryMattSl.psd"},
    {"sku": "GBCrcl30SpryShnGl", "page": "circle-30ml-clear-15-415-perfumespray", "first": False, "method": "psd-cutout",
     "mirror": "15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml/2. GBCrcl30SpryShnGl.psd"},
]

HELD = [
    {"page": "circle-30ml-clear-15-415", "skus": ["GBCrcl30GlCap", "GBCrcl30SlCap"], "record": "productKits (body part)",
     "reason": "The glass reads as solid white because the kit's body layer is opaque white (alpha 255, RGB 253 inside the "
               "glass), and so is the glass layer of the master PSD it was cut from (7. GBCrcl30GlCap..psd, sha256 matches "
               "the kit's plate). No transparent Circle 30 ml glass exists in productKits, productPlates, the builder bodies "
               "or the master; the only see-through Circle 30 photographs in the repo are the bone heroes for GBCrcl30GlCap "
               "and GBCrcl30SpryMattGl, which show the cap beside the bottle, and the stage never reaches a hero while a kit "
               "exists. Fixing it needs new glass artwork (a re-matted body layer) or a stage rule, not a data correction."},
    {"page": "circle-30ml-clear-15-415-perfumespray", "skus": ["GBCrcl30SpryBlk", "GBCrcl30SpryShSl"], "record": "productKits (body part)",
     "reason": "Same opaque master glass layer (1. GBCrcl30SpryBlk.psd: alpha 255, RGB 253). Every Circle kit on the site "
               "(15, 30, 50, 100 ml) carries the same treatment, and clear Vial, Sleek, Elegant and Diva kit bodies are "
               "opaque near-white too (alpha 255, RGB 229-252); Circle's large round face makes it the most visible."},
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ink_bbox(gray: np.ndarray, thr: int = 245):
    ys, xs = np.where(gray < thr)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(ys) else None


def affine(image: Image.Image, s: float, ox: float, oy: float, fill):
    inv = 1.0 / s
    return image.transform((OUT_W, OUT_H), Image.AFFINE, (inv, 0, -ox * inv, 0, inv, -oy * inv), resample=Image.BICUBIC, fillcolor=fill)


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def webp_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    if image.mode == "RGBA":
        image.save(buffer, "WEBP", quality=WEBP_QUALITY, method=6, alpha_quality=100, exact=False)
    else:
        image.save(buffer, "WEBP", quality=WEBP_QUALITY, method=6)
    return buffer.getvalue()


def locate_psd(psd_root: Path, master_path: str, mirror: str | None, expected: str) -> tuple[Path, bytes]:
    """The SKU's PSD, accepted only if its bytes are the ones the live plate records."""
    tried = []
    for candidate in [psd_root / master_path, *( [psd_root / mirror] if mirror else [] )]:
        tried.append(str(candidate))
        if candidate.is_file():
            data = candidate.read_bytes()
            if sha256(data) == expected:
                return candidate, data
            tried[-1] += f" (sha256 {sha256(data)[:12]}, expected {expected[:12]})"
    raise SystemExit(f"no PSD with sha256 {expected[:12]} under {psd_root}; tried:\n  " + "\n  ".join(tried))


def psd_cutout(psd_bytes: bytes, live_plate: Image.Image):
    psd = PSDImage.open(io.BytesIO(psd_bytes))
    layers = list(psd)
    background = layers[0]
    # The bottom layer must be a plain white sheet over the whole canvas, and nothing may be grouped or blended:
    # then dropping it is the only difference between this cutout and the composite build_plates.py flattened.
    if background.bbox != (0, 0, psd.width, psd.height) or background.kind != "pixel":
        raise SystemExit(f"bottom layer {background.name!r} is not a full-canvas pixel layer")
    sheet = np.asarray(background.topil().convert("RGB"))
    if sheet.min() < 245:
        raise SystemExit(f"bottom layer {background.name!r} is not plain white (min {sheet.min()})")
    for layer in layers[1:]:
        if layer.kind != "pixel" or layer.is_group():
            raise SystemExit(f"layer {layer.name!r} is a {layer.kind}; only flat pixel layers are supported")

    # force: without it psd-tools hands back the PSD's cached preview and ignores the filter
    rgba = psd.composite(force=True, layer_filter=lambda layer: layer.is_visible() and layer is not background)
    rgba = rgba.convert("RGBA")
    flat = psd.composite().convert("RGBA")   # what build_plates.py flattened
    white = Image.new("RGBA", psd.size, (255, 255, 255, 255))
    on_white = Image.alpha_composite(white, rgba).convert("RGB")
    flattened = Image.alpha_composite(white, flat).convert("RGB")
    drift = float(np.abs(np.asarray(on_white, int) - np.asarray(flattened, int)).mean())
    if drift > 0.5:
        raise SystemExit(f"the cutout over white differs from the PSD's own composite by {drift:.2f}/255")

    # Recover the live plate's affine (scale, ox, oy): start from the ink boxes, then refine on the pixels.
    src_gray = np.asarray(on_white.convert("L"))
    live = np.asarray(live_plate.convert("RGB"), int)
    live_gray = np.asarray(live_plate.convert("L"))
    sb, pb = ink_bbox(src_gray), ink_bbox(live_gray)
    s = (pb[3] - pb[1]) / (sb[3] - sb[1])
    ox = (pb[0] + pb[2]) / 2 - s * (sb[0] + sb[2]) / 2
    oy = pb[1] - s * sb[1]
    pad = 6
    region = (slice(max(pb[1] - pad, 0), min(pb[3] + pad, OUT_H)), slice(max(pb[0] - pad, 0), min(pb[2] + pad, OUT_W)))

    def residual(s_, ox_, oy_):
        render = np.asarray(affine(on_white, s_, ox_, oy_, (255, 255, 255)), int)
        return float(np.abs(render[region] - live[region]).mean())

    best = (residual(s, ox, oy), s, ox, oy)
    for ds, dp in [(0.004, 2.0), (0.001, 0.5), (0.00025, 0.125)]:
        improved = True
        while improved:
            improved = False
            _, s0, ox0, oy0 = best
            for s_ in (s0 - ds, s0, s0 + ds):
                for ox_ in (ox0 - dp, ox0, ox0 + dp):
                    for oy_ in (oy0 - dp, oy0, oy0 + dp):
                        r = residual(s_, ox_, oy_)
                        if r < best[0] - 1e-6:
                            best, improved = (r, s_, ox_, oy_), True
    r, s, ox, oy = best
    if r > RESIDUAL_MAX:
        raise SystemExit(f"cannot reproduce the live plate: residual {r:.2f}/255 > {RESIDUAL_MAX}")

    # Premultiplied resampling, so no white or black halo enters the alpha edge.
    plate = affine(rgba.convert("RGBa"), s, ox, oy, (0, 0, 0, 0)).convert("RGBA")
    plate, retouch = drop_white_retouch(plate)
    alpha = np.asarray(plate)[..., 3]
    edge = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    if edge.max() > 0:
        raise SystemExit("the cutout touches the canvas edge")
    over_white = Image.alpha_composite(Image.new("RGBA", plate.size, (255, 255, 255, 255)), plate).convert("RGB")
    check = float(np.abs(np.asarray(over_white, int)[region] - live[region]).mean())
    if check > RESIDUAL_MAX:
        raise SystemExit(f"the transparent plate over white misses the live plate by {check:.2f}/255")
    return plate, {"scale": round(s, 6), "ox": round(ox, 3), "oy": round(oy, 3),
                   "residualVsLivePlate": round(check, 2), "residualGate": RESIDUAL_MAX,
                   "droppedLayer": background.name, "psdSize": list(psd.size), "whiteRetouchRemoved": retouch}


def drop_white_retouch(plate: Image.Image):
    """Alpha-only removal of white retouch paint: pieces that do not touch the product and are pure white.

    Retouchers painted white over the white sheet to hide dust and edges; on the white plate it was invisible,
    and on a transparent plate it would float beside the bottle. Only a piece that is separate from the largest
    piece and has no pixel below RGB 250 goes. Its colour values stay; over white the plate is unchanged.
    """
    from scipy import ndimage

    data = np.asarray(plate).copy()
    alpha = data[..., 3]
    labels, count = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
    if count <= 1:
        return plate, {"pieces": 0, "pixels": 0}
    sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, count + 1))
    product = int(np.argmax(sizes)) + 1
    removed_pieces, removed_pixels = 0, 0
    for label in range(1, count + 1):
        if label == product:
            continue
        piece = labels == label
        if data[piece][:, :3].min() >= 250:
            data[..., 3][piece] = 0
            removed_pieces += 1
            removed_pixels += int(piece.sum())
    return Image.fromarray(data, "RGBA"), {"pieces": removed_pieces, "pixels": removed_pixels}


def catalog_hero(path: Path, expected: str):
    data = path.read_bytes()
    if sha256(data) != expected:
        raise SystemExit(f"{path} hashes to {sha256(data)[:12]}, the ledger says {expected[:12]}")
    image = Image.open(io.BytesIO(data))
    if image.size != (1560, 1716):
        raise SystemExit(f"{path} is {image.size}, expected 1560x1716 (10:11)")
    rgba = np.asarray(image.convert("RGBA"))
    if rgba[..., 3].min() < 255:
        raise SystemExit(f"{path} has transparent pixels; a bone hero is opaque")
    return image.convert("RGB").resize((OUT_W, OUT_H), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--psd-root", required=True, type=Path)
    args = parser.parse_args()

    plates = [json.loads(line) for line in (args.snapshot / "productPlates.jsonl").read_text().splitlines() if line.strip()]
    snapshot_at = int((args.snapshot / "productPlates.jsonl").stat().st_mtime * 1000)
    (OUT / "plates").mkdir(parents=True, exist_ok=True)

    entries, before = [], []
    for row in ROWS:
        sku = row["sku"]
        matches = [p for p in plates if p["sku"] == sku]
        if len(matches) != 1:
            raise SystemExit(f"{sku}: {len(matches)} productPlates rows in the snapshot")
        plate_row = matches[0]
        live_bytes = fetch(plate_row["front"]["url"])
        if sha256(live_bytes) != plate_row["front"]["sha256"]:
            raise SystemExit(f"{sku}: the live plate no longer hashes to its row's sha256")
        live_plate = Image.open(io.BytesIO(live_bytes)).convert("RGB")
        print(f"{sku}: {row['method']}", flush=True)

        if row["method"] == "psd-cutout":
            src = plate_row["source"]
            if src["library"] != "master" or not src["psdSha256"]:
                raise SystemExit(f"{sku}: the live plate was not rendered from a master PSD")
            psd_path, psd_bytes = locate_psd(args.psd_root, src["path"], row.get("mirror"), src["psdSha256"])
            image, registration = psd_cutout(psd_bytes, live_plate)
            source = {"method": "psd-cutout", "masterPath": src["path"], "psdSha256": src["psdSha256"],
                      "readFrom": os.path.relpath(psd_path, args.psd_root), "registration": registration,
                      "note": "the live plate with its white background made transparent: same PSD, same placement"}
        else:
            image = catalog_hero(REPO / row["hero"], row["heroSha256"])
            source = {"method": "catalog-hero", "file": row["hero"], "sha256": row["heroSha256"], "ledger": row["ledger"],
                      "note": "the bone-background photograph the catalogue card already shows for this SKU, 1560x1716 scaled to 1000x1100"}

        data = webp_bytes(image)
        digest = sha256(data)
        key = f"plates/{plate_row['familyId']}/{sku}/{digest}.front-on-{OUT_W}x{OUT_H}.webp"
        local = OUT / "plates" / f"{sku}.{digest[:12]}.front-on-{OUT_W}x{OUT_H}.webp"
        local.write_bytes(data)
        front = {"url": f"{PLATE_HOST}/{key}", "key": key, "sha256": digest, "bytes": len(data), "width": OUT_W, "height": OUT_H}
        old = plate_row["front"]
        entries.append({
            "sku": sku,
            "graceSku": plate_row["graceSku"],
            "page": f"/products/{row['page']}",
            "pageShowsFirst": row["first"],
            "plateId": plate_row["_id"],
            "familyId": plate_row["familyId"],
            "expectFront": {"sha256": old["sha256"], "url": old["url"]},
            "front": front,
            "file": os.path.relpath(local, REPO),
            "transparent": image.mode == "RGBA",
            "source": source,
        })
        before.append({"sku": sku, "plateId": plate_row["_id"], "front": old, "revision": plate_row["revision"], "importedAt": plate_row["importedAt"]})

    plan = {
        "title": "2026-10-18 white-box product stages: replace productPlates.front with a composed plate",
        "snapshot": {"deployment": "precise-raccoon-123", "table": "productPlates", "exportedAt": snapshot_at},
        "field": "productPlates.front (cap-on plate). frontCapOff, thumbs, views and source lineage are left as they are.",
        "entries": entries,
        "held": HELD,
    }
    (OUT / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    (OUT / "rollback.json").write_text(json.dumps({"snapshot": plan["snapshot"], "rows": before}, indent=2) + "\n")
    print(f"wrote {len(entries)} plates, plan.json and rollback.json to {os.path.relpath(OUT, REPO)}")


if __name__ == "__main__":
    sys.exit(main())

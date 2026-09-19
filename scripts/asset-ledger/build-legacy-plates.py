#!/usr/bin/env python3
"""Put the 20 legacy-recovered bottles onto the plate canvas.

These SKUs have no PSD in any library, so the normal renderer cannot build them.
Their photographs came from the client's own legacy site and are locked by exact
bytes (docs/reviews/legacy-recovery-2026-09-18/approved-lock.json).

Framing follows what published plates actually do, which is NOT millimetres: a
bottle is scaled to fill the canvas, about 1010 px of ink with its foot near
y=1057 and its centre on the axis. Where the SKU has a plated sibling in its own
family, this copies that sibling's exact ink height and foot instead, so the new
plate sits in the same cluster as the ones already shipped.

Every source is below the 1000x1100 canvas, so each plate is an upscale. Jordan
accepted that in chat on 2026-09-18 rather than reshoot.

    python3 scripts/asset-ledger/build-legacy-plates.py            # report
    python3 scripts/asset-ledger/build-legacy-plates.py --write
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "data/paper-doll/legacy-recovery-2026-09-18"
LOCK = ROOT / "docs/reviews/legacy-recovery-2026-09-18/approved-lock.json"
OUT = ROOT / "dist/paper-doll/legacy-plates-2026-09-18"
SCRATCH = Path("/private/tmp/claude-501/-Users-jordanrichter-Projects-Clients-Nemat-International-Best-Bottles-Website-02-20-2026--claude-worktrees-threejs-blender-render-location-96d90c/d8eea6e4-189b-4e12-bd58-ad68f8718777/scratchpad")
PROD = "https://precise-raccoon-123.convex.cloud"
CANVAS = (1000, 1100)
DEFAULT_INK_HEIGHT, DEFAULT_FOOT = 1010, 1057
MAX_INK_WIDTH = 900


def convex(path: str, args: dict):
    body = json.dumps({"path": path, "args": args, "format": "json"}).encode()
    req = urllib.request.Request(f"{PROD}/api/query", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as response:
        payload = json.load(response)
    if payload.get("status") != "success":
        raise RuntimeError(payload.get("errorMessage", payload))
    return payload["value"]


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


def ink_box(im: Image.Image):
    a = np.asarray(im.convert("RGB")).min(axis=2)
    ys, xs = np.nonzero(a < 245)
    if not len(xs):
        raise ValueError("blank image")
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def bottle_box(im: Image.Image):
    """The bottle alone, in a shot that may stand its cap beside it.

    Several legacy photographs show the bottle with its overcap next to it. The
    bottle is the tallest thing in frame, so the columns around the tallest one
    are the bottle; scaling by the whole ink box instead would shrink the bottle
    to fit a composition that is mostly empty air.
    """
    a = np.asarray(im.convert("RGB")).min(axis=2) < 245
    columns = np.nonzero(a.any(axis=0))[0]
    if not len(columns):
        raise ValueError("blank image")
    heights = np.zeros(a.shape[1], dtype=int)
    for x in columns:
        rows = np.nonzero(a[:, x])[0]
        heights[x] = rows.max() - rows.min() + 1
    peak = int(np.argmax(heights))
    cutoff = heights[peak] * 0.45          # a neighbouring cap is far shorter than the bottle
    left = peak
    while left - 1 >= 0 and heights[left - 1] >= cutoff:
        left -= 1
    right = peak
    while right + 1 < len(heights) and heights[right + 1] >= cutoff:
        right += 1
    band = a[:, left:right + 1]
    rows = np.nonzero(band.any(axis=1))[0]
    return left, int(rows.min()), right, int(rows.max())


def whiten_backdrop(im: Image.Image) -> tuple[Image.Image, bool]:
    """Replace a coloured studio backdrop with white.

    Two of the aluminium bottles were shot on green, inside white margins, so the
    coloured panel is what the ink box finds and the bottle never gets measured.

    The backdrop is keyed by COLOUR, not flooded by brightness. A flood with a
    tolerance wide enough to cover the panel's shading also walks into polished
    aluminium and eats its highlights, which is exactly what it did on the 500 ml
    bottle. Keying on hue and saturation cannot: metal is grey, and grey has no
    hue to match.
    """
    x0, y0, x1, y1 = ink_box(im)
    # sample the panel's corners, not its middle: the product stands in the middle
    candidates = [im.convert("RGB").getpixel(xy) for xy in
                  ((x0 + 2, y0 + 2), (x1 - 2, y0 + 2), (x0 + 2, y1 - 2), (x1 - 2, y1 - 2))]
    coloured = [c for c in candidates if min(c) <= 235 and max(c) - min(c) >= 18]
    if not coloured:
        return im, False                      # already on white
    seed = max(coloured, key=lambda c: max(c) - min(c))
    rgb = im.convert("RGB")
    hsv = np.asarray(rgb.convert("HSV"), dtype=np.int16)
    seed_hsv = np.asarray(Image.new("RGB", (1, 1), seed).convert("HSV"), dtype=np.int16)[0, 0]
    hue_gap = np.abs(hsv[:, :, 0] - seed_hsv[0])
    hue_gap = np.minimum(hue_gap, 255 - hue_gap)          # hue wraps
    backdrop = (hue_gap < 22) & (hsv[:, :, 1] > 70)
    out = np.asarray(rgb).copy()
    out[backdrop] = (255, 255, 255)
    return Image.fromarray(out), bool(backdrop.any())

def capacity_token(value) -> str:
    """120ml, never 120.0ml: the index's family ids carry whole millilitres."""
    if value is None:
        return ""
    number = float(value)
    return f"{int(number)}ml" if number.is_integer() else f"{number}ml"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()



def local_sibling(family_id: str):
    """A plate built and locked today for this family, not yet published."""
    for lock_file in sorted((ROOT / "docs/reviews").glob("*/approved-lock.json")):
        lock = json.loads(lock_file.read_text())
        if not str(lock.get("release", "")).endswith("2026-09-18"):
            continue
        for row in lock.get("rows", []):
            if row.get("familyId") != family_id or not row.get("plate", {}).get("key"):
                continue
            batch = ROOT / "dist/paper-doll" / f"{slug(row['familyId'].split('-')[0])}-plates-2026-09-18"
            candidate = batch / "plates" / row["plate"]["key"]
            if candidate.exists():
                return row["sku"], candidate
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    lock = json.loads(LOCK.read_text())
    if not lock.get("visualApproved"):
        raise SystemExit("the legacy recovery lock records no visual approval")
    locked = {row["sku"]: row for row in lock["rows"]}

    products = {}
    for line in (SCRATCH / "ex/products/documents.jsonl").read_text().splitlines():
        if line.strip():
            p = json.loads(line)
            if p.get("websiteSku"):
                products[p["websiteSku"]] = p
    groups = {}
    for line in (SCRATCH / "ex/productGroups/documents.jsonl").read_text().splitlines():
        if line.strip():
            g = json.loads(line)
            groups[g["_id"]] = g

    # familyId for each SKU: prefer a plated sibling in the same product group,
    # because that is the id the index already uses; otherwise build it from the
    # catalogue fields the way the crosswalk does.
    by_family: dict[str, list[str]] = {}
    plated: dict[str, dict] = {}
    for family in convex("productPlates:families", {}):
        cursor = None
        while True:
            page = convex("productPlates:byFamily", {"familyId": family["familyId"], "cursor": cursor, "limit": 500})
            for row in page["page"]:
                plated[row["sku"]] = {"familyId": family["familyId"], "image": row["image"]}
                by_family.setdefault(family["familyId"], []).append(row["sku"])
            if page["isDone"]:
                break
            cursor = page["continueCursor"]

    rows, report = [], []
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "plates").mkdir(exist_ok=True)

    for sku, locked_row in sorted(locked.items()):
        product = products.get(sku)
        if not product:
            report.append((sku, "no product record on dev", None))
            continue
        group = groups.get(product.get("productGroupId")) or {}
        siblings = [s for s in group.get("skus", []) if s in plated] if group.get("skus") else []
        if not siblings:
            siblings = [s for s, p in products.items()
                        if p.get("productGroupId") == product.get("productGroupId") and s in plated]
        if siblings:
            family_id = plated[siblings[0]]["familyId"]
        else:
            family_id = "-".join(filter(None, [
                slug(product.get("family")), capacity_token(product.get("capacityMl")),
                slug(product.get("color")), slug(product.get("neckThreadSize"))]))

        # the frame: copy a plated sibling's, else the canvas default
        target_h, foot = DEFAULT_INK_HEIGHT, DEFAULT_FOOT
        frame_from = "canvas default"
        reference = None
        if siblings:
            with urllib.request.urlopen(plated[siblings[0]]["image"], timeout=90) as response:
                reference = Image.open(io.BytesIO(response.read()))
            frame_from = f"sibling {siblings[0]}"
        else:
            local = local_sibling(family_id)
            if local:
                reference, frame_from = Image.open(local[1]), f"built today: {local[0]}"
        if reference is not None:
            x0, y0, x1, y1 = bottle_box(reference)
            target_h, foot = y1 - y0 + 1, y1

        # the lock records a repo-relative path
        source = ROOT / locked_row["file"]
        data = source.read_bytes()
        if sha256_bytes(data) != locked_row["sha256"]:
            raise SystemExit(f"{sku}: recovered image no longer matches the lock")
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im, backdrop_replaced = whiten_backdrop(im)
        bx0, by0, bx1, by1 = bottle_box(im)          # scale by the bottle
        ix0, iy0, ix1, iy1 = ink_box(im)             # place everything in the shot
        scale = target_h / (by1 - by0 + 1)
        if (ix1 - ix0 + 1) * scale > MAX_INK_WIDTH:
            scale = MAX_INK_WIDTH / (ix1 - ix0 + 1)
        crop = im.crop((ix0, iy0, ix1 + 1, iy1 + 1))
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        placed = crop.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", CANVAS, "white")
        # the bottle's own axis sits on the canvas centre line, not the shot's
        axis = ((bx0 + bx1) / 2 - ix0) * scale
        left = round(CANVAS[0] / 2 - axis)
        left = max(min(left, CANVAS[0] - size[0]), 0)
        top = foot - round((by1 - iy0 + 1) * scale)
        canvas.paste(placed, (left, max(0, top)))

        report.append((sku, f"{family_id} · {frame_from} · {im.width}x{im.height}"
                            + (" · backdrop whitened" if backdrop_replaced else "")
                            + f" -> bottle {round((by1-by0+1)*scale)}px tall, shot {size[0]}x{size[1]}", scale))
        if not args.write:
            continue

        key = f"{family_id}/{sku}.front-on.webp"
        (OUT / "plates" / family_id).mkdir(parents=True, exist_ok=True)
        (OUT / "plates" / key).write_bytes(b"")
        canvas.save(OUT / "plates" / key, "WEBP", quality=92, method=6)
        plate_bytes = (OUT / "plates" / key).read_bytes()
        thumb = canvas.copy()
        thumb.thumbnail((240, 240), Image.Resampling.LANCZOS)
        thumb_canvas = Image.new("RGB", (240, 240), "white")
        thumb_canvas.paste(thumb, ((240 - thumb.width) // 2, (240 - thumb.height) // 2))
        thumb_key = f"{family_id}/{sku}.front-on-thumb.webp"
        thumb_canvas.save(OUT / "plates" / thumb_key, "WEBP", quality=88, method=6)
        thumb_bytes = (OUT / "plates" / thumb_key).read_bytes()

        plate_sha, thumb_sha = sha256_bytes(plate_bytes), sha256_bytes(thumb_bytes)
        rows.append({
            "websiteSku": sku,
            "graceSku": product.get("graceSku"),
            "familyId": family_id,
            "familyName": product.get("family"),
            "closure": product.get("applicator"),
            "mode": "registered",
            "publishable": True,
            "warnings": ["legacy-source upscale: the photograph is smaller than the plate canvas"]
                        + (["green studio backdrop flooded to white from the border"] if backdrop_replaced else []),
            "blockReasons": [],
            "plate": {
                "key": key, "sha256": plate_sha, "bytes": len(plate_bytes), "width": CANVAS[0], "height": CANVAS[1],
                "storeKey": f"plates/{family_id}/{sku}/{plate_sha}.front-on-1000x1100.webp",
                "sourceLibrary": "legacy-exact", "sourceRelPath": locked_row["sourceUrl"], "sourceSha256": locked_row["sha256"],
                "sourceStateEvidence": "recovered from the client's legacy site and locked by exact bytes, 2026-09-18",
            },
            "thumb": {
                "key": thumb_key, "sha256": thumb_sha, "bytes": len(thumb_bytes), "width": 240, "height": 240,
                "storeKey": f"plates/{family_id}/{sku}/{thumb_sha}.front-on-240x240.webp",
                "sourceLibrary": "legacy-exact", "sourceRelPath": locked_row["sourceUrl"], "sourceSha256": locked_row["sha256"],
            },
            "plateCapOff": None, "thumbCapOff": None,
        })

    print(f"{'sku':26s} frame")
    for sku, detail, _ in report:
        print(f"  {sku:26s} {detail}")

    if args.write:
        manifest = {
            "generatedAt": "2026-09-18",
            "builder": {"name": "build-legacy-plates.py", "version": "1.0.0"},
            "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
            "counts": {"rows": len(rows), "publishable": len(rows)},
            "source": "bestbottles.com, the client's own legacy site; locked by exact bytes",
            "rows": rows,
        }
        (OUT / "plates").mkdir(exist_ok=True)
        (OUT / "plates/manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
        print(f"\nwrote {len(rows)} plates -> {(OUT / 'plates/manifest.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Pilot: Build Your Bottle from ONE body and shared components, not per-SKU kits.

Today the builder takes a fixed body from one SKU's kit and seats another SKU's
top on it by comparing the two body parts' alpha bounding boxes. Those boxes are
not the glass (185 of 1,304 published kits are off by >12 px), so tops land
offset and mis-scaled.

This composes the 50 ml Empire the other way round:
  * ONE canonical bare body for the bottle-and-glass
  * each top taken ONCE, as a component, with its position recorded relative to
    a NECK DATUM measured on solid glass: the finish's top-centre and its width
  * composition = put the component's datum on the body's datum, scaled by the
    ratio of finish widths

and then measures the thing that matters: seated this way, how far does each top
land from where it sits in its own photograph?  Reads dist/ only. Publishes nothing.
"""
import json, glob, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[2]
FAMILY_ID = "empire-50ml-clear-18-415"
STAGE = (237, 233, 226)
BATCHES = [ROOT / "dist/paper-doll/empire-2026-09-16/kits",
           ROOT / "dist/paper-doll/kits-from-published-2026-09-19/families/empire/kits"]


def solid(path):
    return np.asarray(Image.open(path).convert("RGBA"))[:, :, 3] >= 128


def neck_datum(alpha):
    """Top-centre and width of the glass finish, read a little below the rim on solid alpha."""
    ys, _ = np.nonzero(alpha)
    top = int(ys.min())
    widths = []
    for y in range(top + 6, top + 30):
        cols = np.nonzero(alpha[y])[0]
        widths.append((cols.max() - cols.min() + 1, (cols.max() + cols.min()) / 2))
    w = float(np.median([a for a, _ in widths])); cx = float(np.median([b for _, b in widths]))
    return {"top": top, "cx": cx, "width": w}


def load():
    kits = []
    for kdir in BATCHES:
        man = json.loads((kdir / "manifest.json").read_text())
        approved = set(json.loads((kdir / "approval.json").read_text())["skus"])
        for r in man["rows"]:
            if r["status"] == "candidate" and r["sku"] in approved and r["familyId"] == FAMILY_ID:
                kits.append((kdir, r))
    return kits


def compose(body_img, datum, tops, on=STAGE):
    """body multiplied onto the stage (clear glass), tops laid over it."""
    stage = Image.new("RGB", (1000, 1100), on)
    white = Image.new("RGB", (1000, 1100), "white"); white.paste(body_img, (0, 0), body_img)
    glass = ImageChops.multiply(stage, white)
    out = glass.convert("RGBA")
    for img in tops:
        out.alpha_composite(img)
    return out.convert("RGB")


def main():
    kits = load()
    print(f"{FAMILY_ID}: {len(kits)} published kits")
    # canonical body: the kit whose body box is cleanest (alpha bbox == solid bbox) and sharpest
    scored = []
    for kdir, r in kits:
        body = next(p for p in r["parts"] if p["slot"] == "body")
        a = solid(kdir / body["image"]); ys, xs = np.nonzero(a)
        clean = abs((body["bounds"]["right"] - body["bounds"]["left"]) - (xs.max() - xs.min() + 1))
        scored.append((clean, -(xs.max() - xs.min()), r["sku"], kdir, r, body))
    scored.sort(key=lambda t: t[:3])
    _, _, canon_sku, canon_dir, canon_row, canon_body = scored[0]
    canon_img = Image.open(canon_dir / canon_body["image"]).convert("RGBA")
    canon = neck_datum(np.asarray(canon_img)[:, :, 3] >= 128)
    print(f"canonical body: {canon_sku}  datum {canon}")

    # one component per distinct top (by the hashes of its non-body parts)
    components, errors, by_app = {}, [], {}
    for kdir, r in kits:
        body = next(p for p in r["parts"] if p["slot"] == "body")
        own = neck_datum(solid(kdir / body["image"]))
        scale = canon["width"] / own["width"]
        tops = sorted((p for p in r["parts"] if p["slot"] != "body"), key=lambda p: p["zOrder"])
        placed = []
        for p in tops:
            im = Image.open(kdir / p["image"]).convert("RGBA")
            # map: own datum -> canonical datum, uniform scale about the datum
            dx = canon["cx"] - own["cx"] * scale; dy = canon["top"] - own["top"] * scale
            placed.append(im.transform((1000, 1100), Image.Transform.AFFINE, (1 / scale, 0, -dx / scale, 0, 1 / scale, -dy / scale), resample=Image.Resampling.BICUBIC))
        # how far is that from where the top sits in its OWN photograph, once both are expressed at canonical scale?
        # residual = mismatch between the two bodies after datum alignment (what a shopper would see as a seam)
        own_body = Image.open(kdir / body["image"]).convert("RGBA")
        dx = canon["cx"] - own["cx"] * scale; dy = canon["top"] - own["top"] * scale
        moved = own_body.transform((1000, 1100), Image.Transform.AFFINE, (1 / scale, 0, -dx / scale, 0, 1 / scale, -dy / scale), resample=Image.Resampling.BICUBIC)
        A = np.asarray(moved)[:, :, 3] >= 128; B = np.asarray(canon_img)[:, :, 3] >= 128
        iou = (A & B).sum() / max(1, (A | B).sum())
        ysA, xsA = np.nonzero(A); ysB, xsB = np.nonzero(B)
        errors.append({"sku": r["sku"], "applicator": r["applicator"], "scale": round(scale, 4), "bodyIoU": round(float(iou), 4),
                       "footDy": int(ysA.max() - ysB.max()), "widthDx": int((xsA.max() - xsA.min()) - (xsB.max() - xsB.min()))})
        by_app.setdefault(r["applicator"], []).append((r["sku"], placed, kdir, r))

    ious = [e["bodyIoU"] for e in errors]
    print(f"\nafter seating every kit's body on the canonical datum:")
    print(f"   body IoU vs canonical: median {np.median(ious):.4f}, worst {min(ious):.4f}")
    print(f"   foot offset px: median {np.median([abs(e['footDy']) for e in errors]):.0f}, worst {max(abs(e['footDy']) for e in errors)}")
    print(f"   width diff  px: median {np.median([abs(e['widthDx']) for e in errors]):.0f}, worst {max(abs(e['widthDx']) for e in errors)}")
    for app, items in by_app.items():
        sub = [e for e in errors if e["applicator"] == app]
        print(f"   {app:34s} {len(items):3d} kits   IoU median {np.median([e['bodyIoU'] for e in sub]):.4f}")

    # the sheet: per applicator, the first kit — its OWN photograph vs the component composition
    cells = []
    for app, items in sorted(by_app.items()):
        sku, placed, kdir, r = items[0]
        own_parts = [Image.open(kdir / p["image"]).convert("RGBA") for p in sorted(r["parts"], key=lambda p: p["zOrder"]) if p["slot"] != "body"]
        own_body = Image.open(kdir / next(p for p in r["parts"] if p["slot"] == "body")["image"]).convert("RGBA")
        truth = compose(own_body, None, own_parts)
        built = compose(canon_img, canon, placed)
        cells.append((app, sku, truth, built))
    CW, CH = 300, 330
    sheet = Image.new("RGB", (len(cells) * (2 * CW + 24) + 12, CH + 70), "white"); d = ImageDraw.Draw(sheet)
    for i, (app, sku, truth, built) in enumerate(cells):
        x = 12 + i * (2 * CW + 24)
        for j, (img, label) in enumerate([(truth, "its own photograph (truth)"), (built, "canonical body + component")]):
            t = img.copy(); t.thumbnail((CW, CH)); sheet.paste(t, (x + j * (CW + 4), 40)); d.text((x + j * (CW + 4), 24), label, fill="#777")
        d.text((x, 6), f"{app}  ·  {sku}", fill="#111")
    out = ROOT / "public/reviews/builder-review-2026-09-19/empire50-component-pilot.jpg"
    sheet.save(out, quality=90); print(f"\nsheet: {out.relative_to(ROOT)} {sheet.size}")
    (ROOT / "dist/paper-doll/empire50-pilot.json").write_text(json.dumps({"canonical": canon_sku, "datum": canon, "kits": errors}, indent=1))


if __name__ == "__main__":
    main()

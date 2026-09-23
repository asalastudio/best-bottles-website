#!/usr/bin/env python3
"""Review a rendered plate batch: what is new, and did anything already live move?

A family batch re-renders every publishable row, including plates production
already carries. This splits the two: it contact-sheets the plates that are new,
and compares the rest against the live bytes so a scale or framing drift cannot
slip in unnoticed. Read-only; publishes nothing.

    python3 scripts/asset-ledger/review-plate-batch.py --batch dist/paper-doll/round-plates-2026-09-18 --name round
"""
from __future__ import annotations

import argparse
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PROD = "https://precise-raccoon-123.convex.cloud"


def convex(path: str, args: dict):
    body = json.dumps({"path": path, "args": args, "format": "json"}).encode()
    req = urllib.request.Request(f"{PROD}/api/query", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as response:
        payload = json.load(response)
    if payload.get("status") != "success":
        raise RuntimeError(payload.get("errorMessage", payload))
    return payload["value"]


def live_plates(family_ids: set[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for family_id in sorted(family_ids):
        cursor = None
        while True:
            page = convex("productPlates:byFamily", {"familyId": family_id, "cursor": cursor, "limit": 500})
            for row in page["page"]:
                out[row["sku"]] = row["image"]
            if page["isDone"]:
                break
            cursor = page["continueCursor"]
    return out


def ink_box(im: Image.Image):
    a = np.asarray(im).min(axis=2)
    ys, xs = np.nonzero(a < 245)
    return None if not len(xs) else (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))


def fetch(url: str) -> Image.Image:
    with urllib.request.urlopen(url, timeout=90) as response:
        return Image.open(io.BytesIO(response.read())).convert("RGB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=Path, required=True)
    ap.add_argument("--name", required=True, help="slug for the review sheet filename")
    args = ap.parse_args()

    batch = (ROOT / args.batch) if not args.batch.is_absolute() else args.batch
    manifest = json.loads((batch / "plates/manifest.json").read_text())
    rows = manifest["rows"]
    live = live_plates({r["familyId"] for r in rows})
    print(f"rendered rows: {len(rows)} | already live on production: {len(live)}")

    new, drift, compared = [], [], 0
    for row in rows:
        # a held row is carried in the manifest with no rendered plate
        if not row.get("publishable") or not isinstance(row.get("plate"), dict):
            continue
        path = batch / "plates" / row["plate"]["key"]
        if not path.exists():
            continue
        im = Image.open(path).convert("RGB")
        sku = row["websiteSku"]
        if sku not in live:
            new.append((sku, im))
            continue
        published = fetch(live[sku])
        compared += 1
        if published.size != im.size:
            drift.append((sku, f"canvas {published.size} vs {im.size}", 999))
            continue
        a, b = ink_box(published), ink_box(im)
        if not a or not b:
            continue
        moved = max(abs(x - y) for x, y in zip(a, b))
        mean = float(np.abs(np.asarray(published, dtype=np.int16) - np.asarray(im, dtype=np.int16)).mean())
        if moved > 2 or mean > 6:
            drift.append((sku, f"ink box moved {moved}px, mean difference {mean:.1f}/255", moved))

    print(f"new plates: {len(new)}")
    print(f"already live and re-rendered: {compared} compared, {len(drift)} no longer match")
    for sku, why, _ in sorted(drift, key=lambda d: -d[2])[:12]:
        print(f"  {sku}: {why}")

    if not new:
        return
    cols, cell, pad = 6, 260, 30
    height = ((len(new) + cols - 1) // cols) * (cell + pad)
    sheet = Image.new("RGB", (cols * cell, height), "#F5F3EF")
    draw = ImageDraw.Draw(sheet)
    for i, (sku, im) in enumerate(sorted(new)):
        thumb = im.copy()
        thumb.thumbnail((cell - 16, cell - 16))
        x, y = (i % cols) * cell, (i // cols) * (cell + pad)
        sheet.paste(thumb, (x + (cell - thumb.width) // 2, y + (cell - thumb.height) // 2))
        draw.text((x + 6, y + cell + 8), sku, fill="#1d1d1b")
    out = ROOT / f"public/reviews/plate-completion-2026-09-18/{args.name}-new-plates.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=92)
    print(f"contact sheet: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

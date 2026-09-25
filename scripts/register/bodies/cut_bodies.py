#!/usr/bin/env python3
"""
Cut the bare glass body for every catalogue body x glass (data/register/bodies/inventory.csv).

  python3 scripts/register/bodies/cut_bodies.py

Source, in order:
  1. the master PSD named after one of that body+glass's SKUs: the body is the LARGEST layer standing on
     the lowest baseline (a cap set down beside the bottle is smaller; thin dip tubes are ignored);
  2. otherwise the kit lane's already-cut body layer for one of its SKUs (productKits on dev; its PSD
     source path is recorded).
Writes output/register-bodies/cuts/<bodyId>--<glass>.png (gitignored), data/register/bodies/cuts.json and
output/register-bodies/cuts-sheet.png for review. Read-only on every source.
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "phase3"))
import cut_pilot as cp  # noqa: E402

ROOT = cp.ROOT
INV = ROOT / "data" / "register" / "bodies" / "inventory.csv"
OUT = ROOT / "output" / "register-bodies" / "cuts"
CUTS = ROOT / "data" / "register" / "bodies" / "cuts.json"
OVERRIDES = {k: v for k, v in json.loads((ROOT / "data" / "register" / "bodies" / "source-overrides.json").read_text()).items() if not k.startswith("_")}
slug = lambda s: s.lower().replace(" ", "-")


def env(name: str) -> str | None:
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get(name)


def convex_query(path: str, args: dict):
    req = urllib.request.Request(env("NEXT_PUBLIC_CONVEX_URL") + "/api/query", data=json.dumps({"path": path, "args": args, "format": "json"}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
    if body.get("status") != "success":
        raise RuntimeError(body)
    return body["value"]


def body_from_psd(path: Path, layer_name: str | None = None):
    psd = PSDImage.open(path)
    layers = [l for l in cp.pixel_layers(psd) if l.bbox[2] > l.bbox[0] and l.bbox[3] > l.bbox[1]]
    if layer_name:
        named = [l for l in layers if l.name.startswith(layer_name)]
        if len(named) != 1:
            return None, f"override layer {layer_name!r} matched {len(named)} layers"
        return cp.canvas_of(psd, named), f"PSD layer {named[0].name} (override)"
    clip = lambda l: (max(0, l.bbox[0]), max(0, l.bbox[1]), min(psd.width, l.bbox[2]), min(psd.height, l.bbox[3]))
    layers = [l for l in layers if (clip(l)[2] - clip(l)[0]) > 0.2 * (clip(l)[3] - clip(l)[1])]  # drop dip tubes and pipettes
    if not layers:
        return None, "no pixel layers"
    base = max(clip(l)[3] for l in layers)  # bboxes clipped to the canvas: a tube running off the edge is not a baseline
    standing = [l for l in layers if clip(l)[3] >= base - 0.06 * psd.height]
    body = max(standing, key=lambda l: (clip(l)[2] - clip(l)[0]) * (clip(l)[3] - clip(l)[1]))
    if (body.bbox[3] - body.bbox[1]) < 0.2 * psd.height and (body.bbox[2] - body.bbox[0]) < 0.2 * psd.width:
        return None, f"largest standing layer {body.name} is too small ({body.bbox}); body is probably flattened into the background"
    img = cp.canvas_of(psd, [body])
    return img, f"PSD layer {body.name}"


def body_from_kit(skus: list[str]):
    pairs = [{"graceSku": None, "websiteSku": s} for s in skus[:50]]
    kits = convex_query("productKits:forSkus", {"pairs": pairs})
    for sku in skus:
        kit = kits.get(sku)
        if not kit:
            continue
        part = next((p for p in kit["parts"] if p["slot"] == "body"), None)
        if not part:
            continue
        data = urllib.request.urlopen(part["image"]["url"], timeout=60).read()
        return Image.open(io.BytesIO(data)).convert("RGBA"), f"kit body layer {sku} ({kit['familyId']})"
    return None, "no kit body layer"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(INV.open()))
    asm = defaultdict(list)
    for a in csv.DictReader((ROOT / "data" / "register" / "assemblies.csv").open()):
        if a["status"] != "retired":
            asm[(a["bodyId"], a["glass"])].append(a["websiteSku"])
    results = []
    for r in rows:
        key = f"{r['bodyId']}|{r['glass']}"
        o = OVERRIDES.get(key, {})
        entry = {"plateKey": key, "bodyId": r["bodyId"], "glass": r["glass"], "psd": o.get("psd") or r["source"] or None, "override": o or None}
        if "exclude" in o or o.get("sibling"):
            entry.update({"source": ("excluded: " + o["exclude"]) if "exclude" in o else "sibling: " + o["why"], "file": None})
            results.append(entry)
            print(f"{key:44} {'EXCLUDED' if 'exclude' in o else 'SIBLING':14} {entry['source'][:90]}")
            continue
        img, how = (None, "no PSD")
        if entry["psd"] and not o.get("kit"):
            try:
                img, how = body_from_psd(cp.PSD_ROOT / entry["psd"], o.get("layer"))
            except Exception as e:  # noqa: BLE001
                img, how = None, f"PSD error {e}"
        psd_how = how if not o.get("kit") else "override: " + o["why"]
        if img is None:
            img, how = body_from_kit(asm[(r["bodyId"], r["glass"])])
            how = f"{how} (PSD: {psd_how})"
        entry["source"] = how
        if img is not None and (np.asarray(img.getchannel("A")) > 128).sum() > 500:
            name = f"{r['bodyId']}--{slug(r['glass'])}.png"
            cut, ox, oy = cp.crop_save(img, OUT / name)
            m = cp.measure_body(cut)
            entry.update({"file": name, "width": cut.width, "height": cut.height, "sha256": cp.sha(cut),
                          "measured": {"rim": m["rim"], "foot": m["foot"], "axisX": round(m["axisX"], 1), "barrelPx": m["barrelPx"], "shoulderY": m["shoulderY"]}})
        else:
            entry["file"] = None
        results.append(entry)
        print(f"{key:44} {('OK ' + str(entry.get('width')) + 'x' + str(entry.get('height'))) if entry['file'] else 'MISSING':14} {how[:90]}")
    CUTS.write_text(json.dumps(results, indent=1) + "\n")
    ok = [e for e in results if e["file"]]
    print(f"\ncut {len(ok)}/{len(results)}; from PSD {sum(1 for e in ok if e['source'].startswith('PSD'))}, from kits {sum(1 for e in ok if e['source'].startswith('kit'))}")
    # contact sheet: every cut at the same height, on bone
    cell_w, cell_h = 150, 260
    cols = 12
    sheet = Image.new("RGB", (cols * cell_w, ((len(results) + cols - 1) // cols) * (cell_h + 34)), (245, 243, 239))
    d = ImageDraw.Draw(sheet)
    for i, e in enumerate(results):
        x, y = (i % cols) * cell_w, (i // cols) * (cell_h + 34)
        if e["file"]:
            im = Image.open(OUT / e["file"]).convert("RGBA")
            s = min((cell_h - 10) / im.height, (cell_w - 10) / im.width)
            im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
            tile = Image.new("RGBA", (cell_w, cell_h), (245, 243, 239, 255))
            tile.alpha_composite(im, ((cell_w - im.width) // 2, cell_h - 5 - im.height))
            sheet.paste(tile.convert("RGB"), (x, y))
        else:
            d.rectangle([x + 10, y + 10, x + cell_w - 10, y + cell_h - 10], outline=(190, 50, 40))
        d.text((x + 4, y + cell_h + 2), e["bodyId"][:24], fill=(28, 28, 30))
        tag = "kit" if e["source"].startswith("kit") else "psd" if e["file"] else "excluded" if e["source"].startswith("excluded") else "sibling" if e["source"].startswith("sibling") else "MISSING"
        d.text((x + 4, y + cell_h + 16), f"{e['glass']} · {tag}", fill=(120, 100, 60) if e["file"] or tag == "sibling" else (190, 50, 40))
    sheet.save(OUT.parent / "cuts-sheet.png", optimize=True)
    print(OUT.parent / "cuts-sheet.png")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the images and geometry the help center's neck-finish builder draws.

    python3 scripts/help/build_fit_media.py            # writes public/images/help-fit/<neck>/ and the manifest

Every image is an existing approved master; nothing is generated or retouched.
Bottles use the master the PDP itself serves, in the same order of precedence
as src/lib/paper-doll/local-component-kits.ts (later review lanes win), then the
hosted approved masters (Pillar 9 ml, clear Tulip 6 ml, 6 Nov 2026), then the
production register plate. Each body keeps its real scale (px per mm) and the
point where a closure seats on the neck, so parts assemble at true scale.

Closures, sprayers and overcaps are the production register's generic master
layers (Vercel Blob), read from data/help/register-<neck>-<date>.json. The two
roller inserts are the approved masters from #417, sized from the register's
roller collar width.

Writes:
  public/images/help-fit/<neck>/*.webp            trimmed bottle and roller derivatives
  src/lib/help/fit-media.generated.json           URLs plus geometry for every part
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
NECK = "13-415"
SNAPSHOT = ROOT / "data" / "help" / "register-13-415-2026-11-07.json"
OUT_DIR = ROOT / "public" / "images" / "help-fit" / NECK
MANIFEST = ROOT / "src" / "lib" / "help" / "fit-media.generated.json"
BODY_HEIGHT_PX = 640
ROLLER_HEIGHT_PX = 240

# Hosted approved masters that supersede the review lanes (PR #417, 6 Nov 2026).
APPROVED_BODIES = {
    "pillar-9ml-13-415": "/images/approved-masters/body-pillar-9ml-clear-glass.33ffa1b36577.webp",
    "tulip-6ml-13-415": "/images/approved-masters/tulip6-clear-master.18117b2e238d.webp",
}
ROLLERS = {
    "LIB-13-415-PlsticRollon": "/images/approved-masters/roller-plastic.4b356a2a9537.png",
    "LIB-13-415-MtlRollon": "/images/approved-masters/roller-metal.2c4bc8ffee8b.png",
}


def alpha_box(im: Image.Image):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()


def load(url: str) -> Image.Image:
    if url.startswith("http"):
        import urllib.request
        return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGBA")
    path = ROOT / "public" / url.lstrip("/")
    if path.suffix == ".svg":  # a master PNG clipped to the glass outline
        text = path.read_text()
        width, height = (int(v) for v in re.search(r'width="(\d+)" height="(\d+)"', text).groups())
        im = Image.open(io.BytesIO(base64.b64decode(re.search(r'base64,([^"]+)"', text).group(1)))).convert("RGBA").resize((width, height))
        mask = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(mask)
        for sub in re.findall(r"M[^MZ]*Z?", re.search(r'<path d="([^"]+)"', text).group(1)):
            points = [tuple(map(float, p.split(","))) for p in re.findall(r"[-\d.]+,[-\d.]+", sub)]
            if len(points) > 2:
                draw.polygon(points, fill=255)
        im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel("A")), np.asarray(mask)).astype("uint8")))
        return im
    return Image.open(path).convert("RGBA")


def served_body_masters() -> dict[str, tuple[str, dict]]:
    """bodyId -> (image url, kit) as the PDP resolves it: later review files win."""
    source = (ROOT / "src" / "lib" / "paper-doll" / "local-component-kits.ts").read_text()
    block = source[source.index("const files = [process.env.BUILDER_LOCAL_KITS"):source.index("const rows: Record<string, BuilderKit> = {};")]
    rows: dict = {}
    for file in re.findall(r'"(public/local-kits/[^"]+/kits\.json)"', block):
        try:
            rows.update(json.loads((ROOT / file).read_text())["rows"])
        except FileNotFoundError:
            continue
    found: dict[str, tuple[str, dict]] = {}
    for kit in rows.values():
        register = kit.get("register") or {}
        if not register.get("bodyId", "").endswith(f"-{NECK}") or not re.search(r"\|(Clear|Amber)$", register.get("plateKey", "")):
            continue
        body = next((p for p in kit["parts"] if p["slot"] == "body"), None)
        if body and not body["image"]["url"].startswith("http"):
            found[register["bodyId"]] = (body["image"]["url"], {**kit, "_body": body})
    return found


def save(im: Image.Image, stem: str) -> str:
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=88, method=6)
    digest = hashlib.sha256(buf.getvalue()).hexdigest()[:12]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{stem}.{digest}.webp"
    (OUT_DIR / name).write_bytes(buf.getvalue())
    return f"/images/help-fit/{NECK}/{name}"


def pack(im: Image.Image, px_per_mm: float, axis_x: float, seat_y: float, stem: str, target: int, source: str) -> dict:
    box = alpha_box(im)
    im = im.crop(box)
    axis_x -= box[0]
    seat_y -= box[1]
    scale = target / im.height
    im = im.resize((round(im.width * scale), target), Image.LANCZOS)
    return {"src": save(im, stem), "width": im.width, "height": im.height, "pxPerMm": round(px_per_mm * scale, 4),
            "axisX": round(axis_x * scale, 2), "seatY": round(seat_y * scale, 2), "source": source}


def main() -> int:
    snapshot = json.loads(SNAPSHOT.read_text())
    fit = json.loads((ROOT / "src" / "lib" / "help" / "fit-index.generated.json").read_text())
    bodies = [b for b in fit["bodies"] if b["neck"] == NECK and b["interchangeable"]]
    served = served_body_masters()
    for old in OUT_DIR.glob("*.webp") if OUT_DIR.exists() else []:
        old.unlink()
    media_bodies = {}
    for body in bodies:
        glass = "Amber" if body["glass"] == ["Amber"] else "Clear"
        plate = snapshot["plates"][f"{body['id']}|{glass}"]
        if body["id"] in APPROVED_BODIES:
            # Registered to the production plate: same glass height in mm and the same neck seat.
            plate_im = load(plate["url"])
            pb = alpha_box(plate_im)
            height_mm = (pb[3] - pb[1]) / plate["pxPerMm"]
            seat_mm = (plate["anchors"]["seatY"] - pb[1]) / plate["pxPerMm"]
            im = load(APPROVED_BODIES[body["id"]])
            nb = alpha_box(im)
            ppm = (nb[3] - nb[1]) / height_mm
            media_bodies[body["id"]] = pack(im, ppm, (nb[0] + nb[2]) / 2, nb[1] + seat_mm * ppm, body["id"], BODY_HEIGHT_PX, APPROVED_BODIES[body["id"]])
        elif body["id"] in served:
            url, kit = served[body["id"]]
            im = load(url)
            box = kit["_body"]["box"]
            scale = im.width / box["width"]
            anchors = kit["anchors"]
            media_bodies[body["id"]] = pack(im, anchors["pxPerMm"] * scale, (anchors["axisX"] - box["x"]) * scale,
                                            (anchors["seatY"] - box["y"]) * scale, body["id"], BODY_HEIGHT_PX, url)
        else:
            im = load(plate["url"])
            media_bodies[body["id"]] = pack(im, plate["pxPerMm"], plate["anchors"]["axisX"], plate["anchors"]["seatY"],
                                            body["id"], BODY_HEIGHT_PX, plate["url"])
    media_parts = {}
    for cid, comp in snapshot["components"].items():
        layers = {layer["slot"]: layer for layer in comp["layers"]}
        if cid in ROLLERS:
            reg = layers["roller"]
            old = load(reg["url"])
            collar_mm = (np.asarray(old.getchannel("A")) > 40).sum(1).max() / reg["pxPerMm"]
            im = load(ROLLERS[cid])
            im = im.crop(alpha_box(im))
            widths = (np.asarray(im.getchannel("A")) > 40).sum(1)
            collar_y = int(np.where(widths >= widths.max() * 0.97)[0].max())
            ppm = widths.max() / collar_mm
            media_parts[cid] = pack(im, ppm, im.width / 2, collar_y, cid.lower(), ROLLER_HEIGHT_PX, ROLLERS[cid])
            continue
        main_layer = layers.get("cap") or layers.get("sprayer")
        if not main_layer:
            continue
        entry = {"src": main_layer["url"], "width": main_layer["width"], "height": main_layer["height"], "pxPerMm": main_layer["pxPerMm"],
                 "axisX": main_layer["anchor"]["x"], "seatY": main_layer["anchor"]["y"], "source": "registerComponents (production)"}
        if "overcap" in layers:
            o = layers["overcap"]
            entry["overcap"] = {"src": o["url"], "width": o["width"], "height": o["height"], "pxPerMm": o["pxPerMm"], "axisX": o["anchor"]["x"], "seatY": o["anchor"]["y"]}
        media_parts[cid] = entry
    manifest = {"_about": "Built by scripts/help/build_fit_media.py. Bottle and closure masters with true-scale geometry for the neck-finish builder.",
                "necks": {NECK: {"registerSnapshot": SNAPSHOT.name, "bodies": media_bodies, "parts": media_parts}}}
    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"{NECK}: {len(media_bodies)} bottles, {len(media_parts)} parts -> {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

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
NECKS = ["13-415", "15-415", "17-415", "18-400", "18-415", "20-400", "8-425"]
MANIFEST = ROOT / "src" / "lib" / "help" / "fit-media.generated.json"
# Main layer of a part, in order of preference; dip tubes are body-specific and never drawn here.
MAIN_SLOTS = ("cap", "sprayer", "pump", "pipette", "fitment", "roller")
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


def served_rows() -> dict:
    source = (ROOT / "src" / "lib" / "paper-doll" / "local-component-kits.ts").read_text()
    block = source[source.index("const files = [process.env.BUILDER_LOCAL_KITS"):source.index("const rows: Record<string, BuilderKit> = {};")]
    rows: dict = {}
    for file in re.findall(r'"(public/local-kits/[^"]+/kits\.json)"', block):
        try:
            rows.update(json.loads((ROOT / file).read_text())["rows"])
        except FileNotFoundError:
            continue
    return rows


def served_body_masters(neck: str, rows: dict) -> dict[str, tuple[str, dict]]:
    """bodyId -> (image url, kit) as the PDP resolves it: later review files win."""
    found: dict[str, tuple[str, dict]] = {}
    for kit in rows.values():
        register = kit.get("register") or {}
        if not register.get("bodyId", "").endswith(f"-{neck}") or not re.search(r"\|(Clear|Amber)$", register.get("plateKey", "")):
            continue
        body = next((p for p in kit["parts"] if p["slot"] == "body"), None)
        if body and not body["image"]["url"].startswith("http"):
            found[register["bodyId"]] = (body["image"]["url"], {**kit, "_body": body})
    return found


def save(im: Image.Image, stem: str, neck: str) -> str:
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=88, method=6)
    digest = hashlib.sha256(buf.getvalue()).hexdigest()[:12]
    out_dir = ROOT / "public" / "images" / "help-fit" / neck
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"{stem}.{digest}.webp"
    (out_dir / name).write_bytes(buf.getvalue())
    return f"/images/help-fit/{neck}/{name}"


def pack(im: Image.Image, px_per_mm: float, axis_x: float, seat_y: float, stem: str, target: int, source: str, neck: str) -> dict:
    box = alpha_box(im)
    im = im.crop(box)
    axis_x -= box[0]
    seat_y -= box[1]
    scale = target / im.height
    im = im.resize((round(im.width * scale), target), Image.LANCZOS)
    return {"src": save(im, stem, neck), "width": im.width, "height": im.height, "pxPerMm": round(px_per_mm * scale, 4),
            "axisX": round(axis_x * scale, 2), "seatY": round(seat_y * scale, 2), "source": source}


LAYER_ORDER = ("pipette", "fitment", "roller", "collar", "sprayer", "pump", "cap")


def compose(layers: list[dict], stem: str, neck: str, target: int) -> dict:
    """Merge a part's register layers at their recorded anchors (one shared neck seat) into one image."""
    ppm = max(l["pxPerMm"] for l in layers)
    placed = []
    for layer in sorted(layers, key=lambda l: LAYER_ORDER.index(l["slot"]) if l["slot"] in LAYER_ORDER else len(LAYER_ORDER)):
        im = load(layer["url"])
        k = ppm / layer["pxPerMm"]
        if abs(k - 1) > 1e-3:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        placed.append((im, -layer["anchor"]["x"] * k, -layer["anchor"]["y"] * k))
    left = min(x for _, x, _ in placed)
    top = min(y for _, _, y in placed)
    right = max(x + im.width for im, x, _ in placed)
    bottom = max(y + im.height for im, _, y in placed)
    canvas = Image.new("RGBA", (round(right - left), round(bottom - top)), (0, 0, 0, 0))
    for im, x, y in placed:
        layer_canvas = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        layer_canvas.paste(im, (round(x - left), round(y - top)))
        canvas = Image.alpha_composite(canvas, layer_canvas)
    return pack(canvas, ppm, -left, -top, stem, target, "registerComponents (production), layers composed", neck)


def kit_part(kit: dict, part: dict, stem: str, neck: str, source: str) -> dict:
    """A part cut from a served kit, with the kit's scale and neck seat carried into the part's own pixels."""
    im = load(part["image"]["url"])
    box = part.get("box") or {"x": 0, "y": 0, "width": kit["canvas"]["width"], "height": kit["canvas"]["height"]}
    scale = im.width / box["width"]
    anchors = kit["anchors"]
    return pack(im, anchors["pxPerMm"] * scale, (anchors.get("neckAxisX", anchors["axisX"]) - box["x"]) * scale,
                (anchors["seatY"] - box["y"]) * scale, stem, ROLLER_HEIGHT_PX, source, neck)


def build_neck(neck: str, fit: dict, rows: dict) -> dict | None:
    snapshots = sorted((ROOT / "data" / "help").glob(f"register-{neck}-*.json"))
    if not snapshots:
        return None
    snapshot = json.loads(snapshots[-1].read_text())
    bodies = [b for b in fit["bodies"] if b["neck"] == neck and b["interchangeable"] and b["listed"]]
    if not bodies:
        return None
    served = served_body_masters(neck, rows)
    out_dir = ROOT / "public" / "images" / "help-fit" / neck
    for old in out_dir.glob("*.webp") if out_dir.exists() else []:
        old.unlink()
    media_bodies = {}
    for body in bodies:
        glass = "Clear" if "Clear" in body["glass"] else (body["glass"] or ["Clear"])[0]
        plate = snapshot["plates"].get(f"{body['id']}|{glass}") or next((v for k, v in snapshot["plates"].items() if k.startswith(body["id"] + "|")), None)
        if body["id"] in APPROVED_BODIES and plate:
            # Registered to the production plate: same glass height in mm and the same neck seat.
            plate_im = load(plate["url"])
            pb = alpha_box(plate_im)
            height_mm = (pb[3] - pb[1]) / plate["pxPerMm"]
            seat_mm = (plate["anchors"]["seatY"] - pb[1]) / plate["pxPerMm"]
            im = load(APPROVED_BODIES[body["id"]])
            nb = alpha_box(im)
            ppm = (nb[3] - nb[1]) / height_mm
            media_bodies[body["id"]] = pack(im, ppm, (nb[0] + nb[2]) / 2, nb[1] + seat_mm * ppm, body["id"], BODY_HEIGHT_PX, APPROVED_BODIES[body["id"]], neck)
        elif body["id"] in served:
            url, kit = served[body["id"]]
            im = load(url)
            box = kit["_body"]["box"]
            scale = im.width / box["width"]
            anchors = kit["anchors"]
            media_bodies[body["id"]] = pack(im, anchors["pxPerMm"] * scale, (anchors["axisX"] - box["x"]) * scale,
                                            (anchors["seatY"] - box["y"]) * scale, body["id"], BODY_HEIGHT_PX, url, neck)
        elif plate:
            im = load(plate["url"])
            media_bodies[body["id"]] = pack(im, plate["pxPerMm"], plate["anchors"]["axisX"], plate["anchors"]["seatY"],
                                            body["id"], BODY_HEIGHT_PX, plate["url"], neck)
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
            media_parts[cid] = pack(im, ppm, im.width / 2, collar_y, cid.lower(), ROLLER_HEIGHT_PX, ROLLERS[cid], neck)
            continue
        drawn = [l for l in comp["layers"] if l["slot"] in MAIN_SLOTS + ("collar",)]
        front = [l for l in drawn if l.get("z") != "behind-body"]
        behind = [l for l in drawn if l.get("z") == "behind-body"]
        if not front:  # an insert registered only behind the body (roller inserts): it is the part itself
            front, behind = behind, []
        if not front:
            continue
        if len(front) == 1 and not behind:
            main_layer = front[0]
            entry = {"src": main_layer["url"], "width": main_layer["width"], "height": main_layer["height"], "pxPerMm": main_layer["pxPerMm"],
                     "axisX": main_layer["anchor"]["x"], "seatY": main_layer["anchor"]["y"], "source": "registerComponents (production)"}
        else:
            # Several layers (a collar under a sprayer, a dropper's bulb over its stem): one image for what sits
            # above the neck, one for what sits inside the bottle (drawn behind the glass), and the whole part for tiles.
            entry = compose(front, cid.lower(), neck, ROLLER_HEIGHT_PX)
            if behind:
                entry["behind"] = {k: v for k, v in compose(behind, cid.lower() + "-inside", neck, ROLLER_HEIGHT_PX * 2).items() if k != "source"}
                entry["swatch"] = {k: v for k, v in compose(front + behind, cid.lower() + "-whole", neck, ROLLER_HEIGHT_PX).items() if k != "source"}
        if "overcap" in layers:
            o = layers["overcap"]
            entry["overcap"] = {"src": o["url"], "width": o["width"], "height": o["height"], "pxPerMm": o["pxPerMm"], "axisX": o["anchor"]["x"], "seatY": o["anchor"]["y"]}
        media_parts[cid] = entry
    # Parts the register has no layers for: take them from the served kit of a product built from that part alone.
    wanted = {i for b in bodies for i in b["listed"]}
    for body in bodies:
        for product in body.get("products", []):
            parts = [p for p in product["parts"] if p in wanted and p not in media_parts]
            kit = rows.get(product["sku"])
            if len(product["parts"]) != 1 or not parts or not kit:
                continue
            piece = next((p for slot in MAIN_SLOTS for p in kit["parts"] if p["slot"] == slot), None)
            if piece:
                media_parts[parts[0]] = kit_part(kit, piece, parts[0].lower(), neck, f"served kit {product['sku']}")
    missing = sorted(wanted - set(media_parts))
    return {"registerSnapshot": snapshots[-1].name, "bodies": media_bodies, "parts": media_parts, "missingParts": missing}


def main() -> int:
    fit = json.loads((ROOT / "src" / "lib" / "help" / "fit-index.generated.json").read_text())
    rows = served_rows()
    necks = {}
    for neck in NECKS:
        built = build_neck(neck, fit, rows)
        if built:
            necks[neck] = built
            print(f"{neck}: {len(built['bodies'])} bottles, {len(built['parts'])} parts, missing art for {len(built['missingParts'])}: {built['missingParts'][:8]}")
    MANIFEST.write_text(json.dumps({"_about": "Built by scripts/help/build_fit_media.py. Bottle and closure masters with true-scale geometry for the neck-finish builders.", "necks": necks}, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

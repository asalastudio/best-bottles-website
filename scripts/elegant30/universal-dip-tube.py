"""One dip tube for every 30 ml Elegant sprayer kit, the same tube the Cylinder masters use.

Jordan (3 Nov 2026): one universal dip tube per bottle size within a family, shared by
every SKU of the set, looking like the approved 9 ml clear Cylinder fine-mist tube (a thin,
cool grey tube with a bright core and dark walls, so it reads as translucent), and shown
on frosted bottles in EXPLODED, as the Cylinder family already does.

Source: public/local-kits/cylinder9-masters-2026-11-01/tube-fitted.f5a5592f59a0.png, drawn in
the 9 ml kit at 10.5 px/mm, ending 59.45 px (5.66 mm) above the glass foot. Each 30 ml kit
draws the one image in a box: the Cylinder tube's physical width at the 30 ml plate scale
(glass top-to-foot / 79.19 mm, the production plate's apparent height), the straight run
centred on that kit's sprayer axis, the top 8 px under the sprayer collar as in the reviewed
clear kit, the end at the same 5.66 mm clearance. Frosted kits draw it in EXPLODED only.

Usage: python3 scripts/elegant30/universal-dip-tube.py
"""
import hashlib, io, json, os
import numpy as np
from PIL import Image

KITS = "public/local-kits/elegant30-master-2026-11-03/kits.json"
PARTS_DIR = "public/local-kits/elegant30-master-2026-11-03/parts"
SOURCE = "public/local-kits/cylinder9-masters-2026-11-01/tube-fitted.f5a5592f59a0.png"
CYL_PX_PER_MM = 10.5
CYL_BOX_WIDTH = 69.876          # the 9 ml kit's tube box width for the 180 px source
CYL_FOOT_CLEARANCE_MM = 59.4500571 / CYL_PX_PER_MM
ELEGANT30_GLASS_MM = 79.19      # production elegant-30ml-15-415 plate, neck top to foot
COLLAR_OVERLAP = 8              # tube top under the sprayer collar in the reviewed clear kit


def main():
    kits = json.load(open(KITS))
    cyl = Image.open(SOURCE).convert("RGBA")
    # The 30 ml tube is longer in mm than the 9 ml one at the same diameter. Bake that
    # proportion into the one image, so every renderer draws it at the box's own aspect:
    # the catalog card's SVG <image> keeps the source aspect ("meet"), which shrank and
    # centred the stretched 9 ml image and opened a gap under the collar.
    lengths, widths = [], []
    for kit in kits["rows"].values():
        sprayer_part = next((p for p in kit["parts"] if p["slot"] == "sprayer"), None)
        if sprayer_part is None:
            continue
        body = next(p for p in kit["parts"] if p["slot"] == "body")["bounds"]
        ppm = (body["bottom"] - body["top"]) / ELEGANT30_GLASS_MM
        lengths.append(body["bottom"] - CYL_FOOT_CLEARANCE_MM * ppm - (sprayer_part["bounds"]["bottom"] - COLLAR_OVERLAP))
        widths.append(cyl.width * CYL_BOX_WIDTH / cyl.width * ppm / CYL_PX_PER_MM)
    aspect = float(np.mean(widths) / np.mean(lengths))
    src = cyl.convert("RGBa").resize((round(cyl.height * aspect), cyl.height), Image.LANCZOS).convert("RGBA")
    buf = io.BytesIO(); src.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    os.makedirs(PARTS_DIR, exist_ok=True)
    dest = f"{PARTS_DIR}/{sha}.diptube.png"
    open(dest, "wb").write(data)
    image = {"url": "/" + dest.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": src.width, "height": src.height}
    a = np.asarray(src)[..., 3] > 10
    mid = src.height // 2
    xs = np.where(a[mid])[0]
    run_centre = (xs.min() + xs.max()) / 2 / src.width   # the straight run, not the curled end, as a fraction of width

    template = None
    for kit in kits["rows"].values():
        template = template or next((p for p in kit["parts"] if p["slot"] == "diptube"), None)
    shared = []
    for sku, kit in kits["rows"].items():
        sprayer_part = next((p for p in kit["parts"] if p["slot"] == "sprayer"), None)
        if sprayer_part is None:
            continue  # cap-only kits carry no fitment
        frosted = "-frosted-" in kit["familyId"]
        body = next(p for p in kit["parts"] if p["slot"] == "body")["bounds"]
        px_per_mm = (body["bottom"] - body["top"]) / ELEGANT30_GLASS_MM
        sprayer = sprayer_part["bounds"]
        axis = (sprayer["left"] + sprayer["right"]) / 2
        top = sprayer["bottom"] - COLLAR_OVERLAP
        bottom = body["bottom"] - CYL_FOOT_CLEARANCE_MM * px_per_mm
        width = (bottom - top) * src.width / src.height   # the image's own aspect: no renderer can letterbox it
        left = axis - run_centre * width
        part = next((p for p in kit["parts"] if p["slot"] == "diptube"), None)
        if part is None:
            part = json.loads(json.dumps(template))
            kit["parts"].insert(1, part)
        part["image"] = dict(image)
        part["box"] = {"x": round(left, 2), "y": round(top, 2), "width": round(width, 3), "height": round(bottom - top, 2)}
        part["bounds"] = {"left": round(left, 2), "top": round(top, 2), "right": round(left + width, 2), "bottom": round(bottom, 2)}
        part["derivation"] = "family-universal"
        if frosted:
            part["views"] = ["exploded"]
        else:
            part.pop("views", None)
            kit["anchors"]["seatY"] = part["bounds"]["bottom"]
        for z, p in enumerate(sorted(kit["parts"], key=lambda p: ("body", "diptube", "sprayer", "overcap").index(p["slot"]))):
            p["zOrder"] = z; p["explodeIndex"] = z
        kit["parts"].sort(key=lambda p: p["zOrder"])
        shared.append(sku)
    kits["universalDipTube"] = {"url": image["url"], "sha256": sha,
                                "from": f"{SOURCE} (the approved 9 ml Cylinder fine-mist tube), resampled once to the 30 ml tube proportion and placed per kit at its own aspect; frosted kits draw it in EXPLODED only",
                                "skus": sorted(shared)}
    kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("tube", image["url"], "shared by", len(shared), "kits; version", kits["version"])


if __name__ == "__main__":
    main()

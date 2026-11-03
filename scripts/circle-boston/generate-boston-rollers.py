"""Complete 20-400 metal and plastic roller inserts for the Boston Round 30/60 ml roll-ons (Sunburst).

The register's Boston rollers (LIB-20-400-MtlRollon / PlsticRollon) are photographed seated: ball, housing and
flange, cut at the neck, so the stage kept EXPLODED off (closure-presentation.ts: a floating insert showed its cut
edge). Jordan (3 Nov 2026): generate the metal and plastic rollers. Sunburst completes each insert:
- First image (geometry, locked): the register roller at the top of the frame, and under its flange the plug's
  outline in flat grey, sized to the 20-400 neck bore (PLUG_WIDTH of the flange, PLUG_HEIGHT of the top's height).
- Second image (material only): the approved full 13-415 roller of the same kind (approved Sleek 5 ml recipe).
The output is registered on the flange (width-led scale, flange line and axis) so the top lines up with the seated
register image, and cut to its own outline.

Writes public/local-kits/boston-masters-2026-11-03/rollers/<kind>-20-400-full.png and rollers.json (the flange's
width, centre and bottom row in the image, to place it on a kit's seated roller).
Usage: python3 scripts/circle-boston/generate-boston-rollers.py <work-dir> <boston-register.json>
"""
import io, json, os, re, sys, base64, urllib.request
from importlib import import_module
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, "scripts/elegant-masters")
pipeline = import_module("regenerate-frosted")
OUT = "public/local-kits/boston-masters-2026-11-03/rollers"
KINDS = {"metal": ("LIB-20-400-MtlRollon", "GBSleek5MtlRollGlMatt", "a polished steel ball in a translucent white polypropylene housing"),
         "plastic": ("LIB-20-400-PlsticRollon", "GBSleek5RollGlMatt", "a translucent frosted plastic ball in a translucent white polypropylene housing")}
PLUG_WIDTH, PLUG_HEIGHT = 0.64, 0.95
BONE = (245, 243, 239)
PROMPT = """1. Keep geometry locked to the first image: the roller ball, its housing and the flange at the top exactly as drawn, and below the flange the plug in the same position, width and length as the flat grey shape. Do not move, resize or redraw the top.
2. This is one complete roll-on insert, {what}, photographed on its own: render the grey shape as its plug, the same translucent white polypropylene as the housing, a straight cylinder with a slightly rounded bottom edge and soft grey walls, as the plug of the second image. Material reference only from the second image, not its shape or size.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no bottle, no text."""


def flange(m):
    """(width, centre, bottom row) of the widest band at the foot of a mask."""
    ys = np.where(m.any(1))[0]; bottom = int(ys.max()) + 1
    rows = [np.where(m[y])[0] for y in range(bottom - 6, bottom) if m[y].any()]
    left = float(np.median([r.min() for r in rows])); right = float(np.median([r.max() for r in rows])) + 1
    return right - left, (left + right) / 2, bottom


def main():
    work, register = sys.argv[1], json.load(open(sys.argv[2])); os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    approved = json.load(open("src/lib/paper-doll/approved-kits.generated.json"))["rows"]
    report = {}
    for kind, (component, reference, what) in KINDS.items():
        url = next(p["image"]["url"] for v in register.values() for p in v["parts"] if p.get("componentId") == component)
        top = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGBA")
        top = top.resize((top.width * 4, top.height * 4), Image.LANCZOS)          # the register image is 220 px wide
        m = np.asarray(top)[..., 3] > 128; fw, fc, fb = flange(m)
        pw, ph = fw * PLUG_WIDTH, (fb - int(np.where(m.any(1))[0].min())) * PLUG_HEIGHT
        Wd = round(top.width * 1.6); Hd = round(Wd * 1.5)
        geo = Image.new("RGBA", (Wd, Hd), BONE + (255,)); ox = (Wd - top.width) // 2; oy = round(Hd * 0.12)
        d = ImageDraw.Draw(geo)
        d.rounded_rectangle((ox + fc - pw / 2, oy + fb - 4, ox + fc + pw / 2, oy + fb + ph), radius=pw * 0.08, fill=(178, 178, 178, 255))
        geo.alpha_composite(top, (ox, oy)); geo.convert("RGB").save(f"{work}/{kind}.geometry.png")
        svg = urllib.request.urlopen(next(p["image"]["url"] for p in approved[reference]["parts"] if p["slot"] == "roller")).read().decode("latin1")
        ref = Image.open(io.BytesIO(base64.b64decode(re.search(r"data:image/(?:png|webp);base64,([A-Za-z0-9+/=]+)", svg).group(1)))).convert("RGBA")
        pipeline.on_bone(ref, (ref.width, round(ref.width * 1.5))).convert("RGB").save(f"{work}/{kind}.material.png")
        pipeline.PROMPT = PROMPT.format(what=what)
        raw = f"{work}/{kind}.raw.png"
        if not os.path.exists(raw):
            pipeline.edit([f"{work}/{kind}.geometry.png", f"{work}/{kind}.material.png"], raw)
        out = Image.open(raw).convert("RGB").resize((Wd, Hd), Image.LANCZOS); a = np.asarray(out).astype(int)
        bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:20, :20], a[:20, -20:], a[-20:, :20], a[-20:, -20:])]), 0)
        got = np.abs(a - bg).max(axis=2) > 10
        # Fill each row between its edges (the translucent body is near the ground colour), then keep the outline.
        filled = np.zeros_like(got)
        for y in np.where(got.any(1))[0]:
            xs = np.where(got[y])[0]; filled[y, xs.min():xs.max() + 1] = True
        # Register on the flange: the output's widest band above the plug against the register image's.
        rows = np.where(filled.any(1))[0]; widths = filled.sum(1)
        band = [y for y in rows if widths[y] >= 0.97 * widths[rows].max()]
        g_bottom = max(band) + 1; xs = np.where(filled[max(band)])[0]; g_w, g_c = xs.max() - xs.min() + 1, (xs.min() + xs.max() + 1) / 2
        s = fw / g_w
        cut = out.convert("RGBA"); cut.putalpha(Image.fromarray((filled * 255).astype(np.uint8)))
        cut = cut.crop(cut.getchannel("A").getbbox())
        bb = Image.fromarray(filled).getbbox()
        cut = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS)
        path = f"{OUT}/{kind}-20-400-full.png"; cut.save(path)
        report[kind] = {"file": "/" + path.removeprefix("public/"), "pixels": [cut.width, cut.height], "component": component,
                        "flangeWidth": float(fw), "flangeCentre": float((g_c - bb[0]) * s), "flangeBottom": float((g_bottom - bb[1]) * s),
                        "registerScale": 4, "registerFlange": {"width": float(fw), "centre": float(fc), "bottom": float(fb), "imageWidth": top.width},
                        "geometry": f"{work}/{kind}.geometry.png", "material": reference}
        print(kind, report[kind])
    json.dump(report, open(f"{OUT}/rollers.json", "w"), indent=1)


if __name__ == "__main__":
    main()

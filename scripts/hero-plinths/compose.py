"""Homepage hero, 4 Nov 2026 (Jordan: "retake the hero image that showcases the raw glass, maybe 7 of the most popular
bottles on varying plinths with only black tops", "using gpt 2.5 sunburst").

1. Each bottle is drawn from its own kit (approved recipe, or the reviewed localhost kit), CAP ON: the clear glass with
   the shiny black 18-415 overcap, so all seven tops match. Every bottle is scaled by its kit's px/mm, so their sizes
   are true to each other.
2. They stand on seven plinths of varying heights across the right of a 1536 x 1024 frame (the headline sits on the
   left), in a plain layout: bone ground, flat stone-grey blocks. This is the geometry reference.
3. render.py asks gpt-image-2.5-sunburst to photograph that layout without changing any bottle.
Writes scripts/hero-plinths/out/layout.png and layout.json (each bottle's box, for checking the render).
Usage: python3 scripts/hero-plinths/compose.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw

OUT = "scripts/hero-plinths/out"
W, H = 1536, 1024
BONE = (236, 231, 223)
PX_PER_MM = 1.7                       # frame scale: the seven fit the right 60% of the frame side by side
# Left to right; plinth heights in px (varying, tallest in the middle-right), each bottle centred on its plinth.
LINEUP = [
    ("GBDmnd2ozSpryShnBlk", 120),
    ("GBCyl100SpryShnBlk", 175),
    ("GBDiva46SpryShnBlk", 95),
    ("GBEmp100SpryShnBlk", 230),
    ("GBCrcl100SpryShnBlk", 150),
    ("GBElg60SpryShnBlk", 70),
    ("GBGrce55SpryShnBlk", 130),
]
X0, X1 = 500, 1500                    # the bottles' band; the headline keeps the left
BASE_Y = 790                          # the floor line: the site crops the hero to its middle band
GAP = 16                              # plinth margin beside each bottle


def kits():
    rows = json.load(open("src/lib/paper-doll/approved-kits.generated.json"))["rows"]
    for d in sorted(os.listdir("public/local-kits")):
        try:
            for sku, kit in json.load(open(f"public/local-kits/{d}/kits.json"))["rows"].items():
                rows.setdefault(sku, kit)
        except Exception:
            pass
    return rows


_cache = {}
def load(url):
    if url not in _cache:
        data = urllib.request.urlopen(url).read() if url.startswith("http") else open("public" + url, "rb").read()
        _cache[url] = Image.open(io.BytesIO(data)).convert("RGBA")
    return _cache[url]


def cap_on(kit):
    """The kit drawn CAP ON on its own canvas, cropped to the bottle."""
    c = Image.new("RGBA", (kit["canvas"]["width"], kit["canvas"]["height"]), (0, 0, 0, 0))
    for p in sorted(kit["parts"], key=lambda p: p["zOrder"]):
        if p.get("views") and "capon" not in p["views"]:
            continue
        if p["slot"] == "diptube":
            continue                  # the hero shows the glass itself; no tube through it
        b = p["box"]; img = load(p["image"]["url"]).resize((max(1, round(b["width"])), max(1, round(b["height"]))), Image.LANCZOS)
        if p.get("opacity") is not None:
            a = img.getchannel("A").point(lambda v, o=p["opacity"]: int(v * o)); img.putalpha(a)
        c.alpha_composite(img, (round(b["x"]), round(b["y"])))
    return c.crop(c.getchannel("A").getbbox())


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = kits(); frame = Image.new("RGBA", (W, H), BONE + (255,)); draw = ImageDraw.Draw(frame)
    draw.rectangle((0, BASE_Y, W, H), fill=(214, 206, 194, 255))
    imgs = []
    for sku, plinth in LINEUP:
        kit = rows[sku]; img = cap_on(kit); s = PX_PER_MM / kit["anchors"]["pxPerMm"]
        imgs.append(img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS))
    widths = [img.width + 2 * GAP for img in imgs]
    assert sum(widths) <= X1 - X0, f"the seven need {sum(widths)} px, the band has {X1 - X0}"
    x_left = X1 - sum(widths); boxes = []
    for (sku, plinth), img, pw in zip(LINEUP, imgs, widths):
        cx = x_left + pw / 2; x_left += pw; top = BASE_Y - plinth
        draw.rectangle((cx - pw / 2, top, cx + pw / 2, BASE_Y), fill=(196, 188, 176, 255), outline=(170, 160, 146, 255))
        x, y = round(cx - img.width / 2), round(top - img.height)
        frame.alpha_composite(img, (x, y))
        boxes.append({"sku": sku, "x": x, "y": y, "width": img.width, "height": img.height, "plinthTop": top})
        print(f"{sku:22} {img.width:4d} x {img.height:4d} px on a {plinth}px plinth")
    frame.convert("RGB").save(f"{OUT}/layout.png")
    json.dump({"size": [W, H], "bottles": boxes}, open(f"{OUT}/layout.json", "w"), indent=1)


if __name__ == "__main__":
    main()

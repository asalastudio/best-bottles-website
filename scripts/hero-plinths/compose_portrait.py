"""Portrait layout for the phone hero (Jordan, 4 Nov 2026: a full-screen image on mobile, "regenerate this image just
change the aspect ratio"). Same seven bottles and caps as compose.py, at true relative size, in two staggered rows so
they stay large in a 1024 x 1536 frame: the three tall bottles on raised plinths behind, the four shorter ones in front.
The top third stays open wall for the headline; the bottom keeps room for the sticky buttons.
Writes scripts/hero-plinths/out/layout-portrait.png.
Usage: python3 scripts/hero-plinths/compose_portrait.py
"""
import importlib.util
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("compose", "scripts/hero-plinths/compose.py")
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
W, H, PX_PER_MM, GAP = 1024, 1536, 2.25, 14
BACK = [("GBCyl100SpryShnBlk", 300), ("GBEmp100SpryShnBlk", 380), ("GBCrcl100SpryShnBlk", 330)]   # plinth tops above their floor
FRONT = [("GBDmnd2ozSpryShnBlk", 120), ("GBDiva46SpryShnBlk", 70), ("GBElg60SpryShnBlk", 95), ("GBGrce55SpryShnBlk", 150)]
BACK_FLOOR, FRONT_FLOOR = 1180, 1330


def row(frame, draw, rows, lineup, floor, shade):
    imgs = []
    for sku, _ in lineup:
        kit = rows[sku]
        img = C.cap_on(kit); s = PX_PER_MM / kit["anchors"]["pxPerMm"]
        imgs.append(img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS))
    widths = [img.width + 2 * GAP + 30 for img in imgs]
    x = (W - sum(widths)) / 2
    for (sku, plinth), img, pw in zip(lineup, imgs, widths):
        cx = x + pw / 2; x += pw; top = floor - plinth
        draw.rectangle((cx - pw / 2 + 6, top, cx + pw / 2 - 6, floor), fill=shade, outline=(160, 150, 136, 255))
        frame.alpha_composite(img, (round(cx - img.width / 2), round(top - img.height)))
        print(f"{sku:24} {img.width:4d} x {img.height:4d}")


def main():
    rows = C.kits(); frame = Image.new("RGBA", (W, H), C.BONE + (255,)); draw = ImageDraw.Draw(frame)
    draw.rectangle((0, BACK_FLOOR, W, H), fill=(214, 206, 194, 255))
    row(frame, draw, rows, BACK, BACK_FLOOR, (190, 182, 170, 255))
    row(frame, draw, rows, FRONT, FRONT_FLOOR, (204, 196, 184, 255))
    frame.convert("RGB").save(f"{C.OUT}/layout-portrait.png")


if __name__ == "__main__":
    main()

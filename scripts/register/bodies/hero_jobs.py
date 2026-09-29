"""
Boston Round glass, pass "hero" (Jordan 2026-09-29): the 25 Sep plates were lit by the pilot references (a tall 9 mL roller
bottle), which left the clear glass with a milky band and the cobalt an electric azure. Each plate keeps its own master geometry
(output/register-bodies/inputs/<body>/geometry.png) and takes an APPROVED catalogue hero of Boston glass
(public/images/catalog/boston-diva-approved-2026-09-23) as the lighting and colour reference: the bottle only (the cap beside it
cropped away), its bone ground levelled to white, fitted to the body canvas as build_bodies.fit_reference does.

  python3 scripts/register/bodies/hero_jobs.py "Clear,Amber,Cobalt Blue"      # inputs-hero/ + jobs-hero.json
  node scripts/register/bodies/render_bodies.mjs --pass hero --only "<body>|<Glass>,..." [--extra "<line>"]
  python3 scripts/register/bodies/build_bodies.py qa --pass hero --only boston-round-15ml-18-400,boston-round-30ml-20-400,boston-round-60ml-20-400

What shipped (Jordan approved "attempt 3" for amber and cobalt, and the clear): ONE shared reference per glass for all three sizes,
so the colour matches across sizes, plus one prompt line naming the finish:
  - Cobalt: the 60 mL attempt-2 plate (for the 15 mL, the 30 mL attempt-3 plate: the 60 mL reference narrowed the 15 mL neck to
    IoU .954); "Deep cobalt blue glass, the same colour and depth as the second image: not bright, not electric".
  - Amber: the approved 60 mL amber hero (GBBstnAmb2ozBlkCapSht); "Deep brown amber glass, the same colour and depth as the second
    image: not golden, not orange".
  - Clear: the 30 mL first-test clear plate, bone levelled back to white; "Crystal-clear colourless glass with the finish of the
    second image: no haze, no milky tint".
The job's role and the prompt each plate rendered with are recorded in data/register/bodies/bodies-measurements.json (source.role,
render.prompt). The 60 mL keeps its neck edit line ("the mouth of the bottle is open and empty"), so its colour line is number 5.
"""
import glob, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "output/register-bodies"
HEROES = ROOT / "public/images/catalog/boston-diva-approved-2026-09-23"
MARGIN = 96
HERO_SKU = {("boston-round-15ml-18-400", "Clear"): "GBBstn15BlkCapSht", ("boston-round-30ml-20-400", "Clear"): "GBBstn1ozBlkCapSht", ("boston-round-60ml-20-400", "Clear"): "GBBstn2ozBlkCapSht",
            ("boston-round-15ml-18-400", "Amber"): "GBBstnAmb15mlBlkCapSht", ("boston-round-30ml-20-400", "Amber"): "GBBstnAmb1ozBlkCapSht", ("boston-round-60ml-20-400", "Amber"): "GBBstnAmb2ozBlkCapSht",
            ("boston-round-15ml-18-400", "Cobalt Blue"): "GBBstnBlu15BlkCapSht", ("boston-round-30ml-20-400", "Cobalt Blue"): "GBBstnBlu1ozBlkCapSht", ("boston-round-60ml-20-400", "Cobalt Blue"): "GBBstnBlu2ozBlkCapSht"}
LIT_CLEAR = "1. Keep geometry locked to the first image\n2. Lighting and finish quality from the second image; the glass stays colourless and clear\n3. Enhance the quality"
LIT_COLOUR = "1. Keep geometry locked to the first image\n2. Glass colour, material and lighting from the second image\n3. Enhance the quality"
slug = lambda s: s.lower().replace(" ", "-")


def bottle_only(path: Path) -> Image.Image:
    """The hero's bottle on white: the ground levelled to white, the cap (the other object on the floor) left out."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    ground = np.median(np.concatenate([rgb[:40, :40].reshape(-1, 3), rgb[:40, -40:].reshape(-1, 3)]), axis=0)
    level = np.clip(rgb * (255.0 / ground), 0, 255)
    # the objects, not their soft floor shadows (a shadow joins the 60 mL cap to its bottle): clearly darker than the ground
    ink = np.abs(level - 255.0).max(axis=2) > 40
    ink = ndimage.binary_closing(ink, iterations=3)
    # the cap stands on the floor beside the bottle: the column where the bottle ends is the widest empty run of columns
    # between them, read above the floor line where the shadows lie
    lab, n = ndimage.label(ink)
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    boxes = ndimage.find_objects(lab)
    tallest = max(range(n), key=lambda i: (boxes[i][0].stop - boxes[i][0].start) * (sizes[i] > 2000))
    ys, xs = boxes[tallest]
    pad = 12
    crop = level[max(0, ys.start - pad): ys.stop + pad, max(0, xs.start - pad): xs.stop + pad]
    keep = ndimage.binary_dilation(lab[max(0, ys.start - pad): ys.stop + pad, max(0, xs.start - pad): xs.stop + pad] == tallest + 1, iterations=pad)
    crop[~keep] = 255.0   # anything else in the box (the cap's edge) goes to white
    return Image.fromarray(crop.astype(np.uint8))


def fit(ref: Image.Image, W: int, H: int) -> Image.Image:
    s = min((W - 2 * MARGIN) / ref.width, (H - 2 * MARGIN) / ref.height)
    r = ref.resize((max(1, int(ref.width * s)), max(1, int(ref.height * s))), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(r, ((W - r.width) // 2, H - MARGIN - r.height))
    return canvas


def main() -> None:
    glasses = sys.argv[1].split(",") if len(sys.argv) > 1 else ["Clear"]
    lit = {(j["bodyId"], j["glass"]): j for j in json.loads((BASE / "jobs-lit.json").read_text())}
    path = BASE / "jobs-hero.json"
    jobs = {(j["bodyId"], j["glass"]): j for j in (json.loads(path.read_text()) if path.exists() else [])}
    for (body, glass), sku in HERO_SKU.items():
        if glass not in glasses:
            continue
        base = lit[(body, glass)]
        hero = next(iter(glob.glob(str(HEROES / f"{sku}.*.png"))))
        d = BASE / "inputs-hero" / body
        d.mkdir(parents=True, exist_ok=True)
        ref = d / f"{slug(glass)}-hero-reference.png"
        fit(bottle_only(Path(hero)), *base["size"]).save(ref)
        jobs[(body, glass)] = {"bodyId": body, "glass": glass, "size": base["size"], "background": base["background"], "pass": "hero",
                               "role": f"approved hero {sku} as the {glass.lower()} reference", "prompt": LIT_CLEAR if glass == "Clear" else LIT_COLOUR,
                               "extra": base.get("extra"), "images": [base["images"][0], str(ref)], "heroSku": sku, "hero": str(Path(hero).relative_to(ROOT))}
        print(body, glass, "<-", Path(hero).name, "| extra:", base.get("extra"))
    path.write_text(json.dumps(list(jobs.values()), indent=1) + "\n")
    print("wrote", path, len(jobs), "jobs")


if __name__ == "__main__":
    main()

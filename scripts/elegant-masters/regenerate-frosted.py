"""Regenerate the 60 and 100 ml frosted Elegant body candidates, geometry-locked to the approved plates.

The first frosted candidates drifted from the registered geometry (outline IoU 0.951 / 0.954:
60 ml body 2 points narrow and neck 4 points narrow; 100 ml shoulder low, body and base wide).
This sends Sunburst the approved register plate on bone as the geometry (first image) and the
accepted 30 ml frosted candidate as the material reference (second image), aligns the output
back onto the plate, and cuts it with the plate's own approved alpha, so the master's outline
is the registered one by construction. The raw output's own outline is checked against the
plate before it is accepted.

Usage: python3 scripts/elegant-masters/regenerate-frosted.py <work-dir>
"""
import base64, json, os, sys, urllib.error, urllib.request, uuid
import numpy as np
from PIL import Image

PAYLOAD = "docs/reviews/catalog-checkpoint-2026-10-31/evidence/outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/register-payload-precise-raccoon-123.json"
OUT_DIR = "public/reviews/elegant-master-candidates-2026-11-03"
MATERIAL = f"{OUT_DIR}/elegant30-frosted-candidate.png"
BONE = (245, 243, 239)
PROMPT = """1. Keep geometry locked to the first image: the same bottle outline, neck threads, shoulder line, rounded corners and base, at the same position and size in the frame. Do not redraw the shape.
2. Material, frosting, lighting and finish quality from the second image. The glass stays frosted: an even satin acid-etched surface that diffuses light, with soft bright edges, a slightly brighter neck finish and a thicker, slightly denser base. No visible interior, no tube, no liquid, no reflections of objects.
3. Enhance the quality: crisp neck threads, clean edges, photographic studio packshot.
Plain flat background #F5F3EF, no shadow, no floor, no props, no text."""
TARGETS = {"elegant-60ml-18-415|Frosted": "elegant60-frosted-candidate-r2.png", "elegant-100ml-18-415|Frosted": "elegant100-frosted-candidate-r2.png"}


def key():
    # Image generation may bill a different account from the app's own OPENAI_API_KEY (Grace).
    for name in ("SUNBURST_OPENAI_API_KEY", "OPENAI_API_KEY"):
        k = os.environ.get(name)
        if not k:
            for line in open(".env.local"):
                if line.startswith(f"{name}="):
                    k = line.split("=", 1)[1].strip().strip('"').strip("'")
        if k:
            return k


def edit(images, out, size="1024x1536"):
    b = uuid.uuid4().hex; body = b""
    for k, v in {"model": "gpt-image-2.5-sunburst", "prompt": PROMPT, "size": size, "quality": "high", "n": "1"}.items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for path in images:
        body += (f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n').encode() + open(path, "rb").read() + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {key()}", "Content-Type": f"multipart/form-data; boundary={b}"})
    import time
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.load(r)
            break
        except urllib.error.HTTPError as e:
            detail = e.read()[:400].decode(errors="replace")
            print(f"HTTP {e.code} on attempt {attempt + 1}: {detail}", flush=True)
            if e.code != 429 or "insufficient_quota" in detail or attempt == 3:
                raise SystemExit(f"Sunburst request failed: HTTP {e.code} {detail}")
            time.sleep(30 * (attempt + 1))
    open(out, "wb").write(base64.b64decode(d["data"][0]["b64_json"]))
    return d.get("usage")


def on_bone(img, size):
    canvas = Image.new("RGBA", size, BONE + (255,))
    canvas.alpha_composite(img, dest=((size[0] - img.width) // 2, (size[1] - img.height) // 2))
    return canvas


def outline(rgb, tol=10):
    a = np.asarray(rgb.convert("RGB")).astype(int)
    return np.abs(a - BONE).max(axis=2) > tol


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True)
    plates = json.load(open(PAYLOAD))["payload"]["plates"]
    plates = plates if isinstance(plates, dict) else {p["plateKey"]: p for p in plates}
    material = Image.open(MATERIAL).convert("RGBA")
    report = {}
    for key_, name in TARGETS.items():
        p = plates[key_]
        local = f"{work}/{key_.replace('|', '-')}.png"
        if not os.path.exists(local):
            open(local, "wb").write(urllib.request.urlopen(p["url"], timeout=60).read())
        plate = Image.open(local).convert("RGBA")
        W = max(plate.width, round(plate.height / 1.5)); H = round(W * 1.5)   # the 2:3 frame the API returns, holding the whole plate
        geom = on_bone(plate, (W, H)); geom.convert("RGB").save(f"{work}/{name}.geometry.png")
        mat = on_bone(material, (material.width, round(material.width * 1.5))); mat.convert("RGB").save(f"{work}/{name}.material.png")
        raw = f"{work}/{name}.raw.png"
        if not os.path.exists(raw):
            report[key_] = {"usage": edit([f"{work}/{name}.geometry.png", f"{work}/{name}.material.png"], raw)}
        # Sunburst redraws the bottle smaller than the reference, so register it uniformly: scale and
        # shift its outline's box (height-led) onto the plate's, never stretching it. The outline
        # IoU after that, and the row widths, are the geometry check.
        out = Image.open(raw).convert("RGB")
        a = np.asarray(out).astype(int)
        bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:20, :20], a[:20, -20:], a[-20:, :20], a[-20:, -20:])]), 0)
        got = np.abs(a - bg).max(axis=2) > 5
        target = np.asarray(plate)[..., 3] > 40
        (gy, gx), (ty, tx) = np.where(got), np.where(target)
        s = (ty.max() - ty.min()) / (gy.max() - gy.min())
        scaled = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
        dx = round((tx.min() + tx.max()) / 2 - (gx.min() + gx.max()) / 2 * s); dy = round(ty.min() - gy.min() * s)
        aligned = Image.new("RGB", plate.size, tuple(int(v) for v in bg)); aligned.paste(scaled, (dx, dy))
        g = np.zeros(plate.size[::-1], bool)
        sm = np.asarray(Image.fromarray(got).resize(scaled.size, Image.NEAREST))
        y0, x0 = max(dy, 0), max(dx, 0); y1, x1 = min(dy + sm.shape[0], g.shape[0]), min(dx + sm.shape[1], g.shape[1])
        g[y0:y1, x0:x1] = sm[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
        iou = (g & target).sum() / max(1, (g | target).sum())
        rows = np.linspace(ty.min(), ty.max() - 1, 41).astype(int)
        width = lambda m, y: (lambda x: (x.max() - x.min() + 1) if len(x) else 0)(np.where(m[y])[0])
        worst = max(abs(width(g, y) - width(target, y)) for y in rows[1:]) / (ty.max() - ty.min())
        crop = aligned.convert("RGBA")
        crop.putalpha(plate.getchannel("A"))
        crop.save(f"{OUT_DIR}/{name}")
        report.setdefault(key_, {}).update({"registeredOutlineIoU": round(float(iou), 4), "scale": round(float(s), 4), "shift": [dx, dy],
                                            "worstRowWidthDiffOfHeight": round(float(worst), 4), "output": f"{OUT_DIR}/{name}", "alpha": "approved plate alpha"})
        print(key_, report[key_])
    json.dump(report, open(f"{work}/report.json", "w"), indent=1)


if __name__ == "__main__":
    main()

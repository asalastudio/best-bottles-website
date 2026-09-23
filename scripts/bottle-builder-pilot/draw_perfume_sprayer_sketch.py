#!/usr/bin/env python3
"""Pencil drawing of the 18-415 perfume sprayer for the Choose Your Fitment tile.

The approved pencil sheet drew cell 0 after a 13-415 sprayer (three steps). The pump sold on
the 18-415 bottles has two: a narrow actuator and one collar. Same recipe as the reducer
drawing (2026-09-14): geometry reference = the master component library photograph, style
reference = the approved pencil sheet's own lotion-pump cell. Output is an ILLUSTRATION only;
it never enters kit or catalogue truth. Candidates are judged by silhouette, never hand-fixed.

    python3 scripts/bottle-builder-pilot/draw_perfume_sprayer_sketch.py --n 3
"""
import argparse, base64, json, os, sys, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "data/paper-doll/perfume-sprayer-illustration"
PROMPT = """Redraw the object in the FIRST image as a graphite pencil illustration in exactly the drawing style of the SECOND image: fine graphite hatching, soft vertical tonal bands suggesting polished metal, a thin crisp pencil outline, pure white paper, no shadow, no ground line, no text, no border.
Geometry is locked to the first image and must not change: a perfume spray pump seen straight on, made of exactly TWO stacked cylinders — a narrow actuator head on top carrying one small round spray orifice near its top centre, and one wider collar below with a flat bottom edge. There is NO third step, NO ring between them, NO bottle, NO dip tube, NO overcap. Keep the same height-to-width proportion, the same ratio of head width to collar width, the same head height to collar height, vertical straight sides, slightly rounded top edge on the head.
One object only, centred, upright, filling about 80% of the image height."""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--n", type=int, default=3); args = ap.parse_args()
    key = next((l.split("=", 1)[1].strip().strip('"') for l in (ROOT / ".env.local").read_text().splitlines() if l.startswith("OPENAI_API_KEY=")), os.environ.get("OPENAI_API_KEY"))
    if not key:
        sys.exit("OPENAI_API_KEY not found")
    files = [("image[]", DIR / "geometry-reference-Spry18-415ShnSl.png"), ("image[]", DIR / "style-reference-lotion-cell.png")]
    fields = {"model": "gpt-image-2.5-sunburst", "prompt": PROMPT, "size": "1024x1024", "quality": "high", "n": str(args.n)}
    boundary = uuid.uuid4().hex; body = b""
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, path in files:
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{path.name}"\r\nContent-Type: image/png\r\n\r\n'.encode() + path.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        out = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:600]}")
    for i, d in enumerate(out["data"]):
        p = DIR / f"candidate-{i + 1}.png"; p.write_bytes(base64.b64decode(d["b64_json"])); print(p.relative_to(ROOT))
    (DIR / "prompt.txt").write_text(PROMPT)


if __name__ == "__main__":
    main()

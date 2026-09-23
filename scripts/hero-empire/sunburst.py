"""Shared Sunburst edit helper for the Empire hero frames (multipart with image[] refs + optional mask)."""
import os, json, uuid, base64, urllib.request
from pathlib import Path
BACKGROUND_STANDARD_PATH = Path(__file__).resolve().parents[1] / 'hero-families/background-standard.json'
BACKGROUND_STANDARD = json.loads(BACKGROUND_STANDARD_PATH.read_text())
def generation_prompt(prompt):
    """Apply the shared standard at the API boundary for every future hero call."""
    return prompt.rstrip() + '\n\n' + BACKGROUND_STANDARD['prompt']
KEY = os.environ["OPENAI_API_KEY"]
def multipart(fields, files):
    b = uuid.uuid4().hex; body = b""
    for k, v in fields.items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, path in files:
        body += (f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n').encode() + open(path, "rb").read() + b"\r\n"
    body += f"--{b}--\r\n".encode(); return body, b
def edit(prompt, images, out, mask=None, size="1536x1024", quality="high"):
    files = [("image[]", p) for p in images]
    if mask: files.append(("mask", mask))
    body, b = multipart({"model": "gpt-image-2.5-sunburst", "prompt": generation_prompt(prompt), "size": size, "quality": quality, "n": "1"}, files)
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        with urllib.request.urlopen(req, timeout=400) as r: d = json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} {e.read()[:400]}")
    open(out, "wb").write(base64.b64decode(d["data"][0]["b64_json"])); return out

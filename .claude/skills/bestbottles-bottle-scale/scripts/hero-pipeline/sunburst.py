"""Minimal GPT-Image-2.5 Sunburst edit helper. usage: sunburst.py out.png size quality prompt-file ref1 [ref2...]"""
import base64, json, os, sys, time, mimetypes, uuid, urllib.request
out, size, quality, prompt_file, *refs = sys.argv[1:]
prompt = open(prompt_file).read().strip()
key = os.environ["OPENAI_API_KEY"]; B = uuid.uuid4().hex
def part(name, value, filename=None, ctype=None):
    h = f'--{B}\r\nContent-Disposition: form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "") + "\r\n"
    if ctype: h += f"Content-Type: {ctype}\r\n"
    return h.encode() + b"\r\n" + (value if isinstance(value, bytes) else str(value).encode()) + b"\r\n"
body = b"".join([part("model", "gpt-image-2.5-sunburst"), part("prompt", prompt), part("size", size), part("quality", quality),
                 part("background", "opaque"), part("output_format", "png"), part("n", "1")] +
                [part("image[]", open(r, "rb").read(), os.path.basename(r), mimetypes.guess_type(r)[0] or "image/png") for r in refs]) + f"--{B}--\r\n".encode()
req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={B}"})
t = time.time()
try:
    with urllib.request.urlopen(req, timeout=600) as r: d = json.load(r)
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:600]); sys.exit(2)
png = base64.b64decode(d["data"][0]["b64_json"]); open(out, "wb").write(png)
u = d.get("usage", {}); det = u.get("input_tokens_details", {})
cost = det.get("text_tokens", 0) * 5e-6 + det.get("image_tokens", 0) * 8e-6 + u.get("output_tokens", 0) * 30e-6
log = dict(out=out, size=size, quality=quality, refs=refs, latency_s=round(time.time() - t, 1), usage=u, cost_usd=round(cost, 4), prompt=prompt)
json.dump(log, open(out + ".json", "w"), indent=1)
print(f"OK {log['latency_s']}s ${cost:.3f} -> {out}")

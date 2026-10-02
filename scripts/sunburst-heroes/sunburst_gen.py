"""GPT-Image-2.5 Sunburst text-to-image. usage: sunburst_gen.py out.png size quality prompt-file"""
import base64, json, os, sys, time, urllib.request
out, size, quality, prompt_file = sys.argv[1:5]; prompt = open(prompt_file).read().strip()
req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(dict(model="gpt-image-2.5-sunburst", prompt=prompt, size=size, quality=quality, background="opaque", output_format="png", n=1)).encode(),
                             headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"})
t = time.time()
try:
    with urllib.request.urlopen(req, timeout=600) as r: d = json.load(r)
except urllib.error.HTTPError as e: print("HTTP", e.code, e.read().decode()[:600]); sys.exit(2)
open(out, "wb").write(base64.b64decode(d["data"][0]["b64_json"]))
u = d.get("usage", {}); det = u.get("input_tokens_details", {})
cost = det.get("text_tokens", 0) * 5e-6 + det.get("image_tokens", 0) * 8e-6 + u.get("output_tokens", 0) * 30e-6
json.dump(dict(out=out, size=size, quality=quality, latency_s=round(time.time() - t, 1), usage=u, cost_usd=round(cost, 4), prompt=prompt), open(out + ".json", "w"), indent=1)
print(f"OK {time.time()-t:.1f}s ${cost:.3f} -> {out}")

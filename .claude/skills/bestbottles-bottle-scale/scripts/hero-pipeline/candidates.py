"""Render N candidates of one SKU in parallel with the current prompt, downsample, gate at 70 and 40 levels."""
import os, sys, subprocess, json
from PIL import Image
import enhance, prompt_for
S = enhance.S
sku, n = sys.argv[1], int(sys.argv[2])
base = f"{S}/cyl-geom/{sku}.png"; os.makedirs(f"{S}/cyl-final/_cand", exist_ok=True)
pf = f"{S}/cyl-final/_prompts/{sku}.txt"; open(pf, "w").write(prompt_for.build(sku, enhance.has_loose_cap(base)))
procs = []
for i in range(n):
    raw = f"{S}/cyl-final/_cand/{sku}.{i}.raw.png"
    procs.append((i, raw, subprocess.Popen([sys.executable, enhance.SUNBURST, raw, "2080x2288", "high", pf, base], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)))
out = []
for i, raw, p in procs:
    log = p.communicate()[0].decode()[-300:]
    if p.returncode or not os.path.exists(raw):
        out.append(dict(i=i, error=log)); continue
    dst = f"{S}/cyl-final/_cand/{sku}.{i}.png"
    Image.open(raw).convert("RGB").resize((1560, 1716), Image.LANCZOS).save(dst)
    out.append(dict(i=i, file=dst, **enhance.gate(base, dst)))
json.dump(out, open(f"{S}/cyl-final/_cand/{sku}.json", "w"), indent=1)
for o in out: print(o)

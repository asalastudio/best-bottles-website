"""Re-look card: only the heroes Jordan APPROVED on an earlier image whose image has since changed (re-sized or re-rendered), so he re-checks
those and nothing else. usage: relook_card.py <scratch> <handoff> <master-cid> <relook-cid>"""
import json, os, sys, shutil, subprocess
S, H, master, cid = sys.argv[1:5]
rows = {r["sku"]: r for r in json.load(open(f"{H}/hero-reviews/{master}/data.json"))}
latest = {}
for c in sorted(os.listdir(f"{H}/hero-reviews")):
    fp = f"{H}/hero-reviews/{c}/feedback.json"
    if not c.startswith("sunburst-") or not os.path.exists(fp): continue
    fb = json.load(open(fp)); dec = fb.get("decisions") if isinstance(fb, dict) else fb
    for d in (dec.values() if isinstance(dec, dict) else (dec or [])):
        t = d.get("updatedAt") or ""
        if d["sku"] not in latest or t >= latest[d["sku"]]["t"]: latest[d["sku"]] = dict(t=t, status=d.get("status"), sha=d.get("assetSha256"), card=c, notes=d.get("notes", ""))
relook = [s for s, v in latest.items() if v["status"] == "approved" and s in rows and rows[s]["assetSha256"] != v["sha"]]
PUB = f"{S}/heroes/public/{cid}"; os.makedirs(f"{PUB}/sunburst-latest", exist_ok=True); os.makedirs(f"{PUB}/prior", exist_ok=True); out = []
for s in sorted(relook):
    r = rows[s]; src = f"{S}/heroes/public/{master}/sunburst-latest/{s}.png"; shutil.copy(src, f"{PUB}/sunburst-latest/{s}.png")
    prior = f"{S}/heroes/public/{latest[s]['card']}/sunburst-latest/{s}.png"
    if os.path.exists(prior): shutil.copy(prior, f"{PUB}/prior/{s}.png")
    out.append(dict(sku=s, family=r["family"], url=f"/sunburst-latest/{s}.png", priorUrl=f"/prior/{s}.png" if os.path.exists(prior) else None, title=s, stage="visual-review",
                    reviewNotes=[f"RE-LOOK: you approved this on {latest[s]['card']}; the image has since changed (re-sized to your targets or re-rendered) — the 'previous draft' is the one you approved"] + r["reviewNotes"]))
json.dump(dict(rows=out), open(f"{PUB}/manifest.json", "w"), indent=1); print("re-look rows:", len(out))
r = subprocess.run(["node", f"{H}/tools/hero-review/import.cjs", "--id", cid, "--title", "Re-look — heroes you approved whose image changed since", "--manifest", f"{PUB}/manifest.json", "--public-root", PUB], capture_output=True, text=True)
print([l.strip() for l in r.stdout.split("\n") if '"id"' in l or '"count"' in l] or r.stderr[-300:])

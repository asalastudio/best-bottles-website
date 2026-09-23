#!/usr/bin/env python3
"""Same-zoom before/after sheet for the plates rebuilt from the PSD master.

210 plates were served from the old website's images because the cap-state
heuristic hid their master PSD. They have been re-rendered from the master.
Nothing is published: this page is how the change is judged before it is.

"Before" is the plate the catalogue serves right now, fetched from the index.
"After" is the rebuilt file on disk. Both are shown on the same 1000x1100
canvas at the same zoom so the comparison is honest. A row with no "before"
had no plate at all; that is stated rather than drawn as an empty box.

Each row also carries its exact master PSD path, because the whole point of
the rebuild is that the source is now the master rather than a website GIF.

  python3 scripts/asset-ledger/build-legacy-rebuild-review.py [--limit N]

Writes public/reviews/legacy-rebuild-2026-09-13/ (images + index.html) and
data/asset-ledger/legacy-rebuild-review.json. Publishes nothing.
"""
import argparse, concurrent.futures as cf, hashlib, html, json, os, shutil, sys, time, urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/reviews/legacy-rebuild-2026-09-13"
def _manifests():
    """Every rebuild batch, preferring the newest render of a family."""
    found = {m.parent.parent.name: m
             for m in sorted((ROOT / "dist/paper-doll/technical-reconciliation-2026-09-13").glob("*/plates/manifest.json"))}
    # the legacy-rebuild batch is the current one and wins on any overlap
    found.update({m.parent.parent.name: m
                  for m in sorted((ROOT / "dist/paper-doll/legacy-rebuild-2026-09-13").glob("*/plates/manifest.json"))})
    return [found[k] for k in sorted(found)]


MANIFESTS = _manifests()

CSS = """
*{box-sizing:border-box}
body{margin:0;padding:26px 20px 70px;font:14px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#23211e;background:#faf8f5}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
.lede{margin:0 0 16px;color:#5c574f;max-width:88ch}
.note{border:1px solid #e3d9c6;background:#fdf8ed;border-radius:10px;padding:12px 14px;margin:0 0 14px;max-width:104ch;color:#5a4c32}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 24px;font-size:12px;color:#6b655b}
.legend b{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.k-src{background:#b5762f}.k-new{background:#4a7c59}.k-same{background:#9a958c}
h2{font-size:16px;margin:34px 0 12px;padding-bottom:7px;border-bottom:1px solid #e7e1d6}
h2 span{color:#8a8376;font-weight:400;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
.card{border:1px solid #e7e1d6;border-radius:10px;background:#fff;overflow:hidden}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#efeae1}
.cell{background:#f7f5f1;padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px}
.cell .lbl{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#8a8376}
.shot{width:100%;aspect-ratio:1000/1100;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:4px}
.shot img{max-width:100%;max-height:100%;object-fit:contain}
.none{font-size:11px;color:#a09a90;text-align:center;padding:0 8px}
.meta{padding:9px 11px 11px;border-top:1px solid #efeae1}
.sku{font:600 12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.tags{margin-top:6px;display:flex;gap:5px;flex-wrap:wrap}
.tag{font-size:10.5px;color:#6d6456;background:#f2ede3;border-radius:999px;padding:2px 8px}
.tag.src{background:#f6e8d6;color:#7a5a24}
.tag.new{background:#e4efe6;color:#33603f}
.psd{margin-top:6px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8a8376;word-break:break-all}
"""


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BestBottles plate review"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def live_plates(family_ids):
    """Currently indexed plate per SKU, via the repo's own Convex query."""
    script = """
const path=require('node:path');
// resolve against the repo root, not this file's directory
const {ConvexHttpClient}=require(path.join(process.cwd(),'node_modules/convex/browser'));
const {api}=require(path.join(process.cwd(),'convex/_generated/api.js'));
(async()=>{const c=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);const out={};
for(const f of process.argv.slice(1)){let cur=null;for(;;){const r=await c.query(api.productPlates.byFamily,{familyId:f,cursor:cur,limit:200});
for(const row of r.page)out[row.sku]={image:row.image,imageCapOff:row.imageCapOff,sourcePath:row.sourcePath};
if(r.isDone)break;cur=r.continueCursor;}}
process.stdout.write(JSON.stringify(out));})()
"""
    import subprocess
    p = ROOT / "scripts/asset-ledger/.live-plates.cjs"
    p.write_text(script)
    try:
        r = subprocess.run(["node", str(p), *family_ids], cwd=ROOT, capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            print(r.stderr[-600:], file=sys.stderr)
            return {}
        return json.loads(r.stdout or "{}")
    finally:
        p.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    ledger = json.loads((ROOT / "src/lib/asset-ledger/ledger.json").read_text())
    plan = {r["sku"]: r for r in ledger["platePlan"]["rows"]}
    legacy_targets = {r["sku"] for r in ledger["platePlan"]["rows"]
                      if "master Photoshop source" in " ".join(r["reasons"])}

    rows, family_ids = [], set()
    for man_path in MANIFESTS:
        if not man_path.exists():
            continue
        man = json.loads(man_path.read_text())
        base = man_path.parent
        for r in man["rows"]:
            if not r.get("publishable"):
                continue
            sku = r["websiteSku"]
            family_ids.add(r["familyId"])
            rows.append({
                "sku": sku, "familyId": r["familyId"], "family": plan.get(sku, {}).get("family") or r.get("familyName"),
                "capacityMl": plan.get(sku, {}).get("capacityMl"), "itemName": plan.get(sku, {}).get("itemName"),
                "stage": plan.get(sku, {}).get("stage"), "wasLegacySource": sku in legacy_targets,
                "after": base / r["plate"]["key"],
                "afterCapOff": (base / r["plateCapOff"]["key"]) if r.get("plateCapOff") else None,
                "sourcePath": r["plate"].get("sourceRelPath"),
                "sourceLibrary": r["plate"].get("sourceLibrary"),
                "batch": man_path.parent.parent.name,
            })
    rows.sort(key=lambda r: (r["family"] or "", r["capacityMl"] or 0, r["sku"]))
    if args.limit:
        rows = rows[: args.limit]

    print(f"{len(rows)} rebuilt plates across {len(family_ids)} render families", file=sys.stderr)
    live = live_plates(sorted(family_ids))
    print(f"  {len(live)} currently indexed plates read from the deployment", file=sys.stderr)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "before").mkdir(exist_ok=True)
    (OUT / "after").mkdir(exist_ok=True)

    def prepare(r):
        after = OUT / "after" / f"{r['sku']}.webp"
        shutil.copyfile(r["after"], after)
        r["afterUrl"] = f"/reviews/legacy-rebuild-2026-09-13/after/{after.name}"
        r["afterSha"] = hashlib.sha256(after.read_bytes()).hexdigest()
        cur = live.get(r["sku"])
        r["liveSourcePath"] = (cur or {}).get("sourcePath")
        if cur and cur.get("image"):
            try:
                body = fetch(cur["image"])
                before = OUT / "before" / f"{r['sku']}.webp"
                before.write_bytes(body)
                r["beforeUrl"] = f"/reviews/legacy-rebuild-2026-09-13/before/{before.name}"
                r["beforeSha"] = hashlib.sha256(body).hexdigest()
                r["identical"] = r["beforeSha"] == r["afterSha"]
            except Exception as e:
                r["beforeError"] = f"{type(e).__name__}: {e}"
        return r

    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(prepare, rows))

    changed = [r for r in rows if r.get("beforeUrl") and not r.get("identical")]
    brand_new = [r for r in rows if not r.get("beforeUrl")]
    same = [r for r in rows if r.get("identical")]

    by_family = defaultdict(list)
    for r in rows:
        by_family[r["family"] or "Unclassified"].append(r)

    parts = [
        "<!doctype html><meta charset=utf-8>",
        f"<title>Legacy rebuilds &middot; {len(rows)} plates</title><style>{CSS}</style>",
        f"<h1>Rebuilt from the Photoshop master &middot; {len(rows)} plates</h1>",
        "<p class=lede>Left is the plate the catalogue serves right now. Right is the rebuild from the master "
        "Photoshop file, on the same canvas at the same zoom.</p>",
        "<div class=note><strong>Nothing here is published.</strong> These files exist only on this machine. "
        "Publishing them replaces the served plate for each SKU and needs an explicit instruction.</div>",
        "<div class=note>Bottles with a vintage bulb sprayer <strong>and tassel</strong> are framed by a separate rule, "
        "chosen 2026-09-13: the tassel composition is more than twice as wide as the glass, so the bottle keeps the size "
        "that leaves the bulb and tassel uncropped, and its foot is pinned to the baseline its plain siblings stand on. "
        "Before that rule they floated up to 184&nbsp;px above the shelf at roughly 60&nbsp;% of sibling size.</div>",
        f"<div class=legend><span><b class='k-src'></b>{len(changed)} replace the currently served plate</span>"
        f"<span><b class='k-new'></b>{len(brand_new)} have no plate today</span>"
        f"<span><b class='k-same'></b>{len(same)} are byte-identical to what is served</span></div>",
    ]
    for family in sorted(by_family, key=lambda f: (-len(by_family[f]), f)):
        items = by_family[family]
        n_legacy = sum(1 for r in items if r["wasLegacySource"])
        parts.append(f"<h2>{html.escape(family)} <span>&middot; {len(items)} rebuilt"
                     f"{f', {n_legacy} replacing a website image' if n_legacy else ''}</span></h2><div class=grid>")
        for r in items:
            if r.get("beforeUrl"):
                before = f'<img loading="lazy" decoding="async" src="{html.escape(r["beforeUrl"])}" alt="served">'
            elif r.get("beforeError"):
                before = '<div class=none>could not fetch the served plate</div>'
            else:
                before = '<div class=none>no plate served today</div>'
            tags = []
            if r["wasLegacySource"]:
                tags.append('<span class="tag src">was a website image</span>')
            if not r.get("beforeUrl"):
                tags.append('<span class="tag new">new plate</span>')
            if r.get("identical"):
                tags.append('<span class="tag">identical bytes</span>')
            if r.get("afterCapOff"):
                tags.append('<span class="tag">cap-off built</span>')
            if r.get("capacityMl") is not None:
                tags.append(f'<span class=tag>{r["capacityMl"]} mL</span>')
            parts.append(
                f'<div class=card><div class=pair>'
                f'<div class=cell><span class=lbl>Served now</span><div class=shot>{before}</div></div>'
                f'<div class=cell><span class=lbl>Rebuilt from master</span><div class=shot>'
                f'<img loading="lazy" decoding="async" src="{html.escape(r["afterUrl"])}" alt="rebuilt"></div></div></div>'
                f'<div class=meta><div class=sku>{html.escape(r["sku"])}</div>'
                f'<div class=tags>{"".join(tags)}</div>'
                f'<div class=psd>{html.escape((r.get("sourceLibrary") or "?") + ": " + (r.get("sourcePath") or "source path not recorded"))}</div>'
                f'</div></div>'
            )
        parts.append("</div>")
    parts.append(f'<p class=lede style="margin-top:36px">Generated {time.strftime("%Y-%m-%d %H:%M")}. '
                 f'Every image on this page is a local file; none is indexed or served to customers.</p>')
    (OUT / "index.html").write_text("".join(parts))

    record = {
        "schemaVersion": 1, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "page": "/reviews/legacy-rebuild-2026-09-13/index.html",
        "published": False, "indexed": False,
        "counts": {"rebuilt": len(rows), "replacesServed": len(changed),
                   "noPlateToday": len(brand_new), "identicalBytes": len(same),
                   "wasWebsiteImage": sum(1 for r in rows if r["wasLegacySource"])},
        "rows": [{k: (str(v) if isinstance(v, Path) else v) for k, v in r.items()} for r in rows],
    }
    (ROOT / "data/asset-ledger/legacy-rebuild-review.json").write_text(json.dumps(record, indent=1) + "\n")
    print(json.dumps(record["counts"], indent=1))


if __name__ == "__main__":
    main()

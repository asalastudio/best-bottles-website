#!/usr/bin/env python3
"""Sweep the legacy bestbottles.com site: every product page, every image path.

The legacy site has one product page per SKU (the sitemap lists them all) and a
fixed set of image paths per SKU. This script enumerates the catalogue, probes
the images, and diffs both against what prod Convex and the plate lane hold.

  python3 scripts/legacy/sweep_legacy_site.py catalog            # phase A: crawl product pages (cached, resumable)
  python3 scripts/legacy/sweep_legacy_site.py expand            # phase A2: follow sibling-cap links the sitemap omits
  python3 scripts/legacy/sweep_legacy_site.py images [--dims]    # phase B: probe image paths (HEAD; --dims GETs targets)
  python3 scripts/legacy/sweep_legacy_site.py report             # phase C: diff vs prod + plates, write the report
  python3 scripts/legacy/sweep_legacy_site.py selftest           # parse the two cached sample pages

Outputs: data/legacy/legacy-catalog.json, data/legacy/legacy-images.json,
data/legacy/legacy-sweep-report.md. Page cache: dist/legacy/pages/ (not in git).
"""
import concurrent.futures as cf, html, json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "legacy"; CACHE = ROOT / "dist" / "legacy" / "pages"
BASE = "https://www.bestbottles.com/"
UA = {"User-Agent": "Mozilla/5.0 (BestBottles catalogue sweep; jordan@asala.ai)"}
WORKERS = 4; DELAY = 0.15
IMAGE_PATHS = {  # what the legacy site keeps per SKU (measured 2026-09-02)
    "capped":   "images/store/capped/{sku}.gif",        # cap on, 600x800
    "enlarged": "images/store/enlarged_pics/{sku}.gif", # cap beside, ~648x800
    "main":     "images/store/{sku}.png",               # listing image, 300x472
}

def fetch(url, timeout=40, head=False):
    req = urllib.request.Request(url, headers=UA, method="HEAD" if head else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = b"" if head else r.read()
            return r.status, dict(r.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), b""
    except Exception as e:  # network hiccup: caller retries
        return -1, {"error": str(e)}, b""

def sitemap_product_urls():
    st, _, body = fetch(BASE + "sitemap.xml")
    if st != 200: sys.exit(f"sitemap fetch failed: {st}")
    urls = re.findall(r"<loc>([^<]+)</loc>", body.decode("utf-8", "replace"))
    return sorted(u for u in urls if "/product/" in u)

def parse_product(t, url):
    m = re.search(r'class="row ProdDetTitle".*?<h1>\s*([^<]+?)\s*</h1>', t, re.S)
    sku = html.unescape(m.group(1)).strip() if m else None
    desc = None
    if m:
        after = t[m.end(): m.end() + 20000]
        paras = []
        for p in re.findall(r"<p[^>]*>(.*?)</p>", after, re.S):
            txt = html.unescape(re.sub(r"<[^>]+>", " ", p)); txt = re.sub(r"\s+", " ", txt).strip()
            if len(txt) >= 30 and "Minimum Purchase" not in txt and not txt.startswith("Item Type"): paras.append(txt)
        # the product sentence is the one that names the capacity; the page also
        # carries boilerplate paragraphs that merely qualify
        desc = next((x for x in paras if re.search(r"capacity|\b\d+\s*ml\b|\boz\b", x, re.I)), paras[0] if paras else None)
    ladder = []
    for o in re.findall(r"<option[^>]*>([^<]*pcs[^<]*)</option>", t):
        o = html.unescape(o).replace("\xa0", " ")
        mm = re.match(r"\s*([\d,]+)\s*pcs\s*-\s*\$([\d,.]+)(?:\(\$([\d.]+)/pc\))?", o)
        if mm:
            qty = int(mm.group(1).replace(",", "")); total = float(mm.group(2).replace(",", ""))
            unit = float(mm.group(3)) if mm.group(3) else total
            ladder.append({"minQty": qty, "unitPrice": unit, "totalPrice": round(unit * qty, 2) if not mm.group(3) else total})
    imgs = sorted(set(re.findall(r'(?:src|href)="([^"]*images/store/[^"]+)"', t)))
    imgs = [i.replace(BASE, "").replace("../", "") for i in imgs]
    assoc_block = re.search(r'id="assoc_pr".*?</div>', t, re.S)
    assoc = re.findall(r'href="([^"]*/product/[^"]+)"', assoc_block.group(0)) if assoc_block else []
    assoc = [a.replace("https://www.bestbottles.com//", BASE) for a in assoc]
    meta = re.search(r'<meta name="description" content="([^"]*)"', t)
    return {"url": url, "slug": url.rsplit("/product/", 1)[-1], "sku": sku, "description": desc,
            "priceLadder": ladder,
            "images": {"capped": next((i for i in imgs if "/capped/" in i), None),
                       "enlarged": next((i for i in imgs if "/enlarged_pics/" in i), None),
                       "caps": [i for i in imgs if "/caps/" in i]},
            "assoc": assoc, "metaDescription": html.unescape(meta.group(1)) if meta else None}

def crawl_one(url):
    key = re.sub(r"[^A-Za-z0-9_-]", "_", url.rsplit("/product/", 1)[-1])[:180]
    path = CACHE / f"{key}.html"
    if path.exists(): return parse_product(path.read_text(encoding="utf-8", errors="replace"), url)
    for attempt in range(3):
        st, _, body = fetch(url)
        if st == 200 and body:
            path.write_bytes(body); time.sleep(DELAY)
            return parse_product(body.decode("utf-8", "replace"), url)
        time.sleep(1.5 * (attempt + 1))
    return {"url": url, "slug": url.rsplit("/product/", 1)[-1], "sku": None, "error": f"http {st}"}

def phase_catalog():
    CACHE.mkdir(parents=True, exist_ok=True); DATA.mkdir(parents=True, exist_ok=True)
    urls = sitemap_product_urls(); print(f"sitemap: {len(urls)} product pages", flush=True)
    rows = []; t0 = time.time()
    with cf.ThreadPoolExecutor(WORKERS) as ex:
        for i, row in enumerate(ex.map(crawl_one, urls), 1):
            rows.append(row)
            if i % 100 == 0: print(f"  {i}/{len(urls)}  {time.time()-t0:.0f}s", flush=True)
    out = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "source": BASE + "sitemap.xml",
           "productPages": len(urls), "parsed": sum(1 for r in rows if r.get("sku")), "rows": rows}
    (DATA / "legacy-catalog.json").write_text(json.dumps(out, indent=1))
    skus = [r["sku"] for r in rows if r.get("sku")]
    print(f"parsed {len(skus)} SKUs ({len(set(skus))} distinct), {sum(1 for r in rows if r.get('error'))} errors -> {DATA/'legacy-catalog.json'}")

def probe_sku(sku, dims=False):
    out = {}
    for kind, pat in IMAGE_PATHS.items():
        url = BASE + pat.format(sku=sku)
        st, hdr, body = fetch(url, head=not dims)
        rec = {"status": st, "bytes": int(hdr.get("Content-Length") or len(body) or 0)}
        if dims and st == 200 and body:
            try:
                from PIL import Image; import io
                im = Image.open(io.BytesIO(body)); rec["width"], rec["height"] = im.size
            except Exception as e: rec["dimsError"] = str(e)[:60]
        out[kind] = rec
    time.sleep(DELAY); return sku, out

def phase_images(dims_targets=None):
    catp = DATA / "legacy-catalog.json"
    cat = json.loads(catp.read_text()) if catp.exists() else {"rows": []}
    skus = sorted({r["sku"] for r in cat["rows"] if r.get("sku")})
    if dims_targets is not None: skus = [s for s in skus if s in dims_targets] + [s for s in dims_targets if s not in set(skus)]
    print(f"probing {len(skus)} SKUs x {len(IMAGE_PATHS)} paths (dims={'yes' if dims_targets is not None else 'no'})", flush=True)
    res = {}; t0 = time.time()
    with cf.ThreadPoolExecutor(WORKERS) as ex:
        for i, (sku, rec) in enumerate(ex.map(lambda s: probe_sku(s, dims_targets is not None), skus), 1):
            res[sku] = rec
            if i % 200 == 0: print(f"  {i}/{len(skus)}  {time.time()-t0:.0f}s", flush=True)
    prev = json.loads((DATA / "legacy-images.json").read_text()) if (DATA / "legacy-images.json").exists() else {"skus": {}}
    prev["skus"].update(res); prev["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    (DATA / "legacy-images.json").write_text(json.dumps(prev, indent=1))
    have = sum(1 for r in res.values() if r["capped"]["status"] == 200)
    print(f"cap-on image exists for {have}/{len(res)} probed SKUs -> {DATA/'legacy-images.json'}")

def selftest():
    import glob
    S = os.environ.get("LEGACY_SAMPLES", "")
    for p in [x for x in S.split(":") if x]:
        row = parse_product(Path(p).read_text(encoding="utf-8", errors="replace"), "https://www.bestbottles.com/product/sample")
        print(json.dumps({k: row[k] for k in ("sku", "description", "priceLadder", "images", "assoc")}, indent=1)[:1200])


def phase_report():
    cat = json.loads((DATA / "legacy-catalog.json").read_text())
    imgs = json.loads((DATA / "legacy-images.json").read_text())["skus"] if (DATA / "legacy-images.json").exists() else {}
    cs = json.loads((ROOT / "data/paper-doll/convex-snapshot.json").read_text())
    gid = {g["_id"]: g for g in cs["groups"]}
    prod = {p["websiteSku"]: p for p in cs["products"] if p.get("websiteSku")}
    xref = {r["websiteSku"]: r for r in json.loads((ROOT / "data/paper-doll/xref.json").read_text())["products"] if r.get("websiteSku")}
    man = json.loads((ROOT / "dist/paper-doll/manifest.json").read_text())["rows"]
    plated = {r["websiteSku"] for r in man if r.get("publishable")}
    noimg = set((DATA / "targets-no-image.txt").read_text().split()) if (DATA / "targets-no-image.txt").exists() else set()
    legacy = {r["sku"]: r for r in cat["rows"] if r.get("sku")}
    def img(sku, kind):
        rec = imgs.get(sku, {}).get(kind); return rec if rec and rec.get("status") == 200 else None
    def cls(rec):
        if not rec: return "none"
        w, h = rec.get("width"), rec.get("height")
        return f"{w}x{h}" if w else f"{rec.get('bytes', 0)//1024}KB"
    low = lambda s: s.lower()
    legacy_l = {low(k): k for k in legacy}; prod_l = {low(k): k for k in prod}
    only_legacy = sorted(legacy[legacy_l[k]]["sku"] for k in legacy_l if k not in prod_l)
    only_prod = sorted(prod[prod_l[k]]["websiteSku"] for k in prod_l if k not in legacy_l)
    # the URL join (legacy-vs-prod.json) separates spelling drift from real gaps
    vp = json.loads((DATA / "legacy-vs-prod.json").read_text()) if (DATA / "legacy-vs-prod.json").exists() else None
    drift = {d["legacySku"]: d["prodSku"] for d in (vp or {}).get("spellingDrift", [])}
    if (DATA / "legacy-aliases.json").exists():  # reviewed aliases: prod spelling is canonical
        drift.update({k: v.get("prodSku") for k, v in json.loads((DATA / "legacy-aliases.json").read_text())["aliases"].items()})
    if vp: only_legacy = [s for s in only_legacy if s not in drift]
    plateless = sorted(s for s in prod if s not in plated)
    rows = []
    for s in plateless:
        L = legacy.get(s) or legacy.get(legacy_l.get(low(s), ""))
        x = xref.get(s, {}); p = prod[s]
        rows.append({"websiteSku": s, "family": p.get("family"), "category": p.get("category"),
                     "group": gid.get(p["productGroupId"], {}).get("slug"),
                     "plateReason": (x.get("blockReasons") or ["not built"])[0] if x else "not in xref",
                     "onLegacySite": bool(L), "legacyCapOn": cls(img(s, "capped")), "legacyEnlarged": cls(img(s, "enlarged")),
                     "legacyMain": cls(img(s, "main")), "noCatalogueImage": s in noimg,
                     "legacyPrice": (L or {}).get("priceLadder", [{}])[0].get("unitPrice") if L else None})
    with_capon = [r for r in rows if r["legacyCapOn"] != "none"]
    noimg_rows = [{"websiteSku": s, "family": prod[s].get("family"), "legacyCapOn": cls(img(s, "capped")),
                   "legacyMain": cls(img(s, "main")), "onLegacySite": s in legacy} for s in sorted(noimg) if s in prod]
    out = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "legacySkus": len(legacy), "prodSkus": len(prod),
           "onlyLegacy": only_legacy, "onlyProd": only_prod, "plateless": rows, "noCatalogueImage": noimg_rows}
    (DATA / "legacy-sweep.json").write_text(json.dumps(out, indent=1))
    import collections
    L = []
    L.append(f"# Legacy site sweep — {out['generatedAt']}\n")
    L.append(f"Legacy product pages parsed: **{len(legacy)}** SKUs. Prod Convex: **{len(prod)}** website SKUs.\n")
    L.append(f"## Catalogue drift\n- Live on the legacy site, missing from prod: **{len(only_legacy)}**\n- Same product, different SKU spelling on prod: **{len(drift)}** (" + ", ".join(f"{a} → {b or 'blank'}" for a, b in drift.items()) + ")\n- On prod, not on the legacy site: **" + str(len(only_prod)) + "** (of which without any live legacy page: " + str(len((vp or {}).get("prodOnlyNoLegacyPage", []))) + ")\n")
    fam = collections.Counter(re.sub(r"[0-9].*", "", s)[:10] for s in only_legacy)
    L.append("Legacy-only SKUs by prefix: " + ", ".join(f"{k} {v}" for k, v in fam.most_common(15)) + "\n")
    L.append("\n| legacy-only SKU | price | cap-on image |\n|---|---|---|")
    for s in only_legacy[:400]:
        L.append(f"| {s} | {(legacy[s].get('priceLadder') or [{}])[0].get('unitPrice', '')} | {cls(img(s, 'capped'))} |")
    L.append(f"\n## Plate-less SKUs on prod ({len(rows)}) — what the legacy site holds\n")
    L.append(f"- with a legacy cap-on photograph: **{len(with_capon)}**\n- on the legacy site at all: **{sum(1 for r in rows if r['onLegacySite'])}**\n")
    byreason = collections.Counter((r["plateReason"], r["legacyCapOn"] != "none") for r in rows)
    L.append("| plate reason | legacy cap-on exists | count |\n|---|---|---|")
    for (reason, has), n in sorted(byreason.items(), key=lambda kv: -kv[1]): L.append(f"| {reason} | {'yes' if has else 'no'} | {n} |")
    L.append("\n| SKU | family | reason | legacy cap-on | enlarged | main | no catalogue image |\n|---|---|---|---|---|---|---|")
    for r in rows: L.append(f"| {r['websiteSku']} | {r['family']} | {r['plateReason']} | {r['legacyCapOn']} | {r['legacyEnlarged']} | {r['legacyMain']} | {'YES' if r['noCatalogueImage'] else ''} |")
    if noimg_rows:
        L.append(f"\n## Prod products with no usable catalogue image ({len(noimg_rows)})\n")
        L.append(f"- legacy cap-on photograph available: **{sum(1 for r in noimg_rows if r['legacyCapOn'] != 'none')}**\n")
        L.append("| SKU | family | legacy cap-on | legacy main |\n|---|---|---|---|")
        for r in noimg_rows: L.append(f"| {r['websiteSku']} | {r['family']} | {r['legacyCapOn']} | {r['legacyMain']} |")
    (DATA / "legacy-sweep-report.md").write_text("\n".join(L) + "\n")
    print(f"legacy {len(legacy)} | prod {len(prod)} | legacy-only {len(only_legacy)} | prod-only {len(only_prod)} | plate-less {len(rows)}, with legacy cap-on {len(with_capon)} | no-image {len(noimg_rows)}")
    print(f"-> {DATA/'legacy-sweep-report.md'}")


def phase_expand():
    """The sitemap is incomplete (the minaret pages were not in it). Every product
    page links its sibling caps in id="assoc_pr"; follow those links until no new
    page appears, then rewrite the catalogue with discontinued pages classified."""
    cat = json.loads((DATA / "legacy-catalog.json").read_text()); rows = cat["rows"]
    norm = lambda u: u.replace("https://www.bestbottles.com//", BASE)
    known = {norm(r["url"]) for r in rows}; rounds = 0
    while True:
        frontier = sorted({norm(a) for r in rows for a in (r.get("assoc") or [])} - known)
        if not frontier: break
        rounds += 1; print(f"round {rounds}: {len(frontier)} new sibling pages", flush=True)
        with cf.ThreadPoolExecutor(WORKERS) as ex:
            for row in ex.map(crawl_one, frontier): rows.append(row); known.add(norm(row["url"]))
    for r in rows:
        if not r.get("sku") and not r.get("error"):
            key = re.sub(r"[^A-Za-z0-9_-]", "_", r["slug"])[:180]; t = (CACHE / f"{key}.html").read_text(encoding="utf-8", errors="replace") if (CACHE / f"{key}.html").exists() else ""
            r["status"] = "discontinued" if "no longer available" in t else "unparsed"
        else: r["status"] = "ok" if r.get("sku") else "error"
    cat.update({"rows": rows, "productPages": len(rows), "parsed": sum(1 for r in rows if r.get("sku")),
                "expandedRounds": rounds, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z")})
    (DATA / "legacy-catalog.json").write_text(json.dumps(cat, indent=1))
    import collections; print("status:", dict(collections.Counter(r["status"] for r in rows)), f"| SKUs {cat['parsed']} -> {DATA/'legacy-catalog.json'}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "catalog": phase_catalog()
    elif cmd == "images":
        targets = None
        if "--dims" in sys.argv:
            tf = sys.argv[sys.argv.index("--dims") + 1] if len(sys.argv) > sys.argv.index("--dims") + 1 else None
            targets = set(Path(tf).read_text().split()) if tf and Path(tf).exists() else set()
        phase_images(targets)
    elif cmd == "expand": phase_expand()
    elif cmd == "report": phase_report()
    elif cmd == "selftest": selftest()
    else: print(__doc__)

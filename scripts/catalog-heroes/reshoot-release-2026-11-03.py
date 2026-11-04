"""Release the 3 Nov 2026 catalog hero reshoots: lossless WebP files, the release list and its approval record.

Sources (both drawn with gpt-image-2.5-sunburst):
- flat-lay-2026-11-03.py: the two 4 ml frosted heart bottles (keychain, tassel) as overhead flat lays. Jordan: "Only
  the heart shapes were to be done with flat lay, which they look fine."
- front-on-2026-11-03.py: the 3 ml clear tola and 3 ml clear spray bottle as straight-on shots at higher fidelity
  ("regular, straight on image shots. Same like we have on the grid ... improve the fidelity"); approved.
Each replaces the SKU's earlier hero: GB3TPlGl leaves catalog-hero-next-batch-release.json and LB3mlClear leaves
catalog-hero-vials-release.json (as the vials release took the batch-3 vials); the hearts' base rows in
catalog-heroes.json stay as their approved record, and this release takes precedence over them.

Writes public/images/catalog/reshoot-2026-11-03/<sku>.<sha12>.webp, src/lib/products/catalog-hero-reshoot-2026-11-03.json
and docs/hero-families/reshoot-2026-11-03/approval.json.
Usage: python3 scripts/catalog-heroes/reshoot-release-2026-11-03.py
"""
import hashlib, io, json, os
from PIL import Image

OUT = "public/images/catalog/reshoot-2026-11-03"
RELEASE = "src/lib/products/catalog-hero-reshoot-2026-11-03.json"
APPROVAL = "docs/hero-families/reshoot-2026-11-03/approval.json"
ROWS = [  # sku, source index, presentation, status, note
    ("GBHeartFrst4KeyGld", "flat-lay", "Overhead flat lay", "approved", "Jordan 2026-11-03: the heart flat lays look fine"),
    ("GBHeartFrst4TslRed", "flat-lay", "Overhead flat lay", "approved", "Jordan 2026-11-03: the heart flat lays look fine"),
    ("GB3TPlGl", "front-on", "Original product assembly", "approved", "Jordan 2026-11-03: approved the straight-on reshoot"),
    ("LB3mlClear", "front-on", "Empty · cap beside", "approved", "Jordan 2026-11-03: approved the straight-on reshoot"),
]


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.dirname(APPROVAL), exist_ok=True)
    for old in os.listdir(OUT):
        os.remove(f"{OUT}/{old}")
    base = {r["websiteSku"]: r for r in json.load(open("src/lib/products/catalog-heroes.json"))}
    release, approval = [], []
    for sku, src, presentation, status, note in ROWS:
        idx = json.load(open(f"docs/hero-families/reshoot-2026-11-03/{src}/{src}.json"))[sku]
        img = Image.open(idx["path"]).convert("RGB")
        assert img.size == (1560, 1716), img.size
        buf = io.BytesIO(); img.save(buf, "WEBP", lossless=True, quality=100, method=6); data = buf.getvalue()
        sha = hashlib.sha256(data).hexdigest(); url = f"/images/catalog/reshoot-2026-11-03/{sku}.{sha[:12]}.webp"
        open("public" + url, "wb").write(data)
        b = base[sku]
        release.append({"groupSlug": b["groupSlug"], "websiteSku": sku, "graceSku": b["graceSku"], "shopifyVariantId": b["shopifyVariantId"],
                        "family": b["family"], "capacityMl": b["capacityMl"], "bottleColor": b["bottleColor"], "alt": b["alt"],
                        "presentation": presentation, "url": url, "width": 1560, "height": 1716,
                        "framing": {"scale": 1, "translateXPercent": 0, "translateYPercent": 0}})
        approval.append({"sku": sku, "groupSlug": b["groupSlug"], "status": status, "note": note, "model": "gpt-image-2.5-sunburst",
                         "script": f"scripts/catalog-heroes/{src}-2026-11-03.py", "sourceRender": idx["path"],
                         "sourceRenderSha256": hashlib.sha256(open(idx["path"], "rb").read()).hexdigest(),
                         "replaces": b["url"], "url": url, "sha256": sha, "bytes": len(data), "encoding": "lossless WebP"})
        print(sku, status, url, len(data))
    open(RELEASE, "w").write(json.dumps(release, indent=2, ensure_ascii=False) + "\n")
    json.dump({"date": "2026-11-03", "approvedBy": "Jordan", "rows": approval},
              open(APPROVAL, "w"), indent=1, ensure_ascii=False)
    open(APPROVAL, "a").write("\n")


if __name__ == "__main__":
    main()

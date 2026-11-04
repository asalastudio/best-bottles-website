"""Release the 2 ml amber 13-425 black-cap catalog photograph (vial2-black-cap-2026-11-04.py): a lossless WebP, its
release row and its approval record (awaiting Jordan's review).

The row is the black-cap SKU's own photograph in the 2 ml amber group: the card shows it when the black cap is picked
(CatalogClient's pickedHero); it is listed last in catalog-heroes.ts, so the group's default card keeps the approved
white-cap hero. Writes public/images/catalog/vial2-black-cap-2026-11-04/<sku>.<sha12>.webp,
src/lib/products/catalog-hero-vial2-black-cap-2026-11-04.json and docs/hero-families/vial2-black-cap-2026-11-04/approval.json.
Usage: python3 scripts/catalog-heroes/vial2-black-cap-release-2026-11-04.py
"""
import hashlib, io, json, os, subprocess, sys
from PIL import Image

SKU = "GBVAmb1o5BlackCapSht"
SRC = "docs/hero-families/vial2-black-cap-2026-11-04/GBVAmb1o5BlackCapSht.png"
OUT = "public/images/catalog/vial2-black-cap-2026-11-04"
RELEASE = "src/lib/products/catalog-hero-vial2-black-cap-2026-11-04.json"
APPROVAL = "docs/hero-families/vial2-black-cap-2026-11-04/approval.json"


def main():
    subprocess.run([sys.executable, "scripts/catalog-heroes/vial2-black-cap-2026-11-04.py", SRC], check=True)
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        os.remove(f"{OUT}/{old}")
    img = Image.open(SRC).convert("RGB"); assert img.size == (1560, 1716), img.size
    buf = io.BytesIO(); img.save(buf, "WEBP", lossless=True, quality=100, method=6); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest(); url = f"/images/catalog/vial2-black-cap-2026-11-04/{SKU}.{sha[:12]}.webp"
    open("public" + url, "wb").write(data)
    white = next(r for r in json.load(open("src/lib/products/catalog-hero-vials-release.json")) if r["websiteSku"] == "GBVialAmb1o5WhtCapSht")
    blue = next(r for r in json.load(open("src/lib/products/catalog-hero-vials-release.json")) if r["websiteSku"] == "GBVBlu1o9BlackCapSht")
    row = {"groupSlug": white["groupSlug"], "websiteSku": SKU, "graceSku": SKU, "shopifyVariantId": "gid://shopify/ProductVariant/67997290234148",
           "family": "Vial", "capacityMl": 2, "bottleColor": "Amber", "alt": "2 ml Amber Vial with Black Screw Cap",
           "presentation": "Empty · cap beside", "url": url, "width": 1560, "height": 1716,
           "framing": {"scale": 1, "translateXPercent": 0, "translateYPercent": 0}}
    open(RELEASE, "w").write(json.dumps([row], indent=2, ensure_ascii=False) + "\n")
    approval = {"date": "2026-11-04", "requestedBy": "Jordan", "rows": [{
        "sku": SKU, "groupSlug": row["groupSlug"], "status": "awaiting-review",
        "note": "Jordan 2026-11-04 asked for a black-cap photo so the black cap can be picked on the grid",
        "method": "composite of two approved heroes; no image generated", "script": "scripts/catalog-heroes/vial2-black-cap-2026-11-04.py",
        "sources": [white["url"], blue["url"]], "sourceRender": SRC,
        "sourceRenderSha256": hashlib.sha256(open(SRC, "rb").read()).hexdigest(),
        "url": url, "sha256": sha, "bytes": len(data), "encoding": "lossless WebP"}]}
    open(APPROVAL, "w").write(json.dumps(approval, indent=1, ensure_ascii=False) + "\n")
    print(SKU, url, len(data))


if __name__ == "__main__":
    main()

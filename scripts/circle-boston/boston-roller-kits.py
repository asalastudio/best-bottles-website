"""Boston Round 30/60 ml roll-on review kits with complete roller inserts for EXPLODED.

Production's register kits for every 30/60 ml metal and plastic roll-on (register-kits.mts, read-only) keep their
seated roller, which is cut at the neck, for SIDECAR and CAP ON; each gains the complete 20-400 insert from
generate-boston-rollers.py for EXPLODED only, placed so its flange is the seated roller's flange (the stage offers
EXPLODED for a kit that carries one, stage.ts separableRoller). Rows are added to the Boston kits; run after
boston15-kits.py (which writes the file).
Usage: python3 scripts/circle-boston/boston-roller-kits.py <boston-register.json from register-kits.mts>
"""
import hashlib, json, os, sys

KITS = "public/local-kits/boston-masters-2026-11-03/kits.json"
ROLLERS = "public/local-kits/boston-masters-2026-11-03/rollers/rollers.json"


def main():
    register = json.load(open(sys.argv[1])); kits = json.load(open(KITS)); rows = kits["rows"]
    full = {r["component"]: r for r in json.load(open(ROLLERS)).values()}
    added = 0
    for sku, kit in register.items():
        seated = next((p for p in kit["parts"] if p["slot"] == "roller"), None)
        if seated is None or seated.get("componentId") not in full:
            continue
        r = full[seated["componentId"]]; f = r["registerFlange"]
        k1 = seated["box"]["width"] / (f["imageWidth"] / r["registerScale"])     # register image px -> stage px
        k = k1 / r["registerScale"]                                              # full image px (4x register px) -> stage px
        cx = seated["box"]["x"] + f["centre"] / r["registerScale"] * k1; by = seated["box"]["y"] + f["bottom"] / r["registerScale"] * k1
        path = "public" + r["file"]; data = open(path, "rb").read()
        box = {"x": round(cx - r["flangeCentre"] * k, 3), "y": round(by - r["flangeBottom"] * k, 3),
               "width": round(r["pixels"][0] * k, 3), "height": round(r["pixels"][1] * k, 3)}
        whole = {**seated, "image": {"url": r["file"], "key": "", "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                                     "width": r["pixels"][0], "height": r["pixels"][1]},
                 "image2x": None, "mask": None, "views": ["exploded"], "derivation": "sunburst-complete-insert",
                 "source": f"generate-boston-rollers.py ({seated['componentId']})", "box": box,
                 "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}}
        seated["views"] = ["sidecar", "capon"]
        kit["parts"].append(whole)
        rows[sku] = kit; added += 1
    kits["defaultPdpSkus"] = sorted(set(kits["defaultPdpSkus"]) | set(rows))
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    json.dump(kits, open(KITS, "w"), indent=1); open(KITS, "a").write("\n")
    print(f"Boston Round roll-ons with complete inserts: {added}; version {kits['version']}")


if __name__ == "__main__":
    main()

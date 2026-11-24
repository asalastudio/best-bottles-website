"""Put the levelled 18-415 reducer insert on every reducer bottle.

Jordan, 24 Nov 2026: "the reducers [are] a little bit tilted forward on some of the bottles". The shared insert
photograph was taken from slightly above, so its flange reads as tipped toward the viewer on a neck photographed
level. On 4 Nov scripts/empire-grace-diamond/flat-reducer.py made a levelled copy (the flange's underside on one
straight line) and put it into the Empire, Grace and Diamond kits only. Elegant 60/100 and Diva (live), and Circle,
Round and Sleek (localhost review kits) still used the original.

This points every remaining reducer part at the levelled copy. Same image size and the same box on each bottle:
only the pixels change. Nothing is uploaded: the levelled images were published with the Empire/Grace/Diamond
masters (docs/reviews/hosted-egd-masters-2026-11-04/asset-receipt.json), so the live kit file reuses those URLs.

Rewrites, keeping each file's formatting:
  public/local-kits/{circle,diva,elegant60-100,round-sleek}-masters-*/kits.json   and their review versions
  src/lib/products/{circle,diva,elegant60-100,round-sleek}-master.ts              the version each API route serves
  src/lib/paper-doll/approved-kits.generated.json, approved-kit-index.json        the live kits and their version
  docs/reviews/reducer-levelling-2026-11-24/release-manifest.json                 what each live part held before
Usage: python3 scripts/paperdoll/level-reducers-everywhere.py   (safe to re-run: a second run changes nothing)
"""
import hashlib, json, os, re

FLAT_DIR = "public/local-kits/egd-masters-2026-11-04/reducer"
# tilted original sha256 -> levelled file
LEVELLED = {
    "9a7c899be4dff12716d0597af4609b88143b4c5fb5e22ca1c1eb1354c1cc6e8d": f"{FLAT_DIR}/reducer-18415-seated-flat.c3ff73208e1b.png",
    "df76f6c3620dba019b9414e9dc9fab1a5de80ff49aa4ea4407ba9ea643e0a715": f"{FLAT_DIR}/reducer-18415-full-flat.5801c2af9038.png",
}
SIZES = {"9a7c899be4dff12716d0597af4609b88143b4c5fb5e22ca1c1eb1354c1cc6e8d": (316, 93),
         "df76f6c3620dba019b9414e9dc9fab1a5de80ff49aa4ea4407ba9ea643e0a715": (316, 357)}
DERIVATION = "psd-layer:levelled (flat-reducer.py)"
HOSTED = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/"
HOSTED_KEY = "reviewed-master-media/2026-11-04/{sha}.png"   # where publish-egd-masters.mjs put them
LOCAL = {   # review kits -> the constant its localhost API route checks
    "public/local-kits/circle-masters-2026-11-03/kits.json": ("src/lib/products/circle-master.ts", "CIRCLE_MASTER_REVIEW_VERSION"),
    "public/local-kits/diva-masters-2026-11-03/kits.json": ("src/lib/products/diva-master.ts", "DIVA_MASTER_REVIEW_VERSION"),
    "public/local-kits/elegant60-100-masters-2026-11-03/kits.json": ("src/lib/products/elegant60-100-master.ts", "ELEGANT60_100_MASTER_REVIEW_VERSION"),
    "public/local-kits/round-sleek-masters-2026-11-03/kits.json": ("src/lib/products/round-sleek-master.ts", "ROUND_SLEEK_MASTER_REVIEW_VERSION"),
}
APPROVED = "src/lib/paper-doll/approved-kits.generated.json"
INDEX = "src/lib/paper-doll/approved-kit-index.json"
RECORD = "docs/reviews/reducer-levelling-2026-11-24/release-manifest.json"
COMPACT = dict(separators=(",", ":"), ensure_ascii=False)


def levelled_image(sha, hosted):
    path = LEVELLED[sha]; data = open(path, "rb").read(); new = hashlib.sha256(data).hexdigest()
    assert new[:12] in path, f"{path} is not the file its name says"
    key = HOSTED_KEY.format(sha=new) if hosted else ""
    url = HOSTED + key if hosted else "/" + path.removeprefix("public/")
    return {"url": url, "key": key, "sha256": new, "bytes": len(data), "width": SIZES[sha][0], "height": SIZES[sha][1]}


def level(rows, hosted):
    """Swap every tilted reducer part for its levelled copy. Returns {sku: [what each changed part held before]}."""
    changed = {}
    for sku, kit in rows.items():
        for index, part in enumerate(kit["parts"]):
            sha = part.get("slot") == "reducer" and part["image"].get("sha256")
            if sha not in LEVELLED:
                continue
            assert (part["image"]["width"], part["image"]["height"]) == SIZES[sha], sku
            changed.setdefault(sku, []).append({"part": index, "image": part["image"], "derivation": part.get("derivation")})
            part["image"] = levelled_image(sha, hosted); part["derivation"] = DERIVATION
    return changed


def rewrite(path, dumps, update):
    """Load a JSON file, check it round-trips byte for byte, apply update, write it back the same way."""
    raw = open(path, encoding="utf-8").read(); data = json.loads(raw)
    assert raw == dumps(data), f"{path}: unexpected formatting, not rewriting"
    result = update(data)
    open(path, "w", encoding="utf-8").write(dumps(data))
    return result


def main():
    for path, (module, constant) in LOCAL.items():
        def update(kits):
            changed = level(kits["rows"], hosted=False)
            if changed:
                kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
            return changed, kits["version"]
        changed, version = rewrite(path, lambda d: json.dumps(d, indent=1, ensure_ascii=False) + "\n", update)
        source = open(module).read()
        pinned, n = re.subn(rf'({constant} = ")[0-9a-f]+(")', rf"\g<1>{version}\g<2>", source)
        assert n == 1, f"{constant} not found in {module}"
        open(module, "w").write(pinned)
        families = sorted({re.sub(r"\d.*", "", sku) for sku in changed})
        print(f"{path}: {len(changed)} reducer bottles levelled {families}; version {version}")

    def update(manifest):
        prior = manifest["version"]
        changed = level(manifest["rows"], hosted=True)
        manifest["version"] = hashlib.sha256(json.dumps(manifest["rows"], **COMPACT).encode()).hexdigest()[:16]
        return changed, prior, manifest["version"], sorted(manifest["rows"])
    changed, prior, version, skus = rewrite(APPROVED, lambda d: json.dumps(d, **COMPACT) + "\n", update)
    if changed:
        # What the live recipes held before, so earlier releases' tests can still check their own baselines
        # (tests/helpers/reducer-levelling-2026-11-24.ts) and the change can be reversed exactly.
        os.makedirs(os.path.dirname(RECORD), exist_ok=True)
        open(RECORD, "w").write(json.dumps({"priorVersion": prior, "version": version, "levelledSkus": sorted(changed),
                                            "replacedParts": dict(sorted(changed.items()))}, indent=1) + "\n")

    def reindex(index):
        assert index["skus"] == skus, "the index lists different SKUs from the kit file"
        index["version"] = version
    rewrite(INDEX, lambda d: json.dumps(d, **COMPACT) + "\n", reindex)
    families = sorted({re.sub(r"\d.*", "", sku) for sku in changed})
    print(f"{APPROVED}: {len(changed)} live reducer bottles levelled {families}; version {version}")


if __name__ == "__main__":
    main()

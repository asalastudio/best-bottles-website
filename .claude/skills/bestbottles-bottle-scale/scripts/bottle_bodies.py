"""Group a production snapshot into physical glass bodies: the bottle that governs every SKU built on it.

    python3 bottle_bodies.py [snapshot dir]      -> writes <snapshot dir>/bodies.json and prints a summary

Body key = family + capacity (ml) + neck finish + glass finish (Standard / Frosted / Swirl) + tall glass (or a
Decorative shape). Glass colour (clear, amber, cobalt...) and the fitment never change the body.

Traps learned on 2026-09-16:
  * "Tall" as a SKU PREFIX (GBTallCyl9..., GBTallRect10...) is a tall GLASS. "Tall" as a SUFFIX
    (GBDiva30RdcrMtSlTall) is a tall reducer CAP on the same glass. Only the prefix changes the body.
  * The `shape` field is mostly redundant with the family ("Cylinder", "Standard"); it only splits bodies for
    Decorative and for real sub-shapes.
  * Body ids are positional (sorted by family, capacity, neck, glass, variant). A review file refers to these
    ids, so always reconcile against the SAME snapshot the file was built from.
"""
import collections, json, math, os, re, sys

CONTAINER = {"Glass Bottle", "Glass Jar", "Cream Jar", "Aluminum Bottle", "Plastic Bottle", "Metal Atomizer"}
REDUNDANT_SHAPES = {"Standard", "Cylinder", "Vial", "Bell", "Pillar"}


def mm(s):
    """'70 ±1 mm' -> (70.0, 1.0); '50.8' -> (50.8, None); None -> (None, None)."""
    if not s:
        return None, None
    m = re.match(r"\s*([\d.]+)\s*(?:±\s*([\d.]+))?", str(s))
    return (float(m.group(1)), float(m.group(2)) if m.group(2) else None) if m else (None, None)


def glass_kind(p):
    return p["color"] if p["color"] in ("Frosted", "Swirl") else "Standard"


def is_tall_glass(p):
    return bool(re.match(r"^(GB|LB)Tall", p["websiteSku"]))


def variant(p):
    fam = p["family"] or "Unknown"
    if is_tall_glass(p):
        return "Tall"
    s = p["shape"]
    if s and (fam == "Decorative" or s not in REDUNDANT_SHAPES | {fam}):
        return s
    return ""


def body_key(p):
    return (p["family"] or "Unknown", p["capacityMl"], p["neckThreadSize"] or "", glass_kind(p), variant(p))


def repo_root():
    root = os.path.dirname(os.path.abspath(__file__))
    while root != "/" and not os.path.exists(os.path.join(root, "package.json")):
        root = os.path.dirname(root)
    return root


def default_snapshot():
    reviews = os.path.join(repo_root(), "docs", "reviews")
    snaps = sorted(x for x in os.listdir(reviews) if x.startswith("bottle-measurements-"))
    if not snaps:
        sys.exit("no docs/reviews/bottle-measurements-* snapshot; run pull_prod_measurements.mjs first")
    return os.path.join(reviews, snaps[-1])


def load_rows(snapshot_dir):
    d = json.load(open(os.path.join(snapshot_dir, "prod-products.json")))
    rows = [p for p in d["products"] if p["category"] in CONTAINER and "__RETIRED__" not in p["websiteSku"]]
    return d, rows


def build(snapshot_dir):
    d, rows = load_rows(snapshot_dir)
    groups = collections.defaultdict(list)
    for p in rows:
        groups[body_key(p)].append(p)
    bodies = []
    for key, skus in groups.items():
        fam, ml, neck, kind, var = key
        h = [mm(p["heightWithoutCap"]) for p in skus]
        hc = [mm(p["heightWithCap"])[0] for p in skus if mm(p["heightWithCap"])[0] is not None]
        dia = [mm(p["diameter"])[0] for p in skus if mm(p["diameter"])[0] is not None]
        vals = collections.Counter(v for v, _ in h if v is not None)
        truth = vals.most_common(1)[0][0] if vals else None
        tol = collections.Counter(t for v, t in h if v == truth and t is not None).most_common(1)

        def rank(p):
            v, _ = mm(p["heightWithoutCap"])
            return (v != truth, p["color"] != "Clear", not (p["measurementSource"] or "").startswith("best-bottles-master-truth"), p["websiteSku"])

        gov = sorted(skus, key=rank)[0]
        sources = collections.Counter("master truth" if (p["measurementSource"] or "").startswith("best-bottles-master-truth")
                                      else "legacy exact" if (p["measurementSource"] or "").startswith("legacy-exact") else "none" for p in skus)
        blanks = sum(1 for v, _ in h if v is None)
        odd = sorted((p for p in skus if mm(p["heightWithoutCap"])[0] not in (None, truth)), key=lambda p: p["websiteSku"])
        status, notes = "OK", []
        if truth is None:
            status = "Missing height"
        elif len(vals) > 1:
            status = "Heights disagree"
            notes.append("most common height used; fix the SKUs listed")
            if odd and all(p["websiteSku"].endswith("Sht") for p in odd):
                notes.append("all the odd ones are short-cap listings, possibly measured with the cap on")
        elif blanks:
            status = "Some SKUs blank"
        if blanks and truth is not None:
            notes.append(f"{blanks} SKU{'s' if blanks > 1 else ''} on this glass have no height recorded")
        dmax = collections.Counter(dia).most_common(1)[0][0] if dia else None
        if truth and dmax and ml:
            implied = math.pi * (dmax / 2) ** 2 * truth / 1000 * 0.6
            if ml > implied * 2.5 or ml < implied / 6:
                status = "Check height" if status == "OK" else status + "; check height"
                notes.append(f"a {dmax:g} x {truth:g} mm glass holds about {implied:.0f} ml, not {ml:g} ml")
        if any(p["websiteSku"] == "GBSpry1ozGl" for p in skus):
            status = "Check height" if status == "OK" else status
            notes.append("GBSpry1ozGl is a slim 30 ml tube; 50.8 x 42 mm cannot be right")
        if fam == "Cylinder" and ml == 5.5:
            notes.append("same 53 mm glass as the 5 ml; listed separately as 5.5 ml")
        bodies.append(dict(
            family=fam, category=collections.Counter(p["category"] for p in skus).most_common(1)[0][0], capacityMl=ml,
            neck=neck, glass=kind, shape=var, heightNoCapMm=truth, toleranceMm=tol[0][0] if tol else None,
            heightCapMinMm=min(hc) if hc else None, heightCapMaxMm=max(hc) if hc else None, diameterMm=dmax,
            governingSku=gov["websiteSku"], governingItem=gov["itemName"], colours=", ".join(sorted({p["color"] or "n/a" for p in skus})),
            skuCount=len(skus), skus=sorted(p["websiteSku"] for p in skus),
            heightsRecorded="; ".join(f"{v:g} mm × {n}" for v, n in sorted(vals.items())) + (f"; blank × {blanks}" if blanks else ""),
            oddSkus=", ".join(f'{p["websiteSku"]} ({mm(p["heightWithoutCap"])[0]:g} mm)' for p in odd[:8]) + (f", +{len(odd) - 8} more" if len(odd) > 8 else ""),
            sources="; ".join(f"{k} × {n}" for k, n in sources.most_common()), status=status, notes="; ".join(notes)))
    bodies.sort(key=lambda b: (b["family"], b["capacityMl"] or 0, b["neck"], b["glass"], b["shape"]))
    for i, b in enumerate(bodies, 1):
        b["id"] = i
    return d, rows, bodies


def skus_by_body(rows, bodies):
    ids = {(b["family"], b["capacityMl"], b["neck"], b["glass"], b["shape"]): b["id"] for b in bodies}
    out = collections.defaultdict(list)
    for p in rows:
        out[ids[body_key(p)]].append(p)
    return out


if __name__ == "__main__":
    snap = sys.argv[1] if len(sys.argv) > 1 else default_snapshot()
    d, rows, bodies = build(snap)
    json.dump(bodies, open(os.path.join(snap, "bodies.json"), "w"), indent=1)
    twins = len({(b["family"], b["capacityMl"], b["neck"], b["heightNoCapMm"], b["shape"]) for b in bodies})
    print(f"{snap}: pulled {d['pulledAt']}, {len(rows)} live container SKUs -> {len(bodies)} bodies "
          f"({twins} counting frosted/swirl twins of the same height once)")
    print("status:", dict(collections.Counter(b["status"] for b in bodies).most_common()))

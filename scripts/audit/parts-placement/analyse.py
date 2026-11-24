#!/usr/bin/env python3
"""Read-only placement audit of the component kits the storefront draws.

Input is the resolved kit set written by dump-kits.ts (every source file merged and patched the
way the app does it). Measures recorded geometry only (no pixels, no network): closure centring
and seating, dip tube / pipette start, tip, containment and layer order, anchors, distortion.
Flags are review candidates with a measured value, not verdicts.

  npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/parts-placement/dump-kits.ts /tmp/kits.json
  python3 scripts/audit/parts-placement/analyse.py /tmp/kits.json [--out audit]
"""
import argparse, csv, json, os, statistics, collections

SEATED = {"cap", "sprayer", "pump", "fitment", "reducer", "collar", "roller"}
HOLDERS = {"sprayer", "pump", "fitment", "collar", "cap"}
INTERNAL = {"diptube", "pipette"}
AXIS_TOL_PX, ASYM_PX, TUBE_AXIS_TOL_MM, DISTORT_TOL, TIP_TOL_MM = 4.0, 40.0, 3.0, 0.03, 2.0

def seated(p): v = p.get("views"); return v is None or "capon" in v
def cx(b): return (b["left"] + b["right"]) / 2
def glass(k): return (k.get("register") or {}).get("glass") or (k["familyId"].split("|")[1] if "|" in k["familyId"] else ("Frosted" if "frost" in k["familyId"].lower() else "Clear" if "clear" in k["familyId"].lower() else "?"))
def body_id(k): return k["familyId"].split("|")[0].replace("register:", "")
def tip(p):
    b = p["bounds"]["bottom"]; box = p.get("box"); t = p.get("trimBottomPct")
    return min(b, box["y"] + box["height"] * (1 - t / 100)) if box and t else b

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("kits"); ap.add_argument("--out", default="audit"); a = ap.parse_args()
    kits = sorted(json.load(open(a.kits))["rows"].items())
    out, stats = [], collections.Counter()
    def flag(sku, k, part, issue, sev, value, note):
        out.append(dict(sku=sku, body=body_id(k), glass=glass(k), slot=part["slot"] if part else "", componentId=(part or {}).get("componentId") or "",
                        issue_type=issue, severity=sev, value=round(value, 2) if isinstance(value, (int, float)) else value, notes=note))

    tips = collections.defaultdict(list)   # (body, internal slot, holder slot) -> clearance mm
    def holder_slot(live): return next((s for s in ("pump", "sprayer", "fitment", "cap") if any(p["slot"] == s for p in live)), "")
    for sku, k in kits:
        mm = k["anchors"].get("pxPerMm"); live = [p for p in k["parts"] if seated(p)]
        for p in live:
            if p["slot"] in INTERNAL and mm: tips[(body_id(k), p["slot"], holder_slot(live))].append((k["anchors"]["baselineY"] - tip(p)) / mm)
    tip_med = {key: statistics.median(v) for key, v in tips.items() if len(v) >= 3}

    for sku, k in kits:
        an = k["anchors"]; mm = an.get("pxPerMm"); axis = an.get("neckAxisX") or an["axisX"]; g = glass(k)
        live = [p for p in k["parts"] if seated(p)]; stats["kits"] += 1
        bodies = [p for p in live if p["slot"] == "body"]
        if len(bodies) != 1: flag(sku, k, None, "body_count", "Major", len(bodies), "expected exactly one body in the capped view"); continue
        body = bodies[0]; bb = body["bounds"]; h = bb["bottom"] - bb["top"]
        if abs(bb["bottom"] - an["baselineY"]) > 2: flag(sku, k, body, "body_off_baseline", "Major", bb["bottom"] - an["baselineY"], "body foot vs recorded baseline (px)")
        if abs(an["seatY"] - bb["top"]) > max(15, 0.03 * h): flag(sku, k, None, "seat_anchor_wrong", "Major", an["seatY"] - bb["top"], "recorded seat vs top of glass (px); neck callout and builder re-seating read this anchor")
        if not mm: flag(sku, k, None, "no_px_per_mm", "Minor", "", "no scale recorded; mm checks skipped")
        closures = [p for p in live if p["slot"] in SEATED]
        if not closures and not any(p["slot"] == "overcap" for p in live) and k.get("completeness") == "full":
            flag(sku, k, None, "no_closure", "Major", "", "kit marked full but nothing closes the bottle in the capped view")
        if closures and max(p["bounds"]["bottom"] for p in closures) < an["seatY"] - 2:
            flag(sku, k, None, "closure_floating", "Blocker", an["seatY"] - max(p["bounds"]["bottom"] for p in closures), "lowest closure edge is above the rim (px gap)")

        for p in live:
            b = p["bounds"]; s = p["slot"]; stats[f"parts_{s}"] += 1; img = p.get("image") or {}; box = p.get("box")
            if box and img.get("width") and img.get("height") and box["height"] and box["width"]:
                r = (box["width"] / box["height"]) / (img["width"] / img["height"])
                if abs(r - 1) > DISTORT_TOL: flag(sku, k, p, "image_distorted", "Major" if s in INTERNAL else "Minor", r, "drawn aspect / source aspect (1 = undistorted; >1 = widened or shortened)")
            if b["right"] <= b["left"] or b["bottom"] <= b["top"]: flag(sku, k, p, "empty_bounds", "Blocker", "", "zero or negative size")
            if s in SEATED:
                d = cx(b) - axis
                if abs(d) > ASYM_PX: stats["asymmetric_closures_not_axis_checked"] += 1      # bulb hose / tassel hangs to one side by design
                elif abs(d) > AXIS_TOL_PX: flag(sku, k, p, "closure_off_axis", "Major" if abs(d) > 8 else "Minor", d, "closure centre vs neck axis (px)")
                if p["zOrder"] <= body["zOrder"] and s != "roller": flag(sku, k, p, "closure_behind_body", "Major", p["zOrder"], f"body zOrder {body['zOrder']}")
            if s in INTERNAL:
                t = tip(p)
                if mm and abs(cx(b) - axis) / mm > TUBE_AXIS_TOL_MM: flag(sku, k, p, f"{s}_off_axis", "Minor", (cx(b) - axis) / mm, "centre vs neck axis (mm); may be a curved tip, needs a look")
                if b["left"] < bb["left"] or b["right"] > bb["right"]: flag(sku, k, p, f"{s}_outside_glass", "Blocker", "", "extends past the side of the glass")
                clear = an["baselineY"] - t
                if clear < 0: flag(sku, k, p, f"{s}_through_floor", "Blocker", clear, "tip below the bottle foot (px)")
                elif mm and clear / mm < 1.0: flag(sku, k, p, f"{s}_touches_floor", "Major", clear / mm, "tip within 1 mm of the outside foot (mm)")
                if (t - bb["top"]) / h < 0.6: flag(sku, k, p, f"{s}_short", "Minor", (t - bb["top"]) / h, "tip reaches less than 60% of the glass height")
                if (t - b["top"]) / h < 0.25: flag(sku, k, p, f"{s}_stub", "Blocker" if g == "Clear" else "Major", (t - b["top"]) / (mm or 1), "tube is shorter than a quarter of the glass height (length in mm)")
                key = (body_id(k), s, holder_slot(live))
                if mm and key in tip_med and abs(clear / mm - tip_med[key]) > TIP_TOL_MM:
                    flag(sku, k, p, f"{s}_tip_inconsistent", "Major", clear / mm - tip_med[key], f"tip clearance {clear / mm:.1f} mm vs {tip_med[key]:.1f} mm median for this body and closure type")
                holders = [c for c in live if c["slot"] in HOLDERS]
                if not holders: flag(sku, k, p, f"{s}_no_holder", "Blocker", "", "internal part with no sprayer, pump or dropper drawn")
                else:
                    low = max(c["bounds"]["bottom"] for c in holders)
                    if b["top"] > low + 1: flag(sku, k, p, f"{s}_gap_under_closure", "Blocker" if g == "Clear" else "Minor", b["top"] - low, "gap between closure and top of tube (px)")
                    if b["top"] < min(c["bounds"]["top"] for c in holders): flag(sku, k, p, f"{s}_above_closure", "Major", "", "starts above its closure")
                    if p["zOrder"] > max(c["zOrder"] for c in holders): flag(sku, k, p, f"{s}_over_closure", "Major", p["zOrder"], "drawn in front of its closure")
                if p["zOrder"] > body["zOrder"] and p.get("opacity") is None and p.get("blendMode") is None:
                    flag(sku, k, p, f"{s}_opaque_over_glass", "Major", p["zOrder"], "in front of the glass with no opacity or blend: reads as outside the bottle")
        n_tubes = sum(p["slot"] == "diptube" for p in live)
        if n_tubes > 1: flag(sku, k, None, "duplicate_diptube", "Major", n_tubes, "more than one tube drawn in the capped view")
        if any(p["slot"] in ("sprayer", "pump") for p in live) and not n_tubes and g != "Frosted":
            only_exploded = any(p["slot"] == "diptube" for p in k["parts"])
            flag(sku, k, None, "no_diptube_assembled", "Major" if g == "Clear" else "Minor", "", ("tube exists but only in the exploded view" if only_exploded else "no tube part at all") + f"; {g} glass")
        if any(p["slot"] == "fitment" for p in live) and "Drp" in sku and not any(p["slot"] == "pipette" for p in live) and g != "Frosted":
            flag(sku, k, None, "no_pipette_assembled", "Major" if g == "Clear" else "Minor", "", f"dropper drawn without a pipette inside the glass; {g} glass")

    os.makedirs(a.out, exist_ok=True)
    cols = ["sku", "body", "glass", "slot", "componentId", "issue_type", "severity", "value", "notes"]
    with open(os.path.join(a.out, "parts-placement.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(out)
    print(dict(stats)); print("flagged skus:", len({r["sku"] for r in out}), "of", stats["kits"])
    by = collections.defaultdict(list)
    for r in out: by[(r["severity"], r["issue_type"])].append(r)
    for (sev, issue), v in sorted(by.items(), key=lambda x: (["Blocker", "Major", "Minor"].index(x[0][0]), -len(x[1]))):
        bods = collections.Counter(f"{r['body']}|{r['glass']}" for r in v)
        print(f"{sev:8} {issue:26} skus={len({r['sku'] for r in v}):4}  " + ", ".join(f"{b} ({n})" for b, n in bods.most_common(5)) + (" …" if len(bods) > 5 else ""))

if __name__ == "__main__": main()

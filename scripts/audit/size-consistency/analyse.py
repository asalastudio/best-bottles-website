#!/usr/bin/env python3
"""Size-consistency audit: group every variant by its glass, compare on-screen glass width to the glass's
reference size, and attribute each mismatch to a cause.

Reference size per glass = median of its register variants (the standard the site is moving to); a glass
with no register variant uses the median of its layered (kit) variants, else of everything.
A variant is inconsistent when its on-screen glass width is more than 3% off the reference (visible side by
side); more than 8% is obvious at a glance.

Causes, in the order they are tested:
  photo      the variant has no layers and shows a flat photo (plate, legacy store photo or bare body),
             sized by the photo's own framing inside a smaller box
  kit        a legacy published kit on a glass the register draws: another PSD cut at another scale
  frame      layered, same image scale as the reference, but the stage shrank the whole bottle to fit a tall
             or wide closure (the frame fits the assembly, not the glass)
  image      layered, same framing, but the glass image itself is drawn at another size
               (e.g. one colour's plate or layer cut at a different scale)

  python3 scripts/audit/size-consistency/analyse.py   ->  output/size-audit/report.json
"""
from __future__ import annotations

import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / "output" / "size-audit"
# Metal atomizers are left out: metal cases, and their photos show three pieces side by side.
GLASS = {"Glass Bottle", "Glass Jar", "Aluminum Bottle", "Plastic Bottle"}
MINOR, MAJOR = 0.03, 0.08


def mm(value) -> float | None:
    m = re.match(r"\s*([\d.]+)", str(value or ""))
    return float(m.group(1)) if m else None


def glass_key(r: dict) -> str:
    slug = r.get("slug") or ""
    cap = r.get("capacityMl")
    profile = slug.split(f"-{cap}ml-")[0] if cap is not None and f"-{cap}ml-" in slug else (r.get("family") or "").lower()
    tall = " tall" if re.match(r"^(GB|LB)Tall", r.get("websiteSku") or "") else ""
    return f"{profile}{tall} {cap} ml {r.get('neck') or ''}".strip()


def glass_label(key: str, rows: list[dict]) -> str:
    fam = Counter(r.get("family") for r in rows).most_common(1)[0][0] or ""
    profile, _, rest = key.partition(" ")
    tall = "Tall " if " tall " in f" {key} " and "tall" not in profile else ""
    rest = rest.replace("tall ", "")
    name = fam if profile.replace("-", " ") == fam.lower() else profile.replace("-", " ").title()
    return f"{tall}{name} {rest}".strip()


def attribute(r: dict, ref: dict) -> str:
    if r["source"] in ("photo", "body"):
        return "photo"
    if r["source"] == "kit" and ref["hasRegister"]:
        return "kit"
    fs, rs = r.get("frameScale"), ref.get("frameScale")
    if fs and rs and abs(fs / rs - 1) > MINOR / 2:
        return "frame"
    return "image"


def analyse(rows: list[dict], *, page: str) -> dict:
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r.get("screen"):
            groups[r["key"]].append(r)
    out = []
    for key, rs in groups.items():
        reg = [r for r in rs if r["source"] == "register"]
        layered = [r for r in rs if r["source"] in ("register", "kit")]
        basis = reg or layered or rs
        ref = {
            "screen": statistics.median(r["screen"] for r in basis),
            "frameScale": statistics.median(r["frameScale"] for r in basis if r.get("frameScale")) if any(r.get("frameScale") for r in basis) else None,
            "basis": "register" if reg else "kit" if layered else "photo",
            "hasRegister": bool(reg),
        }
        for r in rs:
            r["dev"] = r["screen"] / ref["screen"] - 1
            r["cause"] = attribute(r, ref) if abs(r["dev"]) > MINOR else None
        off = [r for r in rs if r["cause"]]
        out.append({
            "key": key, "label": glass_label(key, rs), "family": Counter(r.get("family") for r in rs).most_common(1)[0][0],
            "variants": len(rs), "reference": ref,
            "sources": dict(Counter(r["source"] for r in rs)),
            "off": len(off), "major": sum(1 for r in off if abs(r["dev"]) > MAJOR),
            "causes": dict(Counter(r["cause"] for r in off)),
            "worst": max((abs(r["dev"]) for r in rs), default=0),
            "rows": sorted(({k: r.get(k) for k in ("websiteSku", "sku", "color", "applicator", "fitment", "closure", "capColor", "source", "dev", "cause", "screen", "frameScale", "fallback", "slug", "stage")}
                            for r in rs), key=lambda x: -abs(x["dev"])),
        })
    out.sort(key=lambda g: (-g["off"], -g["worst"]))
    variants = [r for g in groups.values() for r in g]
    summary = {
        "page": page,
        "glasses": len(out),
        "glassesInconsistent": sum(1 for g in out if g["off"]),
        "glassesMajor": sum(1 for g in out if g["major"]),
        "variants": len(variants),
        "variantsOff": sum(1 for r in variants if r["cause"]),
        "variantsMajor": sum(1 for r in variants if r["cause"] and abs(r["dev"]) > MAJOR),
        "byCause": dict(Counter(r["cause"] for r in variants if r["cause"])),
        "byCauseMajor": dict(Counter(r["cause"] for r in variants if r["cause"] and abs(r["dev"]) > MAJOR)),
        "sources": dict(Counter(r["source"] for r in variants)),
        "bigger": sum(1 for r in variants if r["cause"] and r["dev"] > 0),
        "smaller": sum(1 for r in variants if r["cause"] and r["dev"] < 0),
    }
    return {"summary": summary, "glasses": out}


def main() -> None:
    pdp = json.loads((OUT / "pdp-measured.json").read_text())
    byb = json.loads((OUT / "byb-measured.json").read_text())
    pdp_rows = []
    for r in pdp:
        if r.get("category") not in GLASS or not r.get("screen"):
            continue
        r["key"] = glass_key(r)
        r["frameScale"] = (r.get("frame") or {}).get("scale")
        pdp_rows.append(r)
    byb_rows = []
    for r in byb:
        if r.get("stage") != "complete" or not r.get("screen"):
            continue
        r["key"] = r["bodyId"]
        r["websiteSku"] = r.get("sku")
        byb_rows.append(r)
    byb_body = []
    for r in byb:
        if r.get("stage") != "body" or not r.get("screen"):
            continue
        r["key"] = r["bodyId"]
        r["websiteSku"] = r.get("sku")
        byb_body.append(r)

    # Photoshop-sourced images (published kit layers and plates): glass px per mm on the 1000 x 1100 canvas,
    # per plate family (one PSD set). Register plates are drawn by px/mm and are not part of this check.
    measures = json.loads((OUT / "measures.json").read_text())
    psd = defaultdict(list)
    for r in pdp:
        if r.get("category") not in GLASS:
            continue
        d = mm(r.get("diameter"))
        if not d:
            continue
        if r["source"] == "kit" and r.get("glassCanvasPx"):
            fam = r["body"]["url"].split("/kits/")[1].split("/")[0] if "/kits/" in r["body"]["url"] else "kit"
            psd[(glass_key(r), "kit layer")].append({"sku": r["websiteSku"], "pxPerMm": r["glassCanvasPx"] / d, "color": r["color"]})
        elif r["source"] in ("photo", "body") and r.get("fallback") and "/plates/" in (r.get("fallback") or ""):
            m = measures.get(r["fallback"])
            if m and m.get("imgW") == 1000:
                psd[(glass_key(r), "plate")].append({"sku": r["websiteSku"], "pxPerMm": m["width"] / d, "color": r["color"]})
    psd_out = []
    for (key, kind), xs in psd.items():
        med = statistics.median(x["pxPerMm"] for x in xs)
        for x in xs:
            x["dev"] = x["pxPerMm"] / med - 1
        psd_out.append({"key": key, "kind": kind, "n": len(xs), "pxPerMm": med,
                        "spread": max(x["pxPerMm"] for x in xs) / min(x["pxPerMm"] for x in xs) - 1,
                        "off": sorted([x for x in xs if abs(x["dev"]) > 0.05], key=lambda x: -abs(x["dev"]))})
    psd_out.sort(key=lambda g: -g["spread"])

    report = {
        "pdp": analyse(pdp_rows, page="Product page"),
        "byb": analyse(byb_rows, page="Build Your Bottle (chosen SKU)"),
        "bybBody": analyse(byb_body, page="Build Your Bottle (glass step)"),
        "psd": psd_out,
        "geometry": json.loads((OUT / "geometry.json").read_text()),
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=1))
    for part in ("pdp", "byb", "bybBody"):
        print(json.dumps(report[part]["summary"]))


if __name__ == "__main__":
    main()

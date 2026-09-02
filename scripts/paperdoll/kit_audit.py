#!/usr/bin/env python3
"""
Kit audit — a dry run over the chosen PSD sources that measures, without
rendering anything, how many SKUs can yield a component kit automatically.

    python3 scripts/paperdoll/kit_audit.py [--limit N] [--family <familyId>]   -> data/paper-doll/kit-audit.json, kit-audit-report.md

Per publishable SKU it opens the capped PSD (and the uncapped sibling when
one exists) with psd-tools and records, per layer: name, kind, visibility,
bounds, whether it looks like a background (no alpha or ≥ 98 % of the canvas
at ≥ 98 % solidity), and whether it is drawn on the bottle's axis or beside
it. From that it derives the completeness the kit builder would reach:

    full      body + every slot the closure token opens is a separate drawn layer
    capSplit  body + one removable part
    bodyOnly  a single flattened layer — a plate, not a kit
    review    parts present but a rule failed (fused retouch card, hidden layers, adjustment layers)

and, for pairs, whether the capped and uncapped files share a pixel-identical
body layer (alpha IoU ≥ 0.98), which is what lets the kit skip anchoring.
Nothing here decides anything: the numbers size Phase 5 and the report lists
every SKU with its reason.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from psd_tools import PSDImage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_tokens import CLOSURES, parse_sku  # noqa: E402

REPO = HERE.parents[1]
DATA = REPO / "data" / "paper-doll"
SOURCES = json.loads((DATA / "sources.json").read_text())
SLOTS = {token: meta["slots"] for token, meta in CLOSURES}


def layer_facts(psd, layer, canvas_w, canvas_h, body_axis_x=None):
    """Facts for one layer without compositing the document."""
    try:
        img = layer.topil()          # composites the layer with its mask, RGBA where the file has alpha
    except Exception as error:  # noqa: BLE001
        return {"name": layer.name, "kind": layer.kind, "visible": layer.visible, "error": type(error).__name__}
    fact = {"name": layer.name, "kind": layer.kind, "visible": layer.visible, "bbox": [layer.left, layer.top, layer.right, layer.bottom],
            "opacity": layer.opacity, "hasMask": layer.has_mask()}
    if img is None:
        fact["empty"] = True
        return fact
    w, h = img.size
    area = w * h
    fact["areaFrac"] = round(area / max(1, canvas_w * canvas_h), 3)
    if img.mode == "RGBA":
        alpha = np.asarray(img.getchannel("A"))
        solid = float((alpha > 250).mean())
        fact["solidity"] = round(solid, 3)
        fact["hasAlpha"] = True
        ink = alpha > 128
    else:
        fact["hasAlpha"] = False
        fact["solidity"] = 1.0
        gray = np.asarray(img.convert("L"))
        ink = gray < 245
    fact["background"] = (not fact["hasAlpha"]) or (fact["areaFrac"] >= 0.98 and fact["solidity"] >= 0.98)
    ys, xs = np.where(ink)
    if len(xs):
        fact["inkBox"] = [int(xs.min()) + layer.left, int(ys.min()) + layer.top, int(xs.max()) + layer.left, int(ys.max()) + layer.top]
        fact["inkPixels"] = int(len(xs))
    else:
        fact["inkBox"] = None
        fact["inkPixels"] = 0
    return fact


def audit_file(path: Path) -> dict:
    psd = PSDImage.open(str(path))
    w, h = psd.width, psd.height
    layers = []
    adjustment = 0
    hidden = 0
    for layer in psd.descendants():
        if layer.is_group():
            continue
        if layer.kind in ("adjustment", "fill", "type", "shape"):
            adjustment += 1
        if not layer.visible:
            hidden += 1
        layers.append(layer_facts(psd, layer, w, h))
    parts = [l for l in layers if l.get("inkPixels", 0) > 0 and not l.get("background") and l.get("visible")]
    # the body is the tallest on-canvas part; on-axis = a part whose ink-box centre sits within 6 % of the body's width of the body axis
    body = max(parts, key=lambda l: (l["inkBox"][3] - l["inkBox"][1]) if l.get("inkBox") else 0) if parts else None
    if body and body.get("inkBox"):
        bx0, _, bx1, _ = body["inkBox"]
        axis = (bx0 + bx1) / 2
        width = max(1, bx1 - bx0)
        for l in parts:
            cx = (l["inkBox"][0] + l["inkBox"][2]) / 2
            l["drawn"] = "body" if l is body else ("on-axis" if abs(cx - axis) <= 0.06 * width + 4 else "beside")
    return {"canvas": [w, h], "layerCount": len(layers), "adjustmentLayers": adjustment, "hiddenLayers": hidden,
            "backgrounds": sum(1 for l in layers if l.get("background")), "parts": len(parts),
            "onAxis": sum(1 for l in parts if l.get("drawn") == "on-axis"), "beside": sum(1 for l in parts if l.get("drawn") == "beside"),
            "layers": layers}


def body_alpha(path: Path):
    """The tallest visible non-background layer's alpha at full resolution, placed on the canvas."""
    psd = PSDImage.open(str(path))
    best = None
    for layer in psd.descendants():
        if layer.is_group() or not layer.visible:
            continue
        img = layer.topil()
        if img is None or img.mode != "RGBA":
            continue
        a = np.asarray(img.getchannel("A")) > 128
        if a.mean() > 0.97:
            continue
        height = a.any(axis=1).sum()
        if best is None or height > best[0]:
            best = (height, layer.left, layer.top, a)
    if best is None:
        return None
    # the two files of a pair are different CROPS of one shot, so compare the body by its own ink box,
    # not by canvas position
    _, left, top, a = best
    ys, xs = np.where(a)
    if len(xs) == 0:
        return None
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def alpha_iou(a, b, tolerance: int = 3):
    """IoU of two bbox-cropped masks; sizes within `tolerance` px are padded to match, larger differences are a different body."""
    if a is None or b is None:
        return None, "no_body_layer"
    if abs(a.shape[0] - b.shape[0]) > tolerance or abs(a.shape[1] - b.shape[1]) > tolerance:
        return 0.0, f"size {a.shape[1]}x{a.shape[0]} vs {b.shape[1]}x{b.shape[0]}"
    h, w = max(a.shape[0], b.shape[0]), max(a.shape[1], b.shape[1])
    pa = np.zeros((h, w), dtype=bool); pa[:a.shape[0], :a.shape[1]] = a
    pb = np.zeros((h, w), dtype=bool); pb[:b.shape[0], :b.shape[1]] = b
    return float((pa & pb).sum() / max(1, (pa | pb).sum())), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--family", action="append")
    args = ap.parse_args()
    started = time.time()
    sel = json.loads((DATA / "selection.json").read_text())
    xref = json.loads((DATA / "xref.json").read_text())
    todo = [r for r in xref["products"] if r["publishable"] and (r.get("renderMode") or "registered") == "registered"]
    if args.family:
        todo = [r for r in todo if r["familyId"] in args.family]
    if args.limit:
        todo = todo[: args.limit]

    results = []
    for i, rec in enumerate(todo):
        entry = sel["stems"][rec["stemKey"]]
        parsed = parse_sku(rec["websiteSku"])
        expected = SLOTS.get(parsed["closure"] or "", [])
        out = {"websiteSku": rec["websiteSku"], "familyId": rec["familyId"], "closure": parsed["closure"], "expectedSlots": expected}
        for state in ("on", "off"):
            st = entry["states"].get(state)
            if not st or not st.get("chosen"):
                continue
            path = Path(SOURCES["libraries"][st["chosenLibrary"]]["root"]) / st["chosenPath"]
            try:
                facts = audit_file(path)
            except Exception as error:  # noqa: BLE001
                out[state] = {"error": type(error).__name__, "path": st["chosenPath"]}
                continue
            facts["path"] = st["chosenPath"]
            facts.pop("layers")
            out[state] = facts
        on = out.get("on") or {}
        parts = on.get("parts", 0)
        need = 1 + len(expected)
        if "error" in on or not on:
            out["completeness"] = "unreadable"
        elif on.get("adjustmentLayers", 0) or on.get("hiddenLayers", 0):
            out["completeness"] = "review"
        elif parts >= need and need > 1:
            out["completeness"] = "full"
        elif parts >= 2:
            out["completeness"] = "capSplit"
        else:
            out["completeness"] = "bodyOnly"
        if "on" in out and "off" in out and "error" not in out["on"] and "error" not in out["off"]:
            try:
                a = body_alpha(Path(SOURCES["libraries"][entry["states"]["on"]["chosenLibrary"]]["root"]) / entry["states"]["on"]["chosenPath"])
                b = body_alpha(Path(SOURCES["libraries"][entry["states"]["off"]["chosenLibrary"]]["root"]) / entry["states"]["off"]["chosenPath"])
                iou, note = alpha_iou(a, b)
                if iou is None:
                    out["pairSharedBody"] = None
                    out["pairNote"] = note
                else:
                    out["pairBodyIoU"] = round(iou, 4)
                    out["pairSharedBody"] = iou >= 0.98
                    if note:
                        out["pairNote"] = note
            except Exception as error:  # noqa: BLE001
                out["pairSharedBody"] = None
                out["pairError"] = type(error).__name__
        results.append(out)
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(todo)} ({time.time() - started:.0f}s)", file=sys.stderr)

    completeness = Counter(r["completeness"] for r in results)
    shared = Counter(str(r.get("pairSharedBody")) for r in results if "off" in r)
    by_family = defaultdict(Counter)
    for r in results:
        by_family[r["familyId"]][r["completeness"]] += 1
    out = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "builderVersion": "kit_audit 1.0.0", "audited": len(results),
           "completeness": dict(completeness), "pairSharedBody": dict(shared), "results": results}
    (DATA / "kit-audit.json").write_text(json.dumps(out, indent=1))
    lines = [f"# Kit audit — {out['generatedAt']}", "", f"audited {len(results)} publishable registered SKUs in {time.time() - started:.0f}s",
             f"completeness: {dict(completeness)}", f"pairs with a shared body layer (IoU ≥ 0.98): {dict(shared)}", "",
             "| familyId | full | capSplit | bodyOnly | review | unreadable |", "|---|---:|---:|---:|---:|---:|"]
    for fid in sorted(by_family):
        c = by_family[fid]
        lines.append(f"| {fid} | {c['full']} | {c['capSplit']} | {c['bodyOnly']} | {c['review']} | {c['unreadable']} |")
    (DATA / "kit-audit-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:6]))


if __name__ == "__main__":
    main()

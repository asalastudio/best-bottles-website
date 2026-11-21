#!/usr/bin/env python3
"""Read-only snapshot of the production component register for the neck-finish builders.

    python3 scripts/help/snapshot_register.py 18-415 17-415 ...

For each neck: every component's generic master layers (registerComponents) and
the bare-glass plate of each interchangeable bottle (registerBodyPlates), via
`npx convex run --prod register:componentsForNeck` and `register:body`. Queries
only; nothing is written to Convex. Output: data/help/register-<neck>-<date>.json
(public Blob URLs and geometry), the input to scripts/help/build_fit_media.py.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run(fn: str, args: dict):
    out = subprocess.run(["npx", "convex", "run", "--prod", fn, json.dumps(args)], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def snapshot(neck: str) -> Path:
    fit = json.loads((ROOT / "src/lib/help/fit-index.generated.json").read_text())
    bodies = [b["id"] for b in fit["bodies"] if b["neck"] == neck and b["interchangeable"]]
    components = {}
    for c in run("register:componentsForNeck", {"neck": neck}):
        if c.get("status") != "current":
            continue
        layers = [{"slot": l["slot"], "z": l.get("z"), "anchor": l["anchor"], "pxPerMm": l["pxPerMm"], "url": l["image"]["url"],
                   "width": l["image"]["width"], "height": l["image"]["height"]} for l in c.get("layers") or [] if not l.get("bodyId")]
        if layers:
            components[c["componentId"]] = {"websiteSku": c.get("websiteSku"), "layers": layers}
    plates = {}
    for body in bodies:
        result = run("register:body", {"bodyId": body}) or {}
        for p in result.get("plates", []):
            plates[p["plateKey"]] = {"url": p["image"]["url"], "width": p["image"]["width"], "height": p["image"]["height"],
                                     "pxPerMm": p["pxPerMm"], "anchors": p["anchors"]}
    today = date.today().isoformat()
    path = ROOT / "data" / "help" / f"register-{neck}-{today}.json"
    path.write_text(json.dumps({"_about": f"Read-only snapshot of the production component register for {neck} (generic component layers and bottle plates), taken {today} with scripts/help/snapshot_register.py. Public Blob URLs and geometry only.",
                                "takenOn": today, "neck": neck, "components": components, "plates": plates}, indent=1) + "\n")
    print(f"{neck}: {len(components)} components with layers, {len(plates)} plates -> {path.relative_to(ROOT)}")
    return path


if __name__ == "__main__":
    for neck in sys.argv[1:]:
        snapshot(neck)

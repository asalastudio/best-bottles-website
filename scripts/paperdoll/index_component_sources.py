#!/usr/bin/env python3
"""Read-only Desktop/client-master source candidates for an exact catalog audit.

Filename candidates are not identity/fit approval. Only image/artwork filenames
are inspected; unrelated Desktop documents are neither opened nor copied.
"""
import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path


def key(stem):
    # Strip list numbering without stripping the 17 in a real 17-415 SKU.
    stem = re.sub(r"^\d+(?:\.\s*|\)\s+)", "", stem)
    stem = re.sub(r" copy(?: \d+)?$", "", stem, flags=re.I)
    return re.sub(r"[^a-z0-9]", "", stem.lower())


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--audit", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--desktop", type=Path, required=True)
    ap.add_argument("--client-master", type=Path, required=True)
    args = ap.parse_args()
    components = json.loads((args.audit / "component-reconciliation.json").read_text())
    readiness = json.loads((args.audit / "readiness.json").read_text())
    sources = defaultdict(list)
    scanned = {}
    for kind, root in [("desktop-master", args.desktop), ("client-master", args.client_master)]:
        count = 0
        for p in sorted(root.rglob("*")):
            if not p.is_file() or p.suffix.lower() not in {".psd", ".psb", ".png", ".webp", ".jpg", ".jpeg", ".tif", ".tiff", ".gif"}:
                continue
            if p.name.startswith("."):
                continue
            count += 1
            sources[key(p.stem)].append({"root": kind, "path": str(p), "bytes": p.stat().st_size})
        scanned[kind] = {"root": str(root), "artworkFilenames": count}
    # Explicit source-name alternatives already inspected as native hardware.
    aliases = {"Spry17-415" + finish: "17-415Sp" + finish for finish in ["Blk", "Gl", "MattSl", "ShnSl", "Red", "Tur"]}
    aliases.update({"Ltn17-415" + finish: "17-415Lt" + finish for finish in ["Blk", "Gl", "MattSl"]})
    aliases.update({"CP13-415" + finish: "13-415Cp" + finish
                    for finish in ["BlkShShtMtl", "CuSht", "GlMattSht", "GlSht", "SlMattSht", "SlSht"]})
    rows = []
    for role, records in [("component", components["records"]), ("assembly", readiness["records"])]:
        for r in records:
            sku = r.get("websiteSku", r.get("sku"))
            direct = sources.get(key(sku), [])
            alternate = sources.get(key(aliases[sku]), []) if sku in aliases else []
            candidates = [{**p, "match": "normalized-exact-filename"} for p in direct]
            candidates += [{**p, "match": "explicit-alternate-filename-candidate"} for p in alternate]
            rows.append({"role": role, "sku": sku, "family": r.get("family"),
                         "sourceUrl": r.get("sourceUrl"), "candidates": candidates,
                         "status": "source candidates located; identity, layers and per-bottle fit require review" if candidates else "source matching pending; inspect alternate filenames and embedded layers",
                         "publishedByThisInventory": False})
    args.out.mkdir(parents=True, exist_ok=True)
    report = {"catalogSnapshotAt": readiness["checkedAt"], "roots": scanned,
              "policy": "Prefer Desktop master; client master is an allowed fallback. No source modification, generation, publication or fit approval.",
              "summary": [{"role": role, "rows": sum(r["role"] == role for r in rows),
                           "withCandidates": sum(r["role"] == role and bool(r["candidates"]) for r in rows),
                           "withDesktopCandidates": sum(r["role"] == role and any(c["root"] == "desktop-master" for c in r["candidates"]) for r in rows)}
                          for role in ["component", "assembly"]], "rows": rows}
    (args.out / "source-candidates.json").write_text(json.dumps(report, indent=2) + "\n")
    with (args.out / "source-candidates.csv").open("w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["role", "sku", "family", "status", "desktopCandidates", "clientCandidates", "sourceUrl"])
        for r in rows:
            writer.writerow([r["role"], r["sku"], r["family"], r["status"],
                             " | ".join(c["path"] for c in r["candidates"] if c["root"] == "desktop-master"),
                             " | ".join(c["path"] for c in r["candidates"] if c["root"] == "client-master"), r["sourceUrl"]])
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()

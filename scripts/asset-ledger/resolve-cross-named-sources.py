#!/usr/bin/env python3
"""Pin an exact front source for SKUs whose photograph is filed under two product names.

The master library holds, for several Round lotion bottles, one photograph saved
under BOTH a sprayer name and a lotion name, for example the same bytes as
"57. GBRndFrst128SpryCu.psd" and "58. LBRndFrst128LtnCu.psd". A file filed under
two contradictory product names cannot identify either, so the renderer refuses
it, which is correct.

Each of these SKUs also has a file named only for itself. This resolves that file
by evidence rather than by guessing: among the files whose basename IS the SKU,
it drops any whose exact bytes also appear under a different SKU's name, and
keeps the rest. A capped path wins over an uncapped one, because the plate front
is the capped photograph. Anything still ambiguous is reported, never picked.

Writes data/paper-doll/family-policies/<Family>.json with a frontSourcePins block
carrying the chosen path, its sha256, the rejected twin and why.

    python3 scripts/asset-ledger/resolve-cross-named-sources.py --family Round --sku LBRndFrst128LtnCu ...
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for block in iter(lambda: fp.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def basename_sku(path: Path) -> str:
    """'57. GBRndFrst128SpryCu.psd' -> 'GBRndFrst128SpryCu'."""
    return re.sub(r"^\d+[.\s]+", "", path.stem).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", required=True)
    ap.add_argument("--sku", action="append", required=True)
    ap.add_argument("--write", action="store_true", help="write the policy file (default: report only)")
    args = ap.parse_args()

    by_name: dict[str, list[Path]] = defaultdict(list)
    for path in MASTER.rglob("*.psd"):
        by_name[basename_sku(path).lower()].append(path)

    # every sha in the library, and which names carry it
    names_by_sha: dict[str, set[str]] = defaultdict(set)
    wanted_shas: dict[Path, str] = {}
    for sku in args.sku:
        for path in by_name.get(sku.lower(), []):
            digest = sha256(path)
            wanted_shas[path] = digest
            names_by_sha[digest].add(basename_sku(path))
    # A twin under another name lives beside its original, so hashing the wanted
    # files' own directories finds every cross-named copy without hashing 5,934 PSDs.
    neighbours = {p.parent for p in wanted_shas}
    for parent in neighbours:
        for path in parent.glob("*.psd"):
            if path in wanted_shas:
                continue
            digest = sha256(path)
            if digest in names_by_sha:
                names_by_sha[digest].add(basename_sku(path))

    pins, unresolved = {}, []
    for sku in args.sku:
        candidates = by_name.get(sku.lower(), [])
        rows = []
        for path in candidates:
            digest = wanted_shas[path]
            others = sorted(names_by_sha[digest] - {basename_sku(path)})
            rows.append({"path": str(path.relative_to(MASTER)), "sha256": digest, "bytes": path.stat().st_size, "alsoFiledAs": others})
        unique = [r for r in rows if not r["alsoFiledAs"]]
        capped = [r for r in unique if "uncapped" not in r["path"].lower() and "capped" in r["path"].lower()]
        pick = (capped or unique)
        print(f"\n{sku}: {len(rows)} file(s) named for it, {len(unique)} unique to it")
        for r in rows:
            mark = "  <- pinned" if pick and r is pick[0] else ("  (also filed as " + ", ".join(r["alsoFiledAs"]) + ")" if r["alsoFiledAs"] else "")
            print(f"   {r['sha256'][:12]} {r['bytes']:>9,}  {r['path'][-66:]}{mark}")
        if len(pick) != 1:
            unresolved.append(sku)
            print(f"   !! {'no file unique to this SKU' if not pick else str(len(pick)) + ' unique files, needs a human choice'}")
            continue
        chosen = pick[0]
        rejected = [r for r in rows if r["alsoFiledAs"]]
        pins[sku] = {
            "relPath": chosen["path"],
            "sha256": chosen["sha256"],
            "bytes": chosen["bytes"],
            "reason": "the front source the crosswalk picked is one photograph filed under two product names, so it cannot identify either",
            "rejected": [{"relPath": r["path"], "sha256": r["sha256"], "alsoFiledAs": r["alsoFiledAs"]} for r in rejected],
            "evidence": "byte comparison of the master library, 2026-09-18; this file's name belongs to this SKU alone",
            "reviewedBy": "Jordan · chose per-SKU pins over a global rule, chat 2026-09-18",
        }

    print(f"\npinned {len(pins)} of {len(args.sku)}; unresolved: {', '.join(unresolved) if unresolved else 'none'}")
    if not args.write:
        print("report only. Re-run with --write to save the policy.")
        return
    policy_path = ROOT / f"data/paper-doll/family-policies/{args.family}.json"
    policy = json.loads(policy_path.read_text()) if policy_path.exists() else {"family": args.family}
    policy["confirmedAt"] = "2026-09-18"
    policy.setdefault("evidence", []).append(
        "2026-09-18: several Round lotion bottles share exact bytes with a sprayer file of another name. Jordan chose per-SKU pins rather than a library-wide rule.")
    policy["frontSourcePins"] = {**policy.get("frontSourcePins", {}), **pins}
    policy_path.parent.mkdir(parents=True, exist_ok=True)
    policy_path.write_text(json.dumps(policy, indent=1) + "\n")
    print(f"wrote {policy_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Run the existing plate pipeline in a scoped, isolated, master-only batch.

No publishing or database mutations. Example:
  python3 scripts/paperdoll/family_batch.py --family Cylinder \
    --catalog dist/paper-doll/cylinder-master/catalog.json \
    --out dist/paper-doll/cylinder-master --stage prepare

Stages: prepare (fresh source hashes, dedupe, exact catalog crosswalk),
plates (registered renders), audit-kits (inspect actual PSD layers).
The existing global data/paper-doll inventory and other families are untouched.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import inventory
from pdlib.psdmeta import psd_layers, sha256_of

REPO = HERE.parents[1]
DATA = REPO / "data/paper-doll"
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")


def checked_source(path: Path, master: Path = MASTER) -> Path:
    root = master.resolve(strict=True)
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root):
        raise ValueError(f"Source escapes the master: {path}")
    return resolved


def apply_front_source_pins(target: Path, policy: dict) -> list[dict]:
    """Give a SKU its own identity when the library filed one photograph under two names.

    dedupe groups spellings that share a photograph, so a lotion bottle whose
    file is byte-identical to a sprayer's ends up inheriting the sprayer as its
    front, and the renderer rightly refuses it. A pin splits that group: the
    pinned SKU gets its own stem pointing at the file named for it alone, and
    the other spelling keeps the stem it had. The pinned bytes are re-hashed
    here, so a policy that has drifted from the disk fails loudly.
    """
    pins = policy.get("frontSourcePins") or {}
    if not pins:
        return []
    from psd_tools import PSDImage
    selection = json.loads((target / "selection.json").read_text())
    stems = selection["stems"]
    applied = []
    for sku, pin in sorted(pins.items()):
        source = checked_source(MASTER / pin["relPath"])
        digest = sha256_of(str(source))
        if digest != pin["sha256"]:
            raise ValueError(f"pinned front source for {sku} no longer matches the policy hash: {pin['relPath']}")
        holder_key = next((k for k, v in stems.items() if sku in v.get("stems", [])), None)
        if holder_key is None:
            raise ValueError(f"pinned SKU {sku} has no stem to pin")
        holder = stems[holder_key]
        psd = PSDImage.open(str(source))
        state = {
            "chosen": digest,
            "chosenPath": pin["relPath"],
            "chosenLibrary": "master",
            "chosenCanvas": [psd.width, psd.height],
            "stateEvidence": "explicit",
            "alternates": [],
            "locations": [f"master:{pin['relPath']}"],
            "samePhotograph": True,
        }
        others = [name for name in holder.get("stems", []) if name != sku]
        if others:
            # the shared photograph still belongs to the other spelling: split
            holder["stems"] = others
            key = stem_key(sku)
            stems[key] = {"stems": [sku], "role": holder.get("role", "product"), "states": {"on": state}}
            applied.append({"sku": sku, "action": "split from " + holder_key, "source": pin["relPath"]})
        else:
            holder.setdefault("states", {})["on"] = state
            applied.append({"sku": sku, "action": "pinned in place", "source": pin["relPath"]})
    (target / "selection.json").write_text(json.dumps(selection, indent=1))
    (target / "front-source-pins.json").write_text(json.dumps({"applied": applied, "pins": pins}, indent=1))
    for row in applied:
        print(f"   pinned {row['sku']}: {row['action']} -> {row['source']}", flush=True)
    return applied


def family_products(snapshot, family):
    groups = {g["_id"]: g for g in snapshot["groups"]}
    return [p for p in snapshot["products"] if p.get("family") == family
            or groups.get(p.get("productGroupId"), {}).get("family") == family]


def stem_key(value):
    return inventory.normalise_stem(value + ".psd", known_prefixes=inventory.KNOWN_PREFIXES).stem_key


def apply_catalog_policy(row, product, group, policy):
    standalone = row["websiteSku"] in policy.get("standaloneAssemblies", [])
    row["kitApplicability"] = "notApplicable" if standalone else "requiresLayerAudit"
    if standalone:
        # Preserve the established group route for a complete product. Its
        # absence of a threaded interface is not a missing component mapping.
        row["familyId"] = group.get("slug")
        row["blockReasons"] = [b for b in row["blockReasons"] if b != "familyId:missing:neck"]
        if not row["familyId"]:
            row["blockReasons"].append("standalone_missing_group_route")
    expected = policy.get("capacityConstraints", {}).get(row["websiteSku"])
    if expected is not None and product.get("capacityMl") != expected:
        row["blockReasons"].append(f"confirmed_capacity_conflict:catalog={product.get('capacityMl')},confirmed={expected}")


def prepare(catalog: Path, out: Path, family: str):
    snapshot = json.loads(catalog.read_text())
    products = family_products(snapshot, family)
    if not products:
        raise ValueError(f"No exact catalog family {family!r}")
    sku_counts = Counter(p.get("websiteSku") for p in products)
    invalid = [sku for sku, count in sku_counts.items() if not sku or count != 1]
    if invalid:
        raise ValueError(f"Resolve missing or duplicate exact website SKUs before rendering: {invalid}")
    target = out / "input"
    target.mkdir(parents=True, exist_ok=True)
    for filename in ("sources.json", "alias-map.json", "phash-cache.json", "tokens.json"):
        shutil.copyfile(DATA / filename, target / filename)
    # Reviewed cap states travel with the batch: dedupe reads them from its data dir.
    if (DATA / "cap-state-overrides.json").exists():
        shutil.copyfile(DATA / "cap-state-overrides.json", target / "cap-state-overrides.json")
    source_config = json.loads((target / "sources.json").read_text())
    if set(source_config["libraries"]) != {"master"} or Path(source_config["libraries"]["master"]["root"]).resolve() != MASTER.resolve():
        raise ValueError("The batch requires the canonical master-only source configuration")
    skus = {p.get("websiteSku") for p in products if p.get("websiteSku")}
    aliases = json.loads((target / "alias-map.json").read_text())
    names = set(skus)
    # Include both sides as candidates; xref still decides whether an alias is approved.
    for left, right in aliases.items():
        if left in skus or right in skus:
            names.update((left, right))
    wanted = {stem_key(n) for n in names}
    files = []
    scanned = 0
    for dirpath, dirs, filenames in os.walk(MASTER):
        dirs[:] = sorted(d for d in dirs if d not in source_config["skipPathSegments"])
        relative_dir = str(Path(dirpath).relative_to(MASTER))
        if relative_dir == ".":
            relative_dir = ""
        for filename in sorted(filenames):
            if filename.startswith("._") or Path(filename).suffix.lower() != ".psd":
                continue
            scanned += 1
            normalized = inventory.normalise_stem(filename, known_prefixes=inventory.KNOWN_PREFIXES)
            if normalized.stem_key not in wanted:
                continue
            path = checked_source(Path(dirpath) / filename)
            meta = psd_layers(str(path))
            row = inventory.classify("master", relative_dir, filename, "psd", meta)
            stat = path.stat()
            digest = sha256_of(str(path))
            row.update({"library": "master", "relPath": str(path.relative_to(MASTER)),
                        "dirKey": inventory.map_pua(relative_dir), "fileName": filename, "ext": "psd",
                        "bytes": stat.st_size, "mtime": int(stat.st_mtime), "sha256": digest,
                        "canvas": {"w": meta.width, "h": meta.height}, "channels": meta.channels,
                        "depth": meta.depth, "layerCount": meta.layer_count, "layerNames": meta.layer_names,
                        "hasTextLayers": meta.has_text_layers, "hasAlphaChannel": meta.has_alpha_channel,
                        "metaError": meta.error,
                        "canvasClass": "hires" if meta.width * meta.height >= 12_000_000 else "std",
                        "assetId": f"{digest[:16]}:{len(files)}"})
            files.append(row)
            if len(files) % 100 == 0:
                print(f"Hashed {len(files)} scoped master PSDs", flush=True)
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    (target / "inventory.json").write_text(json.dumps({"generatedAt": now, "builderVersion": "family_batch 1",
        "hashed": True, "partial": True, "scope": family, "masterFilesScanned": scanned, "files": files}, indent=1))
    (target / "convex-snapshot.json").write_text(json.dumps({**snapshot, "products": products}, indent=1))
    import dedupe
    dedupe.DATA = target
    dedupe.PHASH_CACHE = target / "phash-cache.json"
    dedupe.main()
    policy_path = DATA / "family-policies" / f"{family}.json"
    policy = json.loads(policy_path.read_text()) if policy_path.exists() else {}
    # Pins run between dedupe and the crosswalk: they change which photograph a
    # SKU owns, which everything downstream then reads as ordinary selection.
    apply_front_source_pins(target, policy)
    import xref
    xref.DATA = target
    xref.main()
    crosswalk = json.loads((target / "xref.json").read_text())
    by_sku = {p["websiteSku"]: p for p in products}
    (target / "family-policy.json").write_text(json.dumps(policy, indent=2))
    groups = {g["_id"]: g for g in snapshot["groups"]}
    from build_plates import source_of, validate_front_source
    # The historical xref permits uncapped-only/alias rows. Preflight each row
    # against the actual renderer so a single bad source cannot abort the batch.
    selection = json.loads((target / "selection.json").read_text())
    for row in crosswalk["products"]:
        p = by_sku[row["websiteSku"]]
        row["productGroupId"] = p.get("productGroupId")
        row["applicator"] = p.get("applicator")
        if not row["productGroupId"] and row.get("renderMode") != "standalone":
            row["blockReasons"].append("physical_group_hold:catalog group missing")
        apply_catalog_policy(row, p, groups.get(p.get("productGroupId"), {}), policy)
        if row["family"] != family or (p.get("family") and p["family"] != family):
            row["blockReasons"].append("product_group_family_disagreement")
        if row.get("warnings"):
            row["blockReasons"].extend("identity_review:" + w for w in row["warnings"])
        if not row["blockReasons"]:
            try:
                entry = selection["stems"][row["stemKey"]]
                src = source_of(entry, "on") or source_of(entry, "part") or source_of(entry, "unknown")
                if src is None:
                    raise ValueError("no approved capped/front source")
                source_hold = policy.get("frontSourceHolds", {}).get(row["websiteSku"], {})
                if source_hold.get("sourceSha256") == src["sha256"]:
                    raise ValueError("visual source hold: " + source_hold["reason"])
                validate_front_source(src, row["websiteSku"],
                                      also_named=[row.get("stemSpelling")] if row.get("matchKind") == "alias" else ())
                if sha256_of(str(src["path"])) != src["sha256"]:
                    raise ValueError("source hash changed during preparation")
            except (OSError, ValueError, RuntimeError) as error:
                row["blockReasons"].append("source_preflight:" + str(error))
        row["publishable"] = not row["blockReasons"]
    crosswalk["summary"]["publishable"] = sum(r["publishable"] for r in crosswalk["products"])
    crosswalk["summary"]["blockers"] = dict(Counter(b for r in crosswalk["products"] for b in r["blockReasons"]))
    (target / "xref.json").write_text(json.dumps(crosswalk, indent=1))
    fields = ["websiteSku", "graceSku", "familyId", "matchKind", "publishable", "kitApplicability", "blockReasons"]
    with (out / "source-readiness.csv").open("w", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for r in crosswalk["products"]:
            writer.writerow({k: " | ".join(r[k]) if isinstance(r[k], list) else r[k] for k in fields})
    print(json.dumps(crosswalk["summary"], indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--family", required=True)
    ap.add_argument("--catalog", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--stage", choices=["prepare", "plates", "audit-kits"], required=True)
    args = ap.parse_args()
    out = args.out.resolve()
    if out.is_relative_to(MASTER.resolve()) or out.is_relative_to(DATA.resolve()) or DATA.resolve().is_relative_to(out):
        raise ValueError("Batch output must be isolated from the master and shared pipeline data")
    out.mkdir(parents=True, exist_ok=True)
    # Existing stage modules use module-local DATA/DIST constants. Scope those
    # to this process; do not rewrite the repository's shared input files.
    sys.argv = [sys.argv[0]]
    if args.stage == "prepare":
        prepare(args.catalog, out, args.family)
    else:
        scope = json.loads((out / "input/inventory.json").read_text())["scope"]
        if scope != args.family:
            raise ValueError(f"Batch belongs to {scope}, not {args.family}")
        if args.stage == "plates":
            import build_plates
            build_plates.DATA = out / "input"
            build_plates.DIST = out / "plates"
            build_plates.main()
            # A revised source crosswalk may remove an entire render group.
            # Keep its old files for comparison, but never carry stale rows
            # into this batch's current manifest.
            manifest_path = out / "plates/manifest.json"
            manifest = json.loads(manifest_path.read_text())
            crosswalk = json.loads((out / "input/xref.json").read_text())
            allowed = {r["websiteSku"] for r in crosswalk["products"] if r["publishable"]}
            manifest["rows"] = [r for r in manifest["rows"] if r["websiteSku"] in allowed]
            manifest["counts"] = {"rows": len(manifest["rows"]), "publishable": sum(r["publishable"] for r in manifest["rows"]),
                                  "families": len({r["familyId"] for r in manifest["rows"]})}
            manifest_path.write_text(json.dumps(manifest, indent=1))
        else:
            import kit_audit
            kit_audit.DATA = out / "input"
            kit_audit.main()


if __name__ == "__main__":
    main()

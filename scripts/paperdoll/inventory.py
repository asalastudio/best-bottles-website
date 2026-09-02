#!/usr/bin/env python3
"""
Inventory the Photoshop libraries: every file, its normalised stem, its role
and its hash, with the reason for every exclusion. Nothing is rendered here;
this is the audit trail every later decision cites by assetId.

    python3 scripts/paperdoll/inventory.py            -> data/paper-doll/inventory.json, inventory-report.md
    python3 scripts/paperdoll/inventory.py --no-hash  -> fast pass without sha256 (structure only)

Roles, by folder AND token, in precedence order:
    junk > view > thumbnail > component > capped > uncapped > front
A file has exactly one of `role` or `junkReason`; the report asserts that
nothing is left unclassified.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from pdlib.naming import map_pua, normalise_stem  # noqa: E402
from pdlib.psdmeta import png_header, psd_header, psd_layers, sha256_of  # noqa: E402

REPO = HERE.parents[1]
DATA = REPO / "data" / "paper-doll"
SOURCES = json.loads((DATA / "sources.json").read_text())
KNOWN_PREFIXES = ("GB", "LB", "CP", "Cp", "AnSp", "Ansp", "Drp", "DRP", "CJ", "Alu", "PB", "GBV", "OBag", "Box", "SP", "8-425", "8-245", "18-415", "18-400", "17-415", "15-415", "13-415", "20-400", "Spry", "Ltn", "VialWand", "Cyl", "Circle", "Round")
VIEW_FOLDER = re.compile("|".join(SOURCES["viewFolderPatterns"]), re.I)
VIEW_KIND_SEGMENT = re.compile(SOURCES["viewKindSegment"], re.I)     # a folder that IS one kind: "4. Aerial", "Depth views"
VIEW_KIND_WORD = re.compile(r"(measured|side|depth|aerial)", re.I)
THUMB_FOLDER = re.compile(r"thumb(nail|ail)s?", re.I)
CAP_STATE = [
    (re.compile(r"\(capped\)|,\s*capped|\bcapped\b", re.I), "on"),
    (re.compile(r"\(uncapped\)|,\s*uncapped|-\s*uncapped|\buncapped\b", re.I), "off"),
]


def _is_component_dir(dir_key: str) -> bool:
    return any(dir_key == cf or dir_key.startswith(cf + "/") for cf in SOURCES["componentFolders"])


def _folder_view_kind(segments: list[str]) -> str | None:
    """The deepest folder whose NAME is a single view kind. Umbrella folders ('Sideviews',
    'measured, side, depth, aerial views') say nothing about the kind of one file."""
    for segment in reversed(segments):
        m = VIEW_KIND_SEGMENT.match(segment)
        if m:
            return m.group(1).lower()
    return None


def _folder_cap_state(segments: list[str]) -> tuple[str | None, str | None]:
    """The deepest folder that names exactly one state. '31. Capped & Uncapped, ...' names both and is skipped."""
    for segment in reversed(segments):
        states = {state for pattern, state in CAP_STATE if pattern.search(segment)}
        if len(states) == 1:
            return states.pop(), segment
    return None, None


def classify(library: str, rel_dir: str, filename: str, ext: str, meta) -> dict:
    """Role + evidence for one file. `rel_dir` is the path of the directory inside the library (PUA still raw)."""
    dir_key = map_pua(rel_dir)
    segments = [s.strip() for s in dir_key.split("/") if s.strip()]
    low_dir = dir_key.lower()
    is_component = _is_component_dir(dir_key)

    is_view_folder = bool(VIEW_FOLDER.search(low_dir)) or (library == "bbuat" and bool(segments) and segments[0] == SOURCES["bbuatFolders"]["views"].strip())
    result = normalise_stem(filename, is_view_folder=is_view_folder, known_prefixes=KNOWN_PREFIXES, is_component=is_component)
    evidence = {"folder": None, "token": result.view_token, "prefix": None}
    row = {
        "stem": result.stem,
        "stemKey": result.stem_key,
        "stemNormalisations": result.normalisations,
        "role": None,
        "junkReason": result.junk_reason,
        "capState": None,
        "capStateEvidence": [],
        "viewFolderKind": None,
        "viewToken": result.view_token,
        "viewLayerKind": None,
        "viewKind": None,
        "viewKindStatus": None,
        "roleEvidence": evidence,
    }

    tiny = bool(meta.width and meta.height and (meta.width <= 100 or meta.height <= 100))
    if is_view_folder or result.view_token:
        row["role"], row["junkReason"] = "view", None
        evidence["folder"] = "view-folder" if is_view_folder else None
        row["viewFolderKind"] = _folder_view_kind(segments)
        layer_kinds = {m.group(1).lower() for name in meta.layer_names for m in [VIEW_KIND_WORD.search(name)] if m}
        row["viewLayerKind"] = layer_kinds.pop() if len(layer_kinds) == 1 else None
        # 2-of-3 agreement between folder, filename token and layer name decides the kind;
        # "3GBCyl50Depth.psd" in "4. Aerial" with a layer "Aerial View" is aerial, and the dissent is recorded
        votes = [k for k in (row["viewFolderKind"], result.view_token, row["viewLayerKind"]) if k]
        tally = Counter(votes)
        winner, count = (tally.most_common(1)[0] if tally else (None, 0))
        if count >= 2 and len(tally) == 1:
            row["viewKind"], row["viewKindStatus"] = winner, "agreed"
        elif count >= 2:
            row["viewKind"], row["viewKindStatus"] = winner, "majority"
        elif len(tally) > 1:
            row["viewKind"], row["viewKindStatus"] = None, "conflict"
        elif len(tally) == 1:
            row["viewKind"], row["viewKindStatus"] = winner, "single-evidence"
        else:
            row["viewKind"], row["viewKindStatus"] = None, "unknown"
        return row
    if tiny or THUMB_FOLDER.search(low_dir):
        row["role"], row["junkReason"] = "thumbnail", None
        evidence["folder"] = "thumbnail-folder" if THUMB_FOLDER.search(low_dir) else "tiny-canvas"
        return row
    if row["junkReason"]:
        return row
    if is_component:
        row["role"] = "component"
        evidence["folder"] = "component-allowlist"
        return row

    # cap state: the filename outranks the folder; UAT top folders outrank labels deeper down
    if result.cap_state:
        row["capStateEvidence"].append(f"filename:{result.cap_state}")
    if library == "bbuat" and segments:
        top = segments[0]
        if top == SOURCES["bbuatFolders"]["capped"].strip():
            row["capStateEvidence"].append("bbuat-folder:on")
        elif top == SOURCES["bbuatFolders"]["uncapped"].strip():
            row["capStateEvidence"].append("bbuat-folder:off")
    folder_state, folder_segment = _folder_cap_state(segments[1:] if library == "bbuat" else segments)
    if folder_state:
        row["capStateEvidence"].append(f"folder-label:{folder_state}")
    states = [e.split(":")[1] for e in row["capStateEvidence"]]
    if states and len(set(states)) == 1:
        row["role"], row["capState"] = ("capped" if states[0] == "on" else "uncapped"), states[0]
    elif states:
        row["role"], row["capState"] = "front", "conflict"
    else:
        row["role"], row["capState"] = "front", "unknown"
    return row

def walk(library: str, root: Path, do_hash: bool):
    skip = tuple(SOURCES["skipPathSegments"])
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        rel_dir = "" if rel_dir == "." else rel_dir
        if any(seg in rel_dir.split(os.sep) for seg in skip):
            dirnames[:] = []
            continue
        for filename in filenames:
            if filename.startswith("._") or filename == ".DS_Store":
                continue
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext not in ("psd", "png"):
                continue
            path = Path(dirpath) / filename
            if ext == "png" and not (library == "bbuat" and rel_dir.startswith(SOURCES["bbuatFolders"]["views"].strip())):
                continue  # PNGs count only inside the UAT views folder
            meta = psd_layers(str(path)) if ext == "psd" else png_header(str(path))
            row = classify(library, rel_dir, filename, ext, meta)
            try:
                stat = path.stat()
            except OSError:
                continue
            row.update({
                "library": library,
                "relPath": os.path.join(rel_dir, filename),
                "dirKey": map_pua(rel_dir),
                "fileName": filename,
                "ext": ext,
                "bytes": stat.st_size,
                "mtime": int(stat.st_mtime),
                "sha256": sha256_of(str(path)) if do_hash else None,
                "canvas": {"w": meta.width, "h": meta.height},
                "channels": meta.channels,
                "depth": meta.depth,
                "layerCount": meta.layer_count,
                "layerNames": meta.layer_names,
                "hasTextLayers": meta.has_text_layers,
                "hasAlphaChannel": meta.has_alpha_channel,
                "metaError": meta.error,
                "canvasClass": ("tiny" if (meta.width and meta.width <= 100) else "hires" if meta.width * meta.height >= 12_000_000 else "std") if meta.width else "unknown",
            })
            yield row


def parse_args(argv):
    """--no-hash, --limit N (per library), --library NAME (repeatable), --out DIR."""
    opts = {"hash": True, "limit": None, "libraries": None, "out": DATA}
    it = iter(argv)
    for arg in it:
        if arg == "--no-hash":
            opts["hash"] = False
        elif arg == "--limit":
            opts["limit"] = int(next(it))
        elif arg == "--library":
            opts["libraries"] = (opts["libraries"] or []) + [next(it)]
        elif arg == "--out":
            opts["out"] = Path(next(it))
        else:
            raise SystemExit(f"unknown argument {arg}")
    return opts


def main():
    opts = parse_args(sys.argv[1:])
    do_hash = opts["hash"]
    out_dir = opts["out"]
    started = time.time()
    files = []
    for name, lib in SOURCES["libraries"].items():
        if opts["libraries"] and name not in opts["libraries"]:
            continue
        root = Path(lib["root"])
        if not root.exists():
            print(f"!! library {name} missing at {root}", file=sys.stderr)
            continue
        count = 0
        for row in walk(name, root, do_hash):
            row["assetId"] = f"{(row['sha256'] or row['relPath'])[:16]}:{len(files)}"
            files.append(row)
            count += 1
            if count % 500 == 0:
                print(f"  {name}: {count} files ({time.time() - started:.0f}s)", file=sys.stderr)
            if opts["limit"] and count >= opts["limit"]:
                break
        print(f"{name}: {count} files", file=sys.stderr)

    stems = defaultdict(lambda: {"stems": set(), "fileIds": [], "libraries": set(), "roles": set()})
    for row in files:
        if row["junkReason"]:
            continue
        entry = stems[row["stemKey"]]
        entry["stems"].add(row["stem"])
        entry["fileIds"].append(row["assetId"])
        entry["libraries"].add(row["library"])
        entry["roles"].add(row["role"])
    stems_out = {k: {"stemsSeen": sorted(v["stems"]), "fileIds": v["fileIds"], "libraries": sorted(v["libraries"]), "roles": sorted(v["roles"])} for k, v in stems.items()}

    out_dir.mkdir(parents=True, exist_ok=True)
    out = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "builderVersion": "inventory 1.0.0", "hashed": do_hash,
           "partial": bool(opts["limit"] or opts["libraries"]),
           "sources": {k: {"root": v["root"], "files": sum(1 for f in files if f["library"] == k)} for k, v in SOURCES["libraries"].items()},
           "files": files, "stems": stems_out}
    with (out_dir / "inventory.json").open("w") as fh:          # one file per line: diffable, still valid JSON
        head = {k: v for k, v in out.items() if k not in ("files", "stems")}
        fh.write("{" + json.dumps(head, separators=(",", ":"))[1:-1] + ',\n"files":[\n')
        fh.write(",\n".join(json.dumps(f, separators=(",", ":")) for f in files))
        fh.write('\n],\n"stems":' + json.dumps(stems_out, separators=(",", ":")) + "\n}\n")

    # ---- report
    by_lib_role = Counter((f["library"], f["role"] or f"junk:{f['junkReason']}") for f in files)
    unclassified = [f for f in files if not f["role"] and not f["junkReason"]]
    lines = [f"# Inventory report — {out['generatedAt']}", "", f"files: {len(files)}  distinct stems (non-junk): {len(stems_out)}  unclassified: {len(unclassified)}", ""]
    lines.append("| library | role / junk | files |")
    lines.append("|---|---|---:|")
    for (lib, role), n in sorted(by_lib_role.items()):
        lines.append(f"| {lib} | {role} | {n} |")
    bb_on = {f["stemKey"] for f in files if f["library"] == "bbuat" and f["role"] == "capped"}
    bb_off = {f["stemKey"] for f in files if f["library"] == "bbuat" and f["role"] == "uncapped"}
    lines += ["", f"bbuat capped stems: {len(bb_on)}  uncapped stems: {len(bb_off)}  pairs (both): {len(bb_on & bb_off)}"]
    views = {f['stemKey'] for f in files if f['role'] == 'view'}
    lines.append(f"view stems: {len(views)}")
    lines.append(f"view kind status: {dict(Counter(f['viewKindStatus'] for f in files if f['role'] == 'view'))}")
    lines.append(f"cap state (original): {dict(Counter(f['capState'] for f in files if f['library'] == 'original' and f['role'] in ('front', 'capped', 'uncapped')))}")
    lines.append(f"cap state (bbuat): {dict(Counter(f['capState'] for f in files if f['library'] == 'bbuat' and f['role'] in ('front', 'capped', 'uncapped')))}")
    canvas = Counter(f['canvasClass'] for f in files)
    lines.append(f"canvas classes: {dict(canvas)}")
    errors = Counter(f['metaError'] for f in files if f['metaError'])
    lines.append(f"meta errors: {dict(errors)}")
    (out_dir / "inventory-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nwrote {out_dir / 'inventory.json'} in {time.time() - started:.0f}s")
    if unclassified:
        print(f"!! {len(unclassified)} unclassified files", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

"""Verify or restore the frozen Boston/Cylinder release files without publishing."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "docs/releases/boston-cylinder-2026-09-13/preservation.json"


def inside(root, relative):
    part = Path(relative)
    if part.is_absolute() or ".." in part.parts:
        raise ValueError("Unsafe archive path: " + relative)
    target = (root / part).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError("Archive path escapes its root: " + relative)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--restore-to", type=Path, help="Restore exact files under this directory; refuse changed existing files.")
    args = parser.parse_args()
    entries = json.loads(INDEX.read_text())["files"]
    seen = set()
    pending = []
    for entry in entries:
        name = entry["restorePath"]
        if name in seen:
            raise ValueError("Duplicate restore path: " + name)
        seen.add(name)
        source = inside(ROOT, entry["archivePath"])
        raw = source.read_bytes()
        if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError("Archive checksum failed: " + name)
        if args.restore_to:
            target = inside(args.restore_to, name)
            if target.exists() and target.read_bytes() != raw:
                raise ValueError("Refusing to replace existing changed file: " + name)
            pending.append((target, raw))
    # Validate the whole archive and all existing targets before writing anything.
    for target, raw in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            with target.open("xb") as file:
                file.write(raw)
    print(json.dumps({"verifiedFiles": len(entries), "restoredFiles": len(pending),
                      "publicationAuthorized": False}))


if __name__ == "__main__":
    main()

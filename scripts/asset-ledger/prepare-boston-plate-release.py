#!/usr/bin/env python3
"""Prepare a dry-run paper-doll manifest from Jordan-approved Boston plates.

This step is deliberately local. It copies the approved, content-addressed
candidate images into the normal paper-doll layout, derives square thumbnails,
and writes a manifest consumed by scripts/paperdoll/publish.mjs. It never
uploads bytes or writes Convex rows; publication remains gated by Jordan's
release-specific ``ship`` instruction.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
CANDIDATES = ROOT / "data/asset-ledger/boston-plate-completion.json"
DECISIONS = ROOT / "data/asset-ledger/boston-completion-decisions.json"
READINESS = ROOT / "dist/paper-doll/boston-master/source-readiness.csv"
PUBLIC = ROOT / "public"
OUT = ROOT / "dist/paper-doll/boston-approved-release-2026-09-12"
MANIFEST = OUT / "manifest.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def image_asset(path: Path, store_key: str, source: dict) -> dict:
    with Image.open(path) as im:
        width, height = im.size
    digest = sha256(path)
    return {
        "key": str(path.relative_to(OUT)),
        "storeKey": store_key,
        "sha256": digest,
        "bytes": path.stat().st_size,
        "width": width,
        "height": height,
        "sourceLibrary": "master",
        "sourceRelPath": source["sourcePath"],
        "sourceSha256": source["sourceSha256"],
        "sourceStateEvidence": "explicit",
    }


def make_thumb(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src).convert("RGBA") as im:
        im.thumbnail((240, 240), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (240, 240), (255, 255, 255, 255))
        canvas.alpha_composite(im, ((240 - im.width) // 2, (240 - im.height) // 2))
        canvas.convert("RGB").save(dest, "WEBP", quality=90, method=6)


def main() -> None:
    candidates = json.loads(CANDIDATES.read_text())
    decisions = json.loads(DECISIONS.read_text())
    readiness = {row["websiteSku"]: row for row in csv.DictReader(READINESS.open(newline=""))}

    if not decisions.get("decisions"):
        raise SystemExit("no completion decisions found")

    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    skipped = []
    for candidate in candidates["rows"]:
        binding = next((key.split(":", 1)[1] for key, value in decisions["decisions"].items()
                        if value.get("sku") == candidate["sku"] and value.get("status") == "approved"), None)
        if not binding:
            skipped.append(candidate["sku"])
            continue
        decision = decisions["decisions"].get(f"{candidate['sku']}:{binding}")
        if not decision or decision.get("binding") != binding:
            raise SystemExit(f"approval binding mismatch for {candidate['sku']}")

        catalog = readiness.get(candidate["sku"])
        family_id = (catalog or {}).get("familyId") or candidate["groupSlug"]
        family_name = (catalog or {}).get("familyName") or family_id.replace("-", " ")
        neck_match = re.search(r"(\d+-\d+)$", family_id)
        neck = neck_match.group(1) if neck_match else ""
        by_label = {view["label"]: view for view in candidate["views"]}
        if "Cap on" not in by_label:
            raise SystemExit(f"approved candidate has no cap-on view: {candidate['sku']}")

        family_dir = OUT / "plates" / family_id
        family_dir.mkdir(parents=True, exist_ok=True)
        assets = {}
        for label, role, suffix in (("Cap on", "plate", "front-on"), ("Cap off", "plateCapOff", "front-off")):
            view = by_label.get(label)
            if not view:
                continue
            source_path = PUBLIC / view["url"].lstrip("/")
            if not source_path.exists():
                raise SystemExit(f"missing candidate image for {candidate['sku']}: {source_path}")
            if sha256(source_path) != view["sha256"]:
                raise SystemExit(f"candidate hash drift for {candidate['sku']}: {source_path}")
            dest = family_dir / f"{candidate['sku']}.{suffix}.webp"
            shutil.copy2(source_path, dest)
            thumb = family_dir / f"{candidate['sku']}.{suffix}-thumb.webp"
            make_thumb(dest, thumb)
            source = view["source"]
            assets[role] = image_asset(dest, f"plates/{family_id}/{candidate['sku']}/{sha256(dest)}.{suffix}-1000x1100.webp", source)
            thumb_role = "thumbCapOff" if role == "plateCapOff" else "thumb"
            assets[thumb_role] = image_asset(thumb, f"plates/{family_id}/{candidate['sku']}/{sha256(thumb)}.{suffix}-240x240.webp", source)

        rows.append({
            "websiteSku": candidate["sku"],
            "graceSku": (catalog or {}).get("graceSku"),
            "familyId": family_id,
            "familyName": family_name,
            "neck": neck,
            "body": "registered",
            "closure": "Cap",
            "mode": "registered",
            **assets,
            "publishable": True,
            "blockReasons": [],
        })

    if skipped:
        raise SystemExit(f"{len(skipped)} approved candidates missing from decisions: {', '.join(skipped[:10])}")
    if len(rows) != len(decisions["decisions"]):
        raise SystemExit(f"approved decision count {len(decisions['decisions'])} did not produce {len(rows)} rows")

    groups = {}
    for row in rows:
        group = groups.setdefault(row["familyId"], {"familyId": row["familyId"], "name": row["familyName"], "neck": row["neck"], "rows": 0})
        group["rows"] += 1
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "builder": {"name": "prepare-boston-plate-release.py", "version": "1.0.0", "approvalRevision": decisions["revision"]},
        "canvas": {"width": 1000, "height": 1100},
        "counts": {"rows": len(rows), "groups": len(groups), "capOff": sum("plateCapOff" in row for row in rows)},
        "groups": list(groups.values()),
        "rows": rows,
        "publicationAuthorized": False,
        "approvalScope": "Jordan-approved local candidate plates; indexing and publication remain separate gates.",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"manifest": str(MANIFEST), "rows": len(rows), "groups": len(groups), "capOff": manifest["counts"]["capOff"], "publicationAuthorized": False}, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Collapse the inventory into one candidate source per (stem, cap state).

    python3 scripts/paperdoll/dedupe.py              -> data/paper-doll/selection.json, dedupe-report.md
    python3 scripts/paperdoll/dedupe.py --no-image   -> skip the image heuristics (fast; unknowns stay unknown)

Rules (plan §2):
  1. byte-identical files are ONE asset with every location kept (provenance, nothing "dropped");
  2. cap state: the filename, then the UAT top folders (C/2 on, C/1 off), then a single-state
     label deeper in the path; a file whose bytes also sit in a folder with a known state
     inherits that state ("sha sibling"); what is left goes to the blob-count heuristic and is
     tagged as such (a photographed cap beside the bottle is a second ink blob);
  3. precedence when several distinct files share (stem, state):
     C/2 or C/1 > A family folder > A "31. Capped & Uncapped" copies > A Tassels (Updated over
     Original); thumbnails and views are never candidates;
  4. two distinct PHOTOGRAPHS for one (stem, state) -> SAME_STEM_DIFFERENT_PHOTOGRAPH, nothing
     chosen, both listed. Re-saves (perceptual hash within 6 bits) are the same photograph;
  5. a hi-res file in a family whose other files are standard size is set aside before
     registration, so one 6000x4000 scan cannot refuse the family.
"""
from __future__ import annotations

import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

REPO = HERE.parents[1]
DATA = REPO / "data" / "paper-doll"
SOURCES = json.loads((DATA / "sources.json").read_text())
PHASH_CACHE = DATA / "phash-cache.json"

PRODUCT_ROLES = ("capped", "uncapped", "front", "component")   # components carry state "part" (the photo IS the part)
HAMMING_SAME_PHOTO = 16       # dHash bits; re-saves measured at 2–7, different crops of one asset at 46–49
CANVAS_RATIO_SAME_ASSET = 1.5  # area ratio above which the smaller file is a crop/thumbnail of the larger, never a rival
THUMB_SIZE = 256


# ---------------------------------------------------------------- image heuristics (lazy, cached)
def _composite_gray(path: str):
    from PIL import Image
    from psd_tools import PSDImage
    psd = PSDImage.open(path)
    image = psd.composite()
    if image is None:
        return None
    image = image.convert("RGBA")
    # flatten onto white so an alpha background and a painted white background agree
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    background.alpha_composite(image)
    return background.convert("L")


def dhash(gray, size: int = 8) -> str:
    from PIL import Image
    small = gray.resize((size + 1, size), Image.LANCZOS)
    pixels = list(small.getdata())
    bits = []
    for row in range(size):
        for col in range(size):
            left = pixels[row * (size + 1) + col]
            right = pixels[row * (size + 1) + col + 1]
            bits.append("1" if left > right else "0")
    return f"{int(''.join(bits), 2):016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def ink_blobs(gray, threshold: int = 235, min_area_frac: float = 0.002) -> int:
    """Connected components of non-white ink on a 256-px thumbnail. Two big blobs = cap beside bottle."""
    import numpy as np
    from PIL import Image
    thumb = gray.copy()
    thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
    arr = np.asarray(thumb) < threshold
    h, w = arr.shape
    seen = np.zeros_like(arr, dtype=bool)
    min_area = int(h * w * min_area_frac)
    blobs = 0
    for y in range(h):
        for x in range(w):
            if arr[y, x] and not seen[y, x]:
                stack = [(y, x)]
                seen[y, x] = True
                area = 0
                while stack:
                    cy, cx = stack.pop()
                    area += 1
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and arr[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
                if area >= min_area:
                    blobs += 1
    return blobs


class ImageFacts:
    """dHash + blob count per sha256, cached on disk so a re-run never recomposites."""

    def __init__(self, enabled: bool):
        self.enabled = enabled
        self.cache = json.loads(PHASH_CACHE.read_text()) if PHASH_CACHE.exists() else {}
        self.computed = 0

    def get(self, sha: str, path: str) -> dict | None:
        if sha in self.cache:
            return self.cache[sha]
        if not self.enabled:
            return None
        try:
            gray = _composite_gray(path)
            if gray is None:
                facts = {"error": "no_composite"}
            else:
                facts = {"dhash": dhash(gray), "blobs": ink_blobs(gray)}
        except Exception as error:  # noqa: BLE001 — recorded, never fatal
            facts = {"error": f"{type(error).__name__}"}
        self.cache[sha] = facts
        self.computed += 1
        if self.computed % 50 == 0:
            self.save()
        return facts

    def save(self):
        PHASH_CACHE.write_text(json.dumps(self.cache, indent=0, sort_keys=True))


# ---------------------------------------------------------------- precedence
def precedence(f: dict) -> tuple[int, str]:
    """Lower is better. The UAT set is curated; inside A the family folder beats its copies."""
    d = f["dirKey"]
    if f["library"] == "bbuat":
        return (0, d)
    if f["library"] == "bbmaster":
        return (5, d)          # the supplement: fills gaps, never outranks A or C
    if "31. Capped & Uncapped" in d:
        return (2, d)
    if "Updated Tassels" in d:
        return (3, d)
    if "Original Tassels" in d:
        return (4, d)
    return (1, d)


def library_root(f: dict) -> str:
    return SOURCES["libraries"][f["library"]]["root"]


def main():
    no_image = "--no-image" in sys.argv
    started = time.time()
    inv = json.loads((DATA / "inventory.json").read_text())
    files = [f for f in inv["files"] if not f["junkReason"] and f["role"] in PRODUCT_ROLES]
    facts = ImageFacts(enabled=not no_image)

    # 1. byte-identical collapse
    by_sha: dict[str, list[dict]] = defaultdict(list)
    for f in files:
        by_sha[f["sha256"]].append(f)

    # 2. cap state per asset: explicit evidence from any location, then sha siblings
    asset_state: dict[str, tuple[str | None, str]] = {}
    for sha, locs in by_sha.items():
        if all(f["role"] == "component" for f in locs):
            asset_state[sha] = ("part", "component-folder")
            continue
        explicit = Counter()
        for f in locs:
            for e in f["capStateEvidence"]:
                explicit[e.split(":")[1]] += 1
        if len(explicit) == 1:
            asset_state[sha] = (next(iter(explicit)), "explicit")
        elif len(explicit) > 1:
            asset_state[sha] = (None, "conflict")
        else:
            asset_state[sha] = (None, "unknown")

    # 3. group candidates by stem
    by_stem: dict[str, list[str]] = defaultdict(list)
    for sha, locs in by_sha.items():
        keys = {f["stemKey"] for f in locs}
        for key in keys:
            by_stem[key].append(sha)

    heuristics = Counter()
    for key, shas in by_stem.items():
        for sha in shas:
            state, how = asset_state[sha]
            if state is not None:
                continue
            best = min(by_sha[sha], key=precedence)
            path = str(Path(library_root(best)) / best["relPath"])
            info = facts.get(sha, path)
            if not info or "blobs" not in info:
                heuristics["unresolved"] += 1
                continue
            # one ink blob = the assembled product; two or more = a removable part laid beside it
            guess = "on" if info["blobs"] <= 1 else "off"
            asset_state[sha] = (guess, f"blob-count:{info['blobs']}")
            heuristics[guess] += 1

    # 4. selection per (stem, state)
    selection = {}
    conflicts = []
    hires_set_aside = []
    for key in sorted(by_stem):
        shas = by_stem[key]
        stems_seen = sorted({f["stem"] for sha in shas for f in by_sha[sha]})
        per_state: dict[str, list[str]] = defaultdict(list)
        for sha in shas:
            state, _ = asset_state[sha]
            per_state[state or "unknown"].append(sha)
        entry = {"stems": stems_seen, "states": {}, "role": "component" if all(asset_state[s][0] == "part" for s in shas) else "product"}
        # hi-res minority class: set aside before anything else
        for state, group in per_state.items():
            classes = Counter(min(by_sha[s], key=precedence)["canvasClass"] for s in group)
            if len(classes) > 1 and classes.get("hires", 0) < len(group):
                keep = [s for s in group if min(by_sha[s], key=precedence)["canvasClass"] != "hires"]
                for s in group:
                    if s not in keep:
                        hires_set_aside.append({"stem": key, "state": state, "sha256": s, "path": min(by_sha[s], key=precedence)["relPath"]})
                per_state[state] = keep
        for state, group in per_state.items():
            def best_loc(sha):
                return min(by_sha[sha], key=precedence)
            def area(sha):
                b = best_loc(sha)
                return (b["canvas"]["w"] or 0) * (b["canvas"]["h"] or 0)
            def explicit(sha):
                return asset_state[sha][1] in ("explicit", "component-folder")
            # explicit evidence outranks a heuristic guess; then curated folder; then the larger canvas
            candidates = sorted(group, key=lambda s: (0 if explicit(s) else 1, precedence(best_loc(s)), -area(s)))
            chosen = candidates[0]
            same_photo = True
            rivals = []          # candidates that could genuinely be a different photograph of this (stem, state)
            notes = {}
            for s in candidates[1:]:
                if explicit(chosen) and not explicit(s):
                    notes[s] = "heuristic-state-outranked"
                elif area(chosen) >= CANVAS_RATIO_SAME_ASSET * area(s) or area(s) >= CANVAS_RATIO_SAME_ASSET * area(chosen):
                    notes[s] = "smaller-canvas-of-same-asset"
                else:
                    rivals.append(s)
            if rivals:
                hashes = {}
                for s in [chosen] + rivals:
                    b = best_loc(s)
                    info = facts.get(s, str(Path(library_root(b)) / b["relPath"]))
                    hashes[s] = info.get("dhash") if info else None
                if any(hashes[s] is None for s in hashes):
                    same_photo = None       # undecidable without images
                else:
                    distances = {s: hamming(hashes[chosen], hashes[s]) for s in rivals}
                    same_photo = all(d <= HAMMING_SAME_PHOTO for d in distances.values())
                    for s, d in distances.items():
                        notes[s] = f"dhash-distance:{d}"
            record = {
                "chosen": None if same_photo is False else chosen,
                "chosenPath": None if same_photo is False else best_loc(chosen)["relPath"],
                "chosenLibrary": None if same_photo is False else best_loc(chosen)["library"],
                "chosenCanvas": None if same_photo is False else [best_loc(chosen)["canvas"]["w"], best_loc(chosen)["canvas"]["h"]],
                "stateEvidence": asset_state[chosen][1],
                "alternates": [{"sha256": s, "note": notes.get(s), "locations": [f["library"] + ":" + f["relPath"] for f in by_sha[s]]} for s in candidates[1:]],
                "locations": [f["library"] + ":" + f["relPath"] for f in by_sha[chosen]],
                "samePhotograph": same_photo,
            }
            if same_photo is False:
                conflicts.append({"stem": key, "state": state, "candidates": [best_loc(s)["relPath"] for s in [chosen] + rivals],
                                  "distances": {best_loc(s)["relPath"]: notes[s] for s in rivals}, "reason": "SAME_STEM_DIFFERENT_PHOTOGRAPH"})
            entry["states"][state] = record
        selection[key] = entry

    facts.save()
    out = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "builderVersion": "dedupe 1.0.0",
        "inventoryGeneratedAt": inv["generatedAt"],
        "imageHeuristics": not no_image,
        "stems": selection,
        "conflicts": conflicts,
        "hiresSetAside": hires_set_aside,
    }
    (DATA / "selection.json").write_text(json.dumps(out, indent=1))

    # report
    n_assets = len(by_sha)
    states = Counter()
    for key, entry in selection.items():
        for state in entry["states"]:
            states[state] += 1
    evidence = Counter(how.split(":")[0] for _, how in asset_state.values())
    both = sum(1 for e in selection.values() if "on" in e["states"] and "off" in e["states"])
    lines = [
        f"# Dedupe report — {out['generatedAt']}", "",
        f"product files: {len(files)}  distinct assets (sha256): {n_assets}  stems: {len(selection)}",
        f"(stem, state) slots: {dict(states)}  stems with both on and off: {both}",
        f"cap-state evidence per asset: {dict(evidence)}  heuristic results: {dict(heuristics)}",
        f"conflicts (SAME_STEM_DIFFERENT_PHOTOGRAPH): {len(conflicts)}",
        f"hi-res files set aside: {len(hires_set_aside)}",
        f"image facts computed this run: {facts.computed} (cache {len(facts.cache)})",
    ]
    for c in conflicts[:30]:
        lines.append(f"  - {c['stem']} [{c['state']}]: " + " | ".join(c["candidates"]))
    (DATA / "dedupe-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nwrote {DATA / 'selection.json'} in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()

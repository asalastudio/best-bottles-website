#!/usr/bin/env python3
"""Strip the white neck retouch that rides along with a paired-PSD roller part.

Jordan returned eight Elegant kit candidates in
`catalog-kit-candidates-2026-09-08-r7` with notes reading "white square blotch on
the bottle" and "there's a white blotch that's right underneath the cap".

Cause. The paired recipe in `elegant-paired-kit-recipes.json` takes `body` and
`cap` from the capped PSD and `roller` from the *uncapped* PSD. In the uncapped
photograph the bottle shoulder was masked behind a solid white block painted into
the same layer as the roller ball, so extracting that layer as the roller part
drags the retouch with it. On reassembly the cap covers the top of the block and
the rest juts out over the shoulder. `allowBodyRetouchDifference: true` in the
recipe is what let it through. Neither PSD is damaged and the published plate is
clean; only the reassembled kit shows it.

Fix. Drop the single largest solid-white connected component from the roller
layer's alpha. The roller ball keeps its own near-white specular highlights,
which are small separate components. On the eight affected SKUs this takes the
part from 47,537 opaque pixels to about 10,700 -- the ball alone -- and the
frosted shoulder from the capped body layer shows through correctly.

Scope. Only parts whose designated layer is mostly one solid white slab qualify.
Polished chrome sprayers and pumps also carry large white components, but those
are specular bands on the artwork itself: they are rejected by the solidity test
and must never be stripped. Run with --report-only first and look at the
previews before trusting any repair.

This writes previews and a technical report. It does not rebuild production kit
composites, publish, or modify any PSD.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
PSD_LIBRARY = Path(
    os.environ.get(
        "BB_PSD_LIBRARY",
        "/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master",
    )
)
DEFAULT_OUT = ROOT / "docs/reviews/kit-roller-retouch"

# A retouch slab is nearly its own bounding box and covers much of the layer.
# A specular band on chrome fails both tests.
WHITE_TOLERANCE = 6
MIN_BLOCK_SHARE = 0.35
MIN_BLOCK_SOLIDITY = 0.75


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_capped_source(recipe: dict) -> tuple[Path | None, str]:
    """Find the capped PSD for a recipe, proving identity by hash rather than by name.

    Recipes name only the uncapped file plus the capped file's SHA-256. The obvious
    sibling is tried first and accepted only if its hash matches; otherwise the
    family folder is searched for the file that does. A name that looks right but
    hashes wrong is never used.
    """
    wanted = recipe.get("onSourceSha256")
    off = PSD_LIBRARY / recipe["offSourcePath"]
    if not wanted:
        return None, "recipe records no onSourceSha256"

    family = off.parent.parent
    guess = [c for c in family.glob("*/" + off.name) if c != off]
    for candidate in guess:
        if sha256_of(candidate) == wanted:
            return candidate, "sibling filename, hash verified"
    for candidate in sorted(family.rglob("*.psd")):
        if candidate != off and sha256_of(candidate) == wanted:
            return candidate, "family search by hash"
    return None, "no file in the family folder matches onSourceSha256"


def layer_images(path: Path) -> tuple[list[Image.Image], tuple[int, int]]:
    from psd_tools import PSDImage

    document = PSDImage.open(path)
    size = document.size
    return [layer.composite(viewport=(0, 0, *size)).convert("RGBA") for layer in document], size


def opaque_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    mask = np.asarray(image)[..., 3] > 8
    if not mask.any():
        return None
    rows = np.where(mask.any(axis=1))[0]
    columns = np.where(mask.any(axis=0))[0]
    return int(columns.min()), int(rows.min()), int(columns.max()), int(rows.max())


def find_retouch_block(image: Image.Image) -> tuple[np.ndarray | None, dict]:
    """The single solid white slab in a layer, if one dominates it."""
    pixels = np.asarray(image)
    opaque = pixels[..., 3] > 8
    white = opaque & ((255 - pixels[..., :3].astype(int)).sum(axis=2) <= WHITE_TOLERANCE)
    stats = {"opaquePx": int(opaque.sum()), "whitePx": int(white.sum()), "blockPx": 0,
             "blockShare": 0.0, "blockSolidity": 0.0, "qualifies": False}
    if not white.any():
        return None, stats

    labels, count = ndimage.label(white)
    areas = ndimage.sum(white, labels, range(1, count + 1))
    block = labels == int(np.argmax(areas)) + 1
    block = ndimage.binary_closing(block, np.ones((5, 5)))

    rows = np.where(block.any(axis=1))[0]
    columns = np.where(block.any(axis=0))[0]
    box = (columns.max() - columns.min() + 1) * (rows.max() - rows.min() + 1)
    stats["blockPx"] = int(block.sum())
    stats["blockShare"] = round(block.sum() / max(stats["opaquePx"], 1), 4)
    stats["blockSolidity"] = round(block.sum() / max(box, 1), 4)
    stats["blockBounds"] = [int(columns.min()), int(rows.min()), int(columns.max()), int(rows.max())]
    stats["qualifies"] = bool(
        stats["blockShare"] >= MIN_BLOCK_SHARE and stats["blockSolidity"] >= MIN_BLOCK_SOLIDITY
    )
    return block, stats


def strip(image: Image.Image, block: np.ndarray) -> Image.Image:
    pixels = np.asarray(image).copy()
    pixels[..., 3] = np.where(block, 0, pixels[..., 3])
    return Image.fromarray(pixels)


def reassemble(body: Image.Image, part: Image.Image, cap: Image.Image,
               offset: tuple[int, int], size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(body)
    moved = Image.new("RGBA", size, (0, 0, 0, 0))
    moved.paste(part, offset)
    canvas.alpha_composite(moved)
    canvas.alpha_composite(cap)
    flat = Image.new("RGB", size, (255, 255, 255))
    flat.paste(canvas, (0, 0), canvas)
    return flat


def process(recipe: dict, out_dir: Path, report_only: bool) -> dict:
    sku = recipe["websiteSku"]
    result: dict = {"sku": sku}
    if not recipe.get("offSourcePath"):
        result["action"] = "single-source recipe; no donor part"
        return result
    off_path = PSD_LIBRARY / recipe["offSourcePath"]
    if not off_path.exists():
        result["error"] = "uncapped source PSD missing"
        return result
    on_path, how = resolve_capped_source(recipe)
    if on_path is None:
        result["error"] = f"cannot resolve the capped source: {how}"
        return result
    result["onSourcePath"] = str(on_path.relative_to(PSD_LIBRARY))
    result["onSourceResolvedBy"] = how
    result["offSourcePath"] = recipe["offSourcePath"]
    result["onSourceSha256"] = recipe["onSourceSha256"]
    result["offSourceSha256"] = sha256_of(off_path)
    if recipe.get("offSourceSha256") and recipe["offSourceSha256"] != result["offSourceSha256"]:
        result.setdefault("warnings", []).append("offSourceSha256 differs from the recipe")

    on_layers, size = layer_images(on_path)
    off_layers, _ = layer_images(off_path)

    slots = {part["slot"]: part["layers"][0] for part in recipe["parts"] if part.get("layers")}
    donor_slot = next((s for s, l in slots.items() if l.get("source") == "off"), None)
    if donor_slot is None:
        result["error"] = "recipe has no off-source part"
        return result
    result["donorSlot"] = donor_slot

    def pick(layers: list[Image.Image], index: int, label: str) -> Image.Image | None:
        """An index the recipe records that the file does not have is a data defect."""
        if 0 <= index < len(layers):
            return layers[index]
        result.setdefault("layerIndexErrors", []).append(
            f"{label} index {index} outside 0..{len(layers) - 1}")
        return None

    result["onLayerCount"], result["offLayerCount"] = len(on_layers), len(off_layers)
    donor = pick(off_layers, slots[donor_slot]["index"], donor_slot)
    if donor is None:
        result["error"] = "donor layer index out of range"
        return result
    block, stats = find_retouch_block(donor)
    result["donorLayer"] = slots[donor_slot]["index"]
    result.update(stats)
    if not stats["qualifies"]:
        result["action"] = "no solid retouch slab; left alone"
        return result

    on_body = pick(on_layers, slots["body"]["index"], "body") if "body" in slots else None
    on_cap = pick(on_layers, slots["cap"]["index"], "cap") if "cap" in slots else None
    off_body = pick(off_layers, recipe["offBodyLayer"], "offBody")
    if on_body is None or off_body is None:
        result["error"] = "body layer index out of range"
        return result
    on_box, off_box = opaque_bounds(on_body), opaque_bounds(off_body)
    if not on_box or not off_box:
        result["error"] = "cannot align: a body layer is empty"
        return result
    offset = (on_box[0] - off_box[0], on_box[1] - off_box[1])
    result["alignOffset"] = list(offset)

    cleaned = strip(donor, block)
    result["cleanedOpaquePx"] = int((np.asarray(cleaned)[..., 3] > 8).sum())
    result["action"] = "retouch slab removed from the donor part"

    if report_only:
        return result

    out_dir.mkdir(parents=True, exist_ok=True)
    cleaned.save(out_dir / f"{sku}.{donor_slot}-cleaned.png")
    if on_cap is not None:
        before = reassemble(on_body, donor, on_cap, offset, size)
        after = reassemble(on_body, cleaned, on_cap, offset, size)
        before.save(out_dir / f"{sku}.reassembled-before.png")
        after.save(out_dir / f"{sku}.reassembled-after.png")
        difference = np.abs(np.asarray(before).astype(int) - np.asarray(after).astype(int)).sum(axis=2)
        result["pixelsRecovered"] = int((difference > 24).sum())
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipes", required=True, help="a *-paired-kit-recipes.json file")
    parser.add_argument("--sku", action="append", help="limit to these website SKUs")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--report-only", action="store_true", help="measure without writing images")
    args = parser.parse_args()

    data = json.loads(Path(args.recipes).read_text())
    recipes = data if isinstance(data, list) else data.get("rows", data.get("recipes", []))
    if args.sku:
        wanted = set(args.sku)
        recipes = [r for r in recipes if r.get("websiteSku") in wanted]

    results = [process(r, args.out, args.report_only) for r in recipes]
    repaired = [r for r in results if r.get("action", "").startswith("retouch slab removed")]
    report = {
        "psdLibrary": str(PSD_LIBRARY),
        "recipes": str(args.recipes),
        "whiteTolerance": WHITE_TOLERANCE,
        "minBlockShare": MIN_BLOCK_SHARE,
        "minBlockSolidity": MIN_BLOCK_SOLIDITY,
        "scanned": len(results),
        "repaired": len(repaired),
        "scope": "diagnostic and part repair only; no production kit rebuild and no publication",
        "rows": results,
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.json").write_text(f"{json.dumps(report, indent=2)}\n")
    print(f"Scanned {len(results)} recipes; {len(repaired)} carried a solid retouch slab")
    for row in repaired:
        print(f"  {row['sku']:30} {row['donorSlot']:8} "
              f"{row['blockPx']:6d} px removed ({row['blockShare']:.0%} of the layer)")
    print(f"Report: {args.out / 'report.json'}")


if __name__ == "__main__":
    main()

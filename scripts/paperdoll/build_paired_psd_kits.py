#!/usr/bin/env python3
"""Build review-only photographic kits from exact capped/uncapped PSD pairs.

The capped PSD remains the plate and geometry authority. Layers from the
uncapped PSD may supply an exposed fitment only after the identical body layer
establishes the translation back into the capped composition. Every accepted
kit must be registered to the currently published plate hash and reassemble to
that plate within the existing parity gate. This script never publishes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from collections import Counter
from pathlib import Path


SLOTS = {
    "body", "fitment", "roller", "cap", "overcap", "sprayer", "pump",
    "diptube", "collar", "bulb", "tassel", "reducer", "pipette",
}


def shared_body_translation(on_bounds, off_bounds):
    """Return the translation that places an off-source part in on coordinates."""
    on_left, on_top, on_right, on_bottom = on_bounds
    off_left, off_top, off_right, off_bottom = off_bounds
    if (on_right - on_left, on_bottom - on_top) != (
        off_right - off_left,
        off_bottom - off_top,
    ):
        raise ValueError("paired body bounds have different dimensions")
    return on_left - off_left, on_top - off_top


def require_current_plate_hash(manifest_sha, published_sha):
    if not manifest_sha or manifest_sha != published_sha:
        raise ValueError(
            f"published plate hash mismatch: manifest={manifest_sha} published={published_sha}"
        )
    return manifest_sha


def resolve_off_source(recipe, manifest_row):
    plate_cap_off = manifest_row.get("plateCapOff") or {}
    path = recipe.get("offSourcePath") or plate_cap_off.get("sourceRelPath")
    sha = recipe.get("offSourceSha256") or plate_cap_off.get("sourceSha256")
    if not path or not sha:
        raise ValueError("recipe requires a reviewed uncapped source path and hash")
    return path, sha


def validate_body_pair(on_layer, off_layer, allow_retouch_difference=False):
    if on_layer["pixelHash"] != off_layer["pixelHash"] and not allow_retouch_difference:
        raise ValueError("paired body pixels do not match")
    return shared_body_translation(on_layer["bounds"], off_layer["bounds"])


def exploded_offsets(parts):
    body = next(part for part in parts if part["slot"] == "body")
    offsets = {"body": 0}
    ceiling = body["bounds"]["top"]
    for index, part in enumerate((p for p in parts if p["slot"] != "body"), 1):
        dy = min(-90 * index, ceiling - part["bounds"]["bottom"] - 24)
        offsets[part["slot"]] = dy
        ceiling = part["bounds"]["top"] + dy
    return offsets


def exploded_frame(parts, width=1000, height=1100):
    left = min(part["bounds"]["left"] + part["exploded"]["dx"] for part in parts)
    right = max(part["bounds"]["right"] + part["exploded"]["dx"] for part in parts)
    top = min(part["bounds"]["top"] + part["exploded"]["dy"] for part in parts)
    bottom = max(part["bounds"]["bottom"] + part["exploded"]["dy"] for part in parts)
    scale = min(1, (width - 48) / max(1, right - left), (height - 48) / max(1, bottom - top))
    x = (width - (right - left) * scale) / 2 - left * scale
    y = (height - (bottom - top) * scale) / 2 - top * scale
    return {
        "scale": scale,
        "x": x,
        "y": y,
        "left": x + left * scale,
        "right": x + right * scale,
        "top": y + top * scale,
        "bottom": y + bottom * scale,
    }


def validate_recipe(recipe):
    if not recipe.get("reviewedBy") or not recipe.get("evidence"):
        raise ValueError("recipe requires reviewedBy and evidence")
    parts = recipe.get("parts")
    if not isinstance(parts, list) or not parts:
        raise ValueError("recipe requires parts")
    slots = [part.get("slot") for part in parts]
    if "body" not in slots:
        raise ValueError("recipe requires a body part")
    if len(slots) != len(set(slots)) or any(slot not in SLOTS for slot in slots):
        raise ValueError("recipe has duplicate or unsupported slots")
    for part in parts:
        layers = part.get("layers")
        if not isinstance(layers, list) or not layers:
            raise ValueError(f"{part.get('slot')} requires at least one source layer")
        for layer in layers:
            if layer.get("source") not in {"on", "off"} or not isinstance(layer.get("index"), int):
                raise ValueError("source layers require on/off and an integer index")
            if layer.get("alignToOnBody") and layer.get("source") != "off":
                raise ValueError("only off-source layers can align to the on body")
    return slots


def _digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _bounds_dict(bounds):
    return dict(zip(("left", "top", "right", "bottom"), bounds))


def _load_json(path):
    return json.loads(Path(path).read_text())


def is_rendered_source_layer(layer):
    """Return whether a PSD descendant contributes pixels to the rendered source.

    Hidden alternates are common in the master PSDs and do not affect the
    published composite. They are deliberately ignored; a visible non-pixel
    layer still requires manual review because it may change compositing.
    """
    if layer.is_group() or not layer.is_visible():
        return False
    if layer.kind != "pixel":
        raise ValueError("visible non-pixel layer requires source review")
    return True


def paired_layer_inventory(psd):
    import numpy as np

    rows = []
    for index, layer in enumerate(psd.descendants()):
        if not is_rendered_source_layer(layer):
            continue
        if layer.opacity != 255 or str(layer.blend_mode.value) not in ("b'norm'", "norm"):
            raise ValueError(f"layer {index} blending/opacity requires source review")
        image = layer.topil()
        if image is None:
            continue
        rgba = image.convert("RGBA")
        alpha = np.asarray(rgba.getchannel("A"))
        fraction = image.width * image.height / (psd.width * psd.height)
        background = fraction >= 0.98 and float((alpha >= 250).mean()) >= 0.98
        pixel_hash = hashlib.sha256(str((image.size, image.mode)).encode() + image.tobytes()).hexdigest()
        rows.append({
            "index": index,
            "name": layer.name,
            "bounds": list(layer.bbox),
            "background": background,
            "pixelHash": pixel_hash,
            "size": list(image.size),
        })
    return rows


def _render_part(psds, spec, translation, out_size, transform):
    from PIL import Image

    on = psds["on"]
    source_canvas = Image.new("RGBA", on.size)
    for layer_ref in spec["layers"]:
        source_name = layer_ref["source"]
        psd = psds[source_name]
        layers = list(psd.descendants())
        layer = layers[layer_ref["index"]]
        image = layer.topil()
        if image is None:
            raise ValueError(f"layer {layer_ref['index']} in {source_name} has no pixels")
        dx, dy = translation if layer_ref.get("alignToOnBody") else (0, 0)
        source_canvas.alpha_composite(image.convert("RGBA"), (layer.left + dx, layer.top + dy))
    scale, ox, oy = transform
    return source_canvas.transform(
        out_size,
        Image.Transform.AFFINE,
        (1 / scale, 0, -ox / scale, 0, 1 / scale, -oy / scale),
        resample=Image.Resampling.BICUBIC,
    )


def build(args):
    import numpy as np
    from PIL import Image
    from psd_tools import PSDImage

    here = Path(__file__).resolve().parent
    sys.path.insert(0, str(here))
    from build_cyl9_kits import alpha_gate, save_part
    from build_master_kits import parity
    from family_batch import MASTER, checked_source

    batch = args.batch.resolve()
    plates_root = batch / "plates"
    manifest = _load_json(plates_root / "manifest.json")
    manifest_rows = {row["websiteSku"]: row for row in manifest["rows"]}
    published = {row["websiteSku"]: row for row in _load_json(args.published_plates)}
    catalog = {row["websiteSku"]: row for row in _load_json(args.catalog)["products"]}
    recipes = _load_json(args.recipes)
    recipe_rows = recipes["rows"] if isinstance(recipes, dict) else recipes
    output = args.output.resolve()
    parts_root = output / "parts"
    parts_root.mkdir(parents=True, exist_ok=True)
    results = []

    for recipe in recipe_rows:
        sku = recipe["websiteSku"]
        record = {
            "sku": sku,
            "websiteSku": sku,
            "status": "review",
            "publishable": False,
        }
        try:
            validate_recipe(recipe)
            row = manifest_rows[sku]
            live = published[sku]
            product = catalog[sku]
            require_current_plate_hash(row["plate"]["sha256"], live["front"]["sha256"])
            if not row.get("publishable"):
                raise ValueError("plate manifest row is not publishable")

            on_path = checked_source(MASTER / row["plate"]["sourceRelPath"])
            if _digest(on_path) != row["plate"]["sourceSha256"]:
                raise ValueError("capped source hash drift")
            if recipe.get("onSourceSha256") != row["plate"]["sourceSha256"]:
                raise ValueError("recipe capped source hash drift")

            psds = {"on": PSDImage.open(on_path)}
            off_path = None
            if any(layer["source"] == "off" for part in recipe["parts"] for layer in part["layers"]):
                off_source_path, off_source_sha = resolve_off_source(recipe, row)
                off_path = checked_source(MASTER / off_source_path)
                if _digest(off_path) != off_source_sha:
                    raise ValueError("uncapped source hash drift")
                psds["off"] = PSDImage.open(off_path)

            on_layers = paired_layer_inventory(psds["on"])
            off_layers = paired_layer_inventory(psds["off"]) if "off" in psds else []
            on_body = next(layer for layer in on_layers if layer["index"] == recipe["onBodyLayer"])
            translation = (0, 0)
            if "off" in psds:
                off_body = next(layer for layer in off_layers if layer["index"] == recipe["offBodyLayer"])
                translation = validate_body_pair(
                    on_body,
                    off_body,
                    allow_retouch_difference=bool(recipe.get("allowBodyRetouchDifference")),
                )

            registration = _load_json(
                plates_root / row["familyId"] / f"_registration-{row['body']}.json"
            )
            placement = registration["plates"][f"{sku}.front-on"]
            session = next(item for item in registration["sessions"] if item["index"] == placement["session"])
            transform = (
                registration["scale"] * session["scaleFactor"],
                placement["ox"],
                placement["oy"],
            )

            plate_path = plates_root / row["plate"]["key"]
            if _digest(plate_path) != row["plate"]["sha256"]:
                raise ValueError("local plate hash drift")

            assembled = Image.new("RGBA", (1000, 1100), "white")
            part_rows = []
            alpha_results = []
            for z_order, spec in enumerate(recipe["parts"]):
                image = _render_part(psds, spec, translation, (1000, 1100), transform)
                ok, gate = alpha_gate(np.asarray(image))
                alpha_results.append({"slot": spec["slot"], "ok": ok, **gate})
                if not ok:
                    raise ValueError(f"{spec['slot']} alpha gate failed: {gate}")

                tmp = parts_root / f"{sku}.{spec['slot']}.tmp.webp"
                asset = save_part(np.asarray(image), str(tmp))
                name = f"{asset['sha256']}.{spec['slot']}.webp"
                destination = parts_root / name
                if destination.exists():
                    tmp.unlink()
                else:
                    tmp.replace(destination)
                decoded = Image.open(destination).convert("RGBA")
                assembled.alpha_composite(decoded)
                bounds = decoded.getbbox()
                if bounds is None:
                    raise ValueError(f"{spec['slot']} is empty after encoding")
                explode_index = 0 if spec["slot"] == "body" else z_order
                part_rows.append({
                    "slot": spec["slot"],
                    "variantKey": None,
                    "zOrder": z_order,
                    "explodeIndex": explode_index,
                    "bounds": _bounds_dict(bounds),
                    "assembled": {"x": 0, "y": 0},
                    "exploded": {"dx": 0, "dy": 0},
                    "image": f"parts/{name}",
                    "storeKey": f"kits/paired-psd-parts/{name}",
                    **asset,
                    "width": 1000,
                    "height": 1100,
                    "derivation": "psd-layer",
                    "sourceLayers": spec["layers"],
                })

            body = next(part for part in part_rows if part["slot"] == "body")
            offsets = exploded_offsets(part_rows)
            for index, part in enumerate((p for p in part_rows if p["slot"] != "body"), 1):
                part["explodeIndex"] = index
                part["exploded"]["dy"] = offsets[part["slot"]]

            parity_result = parity(assembled, Image.open(plate_path))
            if not parity_result["ok"]:
                raise ValueError(f"plate parity failed: {parity_result}")

            sku_root = output / sku
            sku_root.mkdir(parents=True, exist_ok=True)
            assembled.convert("RGB").save(sku_root / "assembled.webp", quality=90)
            exploded = Image.new("RGBA", (1000, 1100), "white")
            frame = exploded_frame(part_rows)
            for part in part_rows:
                image = Image.open(output / part["image"]).convert("RGBA")
                scaled = image.resize(
                    (round(image.width * frame["scale"]), round(image.height * frame["scale"])),
                    Image.Resampling.LANCZOS,
                )
                x = round(frame["x"] + part["exploded"]["dx"] * frame["scale"])
                y = round(frame["y"] + part["exploded"]["dy"] * frame["scale"])
                exploded.alpha_composite(scaled, (x, y))
            exploded.convert("RGB").save(sku_root / "exploded.webp", quality=90)

            record.update({
                "graceSku": product.get("graceSku"),
                "familyId": row["familyId"],
                "plateSha256": row["plate"]["sha256"],
                "canvas": {"width": 1000, "height": 1100},
                "anchors": {
                    "axisX": 500,
                    "neckAxisX": 500,
                    "seatY": body["bounds"]["top"],
                    "baselineY": body["bounds"]["bottom"],
                    "pxPerMm": None,
                },
                "parts": part_rows,
                "completeness": recipe.get("completeness", "full"),
                "three": None,
                "source": {
                    "library": "master-paired-psd",
                    "path": row["plate"]["sourceRelPath"],
                    "releaseVersion": row["plate"]["sourceSha256"],
                },
                "mappingEvidence": {
                    "reviewedBy": recipe["reviewedBy"],
                    "evidence": recipe["evidence"],
                    "onSource": row["plate"]["sourceRelPath"],
                    "offSource": str(off_path.relative_to(MASTER)) if off_path else None,
                    "sharedBodyTranslation": list(translation),
                },
                "gates": {"alpha": alpha_results, "parity": parity_result},
                "reviewRequired": "visual assembled and exploded review before publishing",
                "status": "candidate",
            })
            (sku_root / "kit.json").write_text(json.dumps(record, indent=2))
        except Exception as error:
            record["reason"] = f"{type(error).__name__}: {error}"
        results.append(record)

    manifest_out = {
        "generatedAt": int(time.time() * 1000),
        "builder": "paired-psd-kit 1",
        "partial": False,
        "rows": results,
        "counts": dict(Counter(row["status"] for row in results)),
    }
    (output / "manifest.json").write_text(json.dumps(manifest_out, indent=2))
    print(dict(Counter(row["status"] for row in results)))
    return 1 if any(row["status"] != "candidate" for row in results) else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", type=Path, required=True)
    parser.add_argument("--published-plates", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--recipes", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    raise SystemExit(build(parser.parse_args()))


if __name__ == "__main__":
    main()

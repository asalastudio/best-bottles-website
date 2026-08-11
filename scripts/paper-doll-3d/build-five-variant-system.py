#!/usr/bin/env python3
"""Build protected five-variant working scenes from the approved baseline.

Usage:
    blender -b APPROVED.blend -P build-five-variant-system.py -- \
        --variant clear --output pipeline/.../five-variant/clear.blend

The script is intentionally additive. It refuses to save over the locked
baseline and asserts that protected scene elements have not drifted.
"""

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "scripts/paper-doll-3d/five_variant_contract.py"
LOCKED_BASELINE = (
    ROOT
    / "pipeline/paper-doll-3d/master/locked/"
    "009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend"
).resolve()
WORKING_ROOT = (
    ROOT / "pipeline/paper-doll-3d/master/working/five-variant"
).resolve()
BASELINE_SHA256 = "3291d7ecf0c8a289a2e06d9fb334ae758010ad42f53a99ece1863d306d7efd0f"

BODY_NAME = "BB_BTL_CYL_009ML_001"
FINISH_NAME = "BB_FIN_17_415"
PROTECTED_NAMES = (
    "BB_CAM_MASTER",
    "BB_STUDIO_SWEEP",
    "BB_LIGHT_KEY_SOFTBOX",
    "BB_CARD_FILL_RIGHT",
    "BB_CARD_TOP",
    "BB_LIGHT_SWEEP_WASH",
    FINISH_NAME,
)


def _load_contract():
    spec = importlib.util.spec_from_file_location("bb_five_variant_contract", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault(spec.name, module)
    spec.loader.exec_module(module)
    return module


contract = _load_contract()


def _rounded(value, digits=6):
    return round(float(value), digits)


def mesh_fingerprint(obj):
    """Hash evaluated-independent mesh coordinates and polygon topology."""
    if obj.type != "MESH":
        raise TypeError(f"{obj.name} is not a mesh")
    digest = hashlib.sha256()
    digest.update(f"v={len(obj.data.vertices)};p={len(obj.data.polygons)};".encode())
    for vertex in obj.data.vertices:
        digest.update(
            ("%.6f,%.6f,%.6f;" % tuple(vertex.co)).encode("ascii")
        )
    for polygon in obj.data.polygons:
        digest.update((",".join(str(i) for i in polygon.vertices) + ";").encode("ascii"))
    return digest.hexdigest()


def _input_value(value):
    if isinstance(value, (int, float, bool, str)):
        return value
    try:
        return tuple(_rounded(component) for component in value)
    except (TypeError, ValueError):
        return str(value)


def material_fingerprint(material):
    if material is None:
        return None
    state = {"name": material.name, "use_nodes": material.use_nodes}
    if material.use_nodes:
        nodes = []
        for node in sorted(material.node_tree.nodes, key=lambda item: item.name):
            inputs = {}
            for socket in node.inputs:
                if hasattr(socket, "default_value"):
                    inputs[socket.name] = _input_value(socket.default_value)
            nodes.append((node.bl_idname, node.name, inputs))
        links = sorted(
            (link.from_node.name, link.from_socket.name,
             link.to_node.name, link.to_socket.name)
            for link in material.node_tree.links
        )
        state.update(nodes=nodes, links=links)
    return hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest()


def object_snapshot(obj):
    result = {
        "type": obj.type,
        "location": tuple(_rounded(v) for v in obj.location),
        "rotation": tuple(_rounded(v) for v in obj.rotation_euler),
        "scale": tuple(_rounded(v) for v in obj.scale),
    }
    if obj.type == "MESH":
        result["mesh"] = mesh_fingerprint(obj)
        result["materials"] = tuple(
            material_fingerprint(material) for material in obj.data.materials
        )
    elif obj.type == "CAMERA":
        result["lens"] = _rounded(obj.data.lens)
        result["sensor_width"] = _rounded(obj.data.sensor_width)
    return result


def protected_snapshot():
    missing = [name for name in PROTECTED_NAMES if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError(f"baseline is missing protected objects: {missing}")
    return {name: object_snapshot(bpy.data.objects[name]) for name in PROTECTED_NAMES}


def _safe_output(output):
    path = Path(output).expanduser().resolve()
    if path == LOCKED_BASELINE:
        raise ValueError("refusing to overwrite the immutable approved baseline")
    if WORKING_ROOT not in path.parents:
        raise ValueError(f"working scene must be saved below {WORKING_ROOT}")
    return path


def build_variant(name, *, save=False, output=None):
    if name not in contract.VARIANTS:
        raise ValueError(f"unknown variant {name!r}; choose {sorted(contract.VARIANTS)}")
    before = protected_snapshot()
    scene = bpy.context.scene
    scene["bb_variant"] = name
    scene["bb_source_baseline"] = str(LOCKED_BASELINE)
    scene["bb_source_baseline_sha256"] = BASELINE_SHA256
    scene["bb_geometry_contract"] = (
        "approved smooth body" if not contract.VARIANTS[name].allows_body_geometry_change
        else "dedicated molded helical body"
    )
    after = protected_snapshot()
    if before != after:
        raise AssertionError("protected baseline state changed during variant build")
    if save:
        if output is None:
            raise ValueError("output is required when save=True")
        path = _safe_output(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
        print(f"BB_VARIANT_SAVED {name} {path}")
    return scene


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", required=True, choices=sorted(contract.VARIANTS))
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(argv)


def main():
    args = parse_args()
    build_variant(args.variant, save=True, output=args.output)


if __name__ == "__main__":
    main()

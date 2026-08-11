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
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


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


def object_snapshot(obj, *, include_materials=True):
    result = {
        "type": obj.type,
        "location": tuple(_rounded(v) for v in obj.location),
        "rotation": tuple(_rounded(v) for v in obj.rotation_euler),
        "scale": tuple(_rounded(v) for v in obj.scale),
    }
    if obj.type == "MESH":
        result["mesh"] = mesh_fingerprint(obj)
        if include_materials:
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
    return {
        name: object_snapshot(
            bpy.data.objects[name], include_materials=(name != FINISH_NAME)
        )
        for name in PROTECTED_NAMES
    }


def build_glass_material(name):
    """Return the calibrated material for one approved family variant."""
    if name not in contract.VARIANTS:
        raise ValueError(f"unknown glass variant {name!r}")
    spec = contract.VARIANTS[name]
    material_name = f"BB_MAT_GLASS_{name.upper()}_FIVE_VARIANT"
    material = bpy.data.materials.get(material_name)
    if material is not None:
        return material

    material = bpy.data.materials.new(material_name)
    material.use_nodes = True
    material.use_fake_user = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    output.location = (320, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    shader.location = (-40, 40)
    shader.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    shader.inputs["Transmission Weight"].default_value = 1.0
    shader.inputs["IOR"].default_value = 1.5
    shader.inputs["Roughness"].default_value = spec.roughness
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])

    if spec.frosted:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.name = "Uniform Frost Microstructure"
        noise.location = (-650, -100)
        noise.inputs["Scale"].default_value = 38.0
        noise.inputs["Detail"].default_value = 2.0
        noise.inputs["Roughness"].default_value = 0.55
        bump = nodes.new("ShaderNodeBump")
        bump.name = "Uniform Frost Micro Normal"
        bump.location = (-300, -100)
        bump.inputs["Strength"].default_value = 0.10
        bump.inputs["Distance"].default_value = 0.025
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])

    if spec.absorption_color is not None:
        volume = nodes.new("ShaderNodeVolumeAbsorption")
        volume.name = f"{name.title()} Volume Absorption"
        volume.location = (-40, -180)
        volume.inputs["Color"].default_value = (*spec.absorption_color, 1.0)
        volume.inputs["Density"].default_value = spec.density
        links.new(volume.outputs["Volume"], output.inputs["Volume"])

    material["bb_variant"] = name
    material["bb_polished"] = not spec.frosted
    return material


def _lighting_collection():
    collection = bpy.data.collections.get("LIGHTING")
    if collection is None:
        collection = bpy.data.collections.new("LIGHTING")
        bpy.context.scene.collection.children.link(collection)
    return collection


def ensure_reflection_strip():
    """Create the shared glossy-only vertical reflection card."""
    existing = bpy.data.objects.get("BB_CARD_GLASS_REFLECTION_STRIP")
    if existing is not None:
        return existing

    width, height = 55.0, 240.0
    mesh = bpy.data.meshes.new("BB_CARD_GLASS_REFLECTION_STRIP_MESH")
    mesh.from_pydata(
        [
            (-width / 2, -height / 2, 0.0),
            (width / 2, -height / 2, 0.0),
            (width / 2, height / 2, 0.0),
            (-width / 2, height / 2, 0.0),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()

    material = bpy.data.materials.new("BB_MAT_GLASS_REFLECTION_STRIP")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    emission.inputs["Strength"].default_value = 4.0
    light_path = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(light_path.outputs["Is Glossy Ray"], mix.inputs[0])
    links.new(transparent.outputs["BSDF"], mix.inputs[1])
    links.new(emission.outputs["Emission"], mix.inputs[2])
    links.new(mix.outputs["Shader"], output.inputs["Surface"])
    mesh.materials.append(material)

    card = bpy.data.objects.new("BB_CARD_GLASS_REFLECTION_STRIP", mesh)
    card.location = (-95.0, -135.0, 105.0)
    target = Vector((0.0, 0.0, 38.0))
    card.rotation_euler = (target - card.location).to_track_quat("-Z", "Y").to_euler()
    card.visible_camera = False
    card.visible_diffuse = False
    card.visible_transmission = False
    card.visible_shadow = False
    card.visible_glossy = True
    card.show_name = True
    card["bb_role"] = "reflection_only_softbox"
    card["bb_dimensions_mm"] = "55x240"
    _lighting_collection().objects.link(card)
    return card


def _assign_variant_material(name):
    material = build_glass_material(name)
    for object_name in (BODY_NAME, FINISH_NAME):
        obj = bpy.data.objects[object_name]
        obj.data.materials.clear()
        obj.data.materials.append(material)
    return material


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
    _assign_variant_material(name)
    ensure_reflection_strip()
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

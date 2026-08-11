#!/usr/bin/env python3
"""Build the isolated high-key cobalt correction scene and density bracket."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


def _load_luxury_builder():
    path = SCRIPT_DIR / "build-9ml-luxury-glass-studio.py"
    spec = importlib.util.spec_from_file_location("bb_luxury_shared_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


shared = _load_luxury_builder()


def _srgb_channel_to_linear(channel):
    value = channel / 255.0
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(value):
    value = value.lstrip("#")
    if len(value) != 6:
        raise ValueError(f"expected six-digit RGB hex, got {value!r}")
    channels = tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
    return tuple(_srgb_channel_to_linear(channel) for channel in channels) + (1.0,)


def _new_group_material(name, roughness, color, density):
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_fake_user = True
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (280, 0)
    group = nodes.new("ShaderNodeGroup")
    group.name = "BB_CORRECTION_GLASS_INSTANCE"
    group.node_tree = shared.ensure_master_group()
    group.location = (-80, 0)
    group.inputs["IOR"].default_value = 1.50
    group.inputs["surface_roughness"].default_value = roughness
    group.inputs["transmission"].default_value = 1.0
    group.inputs["absorption_color"].default_value = (*color, 1.0)
    group.inputs["absorption_density"].default_value = density
    group.inputs["frost_amount"].default_value = 0.0
    group.inputs["micro_roughness_amount"].default_value = 0.0
    group.inputs["micro_roughness_scale"].default_value = 420.0
    group.inputs["micro_normal_strength"].default_value = 0.0
    links.new(group.outputs["Surface"], output.inputs["Surface"])
    links.new(group.outputs["Volume"], output.inputs["Volume"])
    material["bb_cobalt_correction"] = True
    material["bb_absorption_density"] = density
    return material


def ensure_correction_materials():
    materials = {
        "clear": _new_group_material(
            "BB_CORR_CLEAR",
            contract.COBALT_CORRECTION.clear_roughness,
            (1.0, 1.0, 1.0),
            0.0,
        )
    }
    for percentage, density in contract.CORRECTION_COBALT_DENSITIES.items():
        materials[percentage] = _new_group_material(
            f"BB_CORR_COBALT_{percentage}",
            contract.COBALT_CORRECTION.cobalt_roughness,
            (0.003, 0.012, 0.92),
            density,
        )
    return materials


def _correction_collection():
    name = contract.COBALT_CORRECTION.collection_name
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _aim(obj, target, axis="-Z"):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat(axis, "Y").to_euler()


def _scrim_material():
    material = bpy.data.materials.get("BB_MAT_CORRECTION_WHITE_SCRIM")
    if material is not None:
        return material
    material = bpy.data.materials.new("BB_MAT_CORRECTION_WHITE_SCRIM")
    material.use_nodes = True
    material.diffuse_color = (0.95, 0.95, 0.95, 1.0)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.95, 0.95, 0.95, 1.0)
    principled.inputs["Roughness"].default_value = 1.0
    principled.inputs["Specular IOR Level"].default_value = 0.2
    # A real illuminated scrim is a luminous diffusing surface.  The emission
    # keeps its glass reflection neutral and graduated without exposing the
    # hard Area-light rectangle behind it.
    principled.inputs["Emission Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs["Emission Strength"].default_value = 4.5

    # Feather all four boundaries.  A photographed diffusion frame never
    # produces a mathematically hard reflected rectangle; its illuminated
    # fabric rolls off toward the frame.  Generated coordinates make this
    # independent of the scrim's physical dimensions.
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    texcoord = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    x_center = nodes.new("ShaderNodeMath")
    x_center.operation = "SUBTRACT"
    x_center.inputs[1].default_value = 0.5
    x_abs = nodes.new("ShaderNodeMath")
    x_abs.operation = "ABSOLUTE"
    x_double = nodes.new("ShaderNodeMath")
    x_double.operation = "MULTIPLY"
    x_double.inputs[1].default_value = 2.0
    x_fade = nodes.new("ShaderNodeMapRange")
    x_fade.interpolation_type = "SMOOTHERSTEP"
    x_fade.clamp = True
    x_fade.inputs["From Min"].default_value = 0.52
    x_fade.inputs["From Max"].default_value = 1.0
    x_fade.inputs["To Min"].default_value = 1.0
    x_fade.inputs["To Max"].default_value = 0.0

    y_center = nodes.new("ShaderNodeMath")
    y_center.operation = "SUBTRACT"
    y_center.inputs[1].default_value = 0.5
    y_abs = nodes.new("ShaderNodeMath")
    y_abs.operation = "ABSOLUTE"
    y_double = nodes.new("ShaderNodeMath")
    y_double.operation = "MULTIPLY"
    y_double.inputs[1].default_value = 2.0
    y_fade = nodes.new("ShaderNodeMapRange")
    y_fade.interpolation_type = "SMOOTHERSTEP"
    y_fade.clamp = True
    y_fade.inputs["From Min"].default_value = 0.68
    y_fade.inputs["From Max"].default_value = 1.0
    y_fade.inputs["To Min"].default_value = 1.0
    y_fade.inputs["To Max"].default_value = 0.0

    edge_product = nodes.new("ShaderNodeMath")
    edge_product.operation = "MULTIPLY"
    emission_gain = nodes.new("ShaderNodeMath")
    emission_gain.operation = "MULTIPLY"
    emission_gain.inputs[1].default_value = 4.5

    links.new(texcoord.outputs["Generated"], separate.inputs["Vector"])
    links.new(separate.outputs["X"], x_center.inputs[0])
    links.new(x_center.outputs[0], x_abs.inputs[0])
    links.new(x_abs.outputs[0], x_double.inputs[0])
    links.new(x_double.outputs[0], x_fade.inputs["Value"])
    links.new(separate.outputs["Y"], y_center.inputs[0])
    links.new(y_center.outputs[0], y_abs.inputs[0])
    links.new(y_abs.outputs[0], y_double.inputs[0])
    links.new(y_double.outputs[0], y_fade.inputs["Value"])
    links.new(x_fade.outputs["Result"], edge_product.inputs[0])
    links.new(y_fade.outputs["Result"], edge_product.inputs[1])
    links.new(edge_product.outputs[0], emission_gain.inputs[0])
    links.new(emission_gain.outputs[0], principled.inputs["Emission Strength"])
    return material


def _ensure_scrim(spec, collection):
    obj = bpy.data.objects.get(spec.name)
    if obj is None:
        width = spec.width_mm
        height = spec.height_mm
        mesh = bpy.data.meshes.new(f"{spec.name}_MESH")
        mesh.from_pydata(
            [
                (-width * 0.5, -height * 0.5, 0.0),
                (width * 0.5, -height * 0.5, 0.0),
                (width * 0.5, height * 0.5, 0.0),
                (-width * 0.5, height * 0.5, 0.0),
            ],
            [],
            [(0, 1, 2, 3)],
        )
        mesh.materials.append(_scrim_material())
        obj = bpy.data.objects.new(spec.name, mesh)
        collection.objects.link(obj)
    obj.location = spec.location_mm
    _aim(obj, spec.target_mm, "Z")
    obj.visible_camera = False
    obj.visible_glossy = True
    obj.visible_diffuse = True
    obj.visible_transmission = False
    obj.visible_shadow = True
    obj["bb_diffusion_scrim"] = True
    obj["bb_width_mm"] = spec.width_mm
    obj["bb_height_mm"] = spec.height_mm
    return obj


def _ensure_area(spec, collection):
    obj = bpy.data.objects.get(spec.name)
    if obj is None:
        data = bpy.data.lights.new(spec.name, "AREA")
        obj = bpy.data.objects.new(spec.name, data)
        collection.objects.link(obj)
    obj.data.type = "AREA"
    obj.data.shape = "RECTANGLE"
    obj.data.size = spec.width_mm
    obj.data.size_y = spec.height_mm
    obj.data.energy = spec.energy_watts
    obj.data.color = (1.0, 1.0, 1.0)
    if spec.name == "BB_CORR_BACKDROP_WASH":
        # Illuminate the physical sweep without adding another bottle reflection.
        if hasattr(obj.data, "diffuse_factor"):
            obj.data.diffuse_factor = 1.0
        if hasattr(obj.data, "specular_factor"):
            obj.data.specular_factor = 0.0
        if hasattr(obj.data, "transmission_factor"):
            obj.data.transmission_factor = 0.0
    obj.location = spec.location_mm
    _aim(obj, spec.target_mm, "-Z")
    obj.visible_camera = False
    obj.visible_glossy = spec.visible_glossy
    obj["bb_scrim_illuminator"] = spec.name != "BB_CORR_TOP_FILL"
    return obj


def _ensure_backdrop_panel(collection, material):
    """Create an oversized transmitted bone field behind the bottle.

    The inherited cyclorama remains the physical floor/contact surface.  This
    out-of-frame panel removes the cyclorama transition from refracted body
    rays without contributing a glossy rectangular reflection.
    """
    name = "BB_CORR_BACKDROP_PANEL"
    obj = bpy.data.objects.get(name)
    if obj is None:
        width = 420.0
        height = 320.0
        mesh = bpy.data.meshes.new(f"{name}_MESH")
        mesh.from_pydata(
            [
                (-width * 0.5, -height * 0.5, 0.0),
                (width * 0.5, -height * 0.5, 0.0),
                (width * 0.5, height * 0.5, 0.0),
                (-width * 0.5, height * 0.5, 0.0),
            ],
            [],
            [(0, 1, 2, 3)],
        )
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    obj.location = (0.0, 115.0, 105.0)
    _aim(obj, (0.0, -305.0, 36.0), "Z")
    obj.visible_camera = True
    obj.visible_transmission = True
    obj.visible_glossy = False
    obj.visible_diffuse = True
    obj.visible_shadow = False
    obj["bb_correction_backdrop_panel"] = True
    return obj


def _ensure_correction_floor(collection, rgba):
    name = "BB_CORR_FLOOR"
    material = bpy.data.materials.get("BB_MAT_CORRECTION_FLOOR_BONE")
    if material is None:
        material = bpy.data.materials.new("BB_MAT_CORRECTION_FLOOR_BONE")
        material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = rgba
        principled.inputs["Roughness"].default_value = 0.96
        principled.inputs["Emission Color"].default_value = rgba
        principled.inputs["Emission Strength"].default_value = 2.0
        material.diffuse_color = rgba
    obj = bpy.data.objects.get(name)
    if obj is None:
        width = 520.0
        depth = 680.0
        mesh = bpy.data.meshes.new(f"{name}_MESH")
        mesh.from_pydata(
            [
                (-width * 0.5, -depth * 0.5, -0.1),
                (width * 0.5, -depth * 0.5, -0.1),
                (width * 0.5, depth * 0.5, -0.1),
                (-width * 0.5, depth * 0.5, -0.1),
            ],
            [],
            [(0, 1, 2, 3)],
        )
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    obj.visible_camera = True
    # Keep the physical contact/shadow surface visible to the camera while
    # excluding its planar horizon from recursive glass rays.  Otherwise the
    # floor/backdrop transition refracts into a false centered slab.
    obj.visible_transmission = False
    obj.visible_glossy = False
    obj.visible_diffuse = True
    obj.visible_shadow = True
    obj["bb_correction_physical_floor"] = True
    return obj


def _configure_bright_bone():
    rgba = hex_to_linear_rgba(contract.COBALT_CORRECTION.background_hex)
    sweep = bpy.data.objects.get("BB_STUDIO_SWEEP")
    if sweep is None:
        raise RuntimeError("approved seamless sweep is missing")
    material = bpy.data.materials.get("BB_MAT_CORRECTION_BRIGHT_BONE")
    if material is None:
        material = bpy.data.materials.new("BB_MAT_CORRECTION_BRIGHT_BONE")
        material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = rgba
        principled.inputs["Roughness"].default_value = 0.94
        # A subtle luminous component gives the physical sweep a high-key
        # catalog exposure without raising glass/specular exposure globally.
        principled.inputs["Emission Color"].default_value = rgba
        principled.inputs["Emission Strength"].default_value = 2.0
    material.diffuse_color = rgba
    sweep.data.materials.clear()
    sweep.data.materials.append(material)
    sweep.hide_render = False

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("BB_WORLD_CORRECTION_BRIGHT_BONE")
        bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba
    background.inputs["Strength"].default_value = contract.COBALT_CORRECTION.world_strength
    bpy.context.scene["bb_background_hex"] = contract.COBALT_CORRECTION.background_hex
    return material


def _disable_failed_rig():
    disabled = []
    for obj in bpy.data.objects:
        if (
            obj.name in shared.LEGACY_EMITTERS
            or obj.name.startswith("BB_LUX_")
            or obj.name.startswith("BB_FLAG_")
            or obj.name.startswith("BB_CARD_")
            or obj.get("bb_negative_fill")
        ):
            obj.hide_render = True
            disabled.append(obj.name)
    return disabled


def assign_correction_variant(value):
    materials = ensure_correction_materials()
    if value not in materials:
        raise ValueError(f"unknown correction variant {value!r}")
    body = bpy.data.objects[contract.BODY_NAME]
    body.data.materials.clear()
    body.data.materials.append(materials[value])
    bpy.context.scene["bb_correction_variant"] = str(value)
    bpy.context.scene["bb_variant"] = "clear" if value == "clear" else f"cobalt-{value}"
    return materials[value]


def build_correction_in_memory():
    body = bpy.data.objects[contract.BODY_NAME]
    before = contract.object_snapshot(body)
    camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    audit = shared.audit_geometry()
    ensure_correction_materials()
    disabled = _disable_failed_rig()
    collection = _correction_collection()
    for spec in contract.CORRECTION_SCRIMS:
        _ensure_scrim(spec, collection)
    for spec in contract.CORRECTION_LIGHTS:
        _ensure_area(spec, collection)
    background_material = _configure_bright_bone()
    rgba = hex_to_linear_rgba(contract.COBALT_CORRECTION.background_hex)
    _ensure_backdrop_panel(collection, background_material)
    _ensure_correction_floor(collection, rgba)
    # The inherited sweep transition refracts as a centered blue slab.  Keep
    # it in the file for provenance, but replace it at render time only.
    bpy.data.objects["BB_STUDIO_SWEEP"].hide_render = True
    shared.configure_camera()
    shared.configure_cycles()
    shared.configure_color_management()
    bpy.context.scene.view_settings.look = "None"
    bpy.context.scene.view_settings.exposure = contract.COBALT_CORRECTION.exposure
    assign_correction_variant("clear")
    for name in (contract.BODY_NAME, contract.FINISH_NAME, contract.FINISH_MASTER_NAME):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_select = True
            obj["bb_geometry_locked"] = True
    scene = bpy.context.scene
    scene["bb_cobalt_correction_version"] = contract.COBALT_CORRECTION.version
    scene["bb_disabled_failed_rig"] = ",".join(disabled)
    scene["bb_geometry_audit"] = json.dumps(audit, sort_keys=True)
    if contract.object_snapshot(body) != before:
        raise AssertionError("cobalt correction changed approved body geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera_before:
        raise AssertionError("cobalt correction changed approved camera")
    return scene


def _safe_output(path, replace=False):
    path = Path(path).expanduser().resolve()
    root = contract.CORRECTION_WORKING_DIR.resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"correction scenes must remain below {root}")
    if path.exists() and not replace:
        raise FileExistsError(f"refusing to overwrite {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def save_correction_set(output_dir, replace=False):
    output_dir = Path(output_dir).expanduser().resolve()
    build_correction_in_memory()
    outputs = {}
    variants = (
        ("master", "clear", "009ml-cobalt-correction-master.blend"),
        ("clear", "clear", "009ml-clear-calibration.blend"),
        ("cobalt_25", 25, "009ml-cobalt-25.blend"),
        ("cobalt_50", 50, "009ml-cobalt-50.blend"),
        ("cobalt_75", 75, "009ml-cobalt-75.blend"),
        ("cobalt_100", 100, "009ml-cobalt-100.blend"),
    )
    geometry_hash = contract.geometry_fingerprint(bpy.data.objects[contract.BODY_NAME].data)
    for key, material_key, filename in variants:
        path = _safe_output(output_dir / filename, replace)
        assign_correction_variant(material_key)
        if contract.geometry_fingerprint(bpy.data.objects[contract.BODY_NAME].data) != geometry_hash:
            raise AssertionError(f"geometry changed while saving {key}")
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
        outputs[key] = path
    assign_correction_variant("clear")
    return outputs


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--replace-generated", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    outputs = save_correction_set(args.output_dir, args.replace_generated)
    for name, path in outputs.items():
        print("BB_COBALT_CORRECTION", name, path)


if __name__ == "__main__":
    main()

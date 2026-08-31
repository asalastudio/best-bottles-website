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


def _new_group_material(name, roughness, color, density, node_group=None):
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
    group.node_tree = node_group or shared.ensure_master_group()
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


def ensure_reference_v2_materials():
    target = contract.COBALT_REFERENCE_V2
    group_name = "BB_GLASS_MASTER_COBALT_REFERENCE_V2"
    master = bpy.data.node_groups.get(group_name)
    if master is None:
        master = shared.ensure_master_group().copy()
        master.name = group_name
        master.use_fake_user = True
    dielectric = master.nodes.get("Physical Dielectric Glass")
    dielectric.inputs["Base Color"].default_value = (*target.transmission_tint, 1.0)
    materials = {
        "clear": _new_group_material(
            "BB_REF_V2_CLEAR",
            target.clear_roughness,
            (1.0, 1.0, 1.0),
            0.0,
            shared.ensure_master_group(),
        )
    }
    for percentage, density in contract.REFERENCE_V2_COBALT_DENSITIES.items():
        materials[percentage] = _new_group_material(
            f"BB_REF_V2_COBALT_{percentage}",
            target.cobalt_roughness,
            target.absorption_color,
            density,
            master,
        )
        materials[percentage]["bb_reference_photo"] = "Photo 1.jpg"
        materials[percentage]["bb_reference_v2"] = True
    return materials


def ensure_gloss_refraction_materials():
    """Create isolated optical derivatives of the protected V1 material."""
    baseline = ensure_reference_v2_materials()[
        contract.COBALT_FINAL_LOCK.selected_density_percentage
    ]
    materials = {}
    for key, preset in contract.GLOSS_REFRACTION_PRESETS.items():
        if key == "baseline-v1":
            material = baseline
        else:
            material = bpy.data.materials.get(preset.material_name)
            if material is None:
                material = baseline.copy()
                material.name = preset.material_name
                material.use_fake_user = True
        group = next(
            node
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        group.inputs["absorption_density"].default_value = preset.absorption_density
        group.inputs["surface_roughness"].default_value = preset.surface_roughness
        material["bb_gloss_refraction_candidate"] = key
        material["bb_absorption_density"] = preset.absorption_density
        material["bb_surface_roughness"] = preset.surface_roughness
        material["bb_material_only_derivative"] = key != "baseline-v1"
        materials[key] = material
    return materials


def ensure_neutral_surface_tint_material():
    """Copy the luminous-polished glass and neutralize only its surface tint."""
    preset = contract.NEUTRAL_SURFACE_TINT
    source = ensure_gloss_refraction_materials()["luminous-polished"]
    source_group = next(
        node for node in source.node_tree.nodes if node.bl_idname == "ShaderNodeGroup"
    )

    material = bpy.data.materials.get(preset.material_name)
    if material is None:
        material = source.copy()
        material.name = preset.material_name
        material.use_fake_user = True
    candidate_group = next(
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeGroup"
    )

    neutral_master = bpy.data.node_groups.get(preset.node_group_name)
    if neutral_master is None:
        neutral_master = source_group.node_tree.copy()
        neutral_master.name = preset.node_group_name
        neutral_master.use_fake_user = True
    candidate_group.node_tree = neutral_master

    # Group-node input defaults live on each material instance. Copy all of
    # them literally from the protected luminous-polished source.
    for source_socket in source_group.inputs:
        target_socket = candidate_group.inputs[source_socket.name]
        value = source_socket.default_value
        target_socket.default_value = tuple(value) if hasattr(value, "__len__") else value

    dielectric = neutral_master.nodes["Physical Dielectric Glass"]
    dielectric.inputs["Base Color"].default_value = (*preset.surface_tint, 1.0)
    material["bb_neutral_surface_tint"] = True
    material["bb_surface_tint"] = ",".join(str(value) for value in preset.surface_tint)
    material["bb_material_only_derivative"] = True
    return material


def _correction_collection():
    name = contract.COBALT_CORRECTION.collection_name
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _reference_v2_collection():
    name = contract.COBALT_REFERENCE_V2.collection_name
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _final_lock_collection():
    name = contract.COBALT_FINAL_LOCK.collection_name
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


def _ensure_curved_hero_scrim(collection, target):
    """Create one seamless wraparound diffusion field with no visible frame edge."""
    name = target.hero_scrim_name
    obj = bpy.data.objects.get(name)
    radius = target.hero_scrim_width_mm * 0.5
    height = target.hero_scrim_height_mm
    segments = 64
    start = math.radians(-target.hero_scrim_wrap_degrees * 0.5)
    sweep = math.radians(target.hero_scrim_wrap_degrees)
    vertices = []
    for index in range(segments + 1):
        angle = start + sweep * (index / segments)
        # Open arc centered toward camera/front. The reflected source covers
        # the bottle curvature; its frame boundaries remain outside view.
        x = radius * math.sin(angle)
        y = -radius * math.cos(angle)
        vertices.extend(((x, y, -height * 0.5), (x, y, height * 0.5)))
    faces = []
    for index in range(segments):
        lower = index * 2
        faces.append((lower, lower + 2, lower + 3, lower + 1))
    if obj is None:
        mesh = bpy.data.meshes.new(f"{name}_MESH")
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    else:
        mesh = obj.data
        mesh.clear_geometry()
    mesh.from_pydata(vertices, [], faces)
    material = bpy.data.materials.get("BB_MAT_REFERENCE_V2_HERO_SCRIM")
    if material is None:
        material = bpy.data.materials.new("BB_MAT_REFERENCE_V2_HERO_SCRIM")
        material.use_nodes = True
        material.diffuse_color = (0.96, 0.96, 0.96, 1.0)
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = (0.96, 0.96, 0.96, 1.0)
        principled.inputs["Roughness"].default_value = 1.0
        principled.inputs["Specular IOR Level"].default_value = 0.1
        principled.inputs["Emission Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Emission Strength"].default_value = target.hero_scrim_emission
    mesh.materials.clear()
    mesh.materials.append(material)
    obj.location = (0.0, 0.0, 40.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.hide_render = False
    obj.visible_camera = False
    # The curved field shapes illumination, but its white fabric is excluded
    # from glossy rays so it cannot paint a stripe or panel across the bottle.
    obj.visible_glossy = False
    obj.visible_diffuse = True
    obj.visible_transmission = False
    obj.visible_shadow = False
    obj["bb_diffusion_scrim"] = True
    obj["bb_reference_v2_hero_scrim"] = True
    obj["bb_curved_diffusion_field"] = True
    obj["bb_width_mm"] = target.hero_scrim_width_mm
    obj["bb_height_mm"] = target.hero_scrim_height_mm
    obj["bb_wrap_degrees"] = target.hero_scrim_wrap_degrees
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


def _ensure_reference_v2_backdrop(collection, material):
    name = "BB_REF_V2_BACKDROP_PANEL"
    obj = bpy.data.objects.get(name)
    if obj is None:
        width, height = 420.0, 320.0
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
    obj.hide_render = False
    obj.visible_camera = True
    obj.visible_transmission = True
    obj.visible_glossy = False
    obj.visible_diffuse = True
    obj.visible_shadow = False
    obj["bb_reference_v2_backdrop"] = True
    return obj


def _ensure_reference_v2_floor(collection, rgba):
    name = "BB_REF_V2_FLOOR"
    material = bpy.data.materials.get("BB_MAT_REFERENCE_V2_FLOOR_BONE")
    if material is None:
        material = bpy.data.materials.new("BB_MAT_REFERENCE_V2_FLOOR_BONE")
        material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = rgba
        principled.inputs["Roughness"].default_value = 0.96
        principled.inputs["Emission Color"].default_value = rgba
        principled.inputs["Emission Strength"].default_value = 2.8
    obj = bpy.data.objects.get(name)
    if obj is None:
        width, depth = 520.0, 680.0
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
    obj.hide_render = False
    obj.visible_camera = True
    obj.visible_transmission = False
    obj.visible_glossy = False
    obj.visible_diffuse = True
    obj.visible_shadow = True
    obj["bb_reference_v2_physical_floor"] = True
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


def _configure_reference_v2_bone():
    target = contract.COBALT_REFERENCE_V2
    rgba = hex_to_linear_rgba(target.background_hex)
    material = bpy.data.materials.get("BB_MAT_REFERENCE_V2_BRIGHT_BONE")
    if material is None:
        material = bpy.data.materials.new("BB_MAT_REFERENCE_V2_BRIGHT_BONE")
        material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = rgba
        principled.inputs["Roughness"].default_value = 0.96
        principled.inputs["Emission Color"].default_value = rgba
        principled.inputs["Emission Strength"].default_value = 2.8
    material.diffuse_color = rgba
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba
    background.inputs["Strength"].default_value = target.world_strength
    bpy.context.scene["bb_background_hex"] = target.background_hex
    return material


def _final_lock_material(name, color, roughness, emission_strength=0.0):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
        material.use_nodes = True
    material.diffuse_color = color
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Specular IOR Level"].default_value = 0.18
    principled.inputs["Emission Color"].default_value = color
    principled.inputs["Emission Strength"].default_value = emission_strength
    return material


def _final_lock_plane(name, collection, width, height, material):
    obj = bpy.data.objects.get(name)
    if obj is None:
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
    obj.hide_render = False
    return obj


def _final_lock_sweep(name, collection, material):
    """Physical seamless with a broad radius; no floor/backdrop horizon."""
    obj = bpy.data.objects.get(name)
    profile = (
        (-335.0, -0.14),
        (62.0, -0.14),
        (83.0, 1.8),
        (101.0, 7.5),
        (117.0, 17.0),
        (130.0, 31.0),
        (140.0, 49.0),
        (146.0, 70.0),
        (148.0, 98.0),
        (148.0, 330.0),
    )
    half_width = 360.0
    vertices = []
    for x in (-half_width, half_width):
        vertices.extend((x, y, z) for y, z in profile)
    count = len(profile)
    faces = []
    for index in range(count - 1):
        faces.append((index, index + 1, count + index + 1, count + index))
    if obj is None:
        mesh = bpy.data.meshes.new(f"{name}_MESH")
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    else:
        mesh = obj.data
        mesh.clear_geometry()
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.clear()
    mesh.materials.append(material)
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.hide_render = False
    return obj


def _ensure_final_lock_scrim(collection):
    target = contract.COBALT_FINAL_LOCK
    scrim_material = bpy.data.materials.get("BB_MAT_FINAL_LEFT_DIFFUSION")
    if scrim_material is None:
        scrim_material = _scrim_material().copy()
        scrim_material.name = "BB_MAT_FINAL_LEFT_DIFFUSION"
        principled = scrim_material.node_tree.nodes.get("Principled BSDF")
        for node in scrim_material.node_tree.nodes:
            if (
                node.bl_idname == "ShaderNodeMath"
                and node.operation == "MULTIPLY"
                and abs(node.inputs[1].default_value - 4.5) < 1e-6
            ):
                node.inputs[1].default_value = target.scrim_emission
        principled.inputs["Emission Strength"].default_value = target.scrim_emission
    name = target.left_scrim_name
    obj = bpy.data.objects.get(name)
    radius = 74.0
    height = 132.0
    segments = 72
    start = math.radians(-132.0)
    sweep = math.radians(264.0)
    vertices = []
    for index in range(segments + 1):
        angle = start + sweep * (index / segments)
        x = radius * math.sin(angle)
        y = -radius * math.cos(angle)
        vertices.extend(((x, y, -height * 0.5), (x, y, height * 0.5)))
    faces = []
    for index in range(segments):
        lower = index * 2
        faces.append((lower, lower + 2, lower + 3, lower + 1))
    if obj is None:
        mesh = bpy.data.meshes.new(f"{name}_MESH")
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    else:
        mesh = obj.data
        mesh.clear_geometry()
    mesh.from_pydata(vertices, [], faces)
    obj.data.materials.clear()
    obj.data.materials.append(scrim_material)
    obj.location = (0.0, 0.0, 48.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.hide_render = False
    obj.visible_camera = False
    obj.visible_glossy = True
    obj.visible_diffuse = False
    obj.visible_transmission = False
    obj.visible_shadow = False
    obj["bb_final_left_diffusion_scrim"] = True
    obj["bb_curved_diffusion_field"] = True
    obj["bb_wrap_degrees"] = 264.0
    return obj


def _ensure_final_lock_background(collection):
    target = contract.COBALT_FINAL_LOCK
    background = hex_to_linear_rgba(target.background_hex)
    floor_color = hex_to_linear_rgba(target.floor_hex)
    floor_material = _final_lock_material(
        "BB_MAT_FINAL_WARM_BONE_FLOOR", floor_color, 0.96, 0.0
    )
    backdrop = _final_lock_sweep(target.backdrop_name, collection, floor_material)
    backdrop.visible_camera = True
    backdrop.visible_transmission = True
    backdrop.visible_glossy = False
    backdrop.visible_diffuse = True
    backdrop.visible_shadow = False
    backdrop["bb_final_warm_bone_backdrop"] = True

    floor = _final_lock_plane(
        target.floor_name, collection, 540.0, 700.0, floor_material
    )
    floor.location = (0.0, 0.0, -0.12)
    floor.rotation_euler = (0.0, 0.0, 0.0)
    floor.visible_camera = True
    floor.visible_transmission = False
    floor.visible_glossy = False
    floor.visible_diffuse = True
    floor.visible_shadow = True
    floor["bb_final_physical_floor"] = True

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("BB_WORLD_COBALT_FINAL_LOCK")
        bpy.context.scene.world = world
    world.use_nodes = True
    world_background = world.node_tree.nodes.get("Background")
    world_background.inputs["Color"].default_value = background
    world_background.inputs["Strength"].default_value = target.world_strength
    return backdrop, floor


def _ensure_base_halo_control(collection):
    """Add a removable glossy-only low card to quiet the refractive base rim."""
    target = contract.COBALT_FINAL_LOCK
    name = target.base_halo_control_name
    obj = bpy.data.objects.get(name)
    radius = target.base_halo_control_radius_mm
    height = target.base_halo_control_height_mm
    segments = 72
    start = math.radians(-target.base_halo_control_wrap_degrees * 0.5)
    sweep = math.radians(target.base_halo_control_wrap_degrees)
    vertices = []
    for index in range(segments + 1):
        angle = start + sweep * (index / segments)
        x = radius * math.sin(angle)
        y = -radius * math.cos(angle)
        vertices.extend(((x, y, -height * 0.5), (x, y, height * 0.5)))
    faces = []
    for index in range(segments):
        lower = index * 2
        faces.append((lower, lower + 2, lower + 3, lower + 1))
    if obj is None:
        mesh = bpy.data.meshes.new(f"{name}_MESH")
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    else:
        mesh = obj.data
        mesh.clear_geometry()
    mesh.from_pydata(vertices, [], faces)

    bone = hex_to_linear_rgba(target.floor_hex)
    reduction = 1.0 - target.base_halo_reduction_percent / 100.0
    neutral = tuple(channel * reduction for channel in bone[:3]) + (1.0,)
    material = _final_lock_material(
        "BB_MAT_FINAL_BASE_HALO_CONTROL_15", neutral, 1.0, 0.0
    )
    mesh.materials.clear()
    mesh.materials.append(material)
    obj.location = (0.0, 0.0, target.base_halo_control_center_z_mm)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.hide_render = False
    obj.visible_camera = False
    obj.visible_glossy = True
    obj.visible_diffuse = False
    obj.visible_transmission = False
    obj.visible_shadow = False
    obj["bb_base_halo_reduction_percent"] = target.base_halo_reduction_percent
    obj["bb_removable_experiment"] = True
    obj["bb_glossy_only"] = True
    return obj


def _disable_nonfinal_studio():
    disabled = []
    final_names = {
        contract.COBALT_FINAL_LOCK.left_key_name,
        contract.COBALT_FINAL_LOCK.left_scrim_name,
        contract.COBALT_FINAL_LOCK.top_fill_name,
        contract.COBALT_FINAL_LOCK.neck_fill_name,
        contract.COBALT_FINAL_LOCK.backdrop_name,
        contract.COBALT_FINAL_LOCK.floor_name,
    }
    for obj in bpy.data.objects:
        if obj.name in final_names:
            continue
        if (
            obj.name in shared.LEGACY_EMITTERS
            or obj.name.startswith("BB_LUX_")
            or obj.name.startswith("BB_CORR_")
            or obj.name.startswith("BB_REF_V2_")
            or obj.name.startswith("BB_FLAG_")
            or obj.name.startswith("BB_CARD_")
            or obj.get("bb_negative_fill")
        ):
            obj.hide_render = True
            disabled.append(obj.name)
    return disabled


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


def assign_reference_v2_variant(value):
    materials = ensure_reference_v2_materials()
    if value not in materials:
        raise ValueError(f"unknown reference V2 variant {value!r}")
    body = bpy.data.objects[contract.BODY_NAME]
    body.data.materials.clear()
    body.data.materials.append(materials[value])
    bpy.context.scene["bb_correction_variant"] = str(value)
    bpy.context.scene["bb_variant"] = "clear" if value == "clear" else f"cobalt-reference-v2-{value}"
    return materials[value]


def build_reference_v2_in_memory():
    """Build a material/lighting-only derivative for the supplied cobalt photo."""
    target = contract.COBALT_REFERENCE_V2
    body = bpy.data.objects[contract.BODY_NAME]
    before = contract.object_snapshot(body)
    camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    audit = shared.audit_geometry()
    ensure_reference_v2_materials()

    disabled = _disable_failed_rig()
    for obj in bpy.data.objects:
        if obj.name.startswith("BB_CORR_"):
            obj.hide_render = True
            disabled.append(obj.name)

    collection = _reference_v2_collection()
    scrims = (
        contract.CorrectionScrimSpec(
            target.hero_scrim_name,
            (-3.0, -72.0, 40.0),
            (0.0, 0.0, 38.0),
            target.hero_scrim_width_mm,
            target.hero_scrim_height_mm,
        ),
    )
    lights = (
        contract.CorrectionLightSpec(
            "BB_REF_V2_HERO_AREA", (-3.0, -118.0, 42.0), (-3.0, -72.0, 40.0),
            128.0, 132.0, target.left_area_watts + target.right_area_watts, False,
        ),
        contract.CorrectionLightSpec(
            "BB_REF_V2_TOP_FILL", (0.0, -40.0, 102.0), (0.0, 0.0, 55.0),
            74.0, 46.0, target.top_fill_watts, False,
        ),
        contract.CorrectionLightSpec(
            "BB_REF_V2_NECK_SEPARATION_FILL",
            (0.0, -88.0, 70.0),
            (0.0, 0.0, 67.0),
            46.0,
            22.0,
            target.neck_separation_fill_watts,
            False,
        ),
    )
    _ensure_curved_hero_scrim(collection, target)
    for spec in lights:
        light = _ensure_area(spec, collection)
        if spec.name == "BB_REF_V2_NECK_SEPARATION_FILL":
            light["bb_thread_separation_fill"] = True

    background_material = _configure_reference_v2_bone()
    rgba = hex_to_linear_rgba(target.background_hex)
    _ensure_reference_v2_backdrop(collection, background_material)
    _ensure_reference_v2_floor(collection, rgba)
    bpy.data.objects["BB_STUDIO_SWEEP"].hide_render = True

    shared.configure_camera()
    shared.configure_cycles()
    shared.configure_color_management()
    bpy.context.scene.view_settings.look = "None"
    bpy.context.scene.view_settings.exposure = target.exposure
    assign_reference_v2_variant("clear")
    for name in (contract.BODY_NAME, contract.FINISH_NAME, contract.FINISH_MASTER_NAME):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_select = True
            obj["bb_geometry_locked"] = True
    scene = bpy.context.scene
    scene["bb_cobalt_correction_version"] = target.version
    scene["bb_reference_photo"] = "Photo 1.jpg"
    scene["bb_selected_density_percentage"] = target.selected_density_percentage
    scene["bb_approved_finish_geometry_sha256"] = (
        contract.APPROVED_FINISH_GEOMETRY_SHA256
    )
    scene["bb_disabled_failed_rig"] = ",".join(sorted(set(disabled)))
    scene["bb_geometry_audit"] = json.dumps(audit, sort_keys=True)
    if contract.object_snapshot(body) != before:
        raise AssertionError("reference V2 changed approved body geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera_before:
        raise AssertionError("reference V2 changed approved camera")
    return scene


def build_final_lock_candidate_in_memory():
    """Combine the approved Photo 2 subject with Photo 1's warm left-key studio."""
    target = contract.COBALT_FINAL_LOCK
    body = bpy.data.objects[contract.BODY_NAME]
    body_mesh_before = contract.geometry_fingerprint(body.data)
    finish_mesh_before = contract.geometry_fingerprint(
        bpy.data.objects[contract.FINISH_MASTER_NAME].data
    )
    camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    audit = shared.audit_geometry()

    ensure_reference_v2_materials()
    disabled = _disable_nonfinal_studio()
    collection = _final_lock_collection()
    _ensure_final_lock_scrim(collection)

    light_specs = (
        contract.CorrectionLightSpec(
            target.left_key_name,
            target.contact_key_location_mm,
            (22.0, 38.0, 0.0),
            target.contact_key_width_mm,
            target.contact_key_height_mm,
            target.contact_key_watts,
            False,
        ),
        contract.CorrectionLightSpec(
            target.top_fill_name,
            (-10.0, -34.0, 116.0),
            (0.0, 0.0, 55.0),
            84.0,
            54.0,
            target.top_fill_watts,
            False,
        ),
        contract.CorrectionLightSpec(
            target.neck_fill_name,
            (-16.0, -76.0, 76.0),
            (0.0, 0.0, 66.0),
            54.0,
            28.0,
            target.neck_fill_watts,
            False,
        ),
    )
    for spec in light_specs:
        light = _ensure_area(spec, collection)
        light.hide_render = False
        light.visible_camera = False
        light.visible_glossy = False
        light.visible_diffuse = True
        light.visible_transmission = True
        light.visible_shadow = True
        if spec.name == target.left_key_name:
            light["bb_shadow_key"] = True
            light["bb_shadow_direction"] = "camera-right"
            light["bb_grounded_contact_pass"] = True
        elif spec.name == target.neck_fill_name:
            light["bb_thread_separation_fill"] = True

    _ensure_final_lock_background(collection)
    assign_reference_v2_variant(target.selected_density_percentage)
    body.rotation_euler.z = math.radians(target.selected_packshot_yaw_degrees)
    body["bb_packshot_yaw_degrees"] = target.selected_packshot_yaw_degrees

    shared.configure_cycles()
    shared.configure_color_management()
    scene = bpy.context.scene
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = target.exposure
    scene.view_settings.gamma = 1.0
    scene["bb_cobalt_final_lock_version"] = target.version
    scene["bb_final_lock_geometry_source"] = "Photo 2"
    scene["bb_final_lock_lighting_source"] = "Photo 1"
    scene["bb_shadow_direction"] = "camera-right"
    scene["bb_contact_shadow_adjustment"] = "existing-left-key-only"
    scene["bb_background_hex"] = target.background_hex
    scene["bb_selected_density_percentage"] = target.selected_density_percentage
    scene["bb_disabled_nonfinal_studio"] = ",".join(sorted(set(disabled)))
    scene["bb_geometry_audit"] = json.dumps(audit, sort_keys=True)
    scene["bb_approved_body_geometry_sha256"] = body_mesh_before
    scene["bb_approved_finish_geometry_sha256"] = finish_mesh_before

    for name in (contract.BODY_NAME, contract.FINISH_NAME, contract.FINISH_MASTER_NAME):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_select = True
            obj["bb_geometry_locked"] = True

    if contract.geometry_fingerprint(body.data) != body_mesh_before:
        raise AssertionError("final lock candidate changed approved body geometry")
    if (
        contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data)
        != finish_mesh_before
    ):
        raise AssertionError("final lock candidate changed approved finish geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera_before:
        raise AssertionError("final lock candidate changed approved camera")
    return scene


def build_base_halo_control_candidate_in_memory():
    """Opt-in removable 15% glossy-only card experiment."""
    scene = build_final_lock_candidate_in_memory()
    card = _ensure_base_halo_control(_final_lock_collection())
    card.hide_render = False
    scene["bb_base_halo_control"] = "15-percent-glossy-only"
    return scene


def build_grounded_contact_v2_candidate_in_memory():
    """Opt-in V2: tighten only the existing left physical contact-shadow key."""
    target = contract.COBALT_FINAL_LOCK
    scene = build_final_lock_candidate_in_memory()
    key = bpy.data.objects[target.left_key_name]
    key.location = target.contact_v2_key_location_mm
    _aim(key, (22.0, 38.0, 0.0), "-Z")
    key.data.size = target.contact_v2_key_width_mm
    key.data.size_y = target.contact_v2_key_height_mm
    key.data.energy = target.contact_v2_key_watts
    key["bb_grounded_contact_v2"] = True
    key["bb_shadow_direction"] = "camera-right"
    halo_card = bpy.data.objects.get(target.base_halo_control_name)
    if halo_card is not None:
        halo_card.hide_render = True
    scene["bb_contact_shadow_adjustment"] = "v2-tighter"
    scene["bb_base_halo_control"] = "disabled"
    return scene


def build_gloss_refraction_candidate_in_memory(value):
    """Assign one optical candidate without rebuilding or altering the V1 studio."""
    if value not in contract.GLOSS_REFRACTION_PRESETS:
        raise ValueError(f"unknown gloss-refraction candidate {value!r}")
    scene = bpy.context.scene
    if scene.get("bb_cobalt_final_lock_version") != contract.COBALT_FINAL_LOCK.version:
        raise RuntimeError("gloss-refraction candidates require the protected final-lock V1 scene")

    body = bpy.data.objects[contract.BODY_NAME]
    body_before = contract.object_snapshot(body)
    finish_before = contract.geometry_fingerprint(
        bpy.data.objects[contract.FINISH_MASTER_NAME].data
    )
    camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    material = ensure_gloss_refraction_materials()[value]
    body.data.materials.clear()
    body.data.materials.append(material)

    preset = contract.GLOSS_REFRACTION_PRESETS[value]
    scene["bb_gloss_refraction_version"] = "gloss-refraction-bracket-v1"
    scene["bb_gloss_refraction_variant"] = value
    scene["bb_gloss_refraction_absorption_density"] = preset.absorption_density
    scene["bb_gloss_refraction_surface_roughness"] = preset.surface_roughness
    scene["bb_gloss_refraction_scope"] = "material-only"

    if contract.object_snapshot(body) != body_before:
        raise AssertionError("gloss-refraction candidate changed approved body state")
    if (
        contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data)
        != finish_before
    ):
        raise AssertionError("gloss-refraction candidate changed approved finish geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera_before:
        raise AssertionError("gloss-refraction candidate changed approved camera")
    return scene


def build_gloss_refraction_scrim_calibration_in_memory():
    """Add 10% gain to the existing single curved diffuser on the optical winner."""
    scene = build_gloss_refraction_candidate_in_memory("luminous-polished")
    target = contract.COBALT_FINAL_LOCK
    scrim = bpy.data.objects[target.left_scrim_name]
    original = scrim.data.materials[0]
    name = "BB_MAT_FINAL_LEFT_DIFFUSION_GLOSS_110"
    calibrated = bpy.data.materials.get(name)
    if calibrated is None:
        calibrated = original.copy()
        calibrated.name = name
        calibrated.use_fake_user = True
    gain = target.scrim_emission * contract.GLOSS_REFRACTION_SCRIM_GAIN
    gain_node = calibrated.node_tree.nodes.get("BB_GLOSS_REFRACTION_SCRIM_GAIN")
    if gain_node is None:
        gain_node = next(
            node
            for node in calibrated.node_tree.nodes
            if node.bl_idname == "ShaderNodeMath"
            and node.operation == "MULTIPLY"
            and abs(node.inputs[1].default_value - target.scrim_emission) < 1e-6
        )
    gain_node.name = "BB_GLOSS_REFRACTION_SCRIM_GAIN"
    gain_node.inputs[1].default_value = gain
    calibrated["bb_gloss_refraction_scrim_gain"] = contract.GLOSS_REFRACTION_SCRIM_GAIN
    calibrated["bb_single_curved_diffuser"] = True
    scrim.data.materials.clear()
    scrim.data.materials.append(calibrated)
    scene["bb_gloss_refraction_scrim_calibration"] = (
        "single-curved-scrim-110-percent"
    )
    return scene


def build_neutral_surface_tint_candidate_in_memory():
    """Neutralize only the dielectric surface of the luminous-polished glass."""
    scene = build_gloss_refraction_candidate_in_memory("luminous-polished")
    target = contract.COBALT_FINAL_LOCK
    body = bpy.data.objects[contract.BODY_NAME]
    body_before = contract.object_snapshot(body)
    visible_finish_before = contract.geometry_fingerprint(
        bpy.data.objects[contract.FINISH_NAME].data
    )
    finish_master_before = contract.geometry_fingerprint(
        bpy.data.objects[contract.FINISH_MASTER_NAME].data
    )
    camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    protected_names = (
        target.left_key_name,
        target.top_fill_name,
        target.neck_fill_name,
        target.left_scrim_name,
        target.backdrop_name,
        target.floor_name,
    )
    protected_before = {
        name: (
            contract.object_snapshot(bpy.data.objects[name]),
            bpy.data.objects[name].hide_render,
            bpy.data.objects[name].visible_camera,
            bpy.data.objects[name].visible_glossy,
            bpy.data.objects[name].visible_diffuse,
            bpy.data.objects[name].visible_transmission,
            bpy.data.objects[name].visible_shadow,
        )
        for name in protected_names
    }

    material = ensure_neutral_surface_tint_material()
    body.data.materials.clear()
    body.data.materials.append(material)
    preset = contract.NEUTRAL_SURFACE_TINT
    scene["bb_neutral_surface_tint_version"] = preset.version
    scene["bb_neutral_surface_tint_scope"] = "dielectric-base-color-only"
    scene["bb_neutral_surface_tint_rgb"] = ",".join(
        str(value) for value in preset.surface_tint
    )

    if contract.object_snapshot(body) != body_before:
        raise AssertionError("neutral surface tint changed approved body state")
    if (
        contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_NAME].data)
        != visible_finish_before
    ):
        raise AssertionError("neutral surface tint changed visible finish geometry")
    if (
        contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data)
        != finish_master_before
    ):
        raise AssertionError("neutral surface tint changed finish-master geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera_before:
        raise AssertionError("neutral surface tint changed approved camera")
    protected_after = {
        name: (
            contract.object_snapshot(bpy.data.objects[name]),
            bpy.data.objects[name].hide_render,
            bpy.data.objects[name].visible_camera,
            bpy.data.objects[name].visible_glossy,
            bpy.data.objects[name].visible_diffuse,
            bpy.data.objects[name].visible_transmission,
            bpy.data.objects[name].visible_shadow,
        )
        for name in protected_names
    }
    if protected_after != protected_before:
        raise AssertionError("neutral surface tint changed protected studio state")
    return scene


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

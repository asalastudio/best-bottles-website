#!/usr/bin/env python3
"""Build a protected luxury look-development master for the approved 9 ml bottle.

Geometry is audit-only.  The builder creates materials, lights, reflection
cards, render settings, and derivative files around the existing approved mesh.
"""

from __future__ import annotations

import argparse
from collections import deque
import json
import math
from pathlib import Path
import sys
from typing import Any

import bmesh
import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


GROUP_INPUT_NAMES = (
    "IOR",
    "surface_roughness",
    "transmission",
    "absorption_color",
    "absorption_density",
    "frost_amount",
    "micro_roughness_amount",
    "micro_roughness_scale",
    "micro_normal_strength",
)

LEGACY_EMITTERS = (
    "BB_LIGHT_KEY_SOFTBOX",
    "BB_CARD_FILL_RIGHT",
    "BB_CARD_TOP",
    "BB_LIGHT_SWEEP_WASH",
    "BB_CARD_GLASS_REFLECTION_STRIP",
    "BB_CARD_GLASS_TRANSMISSION_BACK",
)


def _body():
    obj = bpy.data.objects.get(contract.BODY_NAME)
    if obj is None or obj.type != "MESH":
        raise RuntimeError(f"approved body {contract.BODY_NAME!r} is missing")
    return obj


def protected_snapshot() -> dict[str, Any]:
    names = (contract.BODY_NAME, contract.FINISH_NAME, contract.FINISH_MASTER_NAME, contract.CAMERA_NAME)
    missing = [name for name in names if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError(f"approved scene is missing protected objects: {missing}")
    return {name: contract.object_snapshot(bpy.data.objects[name]) for name in names}


def _component_count(bm: bmesh.types.BMesh) -> int:
    unseen = set(bm.verts)
    count = 0
    while unseen:
        count += 1
        seed = unseen.pop()
        queue = deque([seed])
        while queue:
            vertex = queue.popleft()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in unseen:
                    unseen.remove(other)
                    queue.append(other)
    return count


def audit_geometry() -> dict[str, Any]:
    """Inspect a copied BMesh and return a non-mutating physical-shell audit."""
    obj = _body()
    body_hash = contract.geometry_fingerprint(obj.data)
    if body_hash != contract.BODY_GEOMETRY_SHA256:
        raise RuntimeError(f"approved body geometry drifted: {body_hash}")
    if tuple(round(float(value), 4) for value in obj.dimensions) != (19.7, 19.7, 72.0):
        raise RuntimeError(f"approved body envelope drifted: {tuple(obj.dimensions)}")

    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        bm.edges.ensure_lookup_table()
        bm.faces.ensure_lookup_table()
        bm.normal_update()

        coordinate_keys = [
            (round(vertex.co.x, 6), round(vertex.co.y, 6), round(vertex.co.z, 6))
            for vertex in bm.verts
        ]
        face_keys = [tuple(sorted(vertex.index for vertex in face.verts)) for face in bm.faces]
        max_z = max(vertex.co.z for vertex in bm.verts)
        top_vertices = [vertex for vertex in bm.verts if vertex.co.z > max_z - 0.06]
        top_radii = [math.hypot(vertex.co.x, vertex.co.y) for vertex in top_vertices]
        bore_radius = contract.GEOMETRY.bore_diameter_mm * 0.5
        top_center_faces = [
            face for face in bm.faces
            if min(vertex.co.z for vertex in face.verts) > max_z - 0.02
            and math.hypot(face.calc_center_median().x, face.calc_center_median().y) < bore_radius * 0.7
        ]

        # The inner floor is the first horizontal annulus above the external
        # bottom.  Median values avoid depending on vertex ordering.
        low_levels: dict[float, list[float]] = {}
        for vertex in bm.verts:
            if 0.5 < vertex.co.z < 6.0:
                low_levels.setdefault(round(vertex.co.z, 6), []).append(
                    math.hypot(vertex.co.x, vertex.co.y)
                )
        inner_floor_z = [
            z for z, radii in low_levels.items()
            if min(radii) < 0.01 and max(radii) > 6.0
        ]
        measured_base = max(inner_floor_z) if inner_floor_z else contract.GEOMETRY.base_thickness_mm

        result = {
            "object": obj.name,
            "vertices": len(bm.verts),
            "edges": len(bm.edges),
            "faces": len(bm.faces),
            "components": _component_count(bm),
            "non_manifold_edges": sum(not edge.is_manifold for edge in bm.edges),
            "boundary_edges": sum(edge.is_boundary for edge in bm.edges),
            "wire_edges": sum(edge.is_wire for edge in bm.edges),
            "duplicate_coordinates": len(coordinate_keys) - len(set(coordinate_keys)),
            "duplicate_faces": len(face_keys) - len(set(face_keys)),
            "zero_area_faces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
            "signed_volume_mm3": float(bm.calc_volume(signed=True)),
            "positive_signed_volume": bm.calc_volume(signed=True) > 0.0,
            "normalized_face_normals": all(abs(face.normal.length - 1.0) < 1e-5 for face in bm.faces),
            "open_bore": bool(top_radii) and min(top_radii) >= bore_radius - 0.02 and not top_center_faces,
            "physical_rim": bool(top_radii) and max(top_radii) - min(top_radii) > 1.0,
            "base_thickness_mm": float(measured_base),
            "minimum_wall_mm": float(obj.get("bb_min_smooth_wall_mm", contract.GEOMETRY.minimum_wall_mm)),
            "body_geometry_sha256": body_hash,
            "thread_source_sha256": str(obj.get("bb_thread_source_fingerprint", "")),
            "solidify_modifiers": [modifier.name for modifier in obj.modifiers if modifier.type == "SOLIDIFY"],
            "all_faces_smooth": all(polygon.use_smooth for polygon in obj.data.polygons),
        }
        if result["thread_source_sha256"] != contract.THREAD_SHA256:
            raise RuntimeError("approved 17-415 thread fingerprint drifted")
        return result
    finally:
        bm.free()


def _new_group_socket(group, name: str, in_out: str, socket_type: str):
    return group.interface.new_socket(name=name, in_out=in_out, socket_type=socket_type)


def ensure_master_group():
    existing = bpy.data.node_groups.get(contract.MASTER_GROUP_NAME)
    if existing is not None:
        return existing

    group = bpy.data.node_groups.new(contract.MASTER_GROUP_NAME, "ShaderNodeTree")
    group.use_fake_user = True
    input_specs = (
        ("IOR", "NodeSocketFloat", 1.5, 1.0, 2.0),
        ("surface_roughness", "NodeSocketFloat", 0.02, 0.0, 1.0),
        ("transmission", "NodeSocketFloat", 1.0, 0.0, 1.0),
        ("absorption_color", "NodeSocketColor", (1.0, 1.0, 1.0, 1.0), None, None),
        ("absorption_density", "NodeSocketFloat", 0.0, 0.0, 10.0),
        ("frost_amount", "NodeSocketFloat", 0.0, 0.0, 1.0),
        ("micro_roughness_amount", "NodeSocketFloat", 0.0, 0.0, 0.2),
        ("micro_roughness_scale", "NodeSocketFloat", 420.0, 1.0, 2000.0),
        ("micro_normal_strength", "NodeSocketFloat", 0.0, 0.0, 0.03),
    )
    for name, socket_type, default, minimum, maximum in input_specs:
        socket = _new_group_socket(group, name, "INPUT", socket_type)
        socket.default_value = default
        if minimum is not None:
            socket.min_value = minimum
            socket.max_value = maximum
    _new_group_socket(group, "Surface", "OUTPUT", "NodeSocketShader")
    _new_group_socket(group, "Volume", "OUTPUT", "NodeSocketShader")

    nodes = group.nodes
    links = group.links
    group_in = nodes.new("NodeGroupInput")
    group_in.name = "Glass Controls"
    group_in.location = (-900, 80)
    group_out = nodes.new("NodeGroupOutput")
    group_out.name = "Glass Shaders"
    group_out.location = (520, 80)

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-900, -320)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.name = "Microscopic Frost"
    noise.location = (-680, -300)
    noise.noise_dimensions = "3D"
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.55
    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(group_in.outputs["micro_roughness_scale"], noise.inputs["Scale"])

    center_noise = nodes.new("ShaderNodeMath")
    center_noise.operation = "SUBTRACT"
    center_noise.inputs[1].default_value = 0.5
    center_noise.location = (-460, -240)
    links.new(noise.outputs["Fac"], center_noise.inputs[0])
    rough_amount = nodes.new("ShaderNodeMath")
    rough_amount.operation = "MULTIPLY"
    rough_amount.location = (-260, -220)
    links.new(center_noise.outputs[0], rough_amount.inputs[0])
    links.new(group_in.outputs["micro_roughness_amount"], rough_amount.inputs[1])
    frost_roughness = nodes.new("ShaderNodeMath")
    frost_roughness.operation = "MULTIPLY"
    frost_roughness.location = (-70, -200)
    links.new(rough_amount.outputs[0], frost_roughness.inputs[0])
    links.new(group_in.outputs["frost_amount"], frost_roughness.inputs[1])
    add_roughness = nodes.new("ShaderNodeMath")
    add_roughness.operation = "ADD"
    add_roughness.use_clamp = True
    add_roughness.location = (110, -100)
    links.new(group_in.outputs["surface_roughness"], add_roughness.inputs[0])
    links.new(frost_roughness.outputs[0], add_roughness.inputs[1])

    bump_strength = nodes.new("ShaderNodeMath")
    bump_strength.operation = "MULTIPLY"
    bump_strength.location = (-90, -410)
    links.new(group_in.outputs["micro_normal_strength"], bump_strength.inputs[0])
    links.new(group_in.outputs["frost_amount"], bump_strength.inputs[1])
    bump = nodes.new("ShaderNodeBump")
    bump.name = "Subvisual Frost Normal"
    bump.location = (120, -350)
    bump.inputs["Distance"].default_value = 0.01
    links.new(bump_strength.outputs[0], bump.inputs["Strength"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])

    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Physical Dielectric Glass"
    principled.location = (280, 170)
    principled.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Alpha"].default_value = 1.0
    links.new(group_in.outputs["IOR"], principled.inputs["IOR"])
    links.new(group_in.outputs["transmission"], principled.inputs["Transmission Weight"])
    links.new(add_roughness.outputs[0], principled.inputs["Roughness"])
    links.new(bump.outputs["Normal"], principled.inputs["Normal"])

    absorption = nodes.new("ShaderNodeVolumeAbsorption")
    absorption.name = "Beer-Lambert Absorption"
    absorption.location = (280, -100)
    links.new(group_in.outputs["absorption_color"], absorption.inputs["Color"])
    links.new(group_in.outputs["absorption_density"], absorption.inputs["Density"])
    links.new(principled.outputs["BSDF"], group_out.inputs["Surface"])
    links.new(absorption.outputs["Volume"], group_out.inputs["Volume"])
    return group


def ensure_glass_material(variant: str):
    if variant not in contract.VARIANTS:
        raise ValueError(f"unknown glass variant {variant!r}")
    name = f"BB_GLASS_{variant.upper()}"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_fake_user = True
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (280, 0)
    instance = nodes.new("ShaderNodeGroup")
    instance.name = "BB_GLASS_MASTER_INSTANCE"
    instance.node_tree = ensure_master_group()
    instance.location = (-80, 0)
    preset = contract.VARIANTS[variant]
    values = {
        "IOR": preset.ior,
        "surface_roughness": preset.surface_roughness,
        "transmission": preset.transmission,
        "absorption_color": (*preset.absorption_color, 1.0),
        "absorption_density": preset.absorption_density,
        "frost_amount": preset.frost_amount,
        "micro_roughness_amount": preset.micro_roughness_amount,
        "micro_roughness_scale": preset.micro_roughness_scale,
        "micro_normal_strength": preset.micro_normal_strength,
    }
    for socket_name, value in values.items():
        instance.inputs[socket_name].default_value = value
    links.new(instance.outputs["Surface"], output.inputs["Surface"])
    links.new(instance.outputs["Volume"], output.inputs["Volume"])
    material["bb_variant"] = variant
    material["bb_physical_glass"] = True
    return material


def ensure_all_glass_materials() -> dict[str, Any]:
    return {variant: ensure_glass_material(variant) for variant in contract.VARIANTS}


def assign_variant(variant: str):
    material = ensure_glass_material(variant)
    body = _body()
    body.data.materials.clear()
    body.data.materials.append(material)
    bpy.context.scene["bb_variant"] = variant
    return material


def _luxury_collection():
    collection = bpy.data.collections.get(contract.LUXURY_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(contract.LUXURY_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _aim_local_axis(obj, target, axis="-Z", up="Y"):
    direction = Vector(target) - obj.location
    if direction.length == 0:
        raise ValueError(f"cannot aim {obj.name} at its own location")
    obj.rotation_euler = direction.to_track_quat(axis, up).to_euler()


def _ensure_area_light(spec, collection):
    obj = bpy.data.objects.get(spec.name)
    if obj is None:
        data = bpy.data.lights.new(spec.name, "AREA")
        obj = bpy.data.objects.new(spec.name, data)
        collection.objects.link(obj)
    elif obj.name not in collection.objects:
        collection.objects.link(obj)
    width, height = spec.dimensions(contract.GEOMETRY)
    obj.data.type = "AREA"
    obj.data.shape = "RECTANGLE"
    obj.data.size = width
    obj.data.size_y = height
    obj.data.energy = spec.energy_watts
    obj.data.color = (1.0, 0.985, 0.96) if spec.name == "BB_LUX_KEY_LEFT" else (1.0, 1.0, 1.0)
    obj.location = spec.location(contract.GEOMETRY)
    _aim_local_axis(obj, spec.target(contract.GEOMETRY), "-Z", "Y")
    obj["bb_role"] = "luxury_glass_area_light"
    obj["bb_contract_angle_degrees"] = spec.angle_degrees
    obj["bb_contract_energy_watts"] = spec.energy_watts
    obj["bb_contract_width_mm"] = width
    obj["bb_contract_height_mm"] = height
    return obj


def _negative_fill_material():
    material = bpy.data.materials.get("BB_MAT_LUXURY_NEGATIVE_FILL")
    if material is not None:
        return material
    material = bpy.data.materials.new("BB_MAT_LUXURY_NEGATIVE_FILL")
    material.use_nodes = True
    material.diffuse_color = (0.003, 0.003, 0.003, 1.0)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.003, 0.003, 0.003, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 1.0
    return material


def _ensure_negative_card(spec, collection):
    obj = bpy.data.objects.get(spec.name)
    width, height = spec.dimensions(contract.GEOMETRY)
    if obj is None:
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
        mesh.materials.append(_negative_fill_material())
        obj = bpy.data.objects.new(spec.name, mesh)
        collection.objects.link(obj)
    elif obj.name not in collection.objects:
        collection.objects.link(obj)
    obj.location = spec.location(contract.GEOMETRY)
    _aim_local_axis(obj, (0.0, 0.0, contract.GEOMETRY.height_mm * 0.53), "Z", "Y")
    obj.visible_camera = False
    obj.visible_shadow = False
    obj.visible_diffuse = False
    obj.visible_glossy = True
    obj.visible_transmission = False
    obj.visible_volume_scatter = False
    obj["bb_negative_fill"] = True
    obj["bb_contract_width_mm"] = width
    obj["bb_contract_height_mm"] = height
    return obj


def ensure_luxury_studio():
    collection = _luxury_collection()
    for spec in contract.LIGHTS:
        _ensure_area_light(spec, collection)
    for spec in contract.NEGATIVE_CARDS:
        _ensure_negative_card(spec, collection)
    for name in LEGACY_EMITTERS:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = True
            obj["bb_disabled_by_luxury_studio"] = True
    sweep = bpy.data.objects.get("BB_STUDIO_SWEEP")
    if sweep is None:
        raise RuntimeError("approved physical seamless sweep is missing")
    sweep.hide_render = False
    collection["bb_height_mm"] = contract.GEOMETRY.height_mm
    collection["bb_diameter_mm"] = contract.GEOMETRY.diameter_mm
    collection["bb_background_gradient_target_percent"] = 6.5
    return collection


def configure_camera():
    camera = bpy.data.objects.get(contract.CAMERA_NAME)
    if camera is None or camera.type != "CAMERA":
        raise RuntimeError("approved 100 mm master camera is missing")
    expected_location = contract.GEOMETRY.camera_location
    expected_rotation = tuple(math.radians(value) for value in contract.GEOMETRY.camera_rotation_degrees)
    if any(abs(float(camera.location[index]) - expected_location[index]) > 1e-4 for index in range(3)):
        raise RuntimeError("approved camera location drifted")
    if any(abs(float(camera.rotation_euler[index]) - expected_rotation[index]) > 1e-4 for index in range(3)):
        raise RuntimeError("approved camera rotation drifted")
    if abs(camera.data.lens - contract.GEOMETRY.camera_lens_mm) > 1e-5:
        raise RuntimeError("approved 100 mm camera lens drifted")
    if abs(camera.data.sensor_width - contract.GEOMETRY.camera_sensor_mm) > 1e-5:
        raise RuntimeError("approved camera sensor drifted")
    camera.data.dof.use_dof = False
    bpy.context.scene.camera = camera
    return camera


def _configure_cycles_device():
    preferences = bpy.context.preferences.addons.get("cycles")
    if preferences is None:
        return
    prefs = preferences.preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type != "CPU"
    except (AttributeError, TypeError):
        pass


def configure_cycles():
    scene = bpy.context.scene
    render = contract.RENDER
    scene.render.engine = render.engine
    scene.cycles.device = render.device
    scene.cycles.samples = render.samples
    scene.cycles.use_adaptive_sampling = render.adaptive_sampling
    scene.cycles.adaptive_threshold = render.noise_threshold
    scene.cycles.use_denoising = render.denoise
    scene.cycles.max_bounces = render.max_bounces
    scene.cycles.transmission_bounces = render.transmission_bounces
    scene.cycles.glossy_bounces = render.glossy_bounces
    scene.cycles.diffuse_bounces = render.diffuse_bounces
    scene.cycles.transparent_max_bounces = render.transparent_bounces
    if hasattr(scene.cycles, "use_reflective_caustics"):
        scene.cycles.use_reflective_caustics = True
    if hasattr(scene.cycles, "use_refractive_caustics"):
        scene.cycles.use_refractive_caustics = True
    _configure_cycles_device()
    return scene.cycles


def configure_color_management():
    settings = bpy.context.scene.view_settings
    settings.view_transform = contract.RENDER.view_transform
    for candidate in (f"AgX - {contract.RENDER.look}", contract.RENDER.look, "None"):
        try:
            settings.look = candidate
            break
        except TypeError:
            continue
    settings.exposure = contract.RENDER.exposure
    settings.gamma = contract.RENDER.gamma
    return settings


def _rounded_tuple(values, digits=6):
    return tuple(round(float(value), digits) for value in values)


def studio_snapshot() -> dict[str, Any]:
    collection = bpy.data.collections.get(contract.LUXURY_COLLECTION)
    if collection is None:
        raise RuntimeError("luxury studio collection is missing")
    state = {}
    for obj in sorted(collection.objects, key=lambda item: item.name):
        item = {
            "type": obj.type,
            "location": _rounded_tuple(obj.location),
            "rotation": _rounded_tuple(obj.rotation_euler),
            "scale": _rounded_tuple(obj.scale),
            "hide_render": bool(obj.hide_render),
        }
        if obj.type == "LIGHT":
            item.update(
                light_type=obj.data.type,
                shape=obj.data.shape,
                size=round(float(obj.data.size), 6),
                size_y=round(float(obj.data.size_y), 6),
                energy=round(float(obj.data.energy), 6),
                color=_rounded_tuple(obj.data.color),
            )
        elif obj.get("bb_negative_fill"):
            item.update(
                negative_fill=True,
                visible_camera=bool(obj.visible_camera),
                visible_glossy=bool(obj.visible_glossy),
                visible_shadow=bool(obj.visible_shadow),
                dimensions=_rounded_tuple(obj.dimensions),
            )
        state[obj.name] = item
    return state


def _safe_generated_path(path, *, replace_generated=False):
    resolved = Path(path).expanduser().resolve()
    root = contract.WORKING_OUTPUT_DIR.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError(f"generated Blender files must remain below {root}")
    if resolved.exists() and not replace_generated:
        raise FileExistsError(f"refusing to overwrite existing generated file: {resolved}")
    resolved.parent.mkdir(parents=True, exist_ok=True)
    return resolved


def _lock_approved_geometry():
    locked = []
    for name in (contract.BODY_NAME, contract.FINISH_NAME, contract.FINISH_MASTER_NAME):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_select = True
            obj["bb_geometry_locked"] = True
            locked.append(name)
    return locked


def build_master(output_path, *, replace_generated=False):
    """Build and save one protected master without touching mesh data."""
    current_path = Path(bpy.data.filepath).resolve() if bpy.data.filepath else None
    if current_path == contract.SOURCE_SCENE.resolve():
        source_hash = contract.sha256_file(current_path)
        if source_hash != contract.SOURCE_SHA256:
            raise RuntimeError(f"approved source file hash drifted: {source_hash}")
    body_before = contract.object_snapshot(_body())
    camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    audit = audit_geometry()
    ensure_all_glass_materials()
    ensure_luxury_studio()
    configure_camera()
    configure_cycles()
    configure_color_management()
    assign_variant("clear")
    locked = _lock_approved_geometry()
    if contract.object_snapshot(_body()) != body_before:
        raise AssertionError("look development changed approved bottle geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera_before:
        raise AssertionError("look development changed approved camera composition")

    scene = bpy.context.scene
    scene["bb_luxury_glass_master"] = True
    scene["bb_source_scene"] = str(contract.SOURCE_SCENE)
    scene["bb_source_sha256"] = contract.SOURCE_SHA256
    scene["bb_body_geometry_sha256"] = contract.BODY_GEOMETRY_SHA256
    scene["bb_thread_sha256"] = contract.THREAD_SHA256
    scene["bb_geometry_locked_objects"] = ",".join(locked)
    scene["bb_geometry_audit_passed"] = True
    scene["bb_geometry_audit_summary"] = json.dumps(audit, sort_keys=True)
    path = _safe_generated_path(output_path, replace_generated=replace_generated)
    scene["bb_master_path"] = str(path)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    return path


def save_derivatives(output_dir, *, replace_generated=False):
    """Save four material-only variants from the same configured master."""
    output_dir = Path(output_dir).expanduser().resolve()
    root = contract.WORKING_OUTPUT_DIR.resolve()
    if output_dir != root and root not in output_dir.parents:
        raise ValueError(f"derivatives must remain below {root}")
    audit_geometry()
    ensure_all_glass_materials()
    ensure_luxury_studio()
    configure_camera()
    configure_cycles()
    configure_color_management()
    body_snapshot = contract.object_snapshot(_body())
    outputs = {}
    for variant in contract.VARIANTS:
        path = _safe_generated_path(
            output_dir / f"009ml-luxury-{variant}.blend",
            replace_generated=replace_generated,
        )
        assign_variant(variant)
        bpy.context.scene["bb_derivative_material_only"] = True
        bpy.context.scene.render.filepath = str(
            contract.RENDER_OUTPUT_DIR / contract.qc_filename(variant, "full", contract.RENDER.samples, True)
        )
        if contract.object_snapshot(_body()) != body_snapshot:
            raise AssertionError(f"{variant} assignment changed approved bottle geometry")
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
        outputs[variant] = path
    assign_variant("clear")
    return outputs


def _material_manifest():
    result = {}
    for variant, preset in contract.VARIANTS.items():
        result[variant] = {
            "material": f"BB_GLASS_{variant.upper()}",
            **contract.dataclass_dict(preset),
        }
    return result


def _camera_manifest():
    camera = bpy.data.objects[contract.CAMERA_NAME]
    return contract.object_snapshot(camera)


def _render_manifest():
    scene = bpy.context.scene
    return {
        **contract.dataclass_dict(contract.RENDER),
        "active_view_transform": scene.view_settings.view_transform,
        "active_look": scene.view_settings.look,
        "device": scene.cycles.device,
    }


def write_audit_manifest(path, outputs):
    path = Path(path).expanduser().resolve()
    render_root = contract.RENDER_OUTPUT_DIR.resolve()
    if path != render_root and render_root not in path.parents:
        raise ValueError(f"audit manifest must remain below {render_root}")
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source_scene": str(contract.SOURCE_SCENE),
        "source_sha256": contract.SOURCE_SHA256,
        "geometry": audit_geometry(),
        "materials": _material_manifest(),
        "studio": studio_snapshot(),
        "camera": _camera_manifest(),
        "render": _render_manifest(),
        "legacy_emitters_disabled": [
            name for name in LEGACY_EMITTERS
            if bpy.data.objects.get(name) is not None and bpy.data.objects[name].hide_render
        ],
        "outputs": {name: str(output) for name, output in outputs.items()},
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def _parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--audit-json", type=Path)
    parser.add_argument("--replace-generated", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    if args.output_dir is None:
        print(json.dumps(audit_geometry(), indent=2, sort_keys=True))
        return
    output_dir = args.output_dir.expanduser().resolve()
    master_path = output_dir / "009ml-luxury-master.blend"
    build_master(master_path, replace_generated=args.replace_generated)
    derivatives = save_derivatives(output_dir, replace_generated=args.replace_generated)
    outputs = {"master": master_path, **derivatives}
    if args.audit_json is not None:
        write_audit_manifest(args.audit_json, outputs)
    print("BB_LUXURY_MASTER", master_path)
    for variant, path in derivatives.items():
        print("BB_LUXURY_DERIVATIVE", variant, path)


if __name__ == "__main__":
    main()

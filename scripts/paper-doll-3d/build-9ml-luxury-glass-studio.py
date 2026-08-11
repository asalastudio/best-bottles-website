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


def _parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--audit-json", type=Path)
    parser.add_argument("--replace-generated", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    audit = audit_geometry()
    ensure_all_glass_materials()
    print(json.dumps(audit, indent=2, sort_keys=True))
    if args.output_dir or args.audit_json:
        raise RuntimeError("saving is implemented after the protected look-development gates")


if __name__ == "__main__":
    main()

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
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "scripts/paper-doll-3d/five_variant_contract.py"
MASTER_BUILDER_PATH = ROOT / "scripts/paper-doll-3d/build-master-scene.py"
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


def _load_master_builder():
    spec = importlib.util.spec_from_file_location("bb_master_scene_builder", MASTER_BUILDER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault(spec.name, module)
    spec.loader.exec_module(module)
    return module


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
    shader.inputs["Transmission Weight"].default_value = spec.transmission
    shader.inputs["IOR"].default_value = spec.ior
    shader.inputs["Roughness"].default_value = spec.roughness
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])

    if spec.frosted:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.name = "Uniform Frost Microstructure"
        noise.location = (-650, -100)
        noise.inputs["Scale"].default_value = spec.frost_scale
        noise.inputs["Detail"].default_value = 2.0
        noise.inputs["Roughness"].default_value = 0.55
        bump = nodes.new("ShaderNodeBump")
        bump.name = "Uniform Frost Micro Normal"
        bump.location = (-300, -100)
        bump.inputs["Strength"].default_value = spec.frost_strength
        bump.inputs["Distance"].default_value = spec.frost_distance
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
    material["bb_ior"] = spec.ior
    material["bb_transmission"] = spec.transmission
    material["bb_roughness"] = spec.roughness
    material["bb_absorption_density"] = (
        spec.density if spec.density is not None else 0.0
    )
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


def _largest_area(screen):
    return max(screen.areas, key=lambda area: area.width * area.height)


def _configure_view(workspace, view_location, distance, rotation, shading="SOLID"):
    if workspace is None or bpy.context.window is None:
        return
    bpy.context.window.workspace = workspace
    screen = bpy.context.window.screen
    area = _largest_area(screen)
    area.type = "VIEW_3D"
    space = area.spaces.active
    space.clip_start = 0.1
    space.clip_end = 10000.0
    space.shading.type = shading
    space.shading.color_type = "MATERIAL"
    space.overlay.show_floor = True
    space.overlay.show_axis_x = True
    space.overlay.show_axis_y = True
    space.overlay.show_extras = True
    space.overlay.show_text = True
    space.overlay.show_relationship_lines = True
    space.overlay.show_outline_selected = True
    region = space.region_3d
    region.view_location = Vector(view_location)
    region.view_distance = distance
    region.view_rotation = Quaternion(rotation)
    region.view_perspective = "PERSP"


def configure_workspaces():
    """Save understandable overview, product, and lighting workspaces."""
    strip = ensure_reflection_strip()
    for name in (
        "BB_LIGHT_KEY_SOFTBOX",
        "BB_CARD_FILL_RIGHT",
        "BB_CARD_TOP",
        "BB_LIGHT_SWEEP_WASH",
        strip.name,
    ):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.display_type = "BOUNDS"
            obj.show_name = True
            obj.show_in_front = True
    studio = bpy.data.objects.get("BB_STUDIO_SWEEP")
    if studio is not None:
        studio.display_type = "TEXTURED"
        studio.show_name = True
    body = bpy.data.objects.get(BODY_NAME)
    if body is not None:
        body.hide_viewport = False
        body.display_type = "TEXTURED"
        body.show_name = True
    finish = bpy.data.objects.get(FINISH_NAME)
    if finish is not None:
        finish.hide_viewport = bool(finish.get("bb_source_geometry", False))
        finish.display_type = "WIRE" if finish.hide_viewport else "TEXTURED"
        finish.show_name = True

    overview = bpy.data.workspaces.get("SCENE OVERVIEW")
    detail = bpy.data.workspaces.get("PRODUCT DETAIL")
    lighting = bpy.data.workspaces.get("LIGHTING PREVIEW")
    overview_rotation = (0.712, 0.441, 0.287, 0.464)
    front_rotation = (0.7071068, 0.7071068, 0.0, 0.0)
    _configure_view(overview, (0.0, -80.0, 260.0), 1450.0, overview_rotation)
    _configure_view(detail, (0.0, 0.0, 36.0), 95.0, front_rotation, "MATERIAL")
    _configure_view(lighting, (0.0, 0.0, 36.0), 95.0, front_rotation, "RENDERED")
    if lighting is not None and bpy.context.window is not None:
        bpy.context.window.workspace = lighting
        area = _largest_area(bpy.context.window.screen)
        space = area.spaces.active
        space.shading.use_scene_lights_render = True
        space.shading.use_scene_world_render = True
        space.overlay.show_overlays = False
        space.region_3d.view_perspective = "CAMERA"
    if overview is not None and bpy.context.window is not None:
        bpy.context.window.workspace = overview

    scene = bpy.context.scene
    scene["interactive_scene_ready"] = True
    scene["interactive_scene_notes"] = (
        "SCENE OVERVIEW shows the complete studio and glossy-only reflection "
        "strip; PRODUCT DETAIL frames the bottle; LIGHTING PREVIEW opens in "
        "the production camera with scene lighting."
    )


def _assign_variant_material(name):
    material = build_glass_material(name)
    obj = bpy.data.objects[BODY_NAME]
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return material


def _densify_profile(profile, max_z_step=0.55, z_max=None):
    """Insert body rings for molded relief without subdividing the finish."""
    dense = [profile[0]]
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        eligible = z_max is None or max(z0, z1) <= z_max + 1e-6
        steps = (
            max(1, int(math.ceil(abs(z1 - z0) / max_z_step)))
            if eligible
            else 1
        )
        for index in range(1, steps + 1):
            t = index / steps
            dense.append((r0 + (r1 - r0) * t, z0 + (z1 - z0) * t))
    return dense


def _precision_009_body_profile(master, bottle_spec, finish_spec):
    """Return the corrected 9 ml body outline below the immutable finish."""
    shoulder = contract.SHOULDER_009
    solved = contract.shoulder_solution(shoulder)
    radius = bottle_spec["diameter"] / 2.0
    finish_radius = finish_spec["neck_d"] / 2.0
    bore_radius = finish_spec["bore_d"] / 2.0
    datum_z = bottle_spec["height"] - finish_spec["finish_h"]
    wall = bottle_spec["wall"]
    if not math.isclose(radius, shoulder.body_radius_mm, abs_tol=1e-6):
        raise ValueError("9 ml precision shoulder requires the 19.7 mm body")
    if not math.isclose(
        finish_radius, shoulder.finish_root_radius_mm, abs_tol=1e-6
    ):
        raise ValueError("9 ml precision shoulder requires the 14.8 mm finish root")
    if not math.isclose(datum_z, shoulder.datum_z_mm, abs_tol=1e-6):
        raise ValueError("9 ml precision shoulder datum drifted")

    angle = solved.angle_rad
    convex = shoulder.convex_radius_mm
    concave = shoulder.concave_radius_mm
    steps = 22

    def shoulder_points(rad_out, rad_in):
        points = []
        for index in range(steps + 1):
            phi = angle * index / steps
            points.append(
                (
                    (radius - convex) + rad_out * math.cos(phi),
                    solved.start_z_mm + rad_out * math.sin(phi),
                )
            )
        for index in range(steps, -1, -1):
            phi = angle * index / steps
            points.append(
                (
                    (finish_radius + concave) - rad_in * math.cos(phi),
                    datum_z - rad_in * math.sin(phi),
                )
            )
        return points

    outer_shoulder = shoulder_points(convex, concave)
    inner_shoulder = shoulder_points(convex - wall, concave + wall)
    inner_cutoff_z = datum_z - 0.55
    inner_parallel = [
        point for point in inner_shoulder if point[1] <= inner_cutoff_z + 1e-6
    ]
    if not inner_parallel:
        raise ValueError("precision shoulder interior taper has no parallel wall")

    profile = [(0.0, bottle_spec["push_up"])]
    profile += master.arc(
        radius - bottle_spec["heel_r"] - 0.8,
        bottle_spec["push_up"] + 0.5,
        0.8,
        270,
        305,
        4,
    )
    profile += master.arc(
        radius - bottle_spec["heel_r"],
        bottle_spec["heel_r"],
        bottle_spec["heel_r"],
        270,
        360,
    )
    profile.append((radius, solved.start_z_mm))
    profile += outer_shoulder
    profile.append((finish_radius, datum_z))
    profile.append((bore_radius, datum_z))
    profile.append((bore_radius, datum_z - 0.22))
    profile += list(reversed(inner_parallel))
    profile.append((radius - wall, bottle_spec["base_th"] + 2.0))
    profile += master.arc(
        radius - wall - 2.0,
        bottle_spec["base_th"] + 2.0,
        2.0,
        0,
        -90,
        6,
    )
    profile.append((0.0, bottle_spec["base_th"]))

    deduped = [profile[0]]
    for point in profile[1:]:
        if (
            abs(point[0] - deduped[-1][0]) > 1e-4
            or abs(point[1] - deduped[-1][1]) > 1e-4
        ):
            deduped.append(point)
    return deduped


def _continuous_profile(master, bottle_spec, finish_spec, *, precision=False):
    """Splice body and finish outlines without a transverse datum annulus."""
    body_profile = (
        _precision_009_body_profile(master, bottle_spec, finish_spec)
        if precision
        else master.cylinder_profile(bottle_spec, finish_spec)
    )
    finish_profile = master.finish_profile(finish_spec)
    datum_z = bottle_spec["height"] - finish_spec["finish_h"]
    outer_radius = finish_spec["neck_d"] / 2.0
    bore_radius = finish_spec["bore_d"] / 2.0

    outer_index = next(
        index for index, (radius, z) in enumerate(body_profile)
        if math.isclose(z, datum_z, abs_tol=1e-6)
        and math.isclose(radius, outer_radius, abs_tol=1e-6)
    )
    inner_index = next(
        index for index in range(outer_index + 1, len(body_profile))
        if math.isclose(body_profile[index][1], datum_z, abs_tol=1e-6)
        and math.isclose(body_profile[index][0], bore_radius, abs_tol=1e-6)
    )
    finish_outer_index = max(
        index for index, (radius, z) in enumerate(finish_profile)
        if math.isclose(z, 0.0, abs_tol=1e-6)
        and math.isclose(radius, outer_radius, abs_tol=1e-6)
    )
    finish_outer_to_inner = list(reversed(finish_profile[:finish_outer_index + 1]))
    shifted_finish = [
        (radius, z + datum_z) for radius, z in finish_outer_to_inner
    ]
    assert math.isclose(shifted_finish[0][0], outer_radius, abs_tol=1e-6)
    assert math.isclose(shifted_finish[-1][0], bore_radius, abs_tol=1e-6)

    return (
        body_profile[:outer_index + 1]
        + shifted_finish[1:]
        + body_profile[inner_index + 1:]
    ), datum_z


def _union_exact(base, addition):
    """Union a deeply embedded swept helix into the continuous neck wall."""
    import bmesh

    for obj in (base, addition):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    modifier = base.modifiers.new("APPROVED_HELIX_UNION", "BOOLEAN")
    modifier.operation = "UNION"
    modifier.solver = "EXACT"
    modifier.object = addition
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(addition, do_unlink=True)
    bm = bmesh.new()
    bm.from_mesh(base.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(base.data)
    bm.free()
    for polygon in base.data.polygons:
        polygon.use_smooth = True


def build_continuous_body(name, *, swirl_spec=None):
    """Build one continuous glass shell with the approved 17/415 helix."""
    if name == "swirl" and swirl_spec is None:
        raise ValueError("swirl requires an explicit 10- or 12-flute candidate")
    source = bpy.data.objects[BODY_NAME]
    collections = list(source.users_collection)
    parent = source.parent
    location = source.location.copy()
    rotation = source.rotation_euler.copy()
    scale = source.scale.copy()
    source_properties = {key: source[key] for key in source.keys()}
    attachment = bpy.data.objects.get("BB_ATTACH_NECK")

    master = _load_master_builder()
    bottle_spec = dict(master.CYL_SPECS["009"])
    finish_spec = dict(master.FINISH_MASTERS["17-415"])
    finish_spec["bead_z"] = contract.JUNCTION_17_415.band_center_z_mm
    finish_spec["bead_h"] = contract.JUNCTION_17_415.band_height_mm
    finish_spec["thread_group_offset_z"] = (
        contract.JUNCTION_17_415.thread_group_offset_z_mm
    )
    finish_spec["runout_overlap_deg"] = contract.JUNCTION_17_415.runout_overlap_deg
    if name == "swirl":
        bottle_spec["height"] = swirl_spec.height_mm
        bottle_spec["diameter"] = swirl_spec.diameter_mm
    profile, datum_z = _continuous_profile(
        master,
        bottle_spec,
        finish_spec,
        precision=name != "swirl",
    )
    if name == "swirl":
        profile = _densify_profile(profile, max_z_step=0.35, z_max=datum_z)
    outer_radius = bottle_spec["diameter"] / 2.0
    relief_z_min = 2.0
    relief_z_max = datum_z - 2.0

    def molded_radius(radius, z, theta):
        return contract.swirl_radius(
            radius,
            theta,
            z,
            outer_radius,
            relief_z_min,
            relief_z_max,
            swirl_spec,
        )

    replacement = master.revolve(
        "BB_BTL_CYL_CONTINUOUS_010ML_001",
        profile,
        segments=512,
        modulate=molded_radius if name == "swirl" else None,
    )
    for collection in collections:
        collection.objects.link(replacement)
    thread = master.helical_thread_object(
        finish_spec, "BB_FIN_17_415_APPROVED_HELIX_WORKING"
    )
    thread_source_fingerprint = mesh_fingerprint(thread)
    thread.location.z = datum_z
    collections[0].objects.link(thread)
    _union_exact(replacement, thread)
    replacement.parent = parent
    replacement.location = location
    replacement.rotation_euler = rotation
    replacement.scale = scale
    for key, value in source_properties.items():
        replacement[key] = value

    bpy.data.objects.remove(source, do_unlink=True)
    replacement.name = BODY_NAME
    replacement.data.name = f"BB_BTL_CYL_{name.upper()}_CONTINUOUS_MESH"
    replacement["asset_id"] = (
        "BB_BTL_CYL_SWIRL_010ML_001"
        if name == "swirl" else "BB_BTL_CYL_010ML_CONTINUOUS_001"
    )
    replacement["height_mm"] = bottle_spec["height"]
    replacement["diameter"] = bottle_spec["diameter"]
    replacement["neck_finish"] = "17-415"
    replacement["bb_continuous_glass_shell"] = True
    replacement["bb_finish_datum_z_mm"] = datum_z
    replacement["bb_finish_height_mm"] = finish_spec["finish_h"]
    replacement["bb_nominal_finish_height_mm"] = finish_spec["nominal_finish_h"]
    replacement["bb_band_height_mm"] = finish_spec["bead_h"]
    replacement["bb_band_center_z_mm"] = finish_spec["bead_z"]
    replacement["bb_thread_pitch_mm"] = finish_spec["pitch"]
    replacement["bb_thread_turns"] = finish_spec["turns"]
    replacement["bb_thread_material_envelope_mm"] = finish_spec["thread_material_envelope"]
    replacement["bb_thread_group_offset_z_mm"] = finish_spec["thread_group_offset_z"]
    replacement["bb_thread_runout_overlap_deg"] = finish_spec["runout_overlap_deg"]
    replacement["bb_thread_source_fingerprint"] = thread_source_fingerprint
    if name != "swirl":
        solved_shoulder = contract.shoulder_solution(contract.SHOULDER_009)
        replacement["bb_precision_shoulder"] = True
        replacement["bb_shoulder_start_z_mm"] = solved_shoulder.start_z_mm
        replacement["bb_shoulder_end_z_mm"] = contract.SHOULDER_009.datum_z_mm
        replacement["bb_min_smooth_wall_mm"] = contract.SHOULDER_009.wall_mm
    if name == "swirl":
        replacement["bb_swirl_flute_count"] = swirl_spec.flute_count
        replacement["bb_swirl_twist_deg"] = swirl_spec.twist_deg
        replacement["bb_swirl_depth_mm"] = swirl_spec.depth_mm
        replacement["bb_swirl_fade_mm"] = swirl_spec.fade_mm
        replacement["bb_swirl_channel_power"] = swirl_spec.channel_power
        replacement["bb_swirl_candidate"] = (
            f"{swirl_spec.flute_count}-flute-clay-review"
        )
        replacement["bb_relief_z_min_mm"] = relief_z_min
        replacement["bb_relief_z_max_mm"] = relief_z_max
        replacement["bb_min_wall_mm"] = bottle_spec["wall"] - swirl_spec.depth_mm
        replacement["bb_geometry_authority"] = "photo-solved relief; measured envelope"

    finish = bpy.data.objects[FINISH_NAME]
    finish["bb_source_geometry"] = True
    finish["bb_source_role"] = "immutable approved finish reference; not rendered"
    finish.hide_render = True
    finish.hide_viewport = True
    if attachment is not None:
        attachment.parent = replacement
        attachment.location = (0.0, 0.0, bottle_spec["height"])
    bpy.context.view_layer.update()
    return replacement


def build_swirl_candidate(flute_count):
    try:
        swirl_spec = contract.SWIRL_CANDIDATES[flute_count]
    except KeyError as error:
        raise ValueError("swirl candidate must use 10 or 12 flutes") from error
    return build_continuous_body("swirl", swirl_spec=swirl_spec)


def _assert_protected_unchanged(before, after, name):
    if name != "swirl":
        if before != after:
            raise AssertionError("protected baseline state changed during variant build")
        return
    for object_name in PROTECTED_NAMES:
        previous = dict(before[object_name])
        current = dict(after[object_name])
        if object_name == FINISH_NAME:
            previous.pop("location", None)
            current.pop("location", None)
        if previous != current:
            raise AssertionError(f"swirl changed protected state for {object_name}")


def _safe_output(output):
    path = Path(output).expanduser().resolve()
    if path == LOCKED_BASELINE:
        raise ValueError("refusing to overwrite the immutable approved baseline")
    if WORKING_ROOT not in path.parents:
        raise ValueError(f"working scene must be saved below {WORKING_ROOT}")
    return path


def build_variant(name, *, save=False, output=None, swirl_flutes=None):
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
    if name == "swirl":
        if swirl_flutes is None:
            raise ValueError("swirl variant requires swirl_flutes=10 or 12")
        build_swirl_candidate(swirl_flutes)
    else:
        if swirl_flutes is not None:
            raise ValueError("swirl_flutes is only valid for the swirl variant")
        build_continuous_body(name)
    _assign_variant_material(name)
    ensure_reflection_strip()
    configure_workspaces()
    after = protected_snapshot()
    _assert_protected_unchanged(before, after, name)
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
    parser.add_argument("--swirl-flutes", type=int, choices=(10, 12))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.variant == "swirl" and args.swirl_flutes is None:
        parser.error("--swirl-flutes is required when --variant swirl")
    if args.variant != "swirl" and args.swirl_flutes is not None:
        parser.error("--swirl-flutes is only valid when --variant swirl")
    return args


def main():
    args = parse_args()
    build_variant(
        args.variant,
        save=True,
        output=args.output,
        swirl_flutes=args.swirl_flutes,
    )


if __name__ == "__main__":
    main()

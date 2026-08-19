"""Verify a saved gloss/refraction Blender derivative against immutable locks."""

from __future__ import annotations

import json
from pathlib import Path
import sys

import bpy


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


LIGHT_EXPECTATIONS = {
    "BB_FINAL_LEFT_SHADOW_KEY": {
        "location": (-88.0, -30.0, 84.0),
        "rotation": (0.994741, -0.0000001, -1.017115),
        "energy": 89000.0,
        "size": 37.0,
        "size_y": 80.0,
    },
    "BB_FINAL_TOP_FILL": {
        "location": (-10.0, -34.0, 116.0),
        "rotation": (0.5263205, 0.0, -0.2860514),
        "energy": 12000.0,
        "size": 84.0,
        "size_y": 54.0,
    },
    "BB_FINAL_NECK_FILL": {
        "location": (-16.0, -76.0, 76.0),
        "rotation": (1.4427443, 0.0, -0.2074962),
        "energy": 5000.0,
        "size": 54.0,
        "size_y": 28.0,
    },
}

RAY_VISIBILITY = (False, False, True, True, True)
WARM_BONE_LINEAR = (
    0.6653872728347778,
    0.6239603757858276,
    0.5457244515419006,
    1.0,
)
EXPECTED_DIELECTRIC_INPUTS = {
    "Weight": 0.0,
    "Metallic": 0.0,
    "Diffuse Roughness": 0.0,
    "IOR": 1.5,
    "Alpha": 1.0,
    "Subsurface Weight": 0.0,
    "Subsurface Radius": (1.0, 0.2, 0.1),
    "Subsurface Scale": 0.005,
    "Subsurface IOR": 1.4,
    "Subsurface Anisotropy": 0.0,
    "Specular IOR Level": 0.5,
    "Specular Tint": (1.0, 1.0, 1.0, 1.0),
    "Anisotropic": 0.0,
    "Anisotropic Rotation": 0.0,
    "Tangent": (0.0, 0.0, 0.0),
    "Transmission Weight": 0.0,
    "Coat Weight": 0.0,
    "Coat Roughness": 0.03,
    "Coat IOR": 1.5,
    "Coat Tint": (1.0, 1.0, 1.0, 1.0),
    "Coat Normal": (0.0, 0.0, 0.0),
    "Sheen Weight": 0.0,
    "Sheen Roughness": 0.5,
    "Sheen Tint": (1.0, 1.0, 1.0, 1.0),
    "Emission Color": (1.0, 1.0, 1.0, 1.0),
    "Emission Strength": 0.0,
    "Thin Film Thickness": 0.0,
    "Thin Film IOR": 1.33,
    "Normal": (0.0, 0.0, 0.0),
    "Thin Wall": False,
}
EXPECTED_MASTER_LINKS = (
    ("Beer-Lambert Absorption", "Volume", "Glass Shaders", "Volume"),
    ("Glass Controls", "IOR", "Physical Dielectric Glass", "IOR"),
    ("Glass Controls", "absorption_color", "Beer-Lambert Absorption", "Color"),
    ("Glass Controls", "absorption_density", "Beer-Lambert Absorption", "Density"),
    ("Glass Controls", "frost_amount", "Math.002", "Value"),
    ("Glass Controls", "frost_amount", "Math.004", "Value"),
    ("Glass Controls", "micro_normal_strength", "Math.004", "Value"),
    ("Glass Controls", "micro_roughness_amount", "Math.001", "Value"),
    ("Glass Controls", "micro_roughness_scale", "Microscopic Frost", "Scale"),
    ("Glass Controls", "surface_roughness", "Math.003", "Value"),
    ("Glass Controls", "transmission", "Physical Dielectric Glass", "Transmission Weight"),
    ("Math", "Value", "Math.001", "Value"),
    ("Math.001", "Value", "Math.002", "Value"),
    ("Math.002", "Value", "Math.003", "Value"),
    ("Math.003", "Value", "Physical Dielectric Glass", "Roughness"),
    ("Math.004", "Value", "Subvisual Frost Normal", "Strength"),
    ("Microscopic Frost", "Factor", "Math", "Value"),
    ("Microscopic Frost", "Factor", "Subvisual Frost Normal", "Height"),
    ("Physical Dielectric Glass", "BSDF", "Glass Shaders", "Surface"),
    ("Subvisual Frost Normal", "Normal", "Physical Dielectric Glass", "Normal"),
    ("Texture Coordinate", "Generated", "Microscopic Frost", "Vector"),
)
EXPECTED_MASTER_NODES = {
    "Glass Controls": ("NodeGroupInput", None),
    "Glass Shaders": ("NodeGroupOutput", None),
    "Physical Dielectric Glass": ("ShaderNodeBsdfPrincipled", None),
    "Beer-Lambert Absorption": ("ShaderNodeVolumeAbsorption", None),
    "Texture Coordinate": ("ShaderNodeTexCoord", None),
    "Microscopic Frost": ("ShaderNodeTexNoise", None),
    "Subvisual Frost Normal": ("ShaderNodeBump", None),
    "Math": ("ShaderNodeMath", "SUBTRACT"),
    "Math.001": ("ShaderNodeMath", "MULTIPLY"),
    "Math.002": ("ShaderNodeMath", "MULTIPLY"),
    "Math.003": ("ShaderNodeMath", "ADD"),
    "Math.004": ("ShaderNodeMath", "MULTIPLY"),
}


def _principled(material):
    return next(
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    )


def _assert_close(actual, expected, tolerance=1e-6):
    assert abs(float(actual) - float(expected)) < tolerance


def _assert_vector(actual, expected, tolerance=1e-6):
    assert len(actual) == len(expected)
    for actual_value, expected_value in zip(actual, expected):
        _assert_close(actual_value, expected_value, tolerance)


def _signature_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return round(float(value), 7)
    # Blender enum properties are exposed as strings. Strings are iterable,
    # so handle them before the generic vector/array branch to avoid
    # recursively iterating a one-character string forever.
    if isinstance(value, str):
        return value
    if hasattr(value, "__len__"):
        return tuple(_signature_value(item) for item in value)
    return str(value)


def _node_group_behavior_signature(node_group, normalize_surface_tint=False):
    """Capture node types, operations, unlinked defaults, and link topology."""
    nodes = []
    behavior_properties = (
        "operation",
        "use_clamp",
        "noise_dimensions",
        "noise_type",
        "normalize",
        "interpolation",
        "blend_type",
        "distribution",
        "subsurface_method",
        "invert",
        "from_instancer",
        "is_active_output",
    )
    for node in sorted(node_group.nodes, key=lambda item: item.name):
        properties = tuple(
            (name, _signature_value(getattr(node, name)))
            for name in behavior_properties
            if hasattr(node, name)
        )
        inputs = []
        for socket in node.inputs:
            if socket.is_linked or not hasattr(socket, "default_value"):
                continue
            value = socket.default_value
            if (
                normalize_surface_tint
                and node.name == "Physical Dielectric Glass"
                and socket.name == "Base Color"
            ):
                value = ("APPROVED_SURFACE_TINT",)
            inputs.append(
                (socket.name, socket.bl_idname, _signature_value(value))
            )
        nodes.append(
            (
                node.name,
                node.bl_idname,
                bool(node.mute),
                properties,
                tuple(inputs),
            )
        )
    links = tuple(
        sorted(
            (
                link.from_node.name,
                link.from_socket.name,
                link.to_node.name,
                link.to_socket.name,
            )
            for link in node_group.links
        )
    )
    return tuple(nodes), links


def _assert_mesh_snapshot(
    obj,
    *,
    location,
    mesh_hash,
    vertices,
    polygons,
    smooth,
):
    assert contract.object_snapshot(obj) == {
        "name": obj.name,
        "type": "MESH",
        "location": location,
        "rotation": (0.0, 0.0, 0.0),
        "scale": (1.0, 1.0, 1.0),
        "mesh": mesh_hash,
        "vertices": vertices,
        "polygons": polygons,
        "modifiers": (),
        "smooth": tuple(smooth for _ in range(polygons)),
    }


def verify_saved_scene(
    variant: str,
    scrim_110: bool = False,
    neutral_surface_tint: bool = False,
):
    """Return evidence after rejecting any drift from the protected V1 state."""
    if variant not in contract.GLOSS_REFRACTION_PRESETS:
        raise ValueError(f"unknown gloss-refraction candidate {variant!r}")
    if scrim_110 and variant != "luminous-polished":
        raise ValueError("scrim-110 is only valid for luminous-polished")

    scene = bpy.context.scene
    target = contract.COBALT_FINAL_LOCK
    preset = contract.GLOSS_REFRACTION_PRESETS[variant]
    neutral_preset = contract.NEUTRAL_SURFACE_TINT
    body = bpy.data.objects[contract.BODY_NAME]
    visible_finish = bpy.data.objects[contract.FINISH_NAME]
    finish_master = bpy.data.objects[contract.FINISH_MASTER_NAME]
    camera = bpy.data.objects[contract.CAMERA_NAME]
    material = body.data.materials[0]
    group = next(
        node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeGroup"
    )

    checks = {
        "body_hash": contract.geometry_fingerprint(body.data),
        "visible_finish_hash": contract.geometry_fingerprint(visible_finish.data),
        "finish_master_hash": contract.geometry_fingerprint(finish_master.data),
        "camera": contract.object_snapshot(camera),
        "variant": scene.get("bb_gloss_refraction_variant"),
        "material": material.name,
        "density": group.inputs["absorption_density"].default_value,
        "roughness": group.inputs["surface_roughness"].default_value,
        "background": scene.get("bb_background_hex"),
        "exposure": scene.view_settings.exposure,
    }

    # Approved subject, finish, camera, and material-only scope.
    assert checks["body_hash"] == contract.BODY_GEOMETRY_SHA256
    assert checks["visible_finish_hash"] == contract.APPROVED_FINISH_GEOMETRY_SHA256
    assert checks["finish_master_hash"] == contract.APPROVED_FINISH_GEOMETRY_SHA256
    _assert_vector(body.location, (0.0, 0.0, 0.0))
    _assert_vector(body.rotation_euler, (0.0, 0.0, -0.5235988))
    _assert_vector(body.scale, (1.0, 1.0, 1.0))
    assert checks["camera"] == {
        "name": contract.CAMERA_NAME,
        "type": "CAMERA",
        "location": (0.0, -305.555542, 36.0),
        "rotation": (1.5707964, 0.0, 0.0),
        "scale": (1.0, 1.0, 1.0),
        "lens": 100.0,
        "sensor_width": 36.0,
        "dof": False,
    }
    assert checks["variant"] == variant
    assert checks["material"] == (
        neutral_preset.material_name if neutral_surface_tint else preset.material_name
    )
    _assert_close(checks["density"], preset.absorption_density)
    _assert_close(checks["roughness"], preset.surface_roughness)
    expected_glass_inputs = {
        "IOR": 1.50,
        "transmission": 1.0,
        "absorption_color": (0.002, 0.006, 0.72, 1.0),
        "frost_amount": 0.0,
        "micro_roughness_amount": 0.0,
        "micro_roughness_scale": 420.0,
        "micro_normal_strength": 0.0,
    }
    assert set(group.inputs.keys()) == {
        "IOR",
        "surface_roughness",
        "transmission",
        "absorption_color",
        "absorption_density",
        "frost_amount",
        "micro_roughness_amount",
        "micro_roughness_scale",
        "micro_normal_strength",
    }
    for name, expected in expected_glass_inputs.items():
        actual = group.inputs[name].default_value
        if isinstance(expected, tuple):
            _assert_vector(actual, expected)
        else:
            _assert_close(actual, expected)
    dielectric = group.node_tree.nodes["Physical Dielectric Glass"]
    _assert_vector(
        dielectric.inputs["Base Color"].default_value,
        (1.0, 1.0, 1.0, 1.0)
        if neutral_surface_tint
        else (0.0002, 0.0015, 0.98, 1.0),
    )
    for name, expected in EXPECTED_DIELECTRIC_INPUTS.items():
        socket = dielectric.inputs.get(name)
        if socket is None or socket.is_linked:
            continue
        actual = socket.default_value
        if isinstance(expected, tuple):
            _assert_vector(actual, expected)
        elif isinstance(expected, bool):
            assert actual is expected
        else:
            _assert_close(actual, expected)
    assert tuple(
        sorted(
            (
                link.from_node.name,
                link.from_socket.name,
                link.to_node.name,
                link.to_socket.name,
            )
            for link in group.node_tree.links
        )
    ) == tuple(sorted(EXPECTED_MASTER_LINKS))
    assert set(group.node_tree.nodes.keys()) == set(EXPECTED_MASTER_NODES)
    for node_name, (node_type, operation) in EXPECTED_MASTER_NODES.items():
        node = group.node_tree.nodes[node_name]
        assert node.bl_idname == node_type
        assert not node.mute
        if operation is not None:
            assert node.operation == operation
        for socket in node.inputs:
            if socket.is_linked or not hasattr(socket, "default_value"):
                continue
            value = socket.default_value
            # Every unlinked behavior-affecting input must be finite and retain
            # the literal luminous-source defaults covered by the signatures
            # above. Math nodes share the canonical 0.5 unlinked operand.
            if node_type == "ShaderNodeMath":
                _assert_close(value, 0.5)
    source_material = bpy.data.materials["BB_GLOSS_COBALT_LUMINOUS_POLISHED"]
    source_group = next(
        node
        for node in source_material.node_tree.nodes
        if node.bl_idname == "ShaderNodeGroup"
    )
    source_dielectric = source_group.node_tree.nodes["Physical Dielectric Glass"]
    _assert_vector(
        source_dielectric.inputs["Base Color"].default_value,
        (0.0002, 0.0015, 0.98, 1.0),
    )
    assert _node_group_behavior_signature(
        group.node_tree, normalize_surface_tint=True
    ) == _node_group_behavior_signature(
        source_group.node_tree, normalize_surface_tint=True
    )
    assert scene.get("bb_gloss_refraction_scope") == "material-only"
    assert scene.get("bb_gloss_refraction_version") == "gloss-refraction-bracket-v1"
    if neutral_surface_tint:
        assert scene.get("bb_neutral_surface_tint_version") == neutral_preset.version
        assert scene.get("bb_neutral_surface_tint_scope") == (
            "dielectric-base-color-only"
        )
    assert scene.get("bb_cobalt_final_lock_version") == target.version
    assert scene.get("bb_final_lock_geometry_source") == "Photo 2"
    assert scene.get("bb_final_lock_lighting_source") == "Photo 1"

    # Camera/render/color-management contract.
    assert scene.camera == camera
    assert scene.render.engine == "CYCLES"
    assert scene.cycles.device == "GPU"
    assert scene.cycles.samples == 256
    assert scene.cycles.use_adaptive_sampling
    _assert_close(scene.cycles.adaptive_threshold, 0.005)
    assert scene.cycles.use_denoising
    assert (
        scene.cycles.max_bounces,
        scene.cycles.transmission_bounces,
        scene.cycles.glossy_bounces,
        scene.cycles.diffuse_bounces,
        scene.cycles.transparent_max_bounces,
    ) == (12, 12, 8, 4, 8)
    assert (
        scene.render.resolution_x,
        scene.render.resolution_y,
        scene.render.resolution_percentage,
    ) == (900, 990, 100)
    assert not scene.render.film_transparent
    assert scene.view_settings.view_transform == "AgX"
    assert scene.view_settings.look == "AgX - Medium High Contrast"
    _assert_close(scene.view_settings.exposure, target.exposure)
    _assert_close(scene.view_settings.gamma, 1.0)

    # Literal studio light transforms prevent the verifier from validating drift
    # against whatever happens to be in the file under test.
    active_lights = sorted(
        obj.name for obj in bpy.data.objects if obj.type == "LIGHT" and not obj.hide_render
    )
    assert active_lights == sorted(LIGHT_EXPECTATIONS)
    for name, expected in LIGHT_EXPECTATIONS.items():
        obj = bpy.data.objects[name]
        _assert_vector(obj.location, expected["location"])
        _assert_vector(obj.rotation_euler, expected["rotation"])
        _assert_vector(obj.scale, (1.0, 1.0, 1.0))
        _assert_close(obj.data.energy, expected["energy"])
        _assert_close(obj.data.size, expected["size"])
        _assert_close(obj.data.size_y, expected["size_y"])
        _assert_vector(obj.data.color, (1.0, 1.0, 1.0))
        assert (
            obj.visible_camera,
            obj.visible_glossy,
            obj.visible_diffuse,
            obj.visible_transmission,
            obj.visible_shadow,
        ) == RAY_VISIBILITY

    # Existing single curved scrim, physical floor, and warm seamless backdrop.
    scrim = bpy.data.objects[target.left_scrim_name]
    _assert_mesh_snapshot(
        scrim,
        location=(0.0, 0.0, 48.0),
        mesh_hash="c7ed2d112791f07631ff41531d3a8316e95ec5d0895a66d7ba69dd9197f2818e",
        vertices=146,
        polygons=72,
        smooth=False,
    )
    assert scrim.get("bb_wrap_degrees") == 264.0
    assert (
        scrim.hide_render,
        scrim.visible_camera,
        scrim.visible_glossy,
        scrim.visible_diffuse,
        scrim.visible_transmission,
        scrim.visible_shadow,
    ) == (False, False, True, False, False, False)

    floor = bpy.data.objects[target.floor_name]
    backdrop = bpy.data.objects[target.backdrop_name]
    _assert_mesh_snapshot(
        floor,
        location=(0.0, 0.0, -0.12),
        mesh_hash="1f5d02274c5130ccca210813f3a92002b33cdf29ce6cc5e90dcd7c677b188084",
        vertices=4,
        polygons=1,
        smooth=False,
    )
    _assert_mesh_snapshot(
        backdrop,
        location=(0.0, 0.0, 0.0),
        mesh_hash="bac3e32e7a3ae1f01c8c5e67186ada16c723f774dafedbbd17755d8498abb535",
        vertices=20,
        polygons=9,
        smooth=False,
    )
    assert (
        floor.hide_render,
        floor.visible_camera,
        floor.visible_glossy,
        floor.visible_diffuse,
        floor.visible_transmission,
        floor.visible_shadow,
    ) == (False, True, False, True, False, True)
    assert (
        backdrop.hide_render,
        backdrop.visible_camera,
        backdrop.visible_glossy,
        backdrop.visible_diffuse,
        backdrop.visible_transmission,
        backdrop.visible_shadow,
    ) == (False, True, False, True, True, False)

    warm_material = floor.data.materials[0]
    assert backdrop.data.materials[0] == warm_material
    assert warm_material.name == "BB_MAT_FINAL_WARM_BONE_FLOOR"
    warm_principled = _principled(warm_material)
    _assert_vector(warm_principled.inputs["Base Color"].default_value, WARM_BONE_LINEAR)
    _assert_vector(warm_principled.inputs["Emission Color"].default_value, WARM_BONE_LINEAR)
    _assert_close(warm_principled.inputs["Roughness"].default_value, 0.96)
    _assert_close(warm_principled.inputs["Emission Strength"].default_value, 0.0)

    assert checks["background"] == target.background_hex
    background = scene.world.node_tree.nodes["Background"]
    _assert_vector(
        background.inputs["Color"].default_value,
        (0.4793201685, 0.4396571815, 0.3864294291, 1.0),
    )
    _assert_close(background.inputs["Strength"].default_value, target.world_strength)
    assert scene.get("bb_shadow_direction") == "camera-right"
    assert scene.get("bb_contact_shadow_adjustment") == "existing-left-key-only"

    scrim_material = scrim.data.materials[0]
    scrim_principled = _principled(scrim_material)
    _assert_vector(scrim_principled.inputs["Base Color"].default_value, (0.95, 0.95, 0.95, 1.0))
    _assert_vector(scrim_principled.inputs["Emission Color"].default_value, (1.0, 1.0, 1.0, 1.0))
    _assert_close(scrim_principled.inputs["Roughness"].default_value, 1.0)
    _assert_close(scrim_principled.inputs["Emission Strength"].default_value, target.scrim_emission)
    if scrim_110:
        assert scrim_material.name == "BB_MAT_FINAL_LEFT_DIFFUSION_GLOSS_110"
        gain_node = scrim_material.node_tree.nodes["BB_GLOSS_REFRACTION_SCRIM_GAIN"]
        checks["scrim_gain"] = gain_node.inputs[1].default_value
        _assert_close(
            checks["scrim_gain"],
            target.scrim_emission * contract.GLOSS_REFRACTION_SCRIM_GAIN,
        )
        assert scene.get("bb_gloss_refraction_scrim_calibration") == (
            "single-curved-scrim-110-percent"
        )
    else:
        assert scrim_material.name == "BB_MAT_FINAL_LEFT_DIFFUSION"

    return checks


def _main():
    if "--" not in sys.argv:
        raise SystemExit("expected -- <variant> [scrim-110]")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if not args:
        raise SystemExit("expected -- <variant> [scrim-110]")
    checks = verify_saved_scene(
        args[0],
        "scrim-110" in args[1:],
        "neutral-surface" in args[1:],
    )
    print("BB_GLOSS_SAVED_SCENE_OK", json.dumps(checks, sort_keys=True))


if __name__ == "__main__":
    _main()

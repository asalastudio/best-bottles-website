"""Blender integration gates for the protected 9 ml luxury glass system."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
import sys
import unittest

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "scripts/paper-doll-3d"
sys.path.insert(0, str(SCRIPT_DIR))


def load_builder():
    path = SCRIPT_DIR / "build-9ml-luxury-glass-studio.py"
    spec = importlib.util.spec_from_file_location("bb_luxury_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = load_builder()


class LuxuryGlassBlenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.body = bpy.data.objects[builder.contract.BODY_NAME]
        cls.before = builder.contract.object_snapshot(cls.body)

    def test_geometry_audit_matches_approved_closed_shell(self):
        audit = builder.audit_geometry()
        self.assertEqual(audit["body_geometry_sha256"], builder.contract.BODY_GEOMETRY_SHA256)
        self.assertEqual(audit["thread_source_sha256"], builder.contract.THREAD_SHA256)
        self.assertEqual(audit["components"], 1)
        self.assertEqual(audit["non_manifold_edges"], 0)
        self.assertEqual(audit["boundary_edges"], 0)
        self.assertEqual(audit["wire_edges"], 0)
        self.assertEqual(audit["duplicate_coordinates"], 0)
        self.assertEqual(audit["duplicate_faces"], 0)
        self.assertEqual(audit["zero_area_faces"], 0)
        self.assertTrue(audit["positive_signed_volume"])
        self.assertTrue(audit["normalized_face_normals"])
        self.assertTrue(audit["open_bore"])
        self.assertTrue(audit["physical_rim"])
        self.assertAlmostEqual(audit["base_thickness_mm"], 3.5, places=6)

    def test_master_group_exposes_only_approved_controls(self):
        group = builder.ensure_master_group()
        sockets = {
            item.name
            for item in group.interface.items_tree
            if getattr(item, "item_type", None) == "SOCKET"
            and getattr(item, "in_out", None) == "INPUT"
        }
        self.assertEqual(
            sockets,
            {
                "IOR",
                "surface_roughness",
                "transmission",
                "absorption_color",
                "absorption_density",
                "frost_amount",
                "micro_roughness_amount",
                "micro_roughness_scale",
                "micro_normal_strength",
            },
        )
        self.assertTrue(any(node.bl_idname == "ShaderNodeBsdfPrincipled" for node in group.nodes))
        self.assertTrue(any(node.bl_idname == "ShaderNodeVolumeAbsorption" for node in group.nodes))
        self.assertTrue(any(node.bl_idname == "ShaderNodeBump" for node in group.nodes))

    def test_four_materials_are_group_driven_physical_glass(self):
        materials = builder.ensure_all_glass_materials()
        self.assertEqual(set(materials), {"clear", "amber", "cobalt", "frosted"})
        for variant, material in materials.items():
            group_nodes = [
                node for node in material.node_tree.nodes
                if node.bl_idname == "ShaderNodeGroup" and node.node_tree.name == "BB_GLASS_MASTER"
            ]
            self.assertEqual(len(group_nodes), 1)
            node = group_nodes[0]
            self.assertEqual(node.inputs["IOR"].default_value, 1.5)
            self.assertEqual(node.inputs["transmission"].default_value, 1.0)
            self.assertEqual(material.diffuse_color[3], 1.0)
            self.assertAlmostEqual(
                node.inputs["absorption_density"].default_value,
                builder.contract.VARIANTS[variant].absorption_density,
            )

        master = bpy.data.node_groups["BB_GLASS_MASTER"]
        principled = next(node for node in master.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
        self.assertEqual(principled.inputs["Metallic"].default_value, 0.0)
        self.assertEqual(principled.inputs["Alpha"].default_value, 1.0)

    def test_material_build_does_not_mutate_geometry_or_add_solidify(self):
        builder.ensure_all_glass_materials()
        after = builder.contract.object_snapshot(self.body)
        self.assertEqual(after, self.before)
        self.assertFalse(any(modifier.type == "SOLIDIFY" for modifier in self.body.modifiers))

    def test_luxury_studio_has_five_area_lights_and_reflection_cards(self):
        collection = builder.ensure_luxury_studio()
        lights = [obj for obj in collection.objects if obj.type == "LIGHT"]
        cards = [obj for obj in collection.objects if obj.get("bb_negative_fill")]
        self.assertEqual({obj.name for obj in lights}, {spec.name for spec in builder.contract.LIGHTS})
        self.assertEqual({obj.name for obj in cards}, {spec.name for spec in builder.contract.NEGATIVE_CARDS})
        self.assertEqual(len(lights), 5)
        for spec in builder.contract.LIGHTS:
            obj = bpy.data.objects[spec.name]
            width, height = spec.dimensions(builder.contract.GEOMETRY)
            self.assertEqual(obj.data.type, "AREA")
            self.assertEqual(obj.data.shape, "RECTANGLE")
            self.assertAlmostEqual(obj.data.size, width, places=5)
            self.assertAlmostEqual(obj.data.size_y, height, places=5)
            self.assertAlmostEqual(obj.data.energy, spec.energy_watts, places=5)
            expected_direction = (
                Vector(spec.target(builder.contract.GEOMETRY)) - obj.location
            ).normalized()
            actual_direction = (obj.rotation_euler.to_matrix() @ Vector((0, 0, -1))).normalized()
            self.assertGreater(actual_direction.dot(expected_direction), 0.99999)
        for card in cards:
            self.assertFalse(card.visible_camera)
            self.assertTrue(card.visible_glossy)
            self.assertGreater(abs(card.location.x), builder.contract.GEOMETRY.diameter_mm * 2.0)

    def test_legacy_emitters_are_disabled_but_physical_sweep_remains(self):
        builder.ensure_luxury_studio()
        for name in builder.LEGACY_EMITTERS:
            obj = bpy.data.objects.get(name)
            if obj is not None:
                self.assertTrue(obj.hide_render, name)
        self.assertFalse(bpy.data.objects["BB_STUDIO_SWEEP"].hide_render)
        key = bpy.data.objects["BB_LUX_KEY_LEFT"]
        self.assertLess(key.location.x, 0.0)
        self.assertLess(key.location.y, 0.0)

    def test_camera_cycles_and_agx_match_the_protected_contract(self):
        camera = bpy.data.objects[builder.contract.CAMERA_NAME]
        camera_before = builder.contract.object_snapshot(camera)
        builder.configure_camera()
        builder.configure_cycles()
        builder.configure_color_management()
        self.assertEqual(builder.contract.object_snapshot(camera), camera_before)
        scene = bpy.context.scene
        render = builder.contract.RENDER
        self.assertEqual(scene.camera.name, builder.contract.CAMERA_NAME)
        self.assertEqual(scene.render.engine, render.engine)
        self.assertEqual(scene.cycles.samples, render.samples)
        self.assertEqual(scene.cycles.use_adaptive_sampling, render.adaptive_sampling)
        self.assertAlmostEqual(scene.cycles.adaptive_threshold, render.noise_threshold)
        self.assertEqual(scene.cycles.max_bounces, render.max_bounces)
        self.assertEqual(scene.cycles.transmission_bounces, render.transmission_bounces)
        self.assertEqual(scene.cycles.glossy_bounces, render.glossy_bounces)
        self.assertEqual(scene.cycles.diffuse_bounces, render.diffuse_bounces)
        self.assertEqual(scene.cycles.transparent_max_bounces, render.transparent_bounces)
        self.assertEqual(scene.view_settings.view_transform, render.view_transform)
        self.assertEqual(scene.view_settings.exposure, render.exposure)
        self.assertEqual(scene.view_settings.gamma, render.gamma)


suite = unittest.defaultTestLoader.loadTestsFromTestCase(LuxuryGlassBlenderTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise SystemExit(1)

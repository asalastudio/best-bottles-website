"""Blender gates for the high-key cobalt correction architecture."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

import bpy


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "scripts/paper-doll-3d"
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


def load_builder():
    path = SCRIPT_DIR / "build-9ml-cobalt-correction.py"
    spec = importlib.util.spec_from_file_location("bb_cobalt_correction_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = load_builder()


class CobaltCorrectionBlenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.body = bpy.data.objects[contract.BODY_NAME]
        cls.body_before = contract.object_snapshot(cls.body)
        cls.camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
        builder.build_correction_in_memory()

    def test_geometry_and_camera_remain_exact(self):
        self.assertEqual(contract.object_snapshot(self.body), self.body_before)
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
            self.camera_before,
        )
        self.assertEqual(contract.geometry_fingerprint(self.body.data), contract.BODY_GEOMETRY_SHA256)
        self.assertEqual(self.body.get("bb_thread_source_fingerprint"), contract.THREAD_SHA256)

    def test_clear_calibration_has_no_absorption_and_neutral_surface(self):
        material = self.body.data.materials[0]
        self.assertEqual(material.name, "BB_CORR_CLEAR")
        group = next(node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeGroup")
        self.assertEqual(group.inputs["absorption_density"].default_value, 0.0)
        self.assertEqual(group.inputs["transmission"].default_value, 1.0)
        self.assertEqual(group.inputs["IOR"].default_value, 1.5)
        self.assertAlmostEqual(group.inputs["surface_roughness"].default_value, 0.035)

    def test_studio_uses_white_scrims_without_negative_fill_or_rear_rim(self):
        collection = bpy.data.collections[contract.COBALT_CORRECTION.collection_name]
        lights = [obj for obj in collection.objects if obj.type == "LIGHT"]
        scrims = [obj for obj in collection.objects if obj.get("bb_diffusion_scrim")]
        self.assertEqual({obj.name for obj in lights}, {spec.name for spec in contract.CORRECTION_LIGHTS})
        self.assertEqual({obj.name for obj in scrims}, {spec.name for spec in contract.CORRECTION_SCRIMS})
        self.assertEqual(len(lights), 3)
        self.assertEqual(len(scrims), 2)
        for light in lights:
            self.assertFalse(light.visible_glossy)
            self.assertEqual(tuple(light.data.color), (1.0, 1.0, 1.0))
        for scrim in scrims:
            self.assertFalse(scrim.visible_camera)
            self.assertTrue(scrim.visible_glossy)
        panel = bpy.data.objects["BB_CORR_BACKDROP_PANEL"]
        self.assertTrue(panel.visible_camera)
        self.assertTrue(panel.visible_transmission)
        self.assertFalse(panel.visible_glossy)
        floor = bpy.data.objects["BB_CORR_FLOOR"]
        self.assertTrue(floor.get("bb_correction_physical_floor"))
        self.assertTrue(floor.visible_shadow)
        self.assertFalse(floor.visible_transmission)
        self.assertFalse(floor.visible_glossy)
        self.assertTrue(bpy.data.objects["BB_STUDIO_SWEEP"].hide_render)
        self.assertFalse(any(obj.get("bb_negative_fill") and not obj.hide_render for obj in bpy.data.objects))
        self.assertFalse(
            any(
                (obj.name.startswith("BB_FLAG_") or obj.name.startswith("BB_CARD_"))
                and not obj.hide_render
                for obj in bpy.data.objects
            )
        )
        self.assertIsNone(bpy.data.objects.get("BB_CORR_REAR_RIM"))

    def test_background_and_world_are_bright_warm_bone(self):
        scene = bpy.context.scene
        self.assertEqual(scene["bb_background_hex"], "#F3EFE8")
        background = scene.world.node_tree.nodes.get("Background")
        self.assertAlmostEqual(background.inputs["Strength"].default_value, 0.70)
        self.assertEqual(scene.view_settings.view_transform, "AgX")
        self.assertAlmostEqual(
            scene.view_settings.exposure,
            contract.COBALT_CORRECTION.exposure,
        )
        sweep = bpy.data.objects["BB_STUDIO_SWEEP"]
        self.assertTrue(sweep.hide_render)
        panel = bpy.data.objects["BB_CORR_BACKDROP_PANEL"]
        floor = bpy.data.objects["BB_CORR_FLOOR"]
        self.assertGreater(panel.data.materials[0].diffuse_color[0], 0.85)
        self.assertGreater(floor.data.materials[0].diffuse_color[0], 0.85)

    def test_four_cobalt_candidates_only_change_absorption_density(self):
        materials = builder.ensure_correction_materials()
        self.assertEqual(set(materials), {"clear", 25, 50, 75, 100})
        for percentage, density in contract.CORRECTION_COBALT_DENSITIES.items():
            group = next(
                node for node in materials[percentage].node_tree.nodes
                if node.bl_idname == "ShaderNodeGroup"
            )
            self.assertAlmostEqual(group.inputs["absorption_density"].default_value, density)
            for actual, expected in zip(
                tuple(group.inputs["absorption_color"].default_value)[:3],
                (0.003, 0.012, 0.92),
            ):
                self.assertAlmostEqual(actual, expected)
            self.assertAlmostEqual(
                group.inputs["surface_roughness"].default_value,
                contract.COBALT_CORRECTION.cobalt_roughness,
            )


suite = unittest.defaultTestLoader.loadTestsFromTestCase(CobaltCorrectionBlenderTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise SystemExit(1)

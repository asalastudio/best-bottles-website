"""Adversarial Blender gates for protected gloss/refraction derivatives."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

import bpy


ROOT = Path(__file__).resolve().parents[3]
VERIFY_PATH = (
    ROOT
    / "scripts/paper-doll-3d/tests/verify_gloss_refraction_saved_scene.py"
)


def load_verifier():
    spec = importlib.util.spec_from_file_location("bb_gloss_saved_scene_verifier", VERIFY_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


verifier = load_verifier()


class GlossRefractionSavedSceneVerifierTests(unittest.TestCase):
    def test_unmodified_saved_baseline_passes(self):
        checks = verifier.verify_saved_scene("baseline-v1")
        self.assertEqual(checks["variant"], "baseline-v1")

    def test_camera_lens_drift_is_rejected(self):
        camera = bpy.data.objects[verifier.contract.CAMERA_NAME]
        original = camera.data.lens
        self.addCleanup(setattr, camera.data, "lens", original)
        camera.data.lens = 40.0
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene("baseline-v1")

    def test_existing_key_rotation_drift_is_rejected(self):
        key = bpy.data.objects[verifier.contract.COBALT_FINAL_LOCK.left_key_name]
        original = key.rotation_euler.copy()
        self.addCleanup(setattr, key, "rotation_euler", original)
        key.rotation_euler.z += 0.1
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene("baseline-v1")

    def test_floor_shadow_visibility_drift_is_rejected(self):
        floor = bpy.data.objects[verifier.contract.COBALT_FINAL_LOCK.floor_name]
        original = floor.visible_shadow
        self.addCleanup(setattr, floor, "visible_shadow", original)
        floor.visible_shadow = False
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene("baseline-v1")

    def test_unapproved_glass_input_drift_is_rejected(self):
        body = bpy.data.objects[verifier.contract.BODY_NAME]
        material = body.data.materials[0]
        group = next(
            node
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        socket = group.inputs["micro_roughness_scale"]
        original = socket.default_value
        self.addCleanup(setattr, socket, "default_value", original)
        socket.default_value = 17.0
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene("baseline-v1")

    def test_neutral_surface_mode_rejects_the_original_blue_dielectric(self):
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene(
                "luminous-polished", neutral_surface_tint=True
            )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(
        GlossRefractionSavedSceneVerifierTests
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)

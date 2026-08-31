"""Adversarial verification for the one-variable neutral-surface derivative."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

import bpy


ROOT = Path(__file__).resolve().parents[3]
VERIFY_PATH = ROOT / "scripts/paper-doll-3d/tests/verify_gloss_refraction_saved_scene.py"


def load_verifier():
    spec = importlib.util.spec_from_file_location(
        "bb_neutral_surface_saved_scene_verifier", VERIFY_PATH
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


verifier = load_verifier()


class NeutralSurfaceSavedSceneVerifierTests(unittest.TestCase):
    def test_unmodified_neutral_surface_scene_passes(self):
        checks = verifier.verify_saved_scene(
            "luminous-polished", neutral_surface_tint=True
        )
        self.assertEqual(checks["material"], "BB_GLOSS_COBALT_NEUTRAL_SURFACE")

    def test_internal_dielectric_metallic_drift_is_rejected(self):
        body = bpy.data.objects[verifier.contract.BODY_NAME]
        material = body.data.materials[0]
        group = next(
            node
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        dielectric = group.node_tree.nodes["Physical Dielectric Glass"]
        socket = dielectric.inputs["Metallic"]
        original = socket.default_value
        self.addCleanup(setattr, socket, "default_value", original)
        socket.default_value = 0.4
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene(
                "luminous-polished", neutral_surface_tint=True
            )

    def test_internal_roughness_math_operation_drift_is_rejected(self):
        body = bpy.data.objects[verifier.contract.BODY_NAME]
        material = body.data.materials[0]
        group = next(
            node
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        math_node = group.node_tree.nodes["Math.003"]
        original = math_node.operation
        self.addCleanup(setattr, math_node, "operation", original)
        math_node.operation = "MULTIPLY"
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene(
                "luminous-polished", neutral_surface_tint=True
            )

    def test_internal_bump_inversion_drift_is_rejected(self):
        body = bpy.data.objects[verifier.contract.BODY_NAME]
        material = body.data.materials[0]
        group = next(
            node
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        bump_node = group.node_tree.nodes["Subvisual Frost Normal"]
        original = bump_node.invert
        self.addCleanup(setattr, bump_node, "invert", original)
        bump_node.invert = not original
        with self.assertRaises(AssertionError):
            verifier.verify_saved_scene(
                "luminous-polished", neutral_surface_tint=True
            )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(
        NeutralSurfaceSavedSceneVerifierTests
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)

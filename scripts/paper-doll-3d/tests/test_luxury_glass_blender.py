"""Blender integration gates for the protected 9 ml luxury glass system."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
import sys
import unittest

import bpy


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


suite = unittest.defaultTestLoader.loadTestsFromTestCase(LuxuryGlassBlenderTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise SystemExit(1)

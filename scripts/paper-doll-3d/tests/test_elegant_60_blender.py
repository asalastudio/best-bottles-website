#!/usr/bin/env python3
"""Real Blender contract tests for the drawing-backed Elegant 60 body."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
BUILD_SCRIPT = ROOT / "scripts" / "paper-doll-3d" / "build-master-scene.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("bb_elegant60_builder", BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def world_bounds(obj: bpy.types.Object) -> dict[str, float]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "width": max(point.x for point in points) - min(point.x for point in points),
        "depth": max(point.y for point in points) - min(point.y for point in points),
        "min_z": min(point.z for point in points),
        "max_z": max(point.z for point in points),
    }


class Elegant60ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.builder = load_builder()

    def elegant_spec(self):
        self.assertIn(
            "elegant60",
            self.builder.CYL_SPECS,
            "the CLI registry cannot build the drawing-backed Elegant 60 body",
        )
        return dict(self.builder.CYL_SPECS["elegant60"])

    def test_profile_matches_drawing_envelope_and_base_chamfer(self):
        bottle_spec = self.elegant_spec()
        self.assertTrue(
            hasattr(self.builder, "elegant_stations"),
            "the Elegant family needs a rectangular station generator",
        )
        finish = self.builder.FINISH_MASTERS["18-415"]
        stations = self.builder.elegant_stations(bottle_spec, finish)

        self.assertAlmostEqual(54.5, max(station[0] for station in stations) * 2, delta=0.05)
        self.assertAlmostEqual(27.5, max(station[1] for station in stations) * 2, delta=0.05)
        self.assertAlmostEqual(70.9, max(station[3] for station in stations), delta=0.05)

        base_ring = min(
            (station for station in stations if station[0] > 0.0),
            key=lambda station: abs(station[3]),
        )
        self.assertAlmostEqual(50.5, base_ring[0] * 2, delta=0.05)
        self.assertAlmostEqual(23.5, base_ring[1] * 2, delta=0.05)

    def test_interior_cavity_meets_63_ml_overflow_gate(self):
        bottle_spec = self.elegant_spec()
        self.assertTrue(
            hasattr(self.builder, "elegant_cavity_ml"),
            "the Elegant family needs an independently reported cavity audit",
        )
        cavity_ml = self.builder.elegant_cavity_ml(bottle_spec)
        self.assertGreaterEqual(cavity_ml, 63.0 * 0.92)
        self.assertLessEqual(cavity_ml, 63.0 * 1.08)

    def test_full_build_uses_clear_glass_and_unscaled_18_415_finish(self):
        self.elegant_spec()
        with tempfile.TemporaryDirectory(prefix="bb-elegant60-test-") as temp_dir:
            output = Path(temp_dir) / "elegant-60ml-clear.blend"
            self.builder.build(
                output,
                samples=8,
                bottle_key="elegant60",
                glass="clear",
                lighting="symmetric",
            )

            self.assertTrue(output.exists())
            body = bpy.data.objects.get("BB_BTL_ELEGANT_060ML_001")
            finish = bpy.data.objects.get("BB_FIN_18_415")
            self.assertIsNotNone(body)
            self.assertIsNotNone(finish)

            body_bounds = world_bounds(body)
            finish_bounds = world_bounds(finish)
            self.assertAlmostEqual(54.5, body_bounds["width"], delta=0.15)
            self.assertAlmostEqual(27.5, body_bounds["depth"], delta=0.15)
            self.assertAlmostEqual(0.0, body_bounds["min_z"], delta=0.05)
            self.assertAlmostEqual(86.7, max(body_bounds["max_z"], finish_bounds["max_z"]), delta=0.15)
            self.assertEqual("18-415", finish["finish_standard"])
            self.assertEqual((1.0, 1.0, 1.0), tuple(round(value, 6) for value in finish.scale))
            self.assertAlmostEqual(17.5, finish["major_d"], delta=1e-6)
            self.assertAlmostEqual(15.5, finish["neck_d"], delta=1e-6)
            self.assertAlmostEqual(10.3, finish["bore_d"], delta=1e-6)
            self.assertTrue(any("CLEAR" in material.name for material in body.data.materials))

            for obj in (body, finish):
                mesh = bmesh.new()
                mesh.from_mesh(obj.data)
                self.assertFalse(
                    [edge for edge in mesh.edges if len(edge.link_faces) != 2],
                    f"{obj.name} must be a closed manifold mesh",
                )
                mesh.free()


suite = unittest.defaultTestLoader.loadTestsFromTestCase(Elegant60ContractTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise SystemExit(1)

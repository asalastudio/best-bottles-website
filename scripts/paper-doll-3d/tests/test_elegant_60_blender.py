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

    def test_inner_shoulder_opens_gradually_without_annular_shelf(self):
        """The photo-backed cavity must not form a second oval below the neck."""
        bottle_spec = self.elegant_spec()
        finish = self.builder.FINISH_MASTERS["18-415"]
        stations = self.builder.elegant_stations(bottle_spec, finish)
        datum_z = bottle_spec["height"] - finish["finish_h"]
        inner_w = bottle_spec["diameter"] / 2.0 - bottle_spec["wall"]

        # The first station at the maximum datum is the outer neck land; the
        # second is the inner bore. Everything after that walks down the
        # cavity. The original front PSD and the operator's physical-bottle
        # photo both show a broad, continuous inner shoulder—not a tight,
        # near-horizontal flare that refracts as a floating oval ring.
        inner_start = next(
            index
            for index, station in enumerate(stations)
            if abs(station[3] - datum_z) <= 0.05
            and abs(station[0] - finish["bore_d"] / 2.0) <= 0.05
        )
        inner = stations[inner_start:]
        self.assertGreater(
            inner[1][0],
            inner[0][0],
            "the cavity must begin opening at the neck datum instead of forming a visible bore stem below it",
        )
        outward_slopes = []
        for upper, lower in zip(inner, inner[1:]):
            width_growth = lower[0] - upper[0]
            drop = upper[3] - lower[3]
            if width_growth > 0.0 and drop > 0.0:
                outward_slopes.append(width_growth / drop)

        self.assertTrue(outward_slopes)
        self.assertLessEqual(
            max(outward_slopes),
            6.0,
            "the inner shoulder flares too abruptly and will read as an annular shelf",
        )

        broad_cavity = next(station for station in inner if station[0] >= inner_w * 0.9)
        self.assertLessEqual(
            broad_cavity[3],
            bottle_spec["shoulder_line"] - 3.0,
            "the broad cavity begins too close to the outer shoulder and creates a second oval",
        )

    def test_visible_side_walls_match_operator_reference(self):
        """The approved visual target uses slim, consistent side walls."""
        bottle_spec = self.elegant_spec()
        finish = self.builder.FINISH_MASTERS["18-415"]
        stations = self.builder.elegant_stations(bottle_spec, finish)
        half_width = bottle_spec["diameter"] / 2.0

        inner_start = next(
            index
            for index, station in enumerate(stations)
            if abs(station[0] - finish["bore_d"] / 2.0) <= 0.05
            and abs(station[3] - (bottle_spec["height"] - finish["finish_h"])) <= 0.05
        )
        inner_body = [
            station
            for station in stations[inner_start:]
            if station[0] > finish["bore_d"] / 2.0
            and station[3] >= bottle_spec["base_th"] + 0.5
        ]
        visible_wall = half_width - max(station[0] for station in inner_body)

        self.assertAlmostEqual(
            visible_wall,
            1.6,
            delta=0.15,
            msg="the side wall is heavier than the operator-approved Elegant reference",
        )

    def test_clear_symmetric_studio_reflects_without_transmitting_cards(self):
        """Reflection panels must shape glass without appearing inside it."""
        self.elegant_spec()
        with tempfile.TemporaryDirectory(prefix="bb-elegant60-optics-test-") as temp_dir:
            output = Path(temp_dir) / "elegant-60ml-clear.blend"
            self.builder.build(
                output,
                samples=8,
                bottle_key="elegant60",
                glass="clear",
                lighting="symmetric",
            )

            cards = [
                bpy.data.objects[name]
                for name in (
                    "BB_LIGHT_KEY_CENTER",
                    "BB_CARD_TOP",
                    "BB_LIGHT_SWEEP_WASH",
                )
            ]
            for card in cards:
                self.assertTrue(
                    card.visible_glossy,
                    f"{card.name} must remain visible to reflective glass rays",
                )
                self.assertFalse(
                    card.visible_transmission,
                    f"{card.name} must not refract as a rectangular object inside clear glass",
                )

    def test_clear_standard_studio_reflects_without_transmitting_key_or_fill(self):
        """The Elegant off-axis key/fill must not appear inside clear glass."""
        self.elegant_spec()
        with tempfile.TemporaryDirectory(prefix="bb-elegant60-standard-optics-test-") as temp_dir:
            output = Path(temp_dir) / "elegant-60ml-clear.blend"
            self.builder.build(
                output,
                samples=8,
                bottle_key="elegant60",
                glass="clear",
                lighting="standard",
            )

            for name in ("BB_LIGHT_KEY_SOFTBOX", "BB_CARD_FILL_RIGHT"):
                card = bpy.data.objects[name]
                self.assertTrue(
                    card.visible_glossy,
                    f"{card.name} must remain visible to reflective glass rays",
                )
                self.assertFalse(
                    card.visible_transmission,
                    f"{card.name} must not refract as a rectangular object inside clear glass",
                )

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
            render_glass = bpy.data.objects.get("BB_RENDER_GLASS_ASSEMBLY")
            self.assertIsNotNone(body)
            self.assertIsNotNone(finish)
            self.assertIsNotNone(
                render_glass,
                "the beauty scene needs one welded dielectric at the body/finish interface",
            )

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
            clear_material = next(
                material for material in body.data.materials if "CLEAR" in material.name
            )
            self.assertFalse(
                clear_material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].is_linked,
                "the operator reference uses a clear polished Elegant bore, not the generic molded-bore frost mask",
            )
            self.assertTrue(body.hide_render)
            self.assertTrue(finish.hide_render)
            self.assertFalse(render_glass.hide_render)
            self.assertEqual("matched-rings", render_glass["interface_weld_method"])
            render_bounds = world_bounds(render_glass)
            self.assertAlmostEqual(54.5, render_bounds["width"], delta=0.15)
            self.assertAlmostEqual(27.5, render_bounds["depth"], delta=0.15)
            self.assertAlmostEqual(0.0, render_bounds["min_z"], delta=0.05)
            self.assertAlmostEqual(86.7, render_bounds["max_z"], delta=0.15)

            for obj in (body, finish, render_glass):
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

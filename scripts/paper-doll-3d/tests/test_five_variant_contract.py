"""Pure-Python contract tests for the Best Bottles five-variant family."""

import importlib.util
import math
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "scripts/paper-doll-3d/five_variant_contract.py"


def load_contract():
    spec = importlib.util.spec_from_file_location("bb_five_variant_contract", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FiveVariantContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = load_contract()

    def test_family_has_exactly_five_named_variants(self):
        self.assertEqual(
            set(self.contract.VARIANTS),
            {"clear", "frosted", "cobalt", "amber", "swirl"},
        )

    def test_shared_variants_do_not_authorize_geometry_changes(self):
        for name in ("clear", "frosted", "cobalt", "amber"):
            with self.subTest(name=name):
                self.assertFalse(
                    self.contract.VARIANTS[name].allows_body_geometry_change
                )
        self.assertTrue(self.contract.VARIANTS["swirl"].allows_body_geometry_change)

    def test_colored_density_candidates_resolve_to_approved_values(self):
        self.assertEqual(self.contract.VARIANTS["cobalt"].density, 0.65)
        self.assertEqual(
            self.contract.VARIANTS["cobalt"].absorption_color,
            (0.002, 0.008, 0.95),
        )
        self.assertEqual(
            self.contract.VARIANTS["cobalt"].surface_tint,
            (0.005, 0.012, 0.65),
        )
        self.assertEqual(self.contract.VARIANTS["amber"].density, 0.65)

    def test_swirl_contract_uses_approved_photo_solved_candidate(self):
        swirl = self.contract.SWIRL
        self.assertEqual(swirl.height_mm, 74.0)
        self.assertEqual(swirl.diameter_mm, 21.0)
        self.assertEqual(swirl.finish, "17-415")
        self.assertEqual(swirl.flute_count, 8)
        self.assertEqual(swirl.twist_deg, 85.0)
        self.assertEqual(swirl.depth_mm, 0.75)

    def test_17_415_finish_height_remains_at_lower_drawing_tolerance(self):
        junction = self.contract.JUNCTION_17_415
        self.assertEqual(junction.finish_height_mm, 13.76)
        self.assertEqual(junction.nominal_finish_height_mm, 14.06)

    def test_bottom_band_matches_drawing_and_spacing_rule(self):
        junction = self.contract.JUNCTION_17_415
        self.assertEqual(junction.band_height_mm, 2.0)
        self.assertEqual(junction.band_center_z_mm, 1.3)
        self.assertAlmostEqual(junction.shoulder_to_band_gap_mm, 0.3)
        self.assertLessEqual(
            junction.shoulder_to_band_gap_mm,
            junction.band_to_first_thread_gap_mm,
        )

    def test_thread_group_uses_remaining_upward_zone_without_clipping(self):
        junction = self.contract.JUNCTION_17_415
        self.assertEqual(junction.thread_group_offset_z_mm, 0.375)
        nominal_band_top = (
            junction.finish_height_mm - junction.top_land_mm
        )
        nominal_band_bottom = nominal_band_top - junction.nominal_thread_zone_mm
        group_mid = (
            (nominal_band_bottom + nominal_band_top) / 2.0
            + junction.thread_group_offset_z_mm
        )
        group_top = group_mid + junction.thread_material_envelope_mm / 2.0
        self.assertAlmostEqual(group_top, nominal_band_top)

    def test_thread_runouts_overlap_across_the_front_centerline(self):
        junction = self.contract.JUNCTION_17_415
        self.assertEqual(junction.runout_overlap_deg, 20.0)

    def test_colored_glass_is_luminous_not_overabsorbed(self):
        self.assertEqual(self.contract.VARIANTS["cobalt"].roughness, 0.012)
        self.assertEqual(self.contract.VARIANTS["cobalt"].density, 0.65)
        self.assertEqual(self.contract.VARIANTS["amber"].roughness, 0.012)
        self.assertEqual(self.contract.VARIANTS["amber"].density, 0.65)

    def test_swirl_is_inward_and_respects_wall_gate(self):
        swirl = self.contract.SWIRL
        radius = self.contract.swirl_radius(
            10.5, 0.0, 30.0, 10.5, 4.0, 56.0, swirl
        )
        self.assertGreaterEqual(radius, 10.5 - swirl.depth_mm)
        self.assertLessEqual(radius, 10.5)
        self.assertGreaterEqual(10.5 - swirl.depth_mm - 8.9, 0.8)

    def test_swirl_fades_to_zero_at_body_region_ends(self):
        swirl = self.contract.SWIRL
        for z in (4.0, 56.0):
            with self.subTest(z=z):
                self.assertTrue(
                    math.isclose(
                        self.contract.swirl_radius(
                            10.5, 0.0, z, 10.5, 4.0, 56.0, swirl
                        ),
                        10.5,
                        abs_tol=1e-9,
                    )
                )

    def test_each_flute_rotates_by_the_full_photo_solved_twist(self):
        swirl = self.contract.SWIRL
        z_min, z_max = 4.0, 56.0
        t = 0.25
        z = z_min + (z_max - z_min) * t
        expected_groove_angle = math.radians(swirl.twist_deg * t)
        divided_angle = expected_groove_angle / swirl.flute_count
        expected_radius = self.contract.swirl_radius(
            10.5, expected_groove_angle, z, 10.5, z_min, z_max, swirl
        )
        divided_radius = self.contract.swirl_radius(
            10.5, divided_angle, z, 10.5, z_min, z_max, swirl
        )
        self.assertLess(expected_radius, divided_radius - 0.1)

    def test_molded_trough_has_broad_shoulders(self):
        swirl = self.contract.SWIRL
        z_min, z_max = 4.0, 56.0
        z = (z_min + z_max) * 0.5
        center_angle = math.radians(swirl.twist_deg * 0.5)
        quarter_phase_angle = center_angle + math.pi / (2 * swirl.flute_count)
        radius = self.contract.swirl_radius(
            10.5, quarter_phase_angle, z, 10.5, z_min, z_max, swirl
        )
        self.assertLessEqual(radius, 10.15)

    def test_inner_or_non_body_vertices_are_never_modulated(self):
        swirl = self.contract.SWIRL
        self.assertEqual(
            self.contract.swirl_radius(8.9, 0.0, 30.0, 10.5, 4.0, 56.0, swirl),
            8.9,
        )
        self.assertEqual(
            self.contract.swirl_radius(10.5, 0.0, 2.0, 10.5, 4.0, 56.0, swirl),
            10.5,
        )

    def test_fingerprint_is_deterministic_and_precision_bounded(self):
        first = self.contract.fingerprint_values([1.0, 2.0, 3.12345649])
        second = self.contract.fingerprint_values([1, 2, 3.1234564])
        different = self.contract.fingerprint_values([1, 2, 3.123458])
        self.assertEqual(first, second)
        self.assertNotEqual(first, different)


if __name__ == "__main__":
    unittest.main()

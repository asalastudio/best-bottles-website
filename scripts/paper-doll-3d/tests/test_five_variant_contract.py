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

    def test_swirl_comparison_has_only_ten_and_twelve_flute_candidates(self):
        candidates = self.contract.SWIRL_CANDIDATES
        self.assertEqual(set(candidates), {10, 12})
        for flute_count, candidate in candidates.items():
            with self.subTest(flute_count=flute_count):
                self.assertEqual(candidate.height_mm, 74.0)
                self.assertEqual(candidate.diameter_mm, 21.0)
                self.assertEqual(candidate.finish, "17-415")
                self.assertEqual(candidate.flute_count, flute_count)
                self.assertEqual(candidate.twist_deg, 90.0)
                self.assertEqual(candidate.depth_mm, 0.75)
                self.assertEqual(candidate.fade_mm, 2.75)
                self.assertEqual(candidate.channel_power, 2.5)

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
        for swirl in self.contract.SWIRL_CANDIDATES.values():
            with self.subTest(flute_count=swirl.flute_count):
                radius = self.contract.swirl_radius(
                    10.5, 0.0, 30.0, 10.5, 2.0, 58.0, swirl
                )
                self.assertGreaterEqual(radius, 10.5 - swirl.depth_mm)
                self.assertLessEqual(radius, 10.5)
                self.assertGreaterEqual(10.5 - swirl.depth_mm - 8.9, 0.8)

    def test_both_candidates_preserve_the_wall_gate(self):
        for swirl in self.contract.SWIRL_CANDIDATES.values():
            with self.subTest(flute_count=swirl.flute_count):
                self.assertGreaterEqual(1.6 - swirl.depth_mm, swirl.minimum_wall_mm)

    def test_swirl_fades_to_zero_at_body_region_ends(self):
        swirl = self.contract.SWIRL_CANDIDATES[10]
        for z in (2.0, 58.0):
            with self.subTest(z=z):
                self.assertTrue(
                    math.isclose(
                        self.contract.swirl_radius(
                            10.5, 0.0, z, 10.5, 2.0, 58.0, swirl
                        ),
                        10.5,
                        abs_tol=1e-9,
                    )
                )

    def test_swirl_has_full_depth_after_short_end_fade(self):
        swirl = self.contract.SWIRL_CANDIDATES[10]
        z_min, z_max, outer = 2.0, 58.0, 10.5
        t = swirl.fade_mm / (z_max - z_min)
        theta = math.radians(swirl.twist_deg * t)
        radius = self.contract.swirl_radius(
            outer, theta, z_min + swirl.fade_mm, outer, z_min, z_max, swirl
        )
        self.assertAlmostEqual(radius, outer - swirl.depth_mm, places=6)

    def test_each_flute_rotates_by_the_full_photo_solved_twist(self):
        swirl = self.contract.SWIRL_CANDIDATES[12]
        z_min, z_max = 2.0, 58.0
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

    def test_molded_channel_is_narrow_with_broad_outer_lands(self):
        swirl = self.contract.SWIRL_CANDIDATES[12]
        z_min, z_max = 2.0, 58.0
        z = (z_min + z_max) * 0.5
        center_angle = math.radians(swirl.twist_deg * 0.5)
        quarter_phase_angle = center_angle + math.pi / (2 * swirl.flute_count)
        center_radius = self.contract.swirl_radius(
            10.5, center_angle, z, 10.5, z_min, z_max, swirl
        )
        shoulder_radius = self.contract.swirl_radius(
            10.5, quarter_phase_angle, z, 10.5, z_min, z_max, swirl
        )
        self.assertAlmostEqual(center_radius, 9.75, places=6)
        self.assertGreater(shoulder_radius, 10.35)

    def test_inner_or_non_body_vertices_are_never_modulated(self):
        swirl = self.contract.SWIRL_CANDIDATES[10]
        self.assertEqual(
            self.contract.swirl_radius(8.9, 0.0, 30.0, 10.5, 2.0, 58.0, swirl),
            8.9,
        )
        self.assertEqual(
            self.contract.swirl_radius(10.5, 0.0, 1.0, 10.5, 2.0, 58.0, swirl),
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

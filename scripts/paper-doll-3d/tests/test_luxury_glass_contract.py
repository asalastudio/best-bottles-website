import math
import sys
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

import luxury_glass_contract as contract


class LuxuryGlassContractTests(unittest.TestCase):
    def test_approved_source_and_geometry_are_immutable(self):
        self.assertEqual(
            contract.SOURCE_SHA256,
            "c436ed8f8c0c363695bf2bcbbdb371a67a4e8c1fd2b6574ac8ebcd6663d22ea0",
        )
        self.assertEqual(
            contract.GEOMETRY.body_sha256,
            "ed64930d7ea4e7301a2687340ea2e3235cbb5f0f4545be0313200e1d1dfba016",
        )
        self.assertEqual(
            contract.GEOMETRY.thread_sha256,
            "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f",
        )
        self.assertEqual(contract.GEOMETRY.diameter_mm, 19.7)
        self.assertEqual(contract.GEOMETRY.height_mm, 72.0)
        self.assertEqual(contract.GEOMETRY.camera_lens_mm, 100.0)
        self.assertEqual(contract.GEOMETRY.camera_sensor_mm, 36.0)
        self.assertEqual(contract.GEOMETRY.camera_location, (0.0, -305.5555, 36.0))
        self.assertEqual(contract.GEOMETRY.camera_rotation_degrees, (90.0, 0.0, 0.0))

    def test_four_glass_presets_stay_in_physical_ranges(self):
        self.assertEqual(set(contract.VARIANTS), {"clear", "amber", "cobalt", "frosted"})
        for preset in contract.VARIANTS.values():
            self.assertEqual(preset.ior, 1.50)
            self.assertEqual(preset.transmission, 1.0)
            self.assertGreaterEqual(preset.surface_roughness, 0.015)
            self.assertLessEqual(preset.surface_roughness, 0.32)
            self.assertEqual(len(preset.absorption_color), 3)
        self.assertEqual(contract.VARIANTS["clear"].absorption_density, 0.0)
        self.assertGreater(contract.VARIANTS["amber"].absorption_density, 0.0)
        self.assertGreater(contract.VARIANTS["cobalt"].absorption_density, 0.0)
        self.assertTrue(0.22 <= contract.VARIANTS["frosted"].surface_roughness <= 0.32)
        self.assertTrue(0.01 <= contract.VARIANTS["frosted"].micro_normal_strength <= 0.03)

    def test_reflection_rig_has_five_parametric_sources_and_two_cards(self):
        self.assertEqual(
            [light.name for light in contract.LIGHTS],
            [
                "BB_LUX_KEY_LEFT",
                "BB_LUX_EDGE_RIGHT",
                "BB_LUX_RIM_REAR",
                "BB_LUX_TOP",
                "BB_LUX_FILL_FRONT",
            ],
        )
        self.assertEqual(len(contract.NEGATIVE_CARDS), 2)
        self.assertEqual(
            {card.name for card in contract.NEGATIVE_CARDS},
            {"BB_LUX_NEG_LEFT", "BB_LUX_NEG_RIGHT"},
        )
        left = contract.LIGHTS[0]
        x, y, z = left.location(contract.GEOMETRY)
        self.assertAlmostEqual(x, left.radius_diameters * 19.7 * math.sin(math.radians(left.angle_degrees)))
        self.assertAlmostEqual(y, -left.radius_diameters * 19.7 * math.cos(math.radians(left.angle_degrees)))
        self.assertAlmostEqual(z, left.z_heights * 72.0)
        self.assertGreater(left.height_heights, 1.2)

    def test_cycles_and_color_contract_protects_glass(self):
        self.assertEqual(contract.RENDER.engine, "CYCLES")
        self.assertEqual(contract.RENDER.samples, 512)
        self.assertTrue(contract.RENDER.adaptive_sampling)
        self.assertEqual(contract.RENDER.noise_threshold, 0.005)
        self.assertEqual(contract.RENDER.max_bounces, 12)
        self.assertEqual(contract.RENDER.transmission_bounces, 12)
        self.assertEqual(contract.RENDER.glossy_bounces, 8)
        self.assertEqual(contract.RENDER.diffuse_bounces, 4)
        self.assertEqual(contract.RENDER.transparent_bounces, 8)
        self.assertEqual(contract.RENDER.view_transform, "AgX")
        self.assertEqual(contract.RENDER.exposure, 0.0)
        self.assertEqual(contract.RENDER.gamma, 1.0)

    def test_qc_plan_centers_non_overflowing_200_percent_crops(self):
        self.assertTrue(contract.COMPARISON_FONT.is_file())
        boxes = contract.crop_boxes(1200, 1320)
        self.assertEqual(boxes["neck"], (408, 73, 792, 449))
        self.assertEqual(boxes["shoulder"], (360, 290, 840, 647))
        self.assertEqual(boxes["base"], (360, 924, 840, 1274))
        for left, top, right, bottom in boxes.values():
            self.assertEqual(left + right, 1200)
            self.assertGreaterEqual(left, 0)
            self.assertGreaterEqual(top, 0)
            self.assertLessEqual(right, 1200)
            self.assertLessEqual(bottom, 1320)
            self.assertGreater(right, left)
            self.assertGreater(bottom, top)

        plan = contract.qc_render_plan(1200, 1320, 512)
        self.assertEqual(set(plan), {"clear", "amber", "cobalt", "frosted"})
        self.assertEqual(
            plan["cobalt"]["neck_raw"],
            "009ml-cobalt-neck-512s-raw.png",
        )
        self.assertEqual(
            plan["amber"]["base_denoised"],
            "009ml-amber-base-512s-denoised.png",
        )
        self.assertEqual(plan["clear"]["crop_scale_percent"], 200)

    def test_cobalt_correction_is_a_separate_high_key_absorption_bracket(self):
        correction = contract.COBALT_CORRECTION
        self.assertEqual(correction.version, "cobalt-correction-v1")
        self.assertEqual(correction.background_hex, "#F3EFE8")
        self.assertEqual(correction.clear_roughness, 0.035)
        self.assertEqual(correction.world_strength, 0.70)
        self.assertFalse(correction.use_negative_fill)
        self.assertFalse(correction.use_rear_rim)
        self.assertEqual(
            contract.CORRECTION_COBALT_DENSITIES,
            {25: 0.50, 50: 1.00, 75: 1.50, 100: 2.00},
        )
        self.assertEqual(
            [light.name for light in contract.CORRECTION_LIGHTS],
            ["BB_CORR_LEFT_AREA", "BB_CORR_RIGHT_AREA", "BB_CORR_TOP_FILL"],
        )
        self.assertEqual(
            {scrim.name for scrim in contract.CORRECTION_SCRIMS},
            {"BB_CORR_LEFT_SCRIM", "BB_CORR_RIGHT_SCRIM"},
        )
        self.assertNotEqual(contract.CORRECTION_WORKING_DIR, contract.WORKING_OUTPUT_DIR)
        self.assertNotEqual(contract.CORRECTION_RENDER_DIR, contract.RENDER_OUTPUT_DIR)
        self.assertEqual(contract.correction_filename("clear"), "01_CLEAR_CALIBRATION.png")
        self.assertEqual(contract.correction_filename(25), "02_COBALT_25.png")
        self.assertEqual(contract.correction_filename(50), "03_COBALT_50.png")
        self.assertEqual(contract.correction_filename(75), "04_COBALT_75.png")
        self.assertEqual(contract.correction_filename(100), "05_COBALT_100.png")
        self.assertEqual(
            contract.correction_crop_filename(75, "base"),
            "04_COBALT_75_BASE_200PCT.png",
        )


if __name__ == "__main__":
    unittest.main()

"""Pure-Python gates for the geometry-safe bone studio recovery."""

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts/paper-doll-3d/bone_studio_recovery_contract.py"


def load_contract():
    spec = importlib.util.spec_from_file_location("bone_studio_recovery_contract", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class BoneStudioRecoveryContractTests(unittest.TestCase):
    def test_recovery_uses_locked_family_not_luxury_source(self):
        recovery = load_contract()
        self.assertEqual(
            set(recovery.LOCKED_SOURCES),
            {"clear", "frosted", "cobalt", "amber", "swirl"},
        )
        self.assertTrue(
            all(
                "master/locked/five-variant-2026-08-11" in str(path)
                for path in recovery.LOCKED_SOURCES.values()
            )
        )
        self.assertNotIn(
            "9ml-luxury-glass-studio",
            " ".join(str(path) for path in recovery.LOCKED_SOURCES.values()),
        )
        self.assertEqual(
            recovery.THREAD_SHA256,
            "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f",
        )
        self.assertEqual(
            recovery.SHARED_BODY_SHA256,
            "e9be8d2ddada1a3a2ca926b25a44ae067d9d5ae2f27f25ab55ed62712592f5b6",
        )
        self.assertEqual(
            recovery.SWIRL_BODY_SHA256,
            "df1c80ac0c034cba09758c2fcda6d649908c8183ba1a8dd354e0da5beb08eff7",
        )

    def test_target_studio_preserves_camera_and_bone_backdrop(self):
        recovery = load_contract()
        target = recovery.TARGET_STUDIO
        self.assertEqual(target.backdrop_hex, "#EFE9DE")
        self.assertEqual(target.camera_lens_mm, 100.0)
        self.assertEqual(target.camera_sensor_width_mm, 36.0)
        self.assertEqual(target.camera_location_mm, (0.0, -305.5555, 36.0))
        self.assertEqual(target.camera_rotation_deg, (90.0, 0.0, 0.0))
        self.assertFalse(target.use_dof)

    def test_protected_state_allows_material_only_changes(self):
        recovery = load_contract()
        before = {
            "Bottle": {"mesh": "locked", "location": (0, 0, 0), "materials": ("old",)},
            "BB_CAM_MASTER": {"location": (0, -305.5555, 36), "lens": 100.0},
        }
        after = {
            "Bottle": {"mesh": "locked", "location": (0, 0, 0), "materials": ("bone",)},
            "BB_CAM_MASTER": {"location": (0, -305.5555, 36), "lens": 100.0},
        }
        recovery.assert_protected_state(before, after)

    def test_protected_state_names_the_drifting_object(self):
        recovery = load_contract()
        before = {"Bottle": {"mesh": "locked", "materials": ("old",)}}
        after = {"Bottle": {"mesh": "drifted", "materials": ("old",)}}
        with self.assertRaisesRegex(AssertionError, "Bottle"):
            recovery.assert_protected_state(before, after)


if __name__ == "__main__":
    unittest.main()

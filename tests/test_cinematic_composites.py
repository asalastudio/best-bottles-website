import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/build_cinematic_composites.py"
SPEC = importlib.util.spec_from_file_location("cinematic_composites", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ClosureRegistrationTests(unittest.TestCase):
    def test_generated_plate_uses_independent_horizontal_and_vertical_scale(self):
        # Original Empire body is 531 px wide and the locked plate body is
        # approximately 434 px. The vertical scale is independently constrained
        # by the 16:9 safe area so the tallest atomizer is not cropped.
        self.assertAlmostEqual(MODULE.SCALE_X, 434 / 531, places=2)
        self.assertAlmostEqual(MODULE.SCALE_Y, 0.39, places=2)
        self.assertGreater(MODULE.SCALE_X, MODULE.SCALE_Y)

    def test_real_closure_attachment_edge_lands_on_plate_shoulder(self):
        overlays, _ = MODULE.prepare_overlays()
        sprayer = overlays[2]
        self.assertIsNotNone(sprayer)
        assert sprayer is not None
        self.assertAlmostEqual(
            sprayer.getbbox()[3], MODULE.TARGET_SHOULDER_Y, delta=1
        )


if __name__ == "__main__":
    unittest.main()

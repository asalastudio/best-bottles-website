import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))


def load_module():
    spec = importlib.util.spec_from_file_location(
        "build_plate_pair_kits", HERE / "build_plate_pair_kits.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PlatePairKitTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()

    def test_mattes_only_edge_connected_studio_white(self):
        rgba = np.full((20, 20, 4), 255, dtype=np.uint8)
        rgba[6:14, 6:14] = (40, 40, 40, 255)
        rgba[8:10, 8:10] = (255, 255, 255, 255)
        matted = self.mod.matte_studio_white(rgba)
        self.assertEqual(int(matted[0, 0, 3]), 0)
        self.assertGreater(int(matted[10, 10, 3]), 200)
        self.assertGreater(int(matted[9, 9, 3]), 200)

    def test_extracts_closure_from_changed_pixels_only(self):
        on = np.full((20, 20, 4), 255, dtype=np.uint8)
        off = on.copy()
        on[2:6, 8:12] = (20, 20, 20, 255)
        off[10:16, 8:12] = (30, 30, 30, 255)
        closure = self.mod.extract_closure(on, off, delta=18)
        self.assertGreater(int(closure[3, 10, 3]), 0)
        self.assertEqual(int(closure[12, 10, 3]), 0)

    def test_sprayer_uses_overcap_slot(self):
        self.assertEqual(self.mod.removable_slot("Fine Mist Sprayer"), "overcap")
        self.assertEqual(self.mod.removable_slot("Plastic Roller Ball"), "cap")

    def test_reassembles_synthetic_pair_inside_parity_gate(self):
        def bottle(extra=None):
            image = Image.new("RGBA", (1000, 1100), "white")
            draw = ImageDraw.Draw(image)
            draw.rounded_rectangle((420, 280, 580, 1040), radius=40, fill=(36, 48, 62))
            if extra:
                extra(draw)
            return image.filter(ImageFilter.SMOOTH)

        on = bottle(lambda draw: draw.rounded_rectangle((430, 80, 570, 300), radius=20, fill=(18, 18, 18)))
        off = bottle(lambda draw: draw.ellipse((445, 240, 555, 300), fill=(90, 90, 90)))
        with tempfile.TemporaryDirectory() as folder:
            row = self.mod.build_kit_from_plates(
                on,
                off,
                website_sku="TEST-SKU",
                grace_sku="GB-TEST",
                family_id="cylinder-9ml-clear-17-415",
                applicator="Plastic Roller Ball",
                plate_sha256="a" * 64,
                plate_url="https://example.test/plates/TEST-SKU/aaaa.front-on-1000x1100.webp",
                out=Path(folder),
            )
        self.assertEqual(row["status"], "candidate")
        self.assertEqual(row["completeness"], "capSplit")
        self.assertEqual([part["slot"] for part in row["parts"]], ["body", "cap"])
        self.assertTrue(row["gates"]["parity"]["ok"])
        self.assertTrue(all(gate["ok"] for gate in row["gates"]["alpha"]))


if __name__ == "__main__":
    unittest.main()

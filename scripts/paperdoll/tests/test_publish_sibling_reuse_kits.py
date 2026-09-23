import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location(
        "publish_sibling_reuse_kits", HERE / "publish_sibling_reuse_kits.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PublishSiblingReuseTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()

    def test_index_row_keeps_hosted_assets_and_drops_review_fields(self):
        row = {
            "websiteSku": "GBCylBlu9RollPnkDot",
            "graceSku": "GB-CYL-BLU-9ML-ROL-PKDT",
            "familyId": "cylinder-9ml-cobalt-blue-17-415",
            "plateSha256": "a" * 64,
            "canvas": {"width": 1000, "height": 1100},
            "anchors": {"axisX": 500, "neckAxisX": 500, "seatY": 280, "baselineY": 1050, "pxPerMm": None},
            "completeness": "full",
            "parts": [{
                "slot": "body",
                "variantKey": None,
                "zOrder": 0,
                "explodeIndex": 0,
                "bounds": {"left": 1, "top": 2, "right": 3, "bottom": 4},
                "assembled": {"x": 0, "y": 0},
                "exploded": {"dx": 0, "dy": 0},
                "derivation": "psd-layer",
                "image": {
                    "url": "https://example/body.webp",
                    "key": "kits/x/" + "b" * 64 + ".body.webp",
                    "sha256": "b" * 64,
                    "bytes": 10,
                    "width": 1000,
                    "height": 1100,
                    "extra": "drop-me",
                },
                "image2x": None,
                "mask": None,
            }],
            "three": None,
            "source": {"library": "published-sibling-reuse", "path": "https://example/plate", "releaseVersion": "a" * 64},
            "builder": {"name": "build_sibling_reuse_kits.py", "version": "1.0.0", "builtAt": 1},
            "publishable": True,
            "donors": {"bodyDonor": "x"},
        }
        payload = self.mod.index_row(row)
        self.assertEqual(payload["sku"], "GBCylBlu9RollPnkDot")
        self.assertEqual(payload["storageProvider"], "vercel-blob")
        self.assertNotIn("publishable", payload)
        self.assertNotIn("donors", payload)
        self.assertEqual(set(payload["parts"][0]["image"]), set(self.mod.ASSET_KEYS))


if __name__ == "__main__":
    unittest.main()

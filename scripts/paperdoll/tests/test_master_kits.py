import sys
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_master_kits import validate_part_map, parity, place_exploded


class MasterKitTests(unittest.TestCase):
    def test_exploded_cap_clears_neck_without_moving_body(self):
        parts = [{"slot": "body", "bounds": {"top": 310, "bottom": 1064}, "explodeIndex": 0,
                  "exploded": {"dx": 0, "dy": 0}},
                 {"slot": "cap", "bounds": {"top": 292, "bottom": 437}, "explodeIndex": 1}]
        place_exploded(parts)
        self.assertEqual(parts[0]["exploded"], {"dx": 0, "dy": 0})
        self.assertEqual(parts[1]["bounds"]["bottom"] + parts[1]["exploded"]["dy"], 278)

    def test_exploded_part_that_would_clip_is_rejected(self):
        parts = [{"slot": "body", "bounds": {"top": 100, "bottom": 1060}, "explodeIndex": 0},
                 {"slot": "cap", "bounds": {"top": 20, "bottom": 200}, "explodeIndex": 1}]
        with self.assertRaises(ValueError):
            place_exploded(parts)

    def setUp(self):
        self.foreground = [{"index": 1}, {"index": 2}, {"index": 3}]
        self.mapping = {"sourceSha256": "current", "reviewedBy": "Reviewer", "evidence": "layer contact sheet",
                        "parts": {"body": [1], "roller": [2], "cap": [3]}}

    def test_explicit_complete_mapping(self):
        self.assertEqual(validate_part_map(self.mapping, self.foreground, "current"), self.mapping["parts"])

    def test_stale_source_is_not_reused(self):
        with self.assertRaises(ValueError):
            validate_part_map(self.mapping, self.foreground, "changed")

    def test_omitted_or_repeated_parts_are_rejected(self):
        for parts in [{"body": [1], "cap": [3]}, {"body": [1, 2], "cap": [2, 3]}]:
            with self.subTest(parts=parts), self.assertRaises(ValueError):
                validate_part_map({**self.mapping, "parts": parts}, self.foreground, "current")

    def test_unreviewed_mapping_cannot_be_used(self):
        with self.assertRaises(ValueError):
            validate_part_map({**self.mapping, "evidence": ""}, self.foreground, "current")

    def test_parity_rejects_wrong_or_empty_reconstruction(self):
        black = Image.new("RGB", (10, 10), "black")
        white = Image.new("RGB", (10, 10), "white")
        self.assertTrue(parity(black, black)["ok"])
        self.assertFalse(parity(black, white)["ok"])
        self.assertFalse(parity(white, white)["ok"])


if __name__ == "__main__":
    unittest.main()

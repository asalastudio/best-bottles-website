import sys
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_master_kits import validate_part_map, parity, place_exploded, render_exploded


class MasterKitTests(unittest.TestCase):
    def test_exploded_cap_clears_neck_without_moving_body(self):
        parts = [{"slot": "body", "bounds": {"top": 310, "bottom": 1064}, "explodeIndex": 0,
                  "exploded": {"dx": 0, "dy": 0}},
                 {"slot": "cap", "bounds": {"top": 292, "bottom": 437}, "explodeIndex": 1}]
        place_exploded(parts)
        self.assertEqual(parts[0]["exploded"], {"dx": 0, "dy": 0})
        self.assertEqual(parts[1]["bounds"]["bottom"] + parts[1]["exploded"]["dy"], 286)

    def test_exploded_spacing_keeps_valid_tall_cap_inside_frame(self):
        parts = [{"slot": "body", "bounds": {"top": 318, "bottom": 1064}, "explodeIndex": 0},
                 {"slot": "cap", "bounds": {"top": 180, "bottom": 470}, "explodeIndex": 1}]
        place_exploded(parts)
        self.assertEqual(parts[1]["bounds"]["top"] + parts[1]["exploded"]["dy"], 8)
        self.assertEqual(parts[1]["bounds"]["bottom"] + parts[1]["exploded"]["dy"], 298)

    def test_tall_cap_that_cannot_fit_above_moves_beside_bottle(self):
        parts = [{"slot": "body", "bounds": {"left": 395, "top": 271, "right": 610, "bottom": 1061}, "explodeIndex": 0},
                 {"slot": "cap", "bounds": {"left": 399, "top": 122, "right": 602, "bottom": 425}, "explodeIndex": 1}]
        place_exploded(parts)
        self.assertEqual(parts[1]["bounds"]["left"] + parts[1]["exploded"]["dx"], 634)
        self.assertEqual(parts[1]["exploded"]["dy"], 0)
        self.assertEqual(parts[1]["bounds"]["bottom"] + parts[1]["exploded"]["dy"], 425)

    def test_wide_exploded_part_stacks_above_for_shared_autofit(self):
        parts = [{"slot": "body", "bounds": {"left": 100, "top": 100, "right": 900, "bottom": 1060}, "explodeIndex": 0},
                 {"slot": "cap", "bounds": {"left": 20, "top": 20, "right": 800, "bottom": 200}, "explodeIndex": 1}]
        place_exploded(parts)
        self.assertEqual(parts[1]["exploded"], {"dx": 0, "dy": -124})

    def test_multiple_exploded_parts_line_up_beside_body_at_source_height(self):
        parts = [{"slot": "body", "bounds": {"left": 350, "top": 250, "right": 650, "bottom": 1060}, "explodeIndex": 0},
                 {"slot": "sprayer", "bounds": {"left": 430, "top": 80, "right": 570, "bottom": 500}, "explodeIndex": 1},
                 {"slot": "overcap", "bounds": {"left": 420, "top": 100, "right": 580, "bottom": 430}, "explodeIndex": 2}]
        place_exploded(parts)
        self.assertEqual(parts[1]["exploded"], {"dx": 244, "dy": 0})
        self.assertEqual(parts[2]["exploded"], {"dx": 418, "dy": 0})

    def test_render_exploded_applies_horizontal_and_vertical_offsets(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from PIL import Image

        with TemporaryDirectory() as td:
            root=Path(td)
            (root/'parts').mkdir()
            layer=Image.new('RGBA',(1000,1100),(0,0,0,0))
            layer.putpixel((10,20),(255,0,0,255))
            layer.save(root/'parts/part.png')
            parts=[{'image':'parts/part.png','bounds':{'left':10,'top':20,'right':11,'bottom':21},'exploded':{'dx':30,'dy':40}}]
            rendered=render_exploded(parts,root)
            self.assertEqual(rendered.getpixel((500,550)),(255,0,0,255))

    def test_render_exploded_autofits_negative_vertical_union(self):
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as td:
            root=Path(td)
            (root/'parts').mkdir()
            layer=Image.new('RGBA',(1000,1100),(0,0,0,0))
            for y in range(100,1000):
                layer.putpixel((500,y),(255,0,0,255))
            layer.save(root/'parts/part.png')
            parts=[{'image':'parts/part.png','bounds':{'left':500,'top':100,'right':501,'bottom':1000},'exploded':{'dx':0,'dy':-600}}]
            rendered=render_exploded(parts,root)
            self.assertEqual(rendered.size,(1000,1100))
            self.assertIsNotNone(rendered.getbbox())

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

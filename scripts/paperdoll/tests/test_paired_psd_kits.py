import importlib.util
import unittest


class PairedPsdKitTests(unittest.TestCase):
    def load_module(self):
        spec = importlib.util.find_spec("scripts.paperdoll.build_paired_psd_kits")
        if spec is None:
            self.skipTest("paired PSD kit builder has not been implemented")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_builder_module_exists(self):
        spec = importlib.util.find_spec("scripts.paperdoll.build_paired_psd_kits")
        self.assertIsNotNone(spec, "paired PSD kit builder has not been implemented")

    def test_aligns_off_source_parts_to_the_on_source_body(self):
        module = self.load_module()
        delta = module.shared_body_translation(
            on_bounds=(251, 367, 1293, 1551),
            off_bounds=(35, 367, 1077, 1551),
        )
        self.assertEqual(delta, (216, 0))

    def test_rejects_a_stale_published_plate(self):
        with self.assertRaisesRegex(ValueError, "published plate hash mismatch"):
            self.load_module().require_current_plate_hash(
                manifest_sha="old",
                published_sha="new",
            )

    def test_accepts_only_reviewed_physical_recipe_slots(self):
        recipe = {
            "reviewedBy": "Jordan and Codex",
            "evidence": "Layer contact sheet and paired PSD body identity",
            "parts": [
                {"slot": "body", "layers": [{"source": "on", "index": 1}]},
                {"slot": "sprayer", "layers": [
                    {"source": "on", "index": 2},
                    {"source": "off", "index": 3, "alignToOnBody": True},
                ]},
                {"slot": "overcap", "layers": [{"source": "on", "index": 3}]},
            ],
        }
        slots = self.load_module().validate_recipe(recipe)
        self.assertEqual(slots, ["body", "sprayer", "overcap"])

    def test_rejects_an_unreviewed_or_bodyless_recipe(self):
        with self.assertRaisesRegex(ValueError, "reviewedBy and evidence"):
            self.load_module().validate_recipe({"parts": [{"slot": "body", "layers": []}]})
        with self.assertRaisesRegex(ValueError, "body part"):
            self.load_module().validate_recipe({
                "reviewedBy": "reviewer",
                "evidence": "visual inspection",
                "parts": [{"slot": "cap", "layers": [{"source": "on", "index": 1}]}],
            })

    def test_uses_an_explicit_reviewed_off_source_when_no_cap_off_plate_exists(self):
        path, sha = self.load_module().resolve_off_source(
            recipe={"offSourcePath": "master/off.psd", "offSourceSha256": "abc"},
            manifest_row={"plateCapOff": None},
        )
        self.assertEqual((path, sha), ("master/off.psd", "abc"))

    def test_reviewed_retouch_difference_can_share_exact_body_geometry(self):
        delta = self.load_module().validate_body_pair(
            on_layer={"bounds": [251, 367, 1293, 1551], "pixelHash": "on"},
            off_layer={"bounds": [35, 367, 1077, 1551], "pixelHash": "off"},
            allow_retouch_difference=True,
        )
        self.assertEqual(delta, (216, 0))

    def test_unreviewed_body_retouch_difference_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "paired body pixels do not match"):
            self.load_module().validate_body_pair(
                on_layer={"bounds": [251, 367, 1293, 1551], "pixelHash": "on"},
                off_layer={"bounds": [35, 367, 1077, 1551], "pixelHash": "off"},
                allow_retouch_difference=False,
            )

    def test_exploded_stack_can_extend_past_assembled_canvas_for_ui_autofit(self):
        parts = [
            {"slot": "body", "bounds": {"left": 150, "top": 300, "right": 850, "bottom": 1050}},
            {"slot": "sprayer", "bounds": {"left": 420, "top": 40, "right": 580, "bottom": 430}},
            {"slot": "overcap", "bounds": {"left": 410, "top": 20, "right": 590, "bottom": 420}},
        ]
        offsets = self.load_module().exploded_offsets(parts)
        self.assertEqual(offsets["body"], 0)
        self.assertLess(offsets["sprayer"], 0)
        self.assertLess(offsets["overcap"], offsets["sprayer"])

    def test_exploded_frame_fits_the_complete_union_with_margin(self):
        parts = [
            {"bounds": {"left": 150, "top": 300, "right": 850, "bottom": 1050}, "exploded": {"dx": 0, "dy": 0}},
            {"bounds": {"left": 420, "top": 40, "right": 580, "bottom": 430}, "exploded": {"dx": 0, "dy": -154}},
            {"bounds": {"left": 410, "top": 20, "right": 590, "bottom": 420}, "exploded": {"dx": 0, "dy": -558}},
        ]
        frame = self.load_module().exploded_frame(parts)
        self.assertLess(frame["scale"], 1)
        self.assertGreaterEqual(frame["left"], 24)
        self.assertGreaterEqual(frame["top"], 24)
        self.assertLessEqual(frame["right"], 976)
        self.assertLessEqual(frame["bottom"], 1076)

    def test_hidden_psd_layers_are_ignored_but_visible_non_pixel_layers_are_rejected(self):
        module = self.load_module()

        class Layer:
            def __init__(self, *, group=False, kind="pixel", visible=True):
                self._group = group
                self.kind = kind
                self._visible = visible

            def is_group(self):
                return self._group

            def is_visible(self):
                return self._visible

        self.assertFalse(module.is_rendered_source_layer(Layer(visible=False)))
        self.assertFalse(module.is_rendered_source_layer(Layer(group=True)))
        self.assertTrue(module.is_rendered_source_layer(Layer()))
        with self.assertRaisesRegex(ValueError, "visible non-pixel layer"):
            module.is_rendered_source_layer(Layer(kind="shape"))


if __name__ == "__main__":
    unittest.main()

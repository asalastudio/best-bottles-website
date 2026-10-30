"""Run with the media venv: python -m unittest discover -s tests -p test_component_photo_adjustments.py"""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import Mock

from psd_tools.api.layers import AdjustmentLayer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("component_cut", ROOT / "scripts/register/components/cut_components.py")
cut = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut)


class PhotoAdjustmentTests(unittest.TestCase):
    def adjustment(self, kind="blackandwhite", visible=True, opacity=255):
        layer = Mock(spec=AdjustmentLayer)
        layer.kind = kind
        layer.name = kind
        layer.opacity = opacity
        layer.is_visible.return_value = visible
        return layer

    def psd(self, layers):
        psd = Mock()
        psd.descendants.return_value = iter(layers)
        return psd

    def test_silver_finish_adjustments_cannot_be_silently_discarded(self):
        psd = self.psd([self.adjustment(), self.adjustment("brightnesscontrast")])
        with self.assertRaisesRegex(ValueError, "blackandwhite.*brightnesscontrast"):
            cut.photo_canvas_of(psd, [])

    def test_hidden_adjustment_does_not_hold_an_unadjusted_cut(self):
        from unittest.mock import patch
        psd = self.psd([self.adjustment(visible=False), self.adjustment(opacity=0)])
        with patch.object(cut, "canvas_of", return_value="unaltered pixels") as compositor:
            self.assertEqual(cut.photo_canvas_of(psd, []), "unaltered pixels")
            compositor.assert_called_once()

    def test_unadjusted_gold_reference_keeps_existing_composition(self):
        from unittest.mock import patch
        with patch.object(cut, "canvas_of", return_value="gold pixels"):
            self.assertEqual(cut.photo_canvas_of(self.psd([]), []), "gold pixels")


if __name__ == "__main__":
    unittest.main()

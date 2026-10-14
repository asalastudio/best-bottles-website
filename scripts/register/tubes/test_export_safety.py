import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from export_safety import TubeExportBatch

ROOT = Path(__file__).resolve().parents[3]


class TubeExportSafetyTests(unittest.TestCase):
    def test_confirmed_broken_assets_stop_batch_before_any_write(self):
        for pattern in ('empire-50ml-18-415-clear-lotion-exploded.*.png',
                        'square-15ml-13-415-clear-spray-exploded.*.png'):
            with self.subTest(pattern=pattern), tempfile.TemporaryDirectory() as directory:
                public = Path(directory)
                original = public / 'previous-source.png'
                original.write_bytes(b'preserved')
                batch = TubeExportBatch(public, public)
                good = np.full((100, 4, 4), 255, dtype=np.uint8)
                batch.prepare(good, [0, 0], 'valid', exploded=True)
                source = next((ROOT / 'public/images/register/tubes').glob(pattern))
                with self.assertRaisesRegex(ValueError, 'continuity'):
                    batch.prepare(np.asarray(Image.open(source).convert('RGBA')), [0, 0], 'broken', exploded=True)
                with self.assertRaisesRegex(ValueError, 'failed'):
                    batch.write()
                self.assertEqual(list(public.iterdir()), [original])
                self.assertEqual(original.read_bytes(), b'preserved')

    def test_intact_source_exports_without_changing_pixels_or_deleting_old_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            public = Path(directory)
            old = public / 'old.png'
            old.write_bytes(b'preserve me')
            source = next((ROOT / 'public/local-media/source-tubes').glob('square15-spray.*.png'))
            pixels = np.asarray(Image.open(source).convert('RGBA'))
            batch = TubeExportBatch(public, public)
            entry = batch.prepare(pixels, [52, 71], 'source', exploded=True)
            self.assertEqual(list(public.iterdir()), [old])
            batch.write()
            result = np.asarray(Image.open(public / entry['url'].lstrip('/')))
            np.testing.assert_array_equal(result, pixels)
            self.assertEqual((entry['x'], entry['y']), (52, 71))
            self.assertEqual(old.read_bytes(), b'preserve me')

    def test_seated_refraction_is_not_rejected_as_a_broken_exposed_tube(self):
        with tempfile.TemporaryDirectory() as directory:
            pixels = np.full((100, 4, 4), 255, dtype=np.uint8)
            pixels[60:80, :, 3] = 0
            batch = TubeExportBatch(Path(directory), Path(directory))
            batch.prepare(pixels, [0, 0], 'seated', exploded=False)
            batch.write()

    def test_empty_exploded_layer_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            batch = TubeExportBatch(Path(directory), Path(directory))
            with self.assertRaisesRegex(ValueError, 'empty'):
                batch.prepare(np.zeros((100, 4, 4)), [0, 0], 'empty', exploded=True)


if __name__ == '__main__':
    unittest.main()

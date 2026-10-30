"""Local export guard. Pixel continuity is a screen, never visual acceptance."""
import hashlib
import io
from pathlib import Path

import numpy as np
from PIL import Image


def validate_exploded_tube(pixels, slug):
    # Match the saved audit: alpha > 6%, central/lower shaft, excluding cut tip.
    # This catches the confirmed Square 15 and Empire 50 gaps without treating
    # seated glass refraction as a defect. It does not validate shape or fitment.
    ink = pixels[:, :, 3].max(axis=1) > 255 * .06
    occupied = np.flatnonzero(ink)
    if not len(occupied):
        raise ValueError(f'{slug}: empty exploded tube')
    start, end = int(occupied[0]), int(occupied[-1])
    low, high = start + int((end - start) * .4), start + int((end - start) * .95)
    longest = run = 0
    for visible in ink[low:high]:
        run = 0 if visible else run + 1
        longest = max(longest, run)
    if longest > 3:
        raise ValueError(f'{slug}: exploded tube continuity failed ({longest} rows); review source before export')


class TubeExportBatch:
    """Prepare all layers before any writes; preserve previous content-addressed files."""
    def __init__(self, directory: Path, public_root: Path):
        self.directory, self.public_root = directory, public_root
        self.pending = []
        self.failed = False

    def prepare(self, pixels, bbox, slug, *, exploded=False):
        pixels = pixels.clip(0, 255).astype(np.uint8)
        try:
            if exploded:
                validate_exploded_tube(pixels, slug)
            png = Image.fromarray(pixels)
            buffer = io.BytesIO()
            png.save(buffer, format='PNG', optimize=True)
            data = buffer.getvalue()
            target = self.directory / f'{slug}.{hashlib.sha256(data).hexdigest()[:12]}.png'
            self.pending.append((target, data))
            return {'url': '/' + str(target.relative_to(self.public_root)),
                    'width': png.width, 'height': png.height, 'x': bbox[0], 'y': bbox[1]}
        except Exception:
            self.failed = True
            raise

    def write(self):
        if self.failed:
            raise ValueError('Export batch failed validation; no files written')
        # Check every collision before writing. Existing source assets are never removed.
        for target, data in self.pending:
            if target.exists() and target.read_bytes() != data:
                raise ValueError(f'Existing asset differs: {target.name}')
        self.directory.mkdir(parents=True, exist_ok=True)
        for target, data in self.pending:
            if not target.exists():
                with target.open('xb') as handle:
                    handle.write(data)

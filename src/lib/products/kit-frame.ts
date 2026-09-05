type PartBounds = { bounds: { left: number; top: number; right: number; bottom: number }; exploded: { dx: number; dy: number } };

/** Fit the complete exploded photograph into its canvas, including hanging bulbs. */
export function explodedKitFrame(parts: readonly PartBounds[], width = 1000, height = 1100) {
    if (!parts.length) return { scale: 1, x: 0, y: 0 };
    const left = Math.min(...parts.map(p => p.bounds.left + p.exploded.dx));
    const right = Math.max(...parts.map(p => p.bounds.right + p.exploded.dx));
    const top = Math.min(...parts.map(p => p.bounds.top + p.exploded.dy));
    const bottom = Math.max(...parts.map(p => p.bounds.bottom + p.exploded.dy));
    const scale = Math.min(1, (width - 48) / Math.max(1, right - left), (height - 48) / Math.max(1, bottom - top));
    return { scale, x: ((width - (right - left) * scale) / 2 - left * scale) / width * 100,
        y: ((height - (bottom - top) * scale) / 2 - top * scale) / height * 100 };
}

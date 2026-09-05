type PartBounds = { bounds: { left: number; top: number; right: number; bottom: number }; exploded: { dx: number; dy: number } };

/** Legacy kits sorted by photographed bounds can put an overcap below its pump.
 * Reorder only that closure stack, preserving its envelope and all other parts.
 */
export function orderExplodedOvercap<T extends PartBounds & { slot: string }>(parts: readonly T[]): T[] {
    const cap = parts.find(p => p.slot === "overcap");
    const mechanisms = parts.filter(p => p.slot === "sprayer" || p.slot === "pump");
    if (!cap || !mechanisms.length || mechanisms.every(p =>
        cap.bounds.bottom + cap.exploded.dy <= p.bounds.top + p.exploded.dy)) return [...parts];

    const stack = [cap, ...mechanisms];
    const top = Math.min(...stack.map(p => p.bounds.top + p.exploded.dy));
    let bottom = Math.max(...stack.map(p => p.bounds.bottom + p.exploded.dy));
    const height = stack.reduce((sum, p) => sum + p.bounds.bottom - p.bounds.top, 0);
    const gap = Math.max(24, (bottom - top - height) / mechanisms.length);
    const offsets = new Map<T, number>();
    // Work upward from the mechanism nearest the bottle; the overcap is last.
    for (const part of [...mechanisms].sort((a, b) =>
        (b.bounds.bottom + b.exploded.dy) - (a.bounds.bottom + a.exploded.dy)).concat(cap)) {
        const dy = bottom - part.bounds.bottom;
        offsets.set(part, dy);
        bottom = part.bounds.top + dy - gap;
    }
    return parts.map(part => offsets.has(part)
        ? { ...part, exploded: { ...part.exploded, dy: offsets.get(part)! } }
        : part);
}

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

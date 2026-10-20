/** Glass cavity in the kit canvas. The body supplies the surface reflections;
 * multiply transmits those reflections through a seated tube's white pixels.
 * The exposed mechanism is never masked or faded by this treatment.
 */
export type ThroughGlass = { clip: Array<[number, number]>; opacity: number };
export function throughGlassAppearance(part: {
    throughGlass?: ThroughGlass; box?: { x: number; y: number; width: number; height: number } | null;
    image: { width: number; height: number };
}, view: 'sidecar' | 'capon' | 'exploded') {
    if (view === 'exploded' || !part.throughGlass || !part.box) return null;
    const { box, image, throughGlass } = part;
    const percent = throughGlass.clip.map(([x, y]) => [(x-box.x)/box.width*100, (y-box.y)/box.height*100]);
    return {
        opacity: throughGlass.opacity, blendMode: 'multiply' as const,
        clipPercent: percent,
        clipPath: `polygon(${percent.map(([x,y]) => `${x}% ${y}%`).join(',')})`,
        clipPoints: percent.map(([x,y]) => `${x/100*image.width},${y/100*image.height}`).join(' '),
    };
}

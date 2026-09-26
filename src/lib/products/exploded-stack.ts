/**
 * EXPLODED view: every part lifts straight up and stacks above the glass in
 * assembly order, one gap apart. A physical part is one unit: a sprayer or
 * pump keeps its head, collar and dip tube together (Jordan 2026-09-25: "the
 * fitment, fine mist sprayer and thread need to be connected"); a cap, an
 * overcap and a roller insert are units of their own. Units order by their
 * lowest explodeIndex, the one nearest the neck first.
 *
 * Shared by the register kits (src/lib/register/stage-kit.ts) and the
 * published kits (src/lib/products/pdp-redesign/stage.ts), so both stages
 * explode the same way.
 */
export type ExplodablePart = {
    slot: string;
    explodeIndex: number;
    bounds: { left: number; top: number; right: number; bottom: number };
    /** The register component the layer came from; published kit layers have none. */
    componentId?: string | null;
};

export const EXPLODE_GAP_PX = 24;

const OWN_UNIT_SLOTS: ReadonlySet<string> = new Set(["cap", "overcap", "roller", "tassel", "bulb", "reducer", "pipette"]);

/** Which unit a part belongs to: its own for closures and inserts, the mechanism for a head, collar or tube. */
export function explodeUnitKey(part: ExplodablePart): string {
    const owner = part.componentId ?? "";
    return OWN_UNIT_SLOTS.has(part.slot) ? `${owner}|${part.slot}` : `${owner}|mechanism`;
}

/**
 * The EXPLODED offset (dy, dx = 0) for every part, by index. The body stays;
 * units stack above its top with EXPLODE_GAP_PX between them.
 */
export function stackedExplodeOffsets(parts: readonly ExplodablePart[], gap = EXPLODE_GAP_PX): Map<number, { dx: number; dy: number }> {
    const body = parts.find((part) => part.slot === "body");
    const glassTop = body ? body.bounds.top : Math.min(...parts.map((part) => part.bounds.top));
    const units = new Map<string, { explodeIndex: number; top: number; bottom: number; indexes: number[] }>();
    parts.forEach((part, index) => {
        if (part.slot === "body") return;
        const key = explodeUnitKey(part);
        const unit = units.get(key);
        if (unit) {
            unit.explodeIndex = Math.min(unit.explodeIndex, part.explodeIndex);
            unit.top = Math.min(unit.top, part.bounds.top);
            unit.bottom = Math.max(unit.bottom, part.bounds.bottom);
            unit.indexes.push(index);
        } else {
            units.set(key, { explodeIndex: part.explodeIndex, top: part.bounds.top, bottom: part.bounds.bottom, indexes: [index] });
        }
    });
    const offsets = new Map<number, { dx: number; dy: number }>();
    parts.forEach((part, index) => { if (part.slot === "body") offsets.set(index, { dx: 0, dy: 0 }); });
    let ceiling = glassTop - gap;
    for (const unit of [...units.values()].sort((a, b) => a.explodeIndex - b.explodeIndex || b.bottom - a.bottom)) {
        const dy = Math.round((ceiling - unit.bottom) * 100) / 100;
        for (const index of unit.indexes) offsets.set(index, { dx: 0, dy });
        ceiling = unit.top + dy - gap;
    }
    return offsets;
}

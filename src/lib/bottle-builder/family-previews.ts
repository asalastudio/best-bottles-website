import type { BuilderBody } from "./model";
import type { BuilderFamily } from "./entry";
import { NAV_FAMILIES } from "../navFamilies";
import bodyHeightMedia from "./body-heights.generated.json";

/** A family on the Build Your Bottle family screen: its name, the sizes the builder
 * offers it in, and how many bottles that makes. The tile draws the sizes as outlines. */
export type BuilderFamilyPreview = BuilderFamily & {
    /** Every capacity the builder offers the family in, in ml, smallest first, once each. */
    sizes: number[];
    /** Bottle options: every size in every glass colour it is made in (Boston Round: 3 sizes × 3 glasses = 9). */
    options: number;
};

/** One option per bottle per glass colour the builder can build it in. */
export function familyOptionCount(bodies: BuilderBody[]): number {
    return bodies.reduce((total, body) => total + new Set(body.configurations.map(c => c.color)).size, 0);
}

const bodyHeights = (bodyHeightMedia as { heights: Record<string, { bodyHeightMm: number }> }).heights;

/** The menus' family order first (the shapes customers already know), then the rest by name. */
export function familyScreenOrder<T extends { family: string }>(families: T[]): T[] {
    const rank = (family: string) => {
        const index = NAV_FAMILIES.indexOf(family);
        return index === -1 ? NAV_FAMILIES.length : index;
    };
    return [...families].sort((a, b) => rank(a.family) - rank(b.family) || a.family.localeCompare(b.family));
}

/** Every capacity the family comes in, smallest first, once each. */
export function familySizes(bodies: Pick<BuilderBody, "capacityMl">[]): number[] {
    return [...new Set(bodies.map(b => b.capacityMl).filter(ml => ml > 0))].sort((a, b) => a - b);
}

/** Up to `max` sizes that show the family's range: the smallest, the largest and one from the middle. */
export function pickFamilyTileSizes(sizes: number[], max = 3): number[] {
    if (sizes.length <= max) return sizes;
    if (max === 1) return [sizes[sizes.length - 1]];
    return [...new Set(Array.from({ length: max }, (_, i) => sizes[Math.round(i * (sizes.length - 1) / (max - 1))]))];
}

/** The tile's size line: "15 to 60 ml", "78 and 128 ml", or one size, "55 ml". */
export function familySizeRange(sizes: number[]): string {
    if (!sizes.length) return "";
    const ml = (n: number) => String(Math.round(n * 10) / 10);
    const [first, last] = [sizes[0], sizes[sizes.length - 1]];
    if (sizes.length === 1) return `${ml(first)} ml`;
    return `${ml(first)} ${sizes.length === 2 ? "and" : "to"} ${ml(last)} ml`;
}

/** Measured glass heights per family, by capacity. */
const measuredByFamily = new Map<string, { capacityMl: number; mm: number }[]>();
for (const [key, { bodyHeightMm }] of Object.entries(bodyHeights)) {
    const [family, capacity] = key.split("|");
    measuredByFamily.set(family, [...(measuredByFamily.get(family) ?? []), { capacityMl: Number(capacity), mm: bodyHeightMm }]);
}

/** A size's measured glass height: its own entry, or the family's entry for a capacity within 15% of it
 * (the audit rounds, so a 3.3 ml Cylinder is its 3 ml row). */
function measuredHeight({ family, capacityMl }: Pick<BuilderBody, "family" | "capacityMl">) {
    const exact = bodyHeights[`${family}|${capacityMl}`]?.bodyHeightMm;
    if (exact) return exact;
    const near = (measuredByFamily.get(family) ?? [])
        .filter(m => Math.abs(m.capacityMl - capacityMl) <= .15 * capacityMl)
        .sort((a, b) => Math.abs(a.capacityMl - capacityMl) - Math.abs(b.capacityMl - capacityMl))[0];
    return near?.mm ?? null;
}

/** Each bottle's height relative to the tallest in its group, from the measured glass heights; floored so
 * the smallest stays legible. If any size in the group is unmeasured the whole group steps up by capacity
 * instead, so a measured and an estimated height are never mixed into the wrong order. */
export function familyPreviewScale(body: Pick<BuilderBody, "family" | "capacityMl">, group: Pick<BuilderBody, "family" | "capacityMl">[]) {
    const heights = group.map(measuredHeight);
    const mine = measuredHeight(body);
    if (mine && heights.every(Boolean)) return Math.max(.5, mine / Math.max(...(heights as number[])));
    const largest = Math.max(...group.map(b => b.capacityMl));
    return largest > 0 ? Math.max(.5, Math.min(1, .55 + .45 * body.capacityMl / largest)) : 1;
}

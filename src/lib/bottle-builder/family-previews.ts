import { clearBodyPreview, type BuilderBody } from "./model";
import type { BuilderFamily } from "./entry";
import { NAV_FAMILIES } from "../navFamilies";
import bodyHeightMedia from "./body-heights.generated.json";

/** A family on the Build Your Bottle family screen: its name, how many bottles
 * the builder offers, and a few of its real bodies drawn as a small group. */
export type BuilderFamilyPreview = BuilderFamily & {
    bodies: BuilderBody[];
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

/** Only bodies the chooser can actually draw: a registered bare-glass layer or a reviewed body image. */
function drawable(body: BuilderBody) {
    const preview = clearBodyPreview(body);
    return Boolean(preview && (preview.previewKit ?? preview.kit ?? preview.chooserKit ?? preview.bodyImage));
}

/**
 * Up to `max` bodies that show the family's range: the smallest, the largest and
 * one from the middle, one per capacity. Each keeps only the bare clear-glass
 * configuration the chooser draws, so the family screen stays light.
 */
export function pickFamilyPreviewBodies(bodies: BuilderBody[], max = 3): BuilderBody[] {
    const byCapacity = new Map<number, BuilderBody>();
    for (const body of [...bodies].filter(drawable).sort((a, b) => a.capacityMl - b.capacityMl || a.id.localeCompare(b.id))) {
        if (!byCapacity.has(body.capacityMl)) byCapacity.set(body.capacityMl, body);
    }
    const ranged = [...byCapacity.values()];
    const picked = ranged.length <= max ? ranged
        : max === 1 ? [ranged[ranged.length - 1]]
        : Array.from({ length: max }, (_, i) => ranged[Math.round(i * (ranged.length - 1) / (max - 1))]);
    return picked.map(body => ({ ...body, configurations: [clearBodyPreview(body)] }));
}

/** Each bottle's height relative to the tallest in its group, from the measured
 * glass heights the chooser already uses; floored so the smallest stays legible. */
export function familyPreviewScale(body: Pick<BuilderBody, "family" | "capacityMl">, group: Pick<BuilderBody, "family" | "capacityMl">[]) {
    const height = (b: Pick<BuilderBody, "family" | "capacityMl">) => bodyHeights[`${b.family}|${b.capacityMl}`]?.bodyHeightMm ?? null;
    const mine = height(body);
    const tallest = Math.max(0, ...group.map(b => height(b) ?? 0));
    if (mine && tallest) return Math.max(.5, mine / tallest);
    // No measurement: order by capacity instead, so the group still steps up in size.
    const largest = Math.max(...group.map(b => b.capacityMl));
    return largest > 0 ? Math.max(.5, Math.min(1, .55 + .45 * body.capacityMl / largest)) : 1;
}

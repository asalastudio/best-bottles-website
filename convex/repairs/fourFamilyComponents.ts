import type { Doc } from "../_generated/dataModel";
import approved from "./fourFamilyComponents.json";

export const FOUR_FAMILY_COMPONENT_REPAIR = approved;
type Kit = Pick<Doc<"productKits">, "canvas" | "familyId" | "plateSha256" | "anchors" | "parts" | "completeness">;

/** Convex object key order is not part of the data contract. */
export function sameData(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameData(v, b[i]));
    }
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length
        && Object.keys(left).every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]));
}

export function kitMetadata(kit: Pick<Kit, "parts" | "anchors">) {
    return {
        anchors: kit.anchors,
        parts: kit.parts.map(p => ({
            slot: p.slot, variantKey: p.variantKey, zOrder: p.zOrder, explodeIndex: p.explodeIndex,
            bounds: p.bounds, assembled: p.assembled, exploded: p.exploded, sha256: p.image.sha256,
        })),
    };
}

/** Repairs reviewed roles/anchors only. Source images and assembled transforms never change. */
export function planCircleKitRepair(sku: string, kit: Kit, currentPlateSha256: string) {
    const recipe = approved.kitRoles.find(r => r.sku === sku);
    if (!recipe) throw new Error(`SKU outside reviewed kit scope: ${sku}`);
    if (kit.plateSha256 !== recipe.plateSha256 || currentPlateSha256 !== recipe.plateSha256
        || kit.familyId !== recipe.familyId || kit.completeness !== "full" || !sameData(kit.canvas, recipe.canvas)) {
        throw new Error(`Kit source changed: ${sku}`);
    }
    const current = kitMetadata(kit);
    if (sameData(current, recipe.after)) return null;
    if (!sameData(current, recipe.before)) throw new Error(`Kit metadata changed since review: ${sku}`);
    const parts = kit.parts.map((part, index) => {
        const next = recipe.after.parts[index];
        return { ...part, slot: next.slot as typeof part.slot, explodeIndex: next.explodeIndex, exploded: next.exploded };
    });
    return { anchors: recipe.after.anchors, parts };
}

export function planTasselMembership(product: Doc<"products">, currentSlug: string) {
    const recipe = approved.membership.find(r => r.sku === product.websiteSku);
    if (!recipe) throw new Error(`SKU outside reviewed catalog scope: ${product.websiteSku}`);
    for (const [key, expected] of Object.entries(recipe.identity)) {
        if (product[key as keyof typeof product] !== expected) throw new Error(`Product identity changed: ${recipe.sku} ${key}`);
    }
    if (currentSlug === recipe.proposedGroup && product.applicator === recipe.proposedApplicator) return null;
    if (currentSlug !== recipe.fromGroup || product.applicator !== recipe.fromApplicator) {
        throw new Error(`Product membership changed since review: ${recipe.sku}`);
    }
    return { groupSlug: recipe.proposedGroup, applicator: "Vintage Bulb Sprayer with Tassel" as const };
}

export function assertTasselGroup(group: Doc<"productGroups">, identity: typeof approved.membership[number]["identity"]) {
    for (const field of ["family", "capacityMl", "color", "neckThreadSize"] as const) {
        if (group[field] !== identity[field]) throw new Error(`Group identity changed: ${group.slug} ${field}`);
    }
    if (group.category !== "Glass Bottle") throw new Error(`Not a glass bottle group: ${group.slug}`);
}

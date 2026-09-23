import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { normalizeComponentsByType, type NormalizedComponent } from "./componentUtils";
import { reviewedCatalogLink } from "./catalogComponentEvidence";
export { reviewedCatalogLink } from "./catalogComponentEvidence";

type Bottle = Pick<Doc<"products">, "family" | "capacityMl" | "color" | "neckThreadSize" | "category" | "shape" | "websiteSku" | "components" | "graceSku" | "applicator" | "capColor">;
const text = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/** A component list belongs to the physical bottle, not one finish SKU.
 * Cylinder imports added complete assemblies without copying that list. Reuse
 * recorded relationships only from the same glass body; matching threads alone
 * is never sufficient. Applicator occupancy and fitment rules still run after
 * this source reconciliation in every consumer.
 */
function cylinderBodyKey(bottle: Bottle): string | null {
    if (text(bottle.family) !== "cylinder" || text(bottle.category) !== "glass bottle"
        || !bottle.capacityMl || bottle.capacityMl <= 0 || !text(bottle.color)
        || !text(bottle.neckThreadSize) || !bottle.websiteSku || /__RETIRED__/i.test(bottle.websiteSku)) return null;
    const shape = text(bottle.shape);
    // Distinct or unresolved mould identities cannot donate compatibility.
    if (shape && shape !== "cylinder" && shape !== "cylindrical") return null;
    return JSON.stringify([bottle.capacityMl, text(bottle.color), text(bottle.neckThreadSize)]);
}

export function catalogComponentPool(bottle: Bottle, siblings: readonly Bottle[]) {
    const grouped = normalizeComponentsByType(bottle.components);
    const key = cylinderBodyKey(bottle);
    const sources: string[] = [];
    if (!key) return { grouped, sources };
    for (const sibling of siblings) {
        if (sibling.websiteSku === bottle.websiteSku || cylinderBodyKey(sibling) !== key) continue;
        let contributed = false;
        for (const [kind, parts] of Object.entries(normalizeComponentsByType(sibling.components))) {
            const own = grouped[kind] ?? [];
            const known = new Set(own.map(part => part.graceSku));
            const additions: NormalizedComponent[] = [];
            for (const part of parts) {
                if (!part.graceSku || known.has(part.graceSku)) continue;
                const thread = part.graceSku.match(/\d{2}-\d{3}/)?.[0];
                if (thread && thread !== text(bottle.neckThreadSize)) continue;
                known.add(part.graceSku);
                additions.push(part);
            }
            if (additions.length) { grouped[kind] = [...own, ...additions]; contributed = true; }
        }
        if (contributed) sources.push(sibling.websiteSku!);
    }
    return { grouped, sources };
}

/** Exact source evidence supplements a missing component relationship. It does not
 * make a loose component sellable or change a complete assembly's inventory. */
export function addReviewedCatalogComponent(bottle: Bottle, pool: ReturnType<typeof catalogComponentPool>, part: Doc<"products"> | null) {
    const link = reviewedCatalogLink(bottle);
    if (!link || !part || part.graceSku !== link.componentGraceSku || part.category !== "Component"
        || part.neckThreadSize !== link.neck || /__RETIRED__/i.test(part.websiteSku)
        || (part.websiteSku !== link.componentSku && !(part.websiteSku === ""
            && part.productUrl === link.componentSourceUrl && part.itemName === link.componentName))) return pool;
    if (Object.values(pool.grouped).flat().some(item => item.graceSku === part.graceSku)) return pool;
    return { grouped: { ...pool.grouped, [link.componentType]: [...(pool.grouped[link.componentType] ?? []), {
        graceSku: part.graceSku, websiteSku: link.componentSku, itemName: part.itemName,
        imageUrl: part.imageUrl ?? null, webPrice1pc: part.webPrice1pc, webPrice12pc: part.webPrice12pc,
        capColor: part.capColor, stockStatus: part.stockStatus,
    }] }, sources: [...pool.sources, link.assemblySourceUrl, link.componentSourceUrl] };
}

export async function loadCatalogComponentPool(ctx: QueryCtx, bottle: Doc<"products">) {
    const siblings = cylinderBodyKey(bottle)
        ? await ctx.db.query("products").withIndex("by_family", q => q.eq("family", bottle.family)).take(1201) : [];
    if (siblings.length > 1200) throw new Error("Cylinder component source query truncated");
    const link = reviewedCatalogLink(bottle);
    const part = link ? await ctx.db.query("products").withIndex("by_graceSku", q => q.eq("graceSku", link.componentGraceSku)).unique() : null;
    return addReviewedCatalogComponent(bottle, catalogComponentPool(bottle, siblings), part);
}

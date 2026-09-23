import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { plateRowV } from "./productPlates";
import { kitRowV } from "./productKits";
import { verifyWriteToken } from "./writeToken";

const identityV = v.object({
  graceSku: v.string(), family: v.string(), capacityMl: v.number(),
  color: v.string(), neckThreadSize: v.string(), category: v.string(), applicator: v.string(),
});
const pairV = { plate: plateRowV, kit: kitRowV };
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
function content(row: Record<string, unknown> | null) {
  return row && Object.fromEntries(Object.entries(row).filter(([key]) =>
    !["_id", "_creationTime", "revision", "importedAt"].includes(key)));
}
async function indexes(ctx: QueryCtx, sku: string, graceSku: string) {
  // Include aliases, not just by_sku: a hidden legacy kit must never be overwritten.
  const plates = [...await ctx.db.query("productPlates").withIndex("by_sku", q => q.eq("sku", sku)).collect(),
    ...await ctx.db.query("productPlates").withIndex("by_websiteSku", q => q.eq("websiteSku", sku)).collect(),
    ...await ctx.db.query("productPlates").withIndex("by_graceSku", q => q.eq("graceSku", graceSku)).collect()];
  const kits = [...await ctx.db.query("productKits").withIndex("by_sku", q => q.eq("sku", sku)).collect(),
    ...await ctx.db.query("productKits").withIndex("by_websiteSku", q => q.eq("websiteSku", sku)).collect(),
    ...await ctx.db.query("productKits").withIndex("by_graceSku", q => q.eq("graceSku", graceSku)).collect()];
  return { plates: [...new Map(plates.map(row => [row._id, row])).values()],
    kits: [...new Map(kits.map(row => [row._id, row])).values()] };
}

/** Read-only pre-upload check; insertPair repeats it inside its transaction. */
export const checkInsertions = query({
  args: { rows: v.array(v.object({ sku: v.string(), graceSku: v.string() })) },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    if (!rows.length || rows.length > 50) throw Error("Expected 1–50 scoped insertions");
    for (const row of rows) {
      const existing = await indexes(ctx, row.sku, row.graceSku);
      if (existing.plates.length || existing.kits.length) throw Error("Index already exists: " + row.sku);
    }
    return null;
  },
});

/** New plate + kit become visible in the same transaction; no partial publication. */
export const insertPair = mutation({
  args: { writeToken: v.string(), ...pairV, identity: identityV },
  returns: v.union(v.literal("inserted"), v.literal("unchanged")),
  handler: async (ctx, { writeToken, plate, kit, identity }) => {
    verifyWriteToken(writeToken);
    if (!plate.graceSku || plate.websiteSku !== plate.sku || kit.websiteSku !== plate.sku ||
      kit.sku !== plate.sku || kit.graceSku !== plate.graceSku || kit.familyId !== plate.familyId ||
      kit.plateSha256 !== plate.front.sha256 || kit.canvas.width !== plate.front.width ||
      kit.canvas.height !== plate.front.height || !kit.parts.some(p => p.slot === "body"))
      throw Error("Plate/kit identity or registration mismatch");
    const products = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", plate.sku)).collect();
    if (products.length !== 1 || products[0].graceSku !== plate.graceSku ||
      Object.entries(identity).some(([key, value]) => products[0][key as keyof typeof products[0]] !== value))
      throw Error("Catalog identity changed: " + plate.sku);
    const existing = await indexes(ctx, plate.sku, plate.graceSku);
    if (existing.plates.length === 1 && existing.kits.length === 1 &&
      stable(content(existing.plates[0])) === stable(plate) && stable(content(existing.kits[0])) === stable(kit))
      return "unchanged";
    if (existing.plates.length || existing.kits.length) throw Error("Index already exists: " + plate.sku);
    const meta = { revision: 1, importedAt: Date.now() };
    await ctx.db.insert("productPlates", { ...plate, ...meta });
    await ctx.db.insert("productKits", { ...kit, ...meta });
    return "inserted";
  },
});

/** Restore verified absence. Only exact release-owned index rows are removed; blobs stay. */
export const rollbackInsertedPair = mutation({
  args: { writeToken: v.string(), ...pairV },
  returns: v.union(v.literal("restored_absence"), v.literal("already_absent")),
  handler: async (ctx, { writeToken, plate, kit }) => {
    verifyWriteToken(writeToken);
    if (!plate.graceSku || kit.sku !== plate.sku || kit.graceSku !== plate.graceSku)
      throw Error("Rollback identity mismatch");
    const existing = await indexes(ctx, plate.sku, plate.graceSku);
    if (!existing.plates.length && !existing.kits.length) return "already_absent";
    if (existing.plates.length !== 1 || existing.kits.length !== 1 ||
      stable(content(existing.plates[0])) !== stable(plate) || stable(content(existing.kits[0])) !== stable(kit))
      throw Error("Later or partial release detected; refusing rollback " + plate.sku);
    await ctx.db.delete(existing.plates[0]._id);
    await ctx.db.delete(existing.kits[0]._id);
    return "restored_absence";
  },
});

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Grace data-integrity sweep — deterministic, no LLM, no cost.
 *
 * The conversation audit measures how Grace *behaves*; this measures whether
 * the catalog underneath her is answerable at all. It is the "every SKU green"
 * view: paginated so it can sweep the whole catalog without approaching the
 * 16MB per-transaction read limit.
 */

export const sweepPage = query({
    args: {
        cursor: v.union(v.string(), v.null()),
        pageSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db.query("products").paginate({
            cursor: args.cursor,
            numItems: Math.min(Math.max(args.pageSize ?? 300, 1), 500),
        });

        let priced = 0;
        let named = 0;
        let grouped = 0;
        let skuResolvable = 0;
        let invertedVolumePrice = 0;
        let colorContradiction = 0;
        let capColorContradiction = 0;
        const issues: Array<{ graceSku: string; issue: string; detail: string }> = [];

        // SKU codes encode glass colour; the itemName states the closure colour.
        // When those disagree with the structured fields Grace reports the field
        // and is confidently wrong — found via a 1ml vial whose SKU said CLR,
        // whose color said Amber, and whose name said "black applicator".
        const GLASS_CODES: Record<string, string> = {
            CLR: "clear", AMB: "amber", CBL: "cobalt blue", FRS: "frosted",
            GRN: "green", BLU: "blue", WHT: "white", PNK: "pink",
        };
        const CAP_WORDS = ["black", "white", "clear", "gold", "silver", "amber", "pink", "lavender", "ivory"];

        for (const p of page.page) {
            const sku = p.graceSku ?? "";
            if (sku) {
                // Exact-index resolution is what getProductBySku relies on.
                const hit = await ctx.db
                    .query("products")
                    .withIndex("by_graceSku", (q) => q.eq("graceSku", sku))
                    .first();
                if (hit) skuResolvable++;
                else issues.push({ graceSku: sku, issue: "sku_unresolvable", detail: "Not retrievable by graceSku index." });
            }

            if (typeof p.webPrice1pc === "number" && p.webPrice1pc > 0) priced++;
            else issues.push({ graceSku: sku, issue: "missing_price", detail: "No positive 1-piece price." });

            if ((p.itemName ?? "").trim()) named++;
            else issues.push({ graceSku: sku, issue: "missing_name", detail: "Empty item name." });

            if (p.productGroupId) grouped++;
            else issues.push({ graceSku: sku, issue: "orphan_product", detail: "No product group — unreachable from the catalog." });

            // Glass colour encoded in the SKU vs the stored color field.
            const codeMatch = /^[A-Z]{2,3}-[A-Z]{3}-([A-Z]{3})-/.exec(sku);
            const codedGlass = codeMatch ? GLASS_CODES[codeMatch[1]] : undefined;
            const storedGlass = (p.color ?? "").trim().toLowerCase();
            if (codedGlass && storedGlass && !storedGlass.includes(codedGlass) && !codedGlass.includes(storedGlass)) {
                colorContradiction++;
                issues.push({
                    graceSku: sku,
                    issue: "sku_color_contradiction",
                    detail: `SKU encodes "${codedGlass}" but the color field says "${p.color}". Grace reports the field, so she will describe the wrong glass.`,
                });
            }

            // Closure colour stated in the item name vs the stored capColor.
            const name = (p.itemName ?? "").toLowerCase();
            const storedCap = (p.capColor ?? "").trim().toLowerCase();
            if (storedCap && storedCap !== "n/a") {
                const namedCap = CAP_WORDS.find((w) => name.includes(`${w} applicator`) || name.includes(`${w} cap`));
                if (namedCap && !storedCap.includes(namedCap)) {
                    capColorContradiction++;
                    issues.push({
                        graceSku: sku,
                        issue: "cap_color_contradiction",
                        detail: `Item name says "${namedCap}" closure but capColor says "${p.capColor}". Grace reports capColor.`,
                    });
                }
            }

            if (typeof p.webPrice1pc === "number" && typeof p.webPrice12pc === "number"
                && p.webPrice12pc > p.webPrice1pc) {
                invertedVolumePrice++;
                issues.push({
                    graceSku: sku,
                    issue: "inverted_volume_price",
                    detail: `12-piece $${p.webPrice12pc.toFixed(2)} exceeds 1-piece $${p.webPrice1pc.toFixed(2)} — Grace will quote a "discount" that is a markup.`,
                });
            }
        }

        return {
            isDone: page.isDone,
            continueCursor: page.continueCursor,
            scanned: page.page.length,
            priced,
            named,
            grouped,
            skuResolvable,
            invertedVolumePrice,
            colorContradiction,
            capColorContradiction,
            issues: issues.slice(0, 200),
        };
    },
});

/** Group-level checks: denormalization drift and PDP reachability. */
export const groupIntegrity = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        const issues: Array<{ slug: string; issue: string; detail: string }> = [];
        let withSlug = 0;
        let priceRangeOk = 0;

        for (const g of groups) {
            if ((g.slug ?? "").trim()) withSlug++;
            else issues.push({ slug: g.displayName ?? "(unnamed)", issue: "missing_slug", detail: "No PDP slug — not linkable." });

            if (typeof g.priceRangeMin === "number" && typeof g.priceRangeMax === "number"
                && g.priceRangeMin <= g.priceRangeMax) priceRangeOk++;
            else if (g.priceRangeMin !== null || g.priceRangeMax !== null) {
                issues.push({ slug: g.slug ?? "?", issue: "bad_price_range", detail: "priceRangeMin/Max missing or inverted." });
            }
        }

        return {
            totalGroups: groups.length,
            withSlug,
            priceRangeOk,
            issues: issues.slice(0, 200),
        };
    },
});

/** Cross-check the denormalized variantCount against real membership. */
export const variantCountDrift = query({
    args: { skip: v.optional(v.number()), take: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const skip = args.skip ?? 0;
        const take = Math.min(args.take ?? 60, 120);
        const groups = (await ctx.db.query("productGroups").collect()).slice(skip, skip + take);
        const drift: Array<{ slug: string; stored: number; actual: number }> = [];
        let checked = 0;

        for (const g of groups) {
            const members = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                .collect();
            checked++;
            if ((g.variantCount ?? 0) !== members.length) {
                drift.push({ slug: g.slug ?? "?", stored: g.variantCount ?? 0, actual: members.length });
            }
        }

        return { checked, scanned: groups.length, drift, done: skip + take >= (await ctx.db.query("productGroups").collect()).length };
    },
});

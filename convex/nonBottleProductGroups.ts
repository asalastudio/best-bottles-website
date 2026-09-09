import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { verifyWriteToken } from "./writeToken";

const ORGANZA_SKUS = [
    "OBagBlack4x6", "OBagBlack5x8", "OBagChGreen5x8", "OBagGold4x6",
    "OBagGold5x8", "OBagChGreen4x6", "OBagIvory4x6", "OBagLavender5x8",
    "OBagLightPurple5x8", "OBagPink4x6", "OBagPurple4x6", "OBagRed4x6",
    "OBagRed5x8", "OBagSilver4x6",
] as const;

const VELVET_SKUS = [
    "VBagBlack4x3", "VBagBlack4x5", "VBagBlue4x3", "VBagGreen4x3",
    "VBagGreen4x5", "VBagRed4x3", "VBagRed4x5",
] as const;

const FUNNEL_SKUS = ["FunnelMetalGl", "FunnelMetalSl", "Plastic"] as const;

type GroupSummaryPatch = Pick<
    Doc<"productGroups">,
    "variantCount" | "priceRangeMin" | "priceRangeMax" | "primaryGraceSku" |
    "primaryWebsiteSku" | "heroImageUrl" | "applicatorTypes"
>;

function summarizeGroup(products: Doc<"products">[], primary: Doc<"products">): GroupSummaryPatch {
    const prices = products
        .map((product) => product.webPrice1pc ?? product.qbPrice)
        .filter((price): price is number => typeof price === "number" && Number.isFinite(price));

    return {
        variantCount: products.length,
        priceRangeMin: prices.length ? Math.min(...prices) : null,
        priceRangeMax: prices.length ? Math.max(...prices) : null,
        primaryGraceSku: primary.graceSku,
        primaryWebsiteSku: primary.websiteSku,
        heroImageUrl: primary.imageUrl ?? null,
        applicatorTypes: [],
    };
}

/**
 * Targeted grouping migration for non-bottle PDPs.
 *
 * The generic product-group rebuild is deliberately not used here. This
 * mutation validates the exact reviewed SKU set before writing, preserves the
 * existing Organza and Funnel URLs, and only creates one new Velvet group.
 * Dry-run is the default so a release operator must explicitly opt into writes.
 */
export const regroupGiftBagsAndFunnels = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const dryRun = args.dryRun ?? true;
        const expectedSkus = [...ORGANZA_SKUS, ...VELVET_SKUS, ...FUNNEL_SKUS];
        const productsBySku = new Map<string, Doc<"products">>();
        const issues: string[] = [];

        for (const websiteSku of expectedSkus) {
            const matches = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (query) => query.eq("websiteSku", websiteSku))
                .collect();
            if (matches.length !== 1) {
                issues.push(`${websiteSku}: expected one product, found ${matches.length}`);
                continue;
            }
            productsBySku.set(websiteSku, matches[0]);
        }

        const organzaGroups = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (query) => query.eq("slug", "gift-bag-0ml-mixed"))
            .collect();
        const funnelGroups = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (query) => query.eq("slug", "tool-0ml-mixed"))
            .collect();
        const velvetGroups = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (query) => query.eq("slug", "velvet-gift-bags"))
            .collect();

        if (organzaGroups.length !== 1) issues.push(`gift-bag-0ml-mixed: expected one group, found ${organzaGroups.length}`);
        if (funnelGroups.length !== 1) issues.push(`tool-0ml-mixed: expected one group, found ${funnelGroups.length}`);
        if (velvetGroups.length > 1) issues.push(`velvet-gift-bags: expected at most one group, found ${velvetGroups.length}`);

        const giftBagProducts = await ctx.db
            .query("products")
            .filter((query) => query.eq(query.field("family"), "Gift Bag"))
            .collect();
        const unexpectedGiftBagSkus = giftBagProducts
            .map((product) => product.websiteSku)
            .filter((sku) => !ORGANZA_SKUS.includes(sku as (typeof ORGANZA_SKUS)[number]) && !VELVET_SKUS.includes(sku as (typeof VELVET_SKUS)[number]));
        if (giftBagProducts.length !== ORGANZA_SKUS.length + VELVET_SKUS.length || unexpectedGiftBagSkus.length) {
            issues.push(`Gift Bag inventory differs from the reviewed 21-SKU set${unexpectedGiftBagSkus.length ? `: ${unexpectedGiftBagSkus.join(", ")}` : ""}`);
        }

        const toolProducts = await ctx.db
            .query("products")
            .filter((query) => query.eq(query.field("family"), "Tool"))
            .collect();
        const unexpectedToolSkus = toolProducts
            .map((product) => product.websiteSku)
            .filter((sku) => !FUNNEL_SKUS.includes(sku as (typeof FUNNEL_SKUS)[number]));
        if (toolProducts.length !== FUNNEL_SKUS.length || unexpectedToolSkus.length) {
            issues.push(`Tool inventory differs from the reviewed 3-SKU funnel set${unexpectedToolSkus.length ? `: ${unexpectedToolSkus.join(", ")}` : ""}`);
        }

        if (velvetGroups[0]) {
            const currentVelvetProducts = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (query) => query.eq("productGroupId", velvetGroups[0]._id))
                .collect();
            const unexpectedVelvetSkus = currentVelvetProducts
                .map((product) => product.websiteSku)
                .filter((sku) => !VELVET_SKUS.includes(sku as (typeof VELVET_SKUS)[number]));
            if (unexpectedVelvetSkus.length) {
                issues.push(`velvet-gift-bags contains unreviewed products: ${unexpectedVelvetSkus.join(", ")}`);
            }
        }

        const preview = {
            organza: { slug: "gift-bag-0ml-mixed", defaultWebsiteSku: "OBagPink4x6", variants: ORGANZA_SKUS.length },
            velvet: { slug: "velvet-gift-bags", defaultWebsiteSku: "VBagBlack4x3", variants: VELVET_SKUS.length },
            funnels: { slug: "tool-0ml-mixed", defaultWebsiteSku: "FunnelMetalGl", variants: FUNNEL_SKUS.length, defaultLabel: "Brass" },
        };

        if (issues.length || dryRun) {
            return { dryRun, applied: false, issues, preview };
        }

        const organzaGroup = organzaGroups[0];
        const funnelGroup = funnelGroups[0];
        const organzaDefault = productsBySku.get("OBagPink4x6");
        const velvetDefault = productsBySku.get("VBagBlack4x3");
        const funnelDefault = productsBySku.get("FunnelMetalGl");
        if (!organzaGroup || !funnelGroup || !organzaDefault || !velvetDefault || !funnelDefault) {
            return { dryRun, applied: false, issues: ["Validated migration inputs became unavailable"], preview };
        }

        let velvetGroupId: Id<"productGroups">;
        if (velvetGroups[0]) {
            velvetGroupId = velvetGroups[0]._id;
        } else {
            velvetGroupId = await ctx.db.insert("productGroups", {
                slug: "velvet-gift-bags",
                displayName: "Velvet Gift Bags",
                family: "Gift Bag",
                capacity: "0 ml (0 oz)",
                capacityMl: 0,
                color: null,
                category: "Packaging",
                bottleCollection: "Gift Bag",
                neckThreadSize: null,
                variantCount: 0,
                priceRangeMin: null,
                priceRangeMax: null,
                applicatorTypes: [],
                primaryGraceSku: null,
                primaryWebsiteSku: null,
                heroImageUrl: null,
                groupDescription: "Velvet drawstring gift bags in selectable colors and sizes.",
            });
        }

        for (const websiteSku of VELVET_SKUS) {
            await ctx.db.patch(productsBySku.get(websiteSku)!._id, { productGroupId: velvetGroupId });
        }

        const organzaProducts = ORGANZA_SKUS.map((sku) => productsBySku.get(sku)!);
        const velvetProducts = VELVET_SKUS.map((sku) => productsBySku.get(sku)!);
        const funnelProducts = FUNNEL_SKUS.map((sku) => productsBySku.get(sku)!);

        await ctx.db.patch(organzaGroup._id, {
            displayName: "Organza Gift Bags",
            groupDescription: "Sheer organza drawstring gift bags in selectable colors and sizes.",
            ...summarizeGroup(organzaProducts, organzaDefault),
        });
        await ctx.db.patch(velvetGroupId, {
            displayName: "Velvet Gift Bags",
            groupDescription: "Velvet drawstring gift bags in selectable colors and sizes.",
            ...summarizeGroup(velvetProducts, velvetDefault),
        });
        await ctx.db.patch(funnelGroup._id, {
            displayName: "Funnels",
            groupDescription: "Small transfer funnels available in brass, silver metal, and plastic.",
            ...summarizeGroup(funnelProducts, funnelDefault),
        });

        return { dryRun, applied: true, issues: [], preview };
    },
});

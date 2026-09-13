import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";

const applicatorValidator = v.union(
    v.literal("Metal Roller Ball"),
    v.literal("Plastic Roller Ball"),
    v.literal("Fine Mist Sprayer"),
    v.literal("Perfume Spray Pump"),
    v.literal("Atomizer"),
    v.literal("Vintage Bulb Sprayer"),
    v.literal("Vintage Bulb Sprayer with Tassel"),
    v.literal("Lotion Pump"),
    v.literal("Dropper"),
    v.literal("Reducer"),
    v.literal("Glass Stopper"),
    v.literal("Glass Rod"),
    v.literal("Cap/Closure"),
    v.literal("Applicator Cap"),
    v.literal("Metal Atomizer"),
    v.literal("N/A"),
);

const priceTierValidator = v.object({
    minQty: v.number(),
    unitPrice: v.number(),
    totalPrice: v.number(),
});

export const createStaffProduct = mutation({
    args: {
        writeToken: v.string(),
        slug: v.string(),
        displayName: v.string(),
        family: v.string(),
        category: v.string(),
        capacity: v.string(),
        capacityMl: v.number(),
        color: v.string(),
        neckThreadSize: v.string(),
        bottleCollection: v.string(),
        groupDescription: v.string(),
        websiteSku: v.string(),
        graceSku: v.string(),
        itemName: v.string(),
        itemDescription: v.string(),
        applicator: applicatorValidator,
        capColor: v.string(),
        capStyle: v.string(),
        trimColor: v.string(),
        componentProfile: v.string(),
        ballMaterial: v.string(),
        heightWithCap: v.string(),
        heightWithoutCap: v.string(),
        diameter: v.string(),
        bottleWeightG: v.union(v.number(), v.null()),
        caseQuantity: v.union(v.number(), v.null()),
        webPrice1pc: v.number(),
        webPrice12pc: v.union(v.number(), v.null()),
        priceTiers: v.array(priceTierValidator),
        heroImageUrl: v.string(),
        imageUrl: v.string(),
        imageUrlCapOff: v.string(),
        paperDollFamilyKey: v.string(),
        stockStatus: v.string(),
        source: v.string(),
    },
    returns: v.object({
        created: v.boolean(),
        slug: v.string(),
        websiteSku: v.string(),
        detail: v.string(),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const existingSku = await ctx.db
            .query("products")
            .withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku))
            .first();
        if (existingSku) {
            return { created: false, slug: args.slug, websiteSku: args.websiteSku, detail: "A product already uses this website SKU." };
        }

        const existingGrace = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku))
            .first();
        if (existingGrace) {
            return { created: false, slug: args.slug, websiteSku: args.websiteSku, detail: `Grace SKU already used by ${existingGrace.websiteSku}.` };
        }

        const existingGroup = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();
        if (existingGroup) {
            return { created: false, slug: args.slug, websiteSku: args.websiteSku, detail: "That product page slug already exists. Open the existing group instead of creating a parallel one." };
        }

        if (args.heroImageUrl.includes("cdn.sanity.io") || args.imageUrl.includes("cdn.sanity.io") || args.imageUrlCapOff.includes("cdn.sanity.io")) {
            return { created: false, slug: args.slug, websiteSku: args.websiteSku, detail: "Sanity CDN images are editorial only. Use Shopify, Convex, or plate-ledger imagery." };
        }

        const groupId = await ctx.db.insert("productGroups", {
            slug: args.slug,
            displayName: args.displayName,
            family: args.family,
            category: args.category,
            capacity: args.capacity,
            capacityMl: args.capacityMl,
            color: args.color,
            bottleCollection: args.bottleCollection || null,
            neckThreadSize: args.neckThreadSize,
            variantCount: 1,
            priceRangeMin: args.webPrice1pc,
            priceRangeMax: args.webPrice1pc,
            heroImageUrl: args.heroImageUrl || args.imageUrl || null,
            applicatorTypes: [args.applicator],
            primaryGraceSku: args.graceSku,
            primaryWebsiteSku: args.websiteSku,
            groupDescription: args.groupDescription || args.itemDescription || null,
            paperDollFamilyKey: args.paperDollFamilyKey || null,
        });

        await ctx.db.insert("products", {
            productId: null,
            websiteSku: args.websiteSku,
            graceSku: args.graceSku,
            category: args.category,
            family: args.family,
            shape: null,
            color: args.color,
            capacity: args.capacity,
            capacityMl: args.capacityMl,
            capacityOz: null,
            applicator: args.applicator,
            capColor: args.capColor || null,
            trimColor: args.trimColor || null,
            capStyle: args.capStyle || null,
            ballMaterial: args.ballMaterial || null,
            componentProfile: args.componentProfile || null,
            neckThreadSize: args.neckThreadSize,
            heightWithCap: args.heightWithCap || null,
            heightWithoutCap: args.heightWithoutCap || null,
            diameter: args.diameter || null,
            bottleWeightG: args.bottleWeightG,
            caseQuantity: args.caseQuantity,
            qbPrice: null,
            webPrice1pc: args.webPrice1pc,
            webPrice10pc: null,
            webPrice12pc: args.webPrice12pc,
            priceTiers: args.priceTiers,
            stockStatus: args.stockStatus || "In Stock",
            itemName: args.itemName,
            itemDescription: args.itemDescription || null,
            imageUrl: args.imageUrl || args.heroImageUrl || null,
            imageUrlCapOff: args.imageUrlCapOff || null,
            productUrl: `/products/${args.slug}`,
            dataGrade: "staff_create",
            bottleCollection: args.bottleCollection || null,
            fitmentStatus: null,
            components: [],
            graceDescription: args.itemDescription || null,
            verified: false,
            importSource: args.source,
            productGroupId: groupId,
            shopifyVariantId: null,
            shopifyInventoryItemId: null,
            shopifySellable: false,
            shopifySellableReason: "NOT_IN_SHOPIFY",
        });

        return {
            created: true,
            slug: args.slug,
            websiteSku: args.websiteSku,
            detail: "created",
        };
    },
});

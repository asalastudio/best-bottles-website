// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const source = readFileSync(resolve(process.cwd(), "convex/products.ts"), "utf8");
const start = source.indexOf("export const setProductGroupHeroFromApprovedSku");
const end = source.indexOf("export const setProductGroupPrimarySku", start);
const mutationSource = source.slice(start, end);

const modules = import.meta.glob("../convex/**/*.ts");
const WRITE_TOKEN = "test-write-token";
const GROUP_SLUG = "cylinder-9ml-amber-metal-roll-on";
const WEBSITE_SKU = "GBCylAmb9MtlRollBlkDot";
const GRACE_SKU = "GB-CYL-AMB-9ML-MTL-ROLL-BLK-DOT";
const HERO_URL = "https://cdn.shopify.com/s/files/1/approved-hero.png?v=1";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

describe("product-group Shopify hero assignment", () => {
    it("provides Madison's indexed website-SKU readback API", () => {
        const lookupStart = source.indexOf("export const getByWebsiteSku");
        const lookupEnd = source.indexOf("export const getByFamily", lookupStart);
        const lookupSource = source.slice(lookupStart, lookupEnd);

        expect(lookupStart).toBeGreaterThan(-1);
        expect(lookupSource).toContain("args: { websiteSku: v.string() }");
        expect(lookupSource).toContain("returns: v.union");
        expect(lookupSource).toContain('.withIndex("by_websiteSku"');
        expect(lookupSource).toContain(".unique()");
        expect(lookupSource).not.toContain(".first()");
        expect(lookupSource).toContain("imageUrl: product.imageUrl ?? null");
        expect(lookupSource).toContain("imageUrlCapOff: product.imageUrlCapOff ?? null");
    });

    it("exposes a fully validated write-token protected mutation", () => {
        expect(start).toBeGreaterThan(-1);
        expect(mutationSource).toContain("writeToken: v.string()");
        expect(mutationSource).toContain("productGroupSlug: v.string()");
        expect(mutationSource).toContain("websiteSku: v.string()");
        expect(mutationSource).toContain("graceSku: v.string()");
        expect(mutationSource).toContain("heroImageUrl: v.string()");
        expect(mutationSource).toContain("returns: v.object");
        expect(mutationSource).toContain("verifyProductImageWriteToken(args.writeToken)");
    });

    it("binds the exact SKU pair and Shopify URL to the indexed group", () => {
        expect(mutationSource).toContain('.withIndex("by_slug"');
        expect(mutationSource).toContain('.withIndex("by_graceSku"');
        expect(mutationSource).toContain("product.websiteSku !== websiteSku");
        expect(mutationSource).toContain("product.productGroupId !== group._id");
        expect(mutationSource).toContain("product.imageUrl !== heroImageUrl");
        expect(mutationSource).toContain("isExactShopifyCdnUrl(heroImageUrl)");
    });

    it("explicitly and idempotently patches only the resolved group hero", () => {
        expect(mutationSource).toContain("group.heroImageUrl !== heroImageUrl");
        expect(mutationSource).toContain("ctx.db.patch(group._id, { heroImageUrl })");
        expect(mutationSource).not.toContain("primaryWebsiteSku:");
        expect(mutationSource).not.toContain("primaryGraceSku:");
    });
});

async function seedApprovedHeroPair(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
        const productGroupId = await ctx.db.insert("productGroups", {
            slug: GROUP_SLUG,
            displayName: "Cylinder 9ml Amber Metal Roll-On",
            family: "Cylinder",
            category: "Glass Bottle",
            color: "Amber",
            capacity: "9 ml",
            capacityMl: 9,
            neckThreadSize: "17-415",
            bottleCollection: null,
            variantCount: 1,
            priceRangeMin: 0.88,
            priceRangeMax: 0.88,
            heroImageUrl: null,
        } as never);

        await ctx.db.insert("products", {
            websiteSku: WEBSITE_SKU,
            graceSku: GRACE_SKU,
            itemName: "Cylinder 9ml amber metal roll-on black dotted",
            imageUrl: HERO_URL,
            category: "Glass Bottle",
            family: "Cylinder",
            shape: null,
            color: "Amber",
            capacity: "9 ml",
            capacityMl: 9,
            capacityOz: 0.3,
            applicator: "Metal Roller Ball",
            capColor: "Black",
            trimColor: null,
            capStyle: null,
            neckThreadSize: "17-415",
            heightWithCap: null,
            heightWithoutCap: null,
            diameter: null,
            bottleWeightG: null,
            caseQuantity: null,
            qbPrice: null,
            webPrice1pc: 0.88,
            webPrice10pc: null,
            webPrice12pc: null,
            stockStatus: null,
            itemDescription: null,
            productUrl: null,
            dataGrade: null,
            bottleCollection: null,
            fitmentStatus: null,
            components: null,
            graceDescription: null,
            verified: false,
            productGroupId,
        } as never);

        return productGroupId;
    });
}

function assignApprovedHero(t: ReturnType<typeof convexTest>) {
    return t.mutation(api.products.setProductGroupHeroFromApprovedSku, {
        writeToken: WRITE_TOKEN,
        productGroupSlug: GROUP_SLUG,
        websiteSku: WEBSITE_SKU,
        graceSku: GRACE_SKU,
        heroImageUrl: HERO_URL,
    });
}

describe("setProductGroupHeroFromApprovedSku runtime", () => {
    it("assigns the synced Shopify hero once, then no-ops on the same URL", async () => {
        const t = convexTest(schema, modules);
        const productGroupId = await seedApprovedHeroPair(t);

        const first = await assignApprovedHero(t);
        expect(first).toMatchObject({
            success: true,
            changed: true,
            productGroupId,
            productGroupSlug: GROUP_SLUG,
            websiteSku: WEBSITE_SKU,
            graceSku: GRACE_SKU,
            heroImageUrl: HERO_URL,
        });

        const persisted = await t.run(async (ctx) => ctx.db.get(productGroupId));
        expect(persisted?.heroImageUrl).toBe(HERO_URL);

        const second = await assignApprovedHero(t);
        expect(second).toMatchObject({
            success: true,
            changed: false,
            productGroupId,
            heroImageUrl: HERO_URL,
        });

        const afterSecond = await t.run(async (ctx) => ctx.db.get(productGroupId));
        expect(afterSecond?.heroImageUrl).toBe(HERO_URL);
    });

    it("rejects duplicate websiteSku rows instead of returning an arbitrary product", async () => {
        const t = convexTest(schema, modules);
        await seedApprovedHeroPair(t);
        await t.run(async (ctx) => {
            await ctx.db.insert("products", {
                websiteSku: WEBSITE_SKU,
                graceSku: `${GRACE_SKU}-DUP`,
                itemName: "duplicate website SKU",
                imageUrl: "https://cdn.shopify.com/s/files/1/other.png",
                category: "Glass Bottle",
                family: "Cylinder",
                shape: null,
                color: "Amber",
                capacity: "9 ml",
                capacityMl: 9,
                capacityOz: 0.3,
                applicator: "Metal Roller Ball",
                capColor: "Black",
                trimColor: null,
                capStyle: null,
                neckThreadSize: "17-415",
                heightWithCap: null,
                heightWithoutCap: null,
                diameter: null,
                bottleWeightG: null,
                caseQuantity: null,
                qbPrice: null,
                webPrice1pc: 0.88,
                webPrice10pc: null,
                webPrice12pc: null,
                stockStatus: null,
                itemDescription: null,
                productUrl: null,
                dataGrade: null,
                bottleCollection: null,
                fitmentStatus: null,
                components: null,
                graceDescription: null,
                verified: false,
            } as never);
        });

        await expect(t.query(api.products.getByWebsiteSku, { websiteSku: WEBSITE_SKU }))
            .rejects.toThrow(/unique/i);
    });
});

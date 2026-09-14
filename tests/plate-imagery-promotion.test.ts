// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Promoting plate imagery into the catalogue's image fields.
 *
 * This rewrites a field the whole storefront reads, so the risks are losing the
 * only record of what a row used to point at, blanking an image for a product
 * the plate pipeline has not reached, and churning rows on every re-run.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

const WRITE_TOKEN = "test-write-token";
const SKU = "GBCyl9SpryGl";
const STALE = "https://cdn.shopify.com/s/files/dead.png?v=1";
const PLATE = "https://blob.example.com/plates/cylinder-9ml-clear.png";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

const asset = (url: string) => ({
    url, key: url, sha256: "a".repeat(64), bytes: 1, width: 10, height: 10,
});

async function seed(
    t: ReturnType<typeof convexTest>,
    opts: { withPlate?: boolean; imageUrl?: string | null } = {},
) {
    const { withPlate = true, imageUrl = STALE } = opts;
    await t.run(async (ctx) => {
        await ctx.db.insert("products", {
            websiteSku: SKU,
            graceSku: "GB-CYL-CLR-9ML",
            itemName: "Cylinder 9ml clear",
            imageUrl,
            category: "Glass Bottle",
            family: "Cylinder",
            shape: null,
            color: "Clear",
            capacity: "9 ml",
            capacityMl: 9,
            capacityOz: 0.3,
            applicator: null,
            capColor: null,
            trimColor: null,
            capStyle: null,
            neckThreadSize: "18-415",
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
        if (withPlate) {
            await ctx.db.insert("productPlates", {
                sku: SKU,
                websiteSku: SKU,
                graceSku: "GB-CYL-CLR-9ML",
                familyId: "cylinder-9ml-clear-18-415",
                front: asset(PLATE),
                frontCapOff: null,
                thumb: asset(`${PLATE}?thumb`),
                thumbCapOff: null,
                views: [],
                source: { library: "BB-PSD-Files-Master", path: "cyl/9ml.psd", psdSha256: null, psdSha256CapOff: null },
                builder: { name: "publish.mjs", version: "1", builtAt: 1_700_000_000_000 },
                storageProvider: "vercel-blob",
                revision: 1,
                importedAt: 1_700_000_000_000,
            } as never);
        }
    });
}

function promote(t: ReturnType<typeof convexTest>, overrides: Record<string, unknown> = {}) {
    return t.mutation(api.productPlates.promotePlateImagery, {
        writeToken: WRITE_TOKEN,
        skus: [SKU],
        ...overrides,
    });
}

const readProduct = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) => ctx.db.query("products").first());

describe("promotePlateImagery", () => {
    it("refuses a mutation without the shared token", async () => {
        const t = convexTest(schema, modules);
        await seed(t);
        // The plate modules gate on the same secret as the portal but throw
        // their own error name — see convex/writeToken.ts.
        await expect(promote(t, { writeToken: "wrong" })).rejects.toThrow(/unauthorized_product_image_write/);
    });

    it("points the image at the plate and keeps the superseded URL", async () => {
        const t = convexTest(schema, modules);
        await seed(t);
        expect(await promote(t)).toMatchObject({ promoted: 1, skipped: 0, noPlate: 0 });

        const product = await readProduct(t);
        expect(product?.imageUrl).toBe(PLATE);
        expect(product?.legacyShopifyImageUrl).toBe(STALE);
    });

    it("leaves a product with no plate exactly as it was", async () => {
        const t = convexTest(schema, modules);
        await seed(t, { withPlate: false });
        expect(await promote(t)).toMatchObject({ promoted: 0, noPlate: 1 });

        const product = await readProduct(t);
        expect(product?.imageUrl).toBe(STALE);
        expect(product?.legacyShopifyImageUrl).toBeUndefined();
    });

    it("is idempotent, and a second run does not overwrite the preserved original", async () => {
        const t = convexTest(schema, modules);
        await seed(t);
        await promote(t);
        expect(await promote(t)).toMatchObject({ promoted: 0, skipped: 1 });

        const product = await readProduct(t);
        expect(product?.legacyShopifyImageUrl).toBe(STALE);
    });

    it("changes nothing on a dry run", async () => {
        const t = convexTest(schema, modules);
        await seed(t);
        expect(await promote(t, { dryRun: true })).toMatchObject({ promoted: 1 });

        const product = await readProduct(t);
        expect(product?.imageUrl).toBe(STALE);
    });

    it("promotes a product that had no image at all", async () => {
        const t = convexTest(schema, modules);
        await seed(t, { imageUrl: null });
        await promote(t);
        expect((await readProduct(t))?.imageUrl).toBe(PLATE);
    });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "convex/products.ts"), "utf8");
const start = source.indexOf("export const setProductGroupHeroFromApprovedSku");
const end = source.indexOf("export const setProductGroupPrimarySku", start);
const mutationSource = source.slice(start, end);

describe("product-group Shopify hero assignment", () => {
    it("provides Madison's indexed website-SKU readback API", () => {
        const lookupStart = source.indexOf("export const getByWebsiteSku");
        const lookupEnd = source.indexOf("export const getByFamily", lookupStart);
        const lookupSource = source.slice(lookupStart, lookupEnd);

        expect(lookupStart).toBeGreaterThan(-1);
        expect(lookupSource).toContain("args: { websiteSku: v.string() }");
        expect(lookupSource).toContain("returns: v.union");
        expect(lookupSource).toContain('.withIndex("by_websiteSku"');
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

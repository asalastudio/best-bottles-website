import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Shopify sync foundation contract", () => {
    it("documents the BB-1/BB-7 run order and canonical ID mapping", () => {
        const doc = read("docs/SHOPIFY_SYNC_FOUNDATION.md");

        expect(doc).toContain("Linear: BB-1 and BB-7");
        expect(doc).toContain("productGroups.slug");
        expect(doc).toContain("Shopify product.handle");
        expect(doc).toContain("products.graceSku or products.websiteSku");
        expect(doc).toContain("Shopify variant.sku");
        expect(doc).toContain("products.shopifyVariantId");
        expect(doc).toContain("Checkout must use `products.shopifyVariantId`");
        expect(doc).toContain("npm run shopify:sync:validate -- --limit 10");
        expect(doc).toContain("npm run shopify:sync:dry -- --limit 10");
        expect(doc).toContain("node scripts/push_convex_to_shopify.mjs --apply --missing-shopify-ids-only");
        expect(doc).toContain("node scripts/backfill_shopify_ids.mjs --apply --limit 10");
        expect(doc).toContain("npm run audit:shopify-skus -- --json");
    });

    it("exposes launch-safe npm commands for validate and dry-run", () => {
        const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

        expect(pkg.scripts["shopify:sync:validate"]).toBe("node scripts/push_convex_to_shopify.mjs --validate-only");
        expect(pkg.scripts["shopify:sync:dry"]).toBe("node scripts/push_convex_to_shopify.mjs");
    });

    it("keeps Convex validation credential-light and blocks unsafe group payloads", () => {
        const source = read("scripts/push_convex_to_shopify.mjs");

        expect(source).toContain('args.validateOnly\n    ? ["NEXT_PUBLIC_CONVEX_URL"]');
        expect(source).toContain("const MAX_SHOPIFY_VARIANTS_PER_PRODUCT = 100");
        expect(source).toContain("reason: \"missing_skus\"");
        expect(source).toContain("reason: \"duplicate_skus\"");
        expect(source).toContain("reason: \"missing_prices\"");
        expect(source).toContain("reason: \"too_many_variants\"");
        expect(source).toContain("reason: \"handle_check_failed\"");
        expect(source).toContain("--missing-shopify-ids-only");
        expect(source).toContain("After missing Shopify ID filter");
    });

    it("maps Convex groups and variants to Shopify handles, SKUs, and manifest rows", () => {
        const source = read("scripts/push_convex_to_shopify.mjs");

        expect(source).toContain("handle: group.slug");
        expect(source).toContain("const variantKey = v.graceSku || v.websiteSku");
        expect(source).toContain('name: "SKU"');
        expect(source).toContain('status: argVal("--status") ?? "DRAFT"');
        expect(source).toContain("manifestVariantsWithShopifyIds");
        expect(source).toContain("productId: v.productId ?? null");
        expect(source).toContain("websiteSku: v.websiteSku ?? null");
        expect(source).toContain("shopifyInventoryItemId: v.shopifyInventoryItemId ?? null");
    });

    it("writes a BB-7 backfill manifest and patches only stable Shopify IDs", () => {
        const script = read("scripts/backfill_shopify_ids.mjs");
        const actions = read("convex/backfillShopifyIds.ts");

        expect(script).toContain('operation: "backfill-shopify-ids"');
        expect(script).toContain("backfill-manifest-");
        expect(script).toContain("writeManifest(manifest)");
        expect(script).toContain("currentShopifyProductId");
        expect(script).toContain("currentShopifyVariantId");
        expect(script).toContain("matchStatus");
        expect(script).toContain("manifest.summary.failed = manifest.rows.reduce");

        expect(actions).toContain(".withIndex(\"by_graceSku\"");
        expect(actions).toContain(".withIndex(\"by_websiteSku\"");
        expect(actions).toContain("shopifyVariantId: p.shopifyVariantId");
        expect(actions).toContain("shopifyInventoryItemId = p.shopifyInventoryItemId");
        expect(actions).toContain("shopifyProductId: p.shopifyProductId");
        expect(actions).not.toContain("itemName:");
        expect(actions).not.toContain("family:");
    });

    it("keeps checkout deterministic by using stored Shopify variant IDs first", () => {
        const route = read("src/app/api/shopify/resolve-variants/route.ts");
        const cart = read("src/components/CartProvider.tsx");

        expect(cart).toContain("shopifyVariantId: i.shopifyVariantId");
        expect(route).toContain("normalizeShopifyVariantId(item.shopifyVariantId)");
        expect(route).toContain("resolveCheckoutVariantsByIds");
        expect(route).toContain("const directCheckoutItems = directItems.flatMap");
        expect(route).toContain("const fallbackItems = requestedItems.filter((item) => !item.shopifyVariantId)");
    });
});

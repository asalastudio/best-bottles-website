import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
const query = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/portal/convexClient", () => ({ getPortalConvex: () => ({ query }), getPortalConvexWriteToken: () => "fixture" }));
vi.mock("../src/lib/portal/server", () => ({}));
import { resolveDraftLines } from "../src/lib/portal/draftEditor";
import { portalCatalogPrice } from "../src/lib/portal/catalog-pricing";
import { activeCatalogTier, catalogCardTiers, resolveCatalogCardPurchaseVariant } from "../src/lib/products/catalog-card-purchase";
import { buildCatalogLineItem } from "../src/lib/products/catalog-line-items";
import type { CatalogSearchGroup, CatalogSearchVariantPreviewRow } from "../src/lib/catalogSearchFallback";
import PortalCatalogPurchase from "../src/components/portal/PortalCatalogPurchase";

const tiers = [{ minQty: 1, unitPrice: .88 }, { minQty: 12, unitPrice: .84 }, { minQty: 144, unitPrice: .79 },
    { minQty: 288, unitPrice: .75 }, { minQty: 1440, unitPrice: .69 }];
const source = { id: "fixture", graceSku: "GBElg15MtlRollSlSh", websiteSku: "GB-ELG-CLR-15ML-MRL-SSLV", itemName: "Elegant 15 mL silver metal roller",
    imageUrl: null, imageUrlCapOff: null, color: "Clear", applicator: "Metal Roller", capColor: "Shiny Silver", trimColor: null,
    capStyle: null, capHeight: null, ballMaterial: "Metal", stockStatus: "In Stock", caseQuantity: 144,
    webPrice1pc: .88, webPrice10pc: null, webPrice12pc: .84, priceTiers: tiers,
    shopifyVariantId: "gid://shopify/ProductVariant/53343615680804", shopifySellable: true };
const variant = resolveCatalogCardPurchaseVariant([source], { productTitle: source.itemName })!;
const group = { _id: "group", slug: "elegant-clear-15ml", displayName: "Elegant clear 15 ml", category: "Glass Bottle", family: "Elegant", capacity: "15 ml", color: "Clear", neckThreadSize: "13-415", variantCount: 2, priceRangeMin: .10 } as CatalogSearchGroup;
function item(variants: CatalogSearchVariantPreviewRow["variants"] = [source]) {
    return buildCatalogLineItem(group, { primarySkus: [{ groupId: "group", websiteSku: source.websiteSku, graceSku: source.graceSku }], variantPreviewRows: [{ groupId: "group", variants }] });
}
describe("buyer portal uses the exact public catalog and server draft ladder", () => {
    it.each([[1, .88], [11, .88], [12, .84], [13, .84], [60, .84], [143, .84], [144, .79], [145, .79],
        [287, .79], [288, .75], [289, .75], [1439, .75], [1440, .69], [1441, .69]])("quantity %i resolves to %f everywhere", async (quantity, rate) => {
        query.mockResolvedValue({ product: source });
        const publicRate = activeCatalogTier(catalogCardTiers(variant), quantity)?.unitPrice;
        const display = portalCatalogPrice(item().purchaseVariant, String(quantity));
        const [resolved] = await resolveDraftLines([{ sku: source.websiteSku, quantity }]);
        expect(display).toMatchObject({ quantity, unitPrice: rate, total: Math.round(rate * 100) * quantity / 100, error: null });
        expect(publicRate).toBe(rate); expect(resolved).toMatchObject({ ok: true, line: { sku: source.websiteSku, quantity, unitPrice: rate } });
    });
    it("shows 60 × $0.84 = $50.40 without using the group's cheaper starting price", () => {
        const html = renderToStaticMarkup(createElement(PortalCatalogPurchase, { item: item(), quantityText: "60", onQuantityChange: vi.fn(), onAdd: vi.fn(), pending: false, justAdded: false }));
        expect(html).toContain("$0.84 / ea"); expect(html).toContain("Add · $50.40"); expect(html).not.toContain("$0.10");
        expect(html).toContain("Pack of"); expect(html).toContain("12–143 · $0.84 / ea"); expect(html).toContain('value="12" selected');
    });
    it("never substitutes a sibling's ladder when the ordered SKU is missing", () => {
        const sibling = { ...source, id: "sibling", graceSku: "Other", websiteSku: "OTHER", webPrice1pc: .10, priceTiers: [{ minQty: 1, unitPrice: .10 }] };
        expect(item([sibling]).purchaseVariant).toBeNull();
        const html = renderToStaticMarkup(createElement(PortalCatalogPurchase, { item: item([sibling]), quantityText: "60", onQuantityChange: vi.fn(), onAdd: vi.fn(), pending: false, justAdded: false }));
        expect(html).toContain("View options and availability"); expect(html).not.toContain("Add ·");
    });
    it("matches the named SKU even when a cheaper sibling appears first", () => {
        const sibling = { ...source, id: "sibling", websiteSku: "OTHER", graceSku: "Other", webPrice1pc: .10 };
        expect(portalCatalogPrice(item([sibling, source]).purchaseVariant, "60").total).toBe(50.40);
    });
    it.each(["", "0", "-1", "1.5", "NaN", "100000"])("does not silently change invalid quantity %s", text => {
        const result = portalCatalogPrice(variant, text); expect(result.quantity).toBeNull(); expect(result.total).toBeNull(); expect(result.error).toBeTruthy();
    });
    it("retains the shared 12-piece fallback on older products", async () => {
        const legacy = { ...source, priceTiers: null }; query.mockResolvedValue({ product: legacy });
        expect(portalCatalogPrice({ ...variant, priceTiers: null }, "12").unitPrice).toBe(.84);
        expect(await resolveDraftLines([{ sku: source.websiteSku, quantity: 12 }])).toMatchObject([{ line: { unitPrice: .84 } }]);
    });
    it("server ignores a browser-injected price and re-resolves published pricing", async () => {
        query.mockResolvedValue({ product: source });
        const input = { sku: source.websiteSku, quantity: 60, unitPrice: .01 };
        expect(await resolveDraftLines([input])).toMatchObject([{ line: { quantity: 60, unitPrice: .84 } }]);
    });
});

import { describe, expect, it } from "vitest";
import { parseOrderList, resolveOrderListProduct } from "@/lib/grace/orderList";

describe("Grace order-list review", () => {
    it("parses reordered CSV headers and combines duplicate SKU quantities", () => {
        expect(parseOrderList('Quantity,Description,SKU\r\n12,"Bottle, clear",WEB-1\r\n144,Bottle,web-1')).toEqual([{ sku: "WEB-1", quantity: 156 }]);
    });
    it("accepts BOM-prefixed TSV copied from Excel without sending descriptive columns", () => {
        expect(parseOrderList('\uFEFFSKU\tQuantity\tNotes\nWEB-1\t12\tPrivate note')).toEqual([{ sku: "WEB-1", quantity: 12 }]);
    });
    it("accepts a headerless SKU and quantity list", () => {
        expect(parseOrderList('WEB-1,144\nWEB-2,12')).toHaveLength(2);
    });
    it.each(['WEB-1,0', 'WEB-1,-1', 'WEB-1,1.5', 'WEB-1,', 'WEB-1,1e3', 'WEB-1,100001', 'WEB-1,99999\nweb-1,2', 'WEB-1,=1+1'])('rejects unsafe quantities without silently defaulting or rounding: %s', text => {
        expect(() => parseOrderList(text)).toThrow("quantity");
    });
    it("rejects malformed, oversized and excessive-row lists", () => {
        expect(() => parseOrderList('SKU,Description\nWEB-1,Bottle')).toThrow("format");
        expect(() => parseOrderList('"WEB-1,1')).toThrow("format");
        expect(() => parseOrderList('"WEB-1"junk,1')).toThrow("format");
        expect(() => parseOrderList('=DANGEROUS(),1')).toThrow("format");
        expect(() => parseOrderList('a'.repeat(262145))).toThrow("tooLarge");
        expect(() => parseOrderList(Array.from({ length: 51 }, (_, i) => `WEB-${i},1`).join('\n'))).toThrow("tooMany");
    });
    const line = { sku: "WEB-1", quantity: 144 };
    const product = { graceSku: "GRACE-1", websiteSku: "WEB-1", itemName: "Test bottle", shopifyVariantId: "gid://shopify/ProductVariant/1", webPrice1pc: 1, webPrice12pc: .5, stockStatus: "In Stock" };
    it("keeps the actual checkout rate when preparing a confirmed cart proposal", () => {
        expect(resolveOrderListProduct(line, product)).toMatchObject({ graceSku: "GRACE-1", quantity: 144, unitPrice: 1 });
    });
    it.each([
        null, { ...product, websiteSku: "WEB-2" }, { ...product, checkoutEligible: false },
        { ...product, stockStatus: "Out of Stock" }, { ...product, stockStatus: "Discontinued" },
        { ...product, webPrice1pc: null }, { ...product, webPrice1pc: -1 },
    ])("does not propose unmatched, blocked, sold-out or unpriced lines", result => {
        expect(resolveOrderListProduct(line, result)).toBeNull();
    });
});

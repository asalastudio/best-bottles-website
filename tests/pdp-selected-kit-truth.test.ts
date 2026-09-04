import { describe, expect, it } from "vitest";
import { resolveSelectedSkuKit } from "../src/lib/products/pdp-selected-kit";

const kit = (sku: string) => ({ sku, parts: [{ slot: "cap" }] });

describe("selected-SKU kit truth", () => {
    it("does not carry Exploded capability from kit A while selected SKU B is pending or has no kit", () => {
        const selected = { websiteSku: "WEB-B", graceSku: "GRACE-B" };
        expect(resolveSelectedSkuKit(selected, undefined)).toBeNull();
        expect(resolveSelectedSkuKit(selected, null)).toBeNull();
        expect(resolveSelectedSkuKit(selected, kit("WEB-A"))).toBeNull();
    });

    it("restores the selected customer intent only when the arriving kit belongs to SKU B", () => {
        const selected = { websiteSku: "WEB-B", graceSku: "GRACE-B" };
        expect(resolveSelectedSkuKit(selected, kit("WEB-B"))?.parts).toHaveLength(1);
        expect(resolveSelectedSkuKit(selected, kit("GRACE-B"))?.parts).toHaveLength(1);
    });
});

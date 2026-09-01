import { describe, it, expect } from "vitest";
import {
    resolveCompatibility,
    isPurchasable,
    qaReason,
    type BottleFacts,
    type ComponentFacts,
} from "../src/lib/wholesale/compatibility";
import {
    summarizeOrder,
    priceLine,
    isValidQuantity,
    ORDER_MINIMUM_USD,
    type ConfigurationLine,
} from "../src/lib/wholesale/orderRules";

const bottle = (over: Partial<BottleFacts> = {}): BottleFacts => ({
    graceSku: "GB-CYL-AMB-9ML",
    family: "Cylinder",
    capacityMl: 9,
    neckThreadSize: "17-415",
    itemName: "9 ml Amber Cylinder",
    color: "Amber",
    stockStatus: null,
    shopifySellable: true,
    ...over,
});

const component = (over: Partial<ComponentFacts> = {}): ComponentFacts => ({
    graceSku: "SPR-17415-BLK",
    itemName: "Fine Mist Sprayer — Black",
    componentType: "Sprayer",
    neckThreadSize: "17-415",
    stockStatus: null,
    shopifySellable: true,
    ...over,
});

describe("compatibility precedence (PRD §39)", () => {
    it("matches an exact fitment", () => {
        const v = resolveCompatibility(bottle(), component());
        expect(v.compatible).toBe(true);
        expect(v.source).toBe("exact_fitment");
    });

    it("rejects a mismatched thread", () => {
        const v = resolveCompatibility(bottle(), component({ neckThreadSize: "18-415" }));
        expect(v.compatible).toBe(false);
        expect(v.source).toBe("exact_fitment");
        expect(v.reason).toContain("18-415");
    });

    it("treats UNKNOWN as incompatible, never as a guess", () => {
        const v = resolveCompatibility(
            bottle({ neckThreadSize: null }),
            component({ neckThreadSize: null }),
        );
        expect(v.compatible).toBe(false);
        expect(v.source).toBe("unknown");
    });

    it("lets explicit exclusion beat an exact thread match", () => {
        const v = resolveCompatibility(bottle(), component(), {
            excludedSkus: new Set(["SPR-17415-BLK"]),
        });
        expect(v.compatible).toBe(false);
        expect(v.source).toBe("explicit_exclusion");
    });

    it("honours explicit inclusion by component type", () => {
        const ok = resolveCompatibility(bottle(), component(), {
            allowedTypes: new Set(["Sprayer", "Cap"]),
        });
        expect(ok.compatible).toBe(true);
        expect(ok.source).toBe("explicit_inclusion");

        const no = resolveCompatibility(bottle(), component({ componentType: "Dropper" }), {
            allowedTypes: new Set(["Sprayer", "Cap"]),
        });
        expect(no.compatible).toBe(false);
    });

    it("falls back to family inference only when the component has no thread", () => {
        const v = resolveCompatibility(bottle(), component({ neckThreadSize: null }));
        expect(v.compatible).toBe(true);
        expect(v.source).toBe("family_inference");
    });

    it("gives QA a more specific reason than the customer sees", () => {
        const v = resolveCompatibility(
            bottle({ neckThreadSize: null }),
            component({ neckThreadSize: null }),
        );
        expect(v.reason).toBe("No compatible components are currently available.");
        expect(qaReason(v)).toBe("Compatibility mapping missing.");
    });
});

describe("purchasability", () => {
    it("blocks a row Shopify marks unsellable", () => {
        expect(isPurchasable({ stockStatus: null, shopifySellable: false })).toBe(false);
    });
    it("blocks discontinued stock", () => {
        expect(isPurchasable({ stockStatus: "Discontinued", shopifySellable: true })).toBe(false);
    });
    it("allows an unset status", () => {
        expect(isPurchasable({ stockStatus: null, shopifySellable: null })).toBe(true);
    });
});

describe("order rules — $50 minimum, no unit minimum", () => {
    const line = (over: Partial<ConfigurationLine> = {}): ConfigurationLine => ({
        bottleSku: "GB-CYL-AMB-9ML",
        componentSku: "SPR-17415-BLK",
        componentMode: "with_component",
        quantity: 12,
        bottlePrices: { webPrice1pc: 0.73, webPrice10pc: 0.71, webPrice12pc: 0.69 },
        componentPrices: { webPrice1pc: 0.5, webPrice10pc: 0.48, webPrice12pc: 0.45 },
        ...over,
    });

    it("prices at the CHARGED rate, not the tier Shopify won't honour", () => {
        // 12+ tier exists, but VOLUME_TIERS_HONORED_AT_CHECKOUT is off
        const { bottleUnitPrice, unitPrice } = priceLine(line());
        expect(bottleUnitPrice).toBe(0.73);
        expect(unitPrice).toBeCloseTo(1.23, 5);
    });

    it("omits component price for bottle_only", () => {
        const p = priceLine(line({ componentMode: "bottle_only", componentSku: null }));
        expect(p.componentUnitPrice).toBeNull();
        expect(p.unitPrice).toBe(0.73);
    });

    it("accepts ANY positive quantity — there is no unit minimum", () => {
        expect(isValidQuantity(1)).toBe(true);
        expect(isValidQuantity(7)).toBe(true);
        expect(isValidQuantity(0)).toBe(false);
        expect(isValidQuantity(2.5)).toBe(false);
    });

    it("enforces the $50 floor across the ORDER, not per line", () => {
        const small = summarizeOrder([line({ quantity: 10 })]);
        expect(small.meetsMinimum).toBe(false);
        expect(small.remainingToMinimum).toBeCloseTo(ORDER_MINIMUM_USD - 12.3, 2);

        const big = summarizeOrder([line({ quantity: 100 }), line({ quantity: 100 })]);
        expect(big.subtotal).toBeCloseTo(246, 2);
        expect(big.meetsMinimum).toBe(true);
        expect(big.remainingToMinimum).toBeNull();
    });

    it("refuses to treat an unpriced line as $0", () => {
        const totals = summarizeOrder([
            line(),
            line({ bottlePrices: { webPrice1pc: null }, componentPrices: null }),
        ]);
        expect(totals.subtotal).toBeNull();
        expect(totals.meetsMinimum).toBe(false);
    });

    it("counts units across every line", () => {
        expect(summarizeOrder([line({ quantity: 12 }), line({ quantity: 24 })]).totalUnits).toBe(36);
    });
});

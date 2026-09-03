import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const configurator = read("src/components/products/ConfiguratorPdp.tsx");
const pdp = read("src/app/products/[slug]/ProductDetailClient.tsx");

describe("focused PDP purchase panel", () => {
    it("keeps the above-fold buy panel inside one applicator intent", () => {
        expect(configurator).not.toContain("Closure Type");
        expect(configurator).not.toContain("const closureRow");
        expect(configurator).not.toContain("const ranked");
        expect(configurator).not.toContain("const commit =");
        expect(configurator).toContain("Glass Finish");
        expect(configurator).toContain("Roller ball");
        expect(configurator).toContain("Closure Finish");
        expect(configurator).not.toContain("Decoration");
    });

    it("uses one resolved variant for guided SKU, media, cart, and quote state", () => {
        expect(pdp).toContain("const selectedVariant = useMemo");
        expect(pdp).toContain("plateImage={selectedPlate?.image ?? null}");
        expect(pdp).toContain("priceEach={selectedVariant?.webPrice1pc");
        expect(pdp).toContain("websiteSku={selectedVariant?.websiteSku ?? null}");
        expect(pdp).toContain("onAddToCart={handleAddToCart}");
        expect(pdp).toContain("shopifySellable: selectedVariant.shopifySellable");
        expect(configurator).toContain("checkoutReady?: boolean");
        expect(configurator).toContain("Request Quote");
        expect(configurator).not.toContain("Request Sample");
    });

    it("keeps numeric quantity and case pricing adjacent to the purchase action", () => {
        expect(configurator).toContain('type="number"');
        expect(configurator).toContain('aria-label="Decrease quantity"');
        expect(configurator).toContain('aria-label="Increase quantity"');
        expect(configurator).toContain("Math.max(1");
        expect(configurator).toContain("caseQty");
        expect(configurator).toContain("/ea");
    });

    it("navigates real in-intent selections through the canonical PDP URL", () => {
        expect(configurator).toContain("onVariantSelectionChange?:");
        expect(pdp).toContain("handleGuidedVariantSelection");
        expect(pdp).toContain("const canonicalVariantUrl");
        expect(pdp).toContain("router.replace(nextUrl");
        expect(pdp).toContain("selectedVariantParam");
    });
});

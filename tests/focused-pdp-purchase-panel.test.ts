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

    it("uses the focused buy panel for classic Roll-On PDPs without requiring 3D media", () => {
        expect(pdp).toContain("const isFocusedPurchasePdp = is3dFamily || isRollonGroup");
        expect(pdp).toContain("{isFocusedPurchasePdp && group.slug ?");
        expect(pdp).toContain("{!isFocusedPurchasePdp ?");
        expect(configurator).toContain("activeBase === \"roller\"");
    });

    it("lets a valid URL SKU override and synchronize stale local selection state", () => {
        expect(pdp).toContain("const explicit = variantFromUrl ??");
        expect(pdp).toContain("setSelectedVariantId(variantFromUrl._id)");
        expect(pdp).toContain("if (!selectedVariantParam)");
    });

    it("canonically navigates to a deterministic real roller fallback when a finish is unavailable", () => {
        expect(pdp).toContain("const candidates = variants");
        expect(pdp).toContain("const resolved = nextCapOption");
        expect(pdp).toContain("resolveVariantCapFinish(variant).swatchName === nextCapOption");
        expect(pdp).toContain("?? candidates[0] ?? null");
        expect(pdp).toContain("router.replace(nextUrl");
    });

    it("never uses a group starting price as selected-SKU transaction price", () => {
        expect(pdp).toContain("priceEach={selectedVariant?.webPrice1pc ?? null}");
        expect(pdp).not.toContain("priceEach={selectedVariant?.webPrice1pc ?? group.priceRangeMin");
        expect(pdp).toContain("selectedVariant?.webPrice1pc != null");
    });
});

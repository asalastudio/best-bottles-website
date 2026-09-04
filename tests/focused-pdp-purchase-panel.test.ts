import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const configurator = read("src/components/products/ConfiguratorPdp.tsx");
const pdp = read("src/app/products/[slug]/ProductDetailClient.tsx");
const productPage = read("src/app/products/[slug]/page.tsx");

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

    it("uses the focused buy panel for any photo-backed real group without requiring 3D media", () => {
        expect(pdp).toContain('import { resolveFocusedPdpCapabilities } from "@/lib/products/focused-pdp-rollout"');
        expect(pdp).toContain("const focusedPdpCapabilities = useMemo(() => resolveFocusedPdpCapabilities({");
        expect(pdp).toContain("const isFocusedPurchasePdp = focusedPdpCapabilities.canRenderFocusedShell");
        expect(pdp).toContain("{isFocusedPurchasePdp && group.slug ?");
        expect(pdp).toContain("{!isFocusedPurchasePdp ?");
        expect(configurator).toContain("hasApproved3d = false");
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

    it("keeps a missing selected-variant price quote-only without fabricating zero pricing", () => {
        expect(configurator).not.toContain("priceEach ?? 0");
        expect(configurator).toContain("const tierPrice = priceEach");
        expect(configurator).toContain('"Price on request"');
        expect(configurator).toContain("caseQty && tierPrice != null");
        expect(configurator).toContain("checkoutReady ? (");
    });

    it("keeps glass, roller, and closure configuration above Add to Cart", () => {
        const step = configurator.slice(configurator.indexOf("const stepPanel"));
        expect(step.indexOf("{glassStep")).toBeGreaterThan(-1);
        expect(step.indexOf("{glassStep")).toBeLessThan(step.indexOf("{ctaStack}"));
        expect(step.indexOf("{rollerStep}")).toBeLessThan(step.indexOf("{ctaStack}"));
        expect(step.indexOf("{finishRow()")).toBeLessThan(step.indexOf("{ctaStack}"));
        expect(step).toContain('data-pdp-cta-cluster="above-fold"');
        expect(configurator).toContain("ctaAnchorRef");
        expect(pdp).toContain("ctaAnchorRef={inlineCartRef}");
    });

    it("keeps a volume teaser under Add to Cart and the full ladder below the fold", () => {
        expect(configurator).toContain("volumePricing?: ReactNode");
        expect(configurator).toContain('data-testid="pdp-volume-under-atc"');
        expect(configurator).toContain('aria-label={`Set quantity to one case of ${caseQty}`}');
        expect(configurator).not.toContain("const [tiersOpen");
        expect(configurator).not.toContain("ladder.map((t)");
        expect(pdp).toContain("volumePricing={<VolumeTeaser variant={selectedVariant} />}");
        expect(pdp).toContain('data-testid="pdp-volume-teaser"');
        expect(pdp).toContain('data-testid="pdp-volume-under-atc"');
        expect(pdp).toContain('data-testid="pdp-volume-fulfillment"');
        expect(pdp).toContain("<TierLadder variant={selectedVariant} qty={qty} onQtyChange={setQty} />");
        expect(pdp).toContain('data-testid="pdp-volume-tier-table"');
        expect(pdp).toContain("Price / unit");
        expect(pdp).toContain("formatVolumeQtyRange");
        expect(pdp).toContain("pdp-volume-case-shortcut");
    });

    it("builds primary glass choices from same-application groups rather than cross-application siblings", () => {
        expect(pdp).not.toContain("initialApplicatorSiblings");
        expect(pdp).not.toContain("applicationSiblings.find");
        expect(pdp).toContain("const sameApplicationGroups");
        expect(pdp).toContain("sameApplicationGroups.find");
        expect(productPage).not.toContain("getApplicatorSiblings");
        expect(productPage).not.toContain("initialApplicatorSiblings");
    });
});

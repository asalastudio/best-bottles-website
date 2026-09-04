import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    agenticHandoffHidesChat,
    GRACE_AGENTIC_HANDOFF_MESSAGE,
    graceCanMutatePdpPickers,
    isExplicitAutoNavigate,
    isGraceMobileViewport,
    isGraceProductPageHref,
    resolveCompanionModeOnOpen,
    shouldAutoNavigateFromGraceTool,
    shouldEnterAgenticOnProductLink,
    shouldAutoNavigateShowProducts,
    shouldEnterAgenticOnVoiceNavigation,
    shouldKeepPdpAnswersInChat,
    isDifferentGraceDestination,
} from "@/lib/grace/agenticHandoff";

describe("Grace mobile agentic handoff", () => {
    it("treats only real product paths as handoff links", () => {
        expect(isGraceProductPageHref("/products/cylinder-9ml-frosted-17-415-rollon?sku=WEB-9ML")).toBe(true);
        expect(isGraceProductPageHref("/products/")).toBe(false);
        expect(isGraceProductPageHref("/catalog?grace=1")).toBe(false);
        expect(isGraceProductPageHref("/")).toBe(false);
    });

    it("keeps PDP Q&A in chat unless they ask to go to a different product", () => {
        expect(shouldKeepPdpAnswersInChat("product", "pdp")).toBe(true);
        expect(shouldAutoNavigateFromGraceTool({ mode: "product", pageType: "pdp" })).toBe(false);
        expect(shouldAutoNavigateFromGraceTool({
            mode: "product",
            pageType: "pdp",
            autoNavigate: true,
        })).toBe(true);
        expect(shouldAutoNavigateFromGraceTool({
            mode: "product",
            pageType: "pdp",
            currentPageUrl: "/products/cylinder-9ml-clear-17-415-finemist",
            destination: "/products/cylinder-9ml-amber-17-415-rollon?sku=WEB-AMB",
        })).toBe(true);
        expect(shouldAutoNavigateFromGraceTool({
            mode: "product",
            pageType: "pdp",
            currentPageUrl: "/products/cylinder-9ml-cobalt-17-415-rollon",
            destination: "/products/cylinder-28ml-clear-18-415-rollon",
        })).toBe(true);
        expect(shouldAutoNavigateFromGraceTool({
            mode: "product",
            pageType: "pdp",
            autoNavigate: false,
            destination: "/products/cylinder-9ml-amber-17-415-rollon",
        })).toBe(false);
        expect(shouldAutoNavigateFromGraceTool({ mode: "agentic", pageType: "pdp" })).toBe(true);
        expect(shouldAutoNavigateFromGraceTool({ mode: "assist", pageType: "catalog" })).toBe(true);
        expect(isDifferentGraceDestination(
            "/products/cylinder-9ml-clear-17-415-finemist",
            "/products/cylinder-9ml-amber-17-415-rollon",
        )).toBe(true);
        expect(shouldAutoNavigateShowProducts({
            mode: "product",
            pageType: "pdp",
            currentPageUrl: "/products/cylinder-9ml-clear-17-415-finemist",
            destination: "/products/cylinder-9ml-amber-17-415-rollon?sku=WEB-AMB",
        })).toBe(true);
        expect(shouldAutoNavigateShowProducts({
            mode: "product",
            pageType: "pdp",
            currentPageUrl: "/products/cylinder-9ml-clear-17-415-finemist",
            destination: "/catalog?search=amber+roller&grace=1",
        })).toBe(false);
        expect(shouldEnterAgenticOnVoiceNavigation({
            href: "/products/cylinder-9ml-amber-17-415-rollon",
            viewportWidth: 390,
        })).toBe(true);
    });

    it("opens from a PDP in product mode and never downgrades an agentic session", () => {
        expect(resolveCompanionModeOnOpen("assist", "pdp")).toBe("product");
        expect(resolveCompanionModeOnOpen("agentic", "pdp")).toBe("agentic");
        expect(resolveCompanionModeOnOpen("product", "site")).toBe("product");
    });

    it("enters agentic mode only on a mobile product-link tap", () => {
        expect(shouldEnterAgenticOnProductLink({
            href: "/products/cylinder-9ml-frosted-17-415-rollon?sku=WEB-9ML",
            viewportWidth: 390,
        })).toBe(true);
        expect(shouldEnterAgenticOnProductLink({
            href: "/products/cylinder-9ml-frosted-17-415-rollon?sku=WEB-9ML",
            viewportWidth: 1440,
        })).toBe(false);
        expect(shouldEnterAgenticOnProductLink({
            href: "/catalog?grace=1",
            viewportWidth: 390,
        })).toBe(false);
        expect(isGraceMobileViewport(767)).toBe(true);
        expect(isGraceMobileViewport(768)).toBe(false);
        expect(agenticHandoffHidesChat()).toBe(true);
    });

    it("does not let Grace drive the live PDP cap or component pickers", () => {
        expect(graceCanMutatePdpPickers()).toBe(false);
        expect(isExplicitAutoNavigate("true")).toBe(true);
        expect(isExplicitAutoNavigate(false)).toBe(false);
    });

    it("approves voice when the mobile PDP opens Grace, then hands off from an in-chat product link", () => {
        const pdp = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        const card = readFileSync("src/components/grace/cards/GraceProductCard.tsx", "utf8");
        const launcher = readFileSync("src/components/grace/GraceLauncher.tsx", "utf8");

        expect(pdp).toContain("enableVoice: true");
        expect(pdp).toContain('source: "pdp"');
        expect(provider).toContain("followSurfacedProduct");
        expect(provider).toContain("enableVoiceFromGesture");
        expect(provider).toContain('setCompanionMode("agentic")');
        expect(card).toContain("followSurfacedProduct");
        expect(card).toContain("data-grace-product-handoff");
        expect(launcher).toContain("companionMode === \"agentic\"");
        expect(provider).toContain("GRACE_AGENTIC_HANDOFF_MESSAGE");
        expect(provider).toContain("Speak this once, then wait");
        expect(GRACE_AGENTIC_HANDOFF_MESSAGE).toContain("move you around the site");
    });
});

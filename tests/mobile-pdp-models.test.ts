import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGuidedVariant } from "@/lib/products/guided-variant-resolver";
import {
    buildMobileConfigRows,
    closureFinishLabels,
    confirmLabelFor,
} from "@/lib/products/mobile-pdp-config-rows";
import {
    mobilePdpToolbarPaddingTop,
    visualViewportOverlayTop,
} from "@/lib/products/mobile-pdp-chrome";
import {
    initialMobilePickerState,
    mobilePickerReducer,
    pickerHasPendingChange,
    sheetTopCss,
    sheetTopFromHero,
    type MobilePickerState,
} from "@/lib/products/mobile-pdp-picker";
import {
    STICKY_CTA_ANIMATION_MS,
    STICKY_CTA_TRIGGER_OFFSET_PX,
    stickyCtaFacts,
    stickyCtaRootMargin,
    stickyCtaVisible,
} from "@/lib/products/mobile-pdp-sticky-cta";
import {
    coerceMobileViewMode,
    getMobileViewModes,
    preferredViewForPicker,
} from "@/lib/products/mobile-pdp-view-modes";
import {
    DOUBLE_TAP_SCALE,
    IDENTITY_TRANSFORM,
    PINCH_MAX_SCALE,
    PINCH_MIN_SCALE,
    clampScale,
    clampTranslate,
    panBy,
    toggleDoubleTap,
    transformToCss,
    zoomAround,
} from "@/lib/products/pinch-zoom-math";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile PDP view modes", () => {
    it("only offers Cap On | Cap Off when the configured product has a cap-off asset", () => {
        expect(getMobileViewModes({ hasCapOffAsset: false }).map((m) => m.id)).toEqual(["assembled"]);
        expect(getMobileViewModes({ hasCapOffAsset: true }).map((m) => m.id)).toEqual(["assembled", "capOff"]);
        expect(getMobileViewModes({ hasCapOffAsset: false })[0]?.label).toBe("Product");
        expect(getMobileViewModes({ hasCapOffAsset: true })[0]?.label).toBe("Cap On");
        expect(getMobileViewModes({ hasCapOffAsset: true })[1]?.label).toBe("Cap Off");
    });

    it("falls back to the assembled view when a mode has no asset", () => {
        expect(coerceMobileViewMode("capOff", { hasCapOffAsset: false })).toBe("assembled");
        expect(coerceMobileViewMode("capOff", { hasCapOffAsset: true })).toBe("capOff");
        expect(coerceMobileViewMode("assembled", { hasCapOffAsset: true })).toBe("assembled");
    });

    it("picks the most informative view per picker and preserves the customer's view for glass", () => {
        const caps = { hasCapOffAsset: true };
        expect(preferredViewForPicker("roller", "assembled", caps)).toBe("capOff");
        expect(preferredViewForPicker("roller", "assembled", { hasCapOffAsset: false })).toBe("assembled");
        expect(preferredViewForPicker("capFinish", "capOff", caps)).toBe("assembled");
        expect(preferredViewForPicker("glass", "capOff", caps)).toBeNull();
        expect(preferredViewForPicker("glass", "assembled", caps)).toBeNull();
    });
});

describe("mobile PDP sticky Add to Cart trigger", () => {
    it("appears as the gap after the final component row opens at the bottom edge", () => {
        expect(stickyCtaVisible({ sentinelTop: 759, viewportBottom: 664 })).toBe(false);
        expect(stickyCtaVisible({ sentinelTop: 659, viewportBottom: 664 })).toBe(false);
        expect(stickyCtaVisible({ sentinelTop: 595, viewportBottom: 664 })).toBe(true);
        expect(stickyCtaVisible({ sentinelTop: 559, viewportBottom: 664 })).toBe(true);
        expect(stickyCtaVisible({ sentinelTop: -400, viewportBottom: 664 })).toBe(true);
        // Scrolling back above the boundary hides the bar again.
        expect(stickyCtaVisible({ sentinelTop: 596, viewportBottom: 664 })).toBe(false);
    });

    it("uses the visible viewport bottom when browser chrome changes height", () => {
        expect(stickyCtaVisible({ sentinelTop: 640, viewportBottom: 664 })).toBe(false);
        expect(stickyCtaVisible({ sentinelTop: 640, viewportBottom: 724 })).toBe(true);
        expect(stickyCtaVisible({ sentinelTop: 655, viewportBottom: 724 })).toBe(true);
    });

    it("includes the safe area so the bar never obscures the cap row", () => {
        expect(stickyCtaVisible({ sentinelTop: 580, viewportBottom: 664, triggerOffset: 103 })).toBe(false);
        expect(stickyCtaVisible({ sentinelTop: 561, viewportBottom: 664, triggerOffset: 103 })).toBe(true);
    });

    it("never competes with an open picker or the expanded viewer", () => {
        expect(stickyCtaVisible({ sentinelTop: 559, viewportBottom: 664, overlayOpen: true })).toBe(false);
    });

    it("uses geometry even on short pages and rejects missing viewport measurements", () => {
        expect(stickyCtaVisible({ sentinelTop: 500, viewportBottom: 664 })).toBe(true);
        expect(stickyCtaVisible({ sentinelTop: Number.NaN, viewportBottom: 664 })).toBe(false);
        expect(stickyCtaVisible({ sentinelTop: 500, viewportBottom: 0 })).toBe(false);
        expect(stickyCtaVisible({ sentinelTop: 500, viewportBottom: Number.NaN })).toBe(false);
    });

    it("keeps the trigger band and animation inside the PRD's envelope", () => {
        expect(stickyCtaRootMargin()).toBe(`0px 0px -${STICKY_CTA_TRIGGER_OFFSET_PX}px 0px`);
        expect(stickyCtaRootMargin(12.4)).toBe("0px 0px -12px 0px");
        expect(STICKY_CTA_ANIMATION_MS).toBeGreaterThanOrEqual(150);
        expect(STICKY_CTA_ANIMATION_MS).toBeLessThanOrEqual(220);
    });

    it("describes the bar with per-unit price, case quantity, and a non-default quantity", () => {
        expect(stickyCtaFacts({ priceEach: 0.73, caseQuantity: 724, qty: 1 })).toBe("$0.73/ea · 724/case");
        expect(stickyCtaFacts({ priceEach: 0.73, caseQuantity: 724, qty: 12 })).toBe("$0.73/ea · 724/case · Qty 12");
        expect(stickyCtaFacts({ priceEach: null, caseQuantity: 1, qty: 1 })).toBe("Price on request");
    });
});

describe("expanded viewer pinch-to-zoom geometry", () => {
    const container = { width: 400, height: 600 };

    it("clamps scale and keeps the content covering the container", () => {
        expect(clampScale(0.2)).toBe(PINCH_MIN_SCALE);
        expect(clampScale(99)).toBe(PINCH_MAX_SCALE);
        expect(clampTranslate({ scale: 1, tx: 50, ty: -50 }, container)).toEqual({ scale: 1, tx: 0, ty: 0 });
        expect(clampTranslate({ scale: 2, tx: 10, ty: -5000 }, container)).toEqual({ scale: 2, tx: 0, ty: -600 });
    });

    it("zooms around the anchor so the point under the fingers does not move", () => {
        const anchor = { x: 200, y: 300 };
        const zoomed = zoomAround(IDENTITY_TRANSFORM, 2, anchor, container);
        expect(zoomed).toEqual({ scale: 2, tx: -200, ty: -300 });
        // the content point under the anchor is unchanged
        const before = { x: (anchor.x - 0) / 1, y: (anchor.y - 0) / 1 };
        const after = { x: (anchor.x - zoomed.tx) / zoomed.scale, y: (anchor.y - zoomed.ty) / zoomed.scale };
        expect(after).toEqual(before);
    });

    it("pans within bounds and double-tap toggles between rest and inspection zoom", () => {
        const zoomed = zoomAround(IDENTITY_TRANSFORM, 2, { x: 200, y: 300 }, container);
        expect(panBy(zoomed, { x: -1000, y: 1000 }, container)).toEqual({ scale: 2, tx: -400, ty: 0 });
        const tapped = toggleDoubleTap(IDENTITY_TRANSFORM, { x: 0, y: 0 }, container);
        expect(tapped.scale).toBe(DOUBLE_TAP_SCALE);
        expect(tapped).toMatchObject({ tx: 0, ty: 0 });
        expect(toggleDoubleTap(tapped, { x: 0, y: 0 }, container)).toEqual(IDENTITY_TRANSFORM);
        expect(transformToCss({ scale: 2, tx: -10, ty: 5 })).toBe("translate(-10px, 5px) scale(2)");
    });
});

describe("mobile PDP chrome inset", () => {
    it("ignores invalid visualViewport offsets and rounds a real overlay", () => {
        expect(visualViewportOverlayTop(undefined)).toBe(0);
        expect(visualViewportOverlayTop(null)).toBe(0);
        expect(visualViewportOverlayTop(-12)).toBe(0);
        expect(visualViewportOverlayTop(Number.NaN)).toBe(0);
        expect(visualViewportOverlayTop(47.6)).toBe(48);
    });

    it("pads the toolbar by the larger of a minimum, safe-area, and the Safari overlay", () => {
        expect(mobilePdpToolbarPaddingTop(0)).toBe("max(0.75rem, env(safe-area-inset-top, 0px), 0px)");
        expect(mobilePdpToolbarPaddingTop(52)).toBe("max(0.75rem, env(safe-area-inset-top, 0px), 52px)");
    });
});

describe("mobile PDP sheet geometry", () => {
    it("uses the hero bottom when it is laid out, otherwise half the viewport", () => {
        expect(sheetTopFromHero(412, 844)).toBe(412);
        expect(sheetTopFromHero(0, 844)).toBe(Math.round(844 * 0.48));
        expect(sheetTopFromHero(4, 700)).toBe(Math.round(700 * 0.48));
        expect(sheetTopCss(412)).toBe("412px");
        expect(sheetTopCss(0)).toBe("48svh");
        expect(sheetTopCss(4)).toBe("48svh");
    });
});

describe("mobile PDP picker reducer", () => {
    const opened = (): MobilePickerState => mobilePickerReducer(
        initialMobilePickerState("assembled"),
        { type: "open", picker: "roller", committedId: "Metal Roller", preferredView: "capOff" },
    );

    it("opens on the committed option, switches to the preferred view, and remembers where it came from", () => {
        const state = opened();
        expect(state.activePicker).toBe("roller");
        expect(state.previewSelectionId).toBe("Metal Roller");
        expect(state.committedSelectionId).toBe("Metal Roller");
        expect(state.viewMode).toBe("capOff");
        expect(state.previousViewMode).toBe("assembled");
        expect(pickerHasPendingChange(state)).toBe(false);
    });

    it("preview never touches the committed snapshot; cancel discards it and restores the view", () => {
        const previewed = mobilePickerReducer(opened(), { type: "preview", id: "Plastic Roller" });
        expect(pickerHasPendingChange(previewed)).toBe(true);
        expect(previewed.committedSelectionId).toBe("Metal Roller");
        const cancelled = mobilePickerReducer(previewed, { type: "cancel" });
        expect(cancelled.activePicker).toBeNull();
        expect(cancelled.previewSelectionId).toBeNull();
        expect(cancelled.viewMode).toBe("assembled");
    });

    it("confirm closes the picker too — the caller commits through the existing resolver", () => {
        const confirmed = mobilePickerReducer(mobilePickerReducer(opened(), { type: "preview", id: "Plastic Roller" }), { type: "confirm" });
        expect(confirmed.activePicker).toBeNull();
        expect(confirmed.viewMode).toBe("assembled");
    });

    it("does not record a previous view when opening keeps the current one", () => {
        const state = mobilePickerReducer(initialMobilePickerState("capOff"), { type: "open", picker: "glass", committedId: "cobalt", preferredView: null });
        expect(state.previousViewMode).toBeNull();
        expect(state.viewMode).toBe("capOff");
        // an explicit view change while open sticks after close
        const changed = mobilePickerReducer(state, { type: "setView", view: "assembled" });
        expect(mobilePickerReducer(changed, { type: "cancel" }).viewMode).toBe("assembled");
    });

    it("ignores preview/confirm/cancel while nothing is open", () => {
        const idle = initialMobilePickerState();
        expect(mobilePickerReducer(idle, { type: "preview", id: "x" })).toBe(idle);
        expect(mobilePickerReducer(idle, { type: "confirm" })).toBe(idle);
        expect(mobilePickerReducer(idle, { type: "cancel" })).toBe(idle);
    });
});

describe("mobile PDP configuration rows", () => {
    it("turns single-option properties into facts, keeps physical order, and picks layouts", () => {
        const { rows, facts } = buildMobileConfigRows({
            closureBase: "roller",
            glass: { options: [{ id: "clear", label: "Clear" }], selectedId: "clear" },
            roller: { options: [{ id: "Metal Roller", label: "Metal" }, { id: "Plastic Roller", label: "Plastic" }], selectedId: "Metal Roller" },
            capFinish: {
                options: ["Black", "White", "Gold", "Silver", "Pink", "Blue", "Green"].map((name) => ({ id: name, label: name })),
                selectedId: "Gold",
            },
        });
        expect(facts).toEqual([{ label: "Glass Finish", value: "Clear" }]);
        expect(rows.map((row) => row.picker)).toEqual(["roller", "capFinish"]);
        expect(rows[0]?.layout).toBe("cards");
        expect(rows[1]?.layout).toBe("grid");
        expect(rows[1]?.label).toBe("Cap Color");
    });

    it("uses a stacked list for short finish sets and family-specific closure wording", () => {
        const { rows } = buildMobileConfigRows({
            closureBase: "sprayer",
            capFinish: { options: [{ id: "Gold", label: "Gold" }, { id: "Silver", label: "Silver" }], selectedId: null },
        });
        expect(rows[0]?.layout).toBe("list");
        expect(rows[0]?.title).toBe("Select Sprayer Finish");
        expect(rows[0]?.selectedId).toBe("Gold");
        expect(closureFinishLabels("dropper").label).toBe("Dropper Finish");
        expect(closureFinishLabels("antique").label).toBe("Closure Finish");
    });

    it("names the confirm button after the previewed option", () => {
        const { rows } = buildMobileConfigRows({
            closureBase: "roller",
            glass: { options: [{ id: "cobalt", label: "Cobalt Blue" }, { id: "amber", label: "Amber" }], selectedId: "cobalt" },
        });
        expect(confirmLabelFor(rows[0]!, null)).toBe("Select Glass");
        expect(confirmLabelFor(rows[0]!, "amber")).toBe("Select Amber");
    });
});

describe("guided variant resolver", () => {
    type V = { sku: string; app: string | null; finish: string };
    const deps = { sku: (v: V) => v.sku, capFinish: (v: V) => v.finish, applicator: (v: V) => v.app };
    const variants: V[] = [
        { sku: "B-metal-gold", app: "Metal Roller", finish: "Gold" },
        { sku: "A-metal-silver", app: "Metal Roller", finish: "Silver" },
        { sku: "C-plastic-gold", app: "Plastic Roller", finish: "Gold" },
    ];

    it("matches applicator + finish, else the deterministic first candidate by SKU", () => {
        expect(resolveGuidedVariant(variants, { applicator: "Metal Roller", capOption: "Gold" }, deps)?.sku).toBe("B-metal-gold");
        expect(resolveGuidedVariant(variants, { applicator: "Plastic Roller", capOption: "Silver" }, deps)?.sku).toBe("C-plastic-gold");
        expect(resolveGuidedVariant(variants, { applicator: "Metal Roller", capOption: null }, deps)?.sku).toBe("A-metal-silver");
        expect(resolveGuidedVariant(variants, { applicator: "Dropper", capOption: "Gold" }, deps)).toBeNull();
    });
});

describe("mobile PDP wiring", () => {
    const pdp = read("src/app/products/[slug]/ProductDetailClient.tsx");
    const mobile = read("src/components/products/mobile/MobileProductPdp.tsx");
    const sheet = read("src/components/products/mobile/ProductOptionSheet.tsx");

    it("renders both trees CSS-gated at the md breakpoint and commits through the existing handlers", () => {
        expect(pdp).toContain('<div className="md:hidden">');
        expect(pdp).toContain("<MobileProductPdp");
        expect(pdp).toContain("onCommitVariant={handleGuidedVariantSelection}");
        expect(pdp).toContain("onCommitGlass={handleGuidedProductUrlChange}");
        expect(pdp).toContain("onAddToCart={handleAddToCart}");
        expect(pdp).toContain('data-mobile-pdp={isFocusedPurchasePdp ? "focused" : undefined}');
    });

    it("gives Grace an inline entry in the purchase block since the tab bar is hidden here", () => {
        expect(pdp).toContain("onAskGrace={openGraceFromMobilePdp}");
        expect(pdp).toContain("analytics.graceMobilePdpOpened({");
        expect(mobile).toContain('data-testid="mobile-pdp-ask-grace"');
        expect(mobile).not.toMatch(/fixed[^"]*data-testid="mobile-pdp-ask-grace"/);
        // The row lives in the identity block after quantity, before the details disclosures — never floating.
        const purchase = mobile.indexOf('data-testid="mobile-pdp-purchase"');
        const quantity = mobile.indexOf('aria-label="Quantity"', purchase);
        const grace = mobile.indexOf('data-testid="mobile-pdp-ask-grace"', quantity);
        const details = mobile.indexOf("<MobileProductDetails", grace);
        expect(purchase).toBeGreaterThan(-1);
        expect(quantity).toBeGreaterThan(purchase);
        expect(grace).toBeGreaterThan(quantity);
        expect(details).toBeGreaterThan(grace);
        expect(mobile).toContain("onClick={onAskGrace}");
        expect(mobile).not.toContain("openPanel({ anchor");
        expect(pdp).toContain("openGraceFromPdp({ enableVoice: true });");
        expect(pdp).toContain('openGracePanel({ source: "pdp", enableVoice: options?.enableVoice });');
        const drawer = read("src/components/grace/GraceChatDrawer.tsx");
        expect(drawer).toContain('height: "100dvh"');
        expect(drawer).toContain('background: "rgba(29, 29, 31, 0.35)"');
        expect(drawer).not.toContain("measureGraceDockedSheet");
        expect(drawer).not.toContain("visualViewport");
    });

    it("hides route chrome only below the breakpoint and only while mounted", () => {
        expect(mobile).toContain("@media (max-width: 767px)");
        expect(mobile).toContain("[data-site-header],[data-mobile-tab-bar]{display:none}");
        expect(read("src/components/Navbar.tsx")).toContain('data-site-header=""');
        expect(read("src/components/mobile/MobileTabBar.tsx")).toContain('data-mobile-tab-bar=""');
    });

    it("keeps the picker a real modal dialog that cancels on dismissal and never closes from a hero tap", () => {
        expect(sheet).toContain('from "@radix-ui/react-dialog"');
        expect(sheet).toContain("modal={false}");
        expect(sheet).toContain("onOpenChange={(next) => { if (!next) onCancel(); }}");
        expect(sheet).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
        expect(sheet).toContain("onEscapeKeyDown={() => onCancel()}");
        expect(sheet).toContain("style={{ top: sheetTop }}");
        expect(sheet).toContain("sheetTopCss");
        expect(sheet).not.toContain("scrollIntoView");
        expect(sheet).not.toContain("inset-0 z-[69]");
    });

    it("measures the picker sheet after paint instead of setState in the effect body", () => {
        expect(mobile).toContain("requestAnimationFrame(measureSheetTop)");
        expect(mobile).toContain("cancelAnimationFrame(frame)");
        expect(mobile).not.toMatch(/if \(!picker\.activePicker\) return;\s*measureSheetTop\(\);/);
    });

    it("does not decode a kit on every preview tap", () => {
        expect(mobile).not.toContain("previewKitQuery");
        expect(mobile).not.toContain("previewSiblingKitQuery");
        expect(mobile).toContain("picker.activePicker === \"glass\"");
        expect(mobile).toContain("const previewing = Boolean");
    });

    it("gives the bottle a real toolbar above the plate so the cap is not under the chrome", () => {
        const hero = read("src/components/products/mobile/MobileProductHero.tsx");
        expect(hero).toContain('data-testid="mobile-pdp-hero-toolbar"');
        expect(hero).toContain("sticky top-0");
        expect(hero).toContain("mobilePdpToolbarPaddingTop");
        expect(hero).toContain("visualViewport");
        expect(hero).not.toContain("pointer-events-none absolute inset-x-2 top-2");
        expect(mobile).toContain("useLayoutEffect");
        expect(mobile).toContain('window.history.scrollRestoration = "manual"');
        expect(read("src/app/globals.css")).toContain("body:has(main[data-mobile-pdp]) [data-site-header]");
        expect(read("src/app/globals.css")).toContain("html:has(main[data-mobile-pdp])");
        expect(read("src/app/globals.css")).toContain("overflow-anchor: none");
        expect(read("src/app/globals.css")).toContain("html:has(main[data-mobile-picker-open])");
        expect(read("src/app/globals.css")).toContain("overscroll-behavior: none");
    });

    it("puts configure under the bottle with a heading and Change label, not a spec list", () => {
        const config = read("src/components/products/mobile/MobileConfigurationSummary.tsx");
        expect(config).toContain("Configure this bottle");
        expect(config).toContain("Tap a row to change an option");
        expect(config).toContain("Change");
        expect(config).toContain("other option");
        const hero = mobile.indexOf("<MobileProductHero");
        const configure = mobile.indexOf("<MobileConfigurationSummary");
        const sentinel = mobile.indexOf('data-testid="mobile-pdp-cta-sentinel"');
        const title = mobile.indexOf('id="mobile-pdp-title"');
        expect(hero).toBeGreaterThan(-1);
        expect(configure).toBeGreaterThan(hero);
        // Nothing (no title, no price) sits between the stage and the configurator.
        expect(mobile.slice(hero, configure)).not.toContain("mobile-pdp-title");
        expect(mobile.slice(hero, configure)).not.toContain("mobile-pdp-price");
        // The sentinel is immediately after the final configurator row.
        expect(sentinel).toBeGreaterThan(configure);
        expect(title).toBeGreaterThan(sentinel);
    });

    it("keeps the stage to a single View Larger control and moves Cap Off / Dimensions out of it", () => {
        const hero = read("src/components/products/mobile/MobileProductHero.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
        expect(hero).toContain('data-testid="mobile-pdp-view-larger"');
        expect(hero).toContain("View Larger");
        expect(hero).not.toContain("Cap On");
        expect(hero).not.toContain("Cap Off");
        expect(hero).not.toContain("Dimensions");
        expect(hero).not.toContain("PdpDimensionsPanel");
        expect(mobile).not.toContain("ProductViewSelector");
        expect(mobile).not.toContain("sessionStorage");
        expect(mobile).toContain("onViewLarger={openViewer}");
    });

    it("opens a full-screen viewer that shares the configured bottle and offers Cap On | Cap Off", () => {
        const viewer = read("src/components/products/mobile/MobileProductViewer.tsx");
        expect(viewer).toContain('from "@radix-ui/react-dialog"');
        expect(viewer).toContain("modal={false}");
        expect(viewer).toContain('data-testid="mobile-pdp-viewer-close"');
        expect(viewer).toContain('data-testid="mobile-pdp-viewer-cap-toggle"');
        expect(viewer).toContain('role="radiogroup"');
        expect(viewer).toContain("touch-none");
        expect(viewer).toContain("onPointerDown");
        expect(viewer).toContain("zoomAround");
        expect(viewer).toContain("<PaperDollLayers");
        // The viewer paints the same shown variant / plate the stage does, with its own cap state.
        expect(mobile).toContain("const viewerMode = coerceMobileViewMode(viewerView, viewCaps)");
        expect(mobile).toContain("viewerOpen ? plateUrlFor(viewerMode) : null");
        expect(mobile).toContain("viewerOpen ? shownKitQuery : undefined");
        expect(mobile).toContain("onRestoreFocus={restoreViewerFocus}");
        // No scroll repositioning around open/close: the page is never moved.
        expect(viewer).not.toContain("scrollTo");
        expect(mobile).not.toMatch(/openViewer[\s\S]{0,200}scrollTo/);
    });

    it("drives the sticky Add to Cart from a sentinel after the last configurator row with an IntersectionObserver", () => {
        const bar = read("src/components/products/mobile/MobileStickyPurchaseBar.tsx");
        expect(mobile).toContain("new IntersectionObserver(");
        expect(mobile).toContain("rootMargin: stickyCtaRootMargin()");
        expect(mobile).toContain("stickyCtaVisible({ sentinelTop, viewportBottom, triggerOffset, overlayOpen })");
        expect(mobile).not.toMatch(/setStickyVisible\([^)]*window\.scrollY\s*[<>]/);
        expect(mobile).toContain("<MobileStickyPurchaseBar");
        expect(mobile).toContain("visible={stickyVisible && !overlayOpen}");
        // Same canonical props as the configurator: no duplicated product state in the bar.
        expect(bar).not.toContain("useState");
        expect(bar).not.toContain("useQuery");
        expect(bar).toContain('data-testid="mobile-pdp-add-to-cart"');
        expect(bar).toContain('data-testid="mobile-pdp-request-quote"');
        expect(bar).toContain("env(safe-area-inset-bottom, 0px)");
        expect(bar).toContain("translateY(100%)");
        expect(bar).toContain("STICKY_CTA_ANIMATION_MS");
        expect(bar).toContain("inert={!visible}");
        expect(bar).toContain("h-[68px]");
        // Keep one mobile purchase action, with quantity and Grace in the page.
        const purchase = mobile.slice(mobile.indexOf('data-testid="mobile-pdp-purchase"'), mobile.indexOf("<MobileProductDetails"));
        expect(purchase).not.toContain('data-testid="mobile-pdp-inline-add-to-cart"');
        expect(purchase).not.toContain('data-testid="mobile-pdp-inline-request-quote"');
        expect(purchase).not.toContain("onClick={onAddToCart}");
        expect(purchase).toContain('data-testid="mobile-pdp-ask-grace"');
        expect(purchase).toContain('aria-label="Quantity"');
    });

    it("folds secondary information into disclosures on mobile and hides the desktop sections below md", () => {
        const details = read("src/components/products/mobile/MobileProductDetails.tsx");
        expect(details).toContain("<details");
        expect(details).toContain("<summary");
        for (const label of ["Specifications", "Dimensions", "Volume Pricing", "Compatible Components", "Uses & Applications", "Shipping & Fulfillment"]) {
            expect(details).toContain(`label: "${label}"`);
        }
        expect(details).toContain('testId: "mobile-pdp-volume-pricing"');
        expect(details).toContain("useDiscoveryCompatibility(");
        expect(pdp).toContain('<div className={isFocusedPurchasePdp ? "hidden md:block" : undefined} data-testid="pdp-desktop-secondary">');
        expect(pdp).toContain("volumePricing={<TierLadder variant={selectedVariant} qty={qty} compact onQtyChange={setQty} />}");
        expect(pdp).toContain("onAddComponent={handleAddCompatibleComponent}\n                        />");
        // Desktop still renders the full discovery rail through the shared blocks.
        const discovery = read("src/components/products/PdpDiscoverySections.tsx");
        expect(discovery).toContain("export function PdpCompatibleComponentList");
        expect(discovery).toContain("export function useDiscoveryCompatibility");
        expect(discovery).toContain('data-testid="pdp-discovery-sections"');
    });

    it("never starts a 3D or GLB warm-up for the hidden desktop stage on mobile", () => {
        const configurator = read("src/components/products/ConfiguratorPdp.tsx");
        expect(configurator).toContain('if (saved === "3d" && viewportIsMobile()) return;');
        expect(configurator).toContain("if (viewportIsMobile()) return;\n    const ids = new Set<string>([fam.bodyDefault]);");
    });

    it("removes obstructive previewing badge and prevents confirm button disablement", () => {
        expect(mobile).toContain("overlay={null}");
        expect(mobile).not.toContain("Previewing ·");
        expect(mobile).toContain("confirmDisabled={!activeRow}");
        expect(mobile).not.toContain("previewSibling?.pending");
        expect(sheet).toContain("touch-manipulation");
        expect(sheet).toContain("data-testid=\"mobile-pdp-sheet-confirm\"");
    });

    it("commits chosen option reliably and passes applicator and sku context", () => {
        expect(mobile).toContain("onCommitVariant({ rollerVariant: material, applicator: chosen })");
        expect(mobile).toContain("const href = sku ? `${option.href}?sku=${encodeURIComponent(sku)}` : option.href");
        expect(pdp).toContain("selection.applicator ?? (selection.rollerVariant");
    });
});

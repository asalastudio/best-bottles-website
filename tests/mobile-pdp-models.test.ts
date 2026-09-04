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
    initialMobilePickerState,
    mobilePickerReducer,
    pickerHasPendingChange,
    type MobilePickerState,
} from "@/lib/products/mobile-pdp-picker";
import {
    coerceMobileViewMode,
    getMobileViewModes,
    preferredViewForPicker,
} from "@/lib/products/mobile-pdp-view-modes";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile PDP view modes", () => {
    it("only offers views the configured product can render", () => {
        expect(getMobileViewModes({ hasCapOffAsset: false, hasDimensions: false }).map((m) => m.id)).toEqual(["assembled"]);
        expect(getMobileViewModes({ hasCapOffAsset: true, hasDimensions: true }).map((m) => m.id)).toEqual(["assembled", "capOff", "dimensions"]);
        expect(getMobileViewModes({ hasCapOffAsset: false, hasDimensions: true })[0]?.label).toBe("Product");
        expect(getMobileViewModes({ hasCapOffAsset: true, hasDimensions: false })[0]?.label).toBe("Cap On");
    });

    it("falls back to the assembled view when a stored mode has no asset", () => {
        expect(coerceMobileViewMode("capOff", { hasCapOffAsset: false, hasDimensions: true })).toBe("assembled");
        expect(coerceMobileViewMode("dimensions", { hasCapOffAsset: true, hasDimensions: false })).toBe("assembled");
        expect(coerceMobileViewMode("capOff", { hasCapOffAsset: true, hasDimensions: false })).toBe("capOff");
    });

    it("picks the most informative view per picker and preserves the customer's view for glass", () => {
        const caps = { hasCapOffAsset: true, hasDimensions: true };
        expect(preferredViewForPicker("roller", "assembled", caps)).toBe("capOff");
        expect(preferredViewForPicker("roller", "assembled", { ...caps, hasCapOffAsset: false })).toBe("assembled");
        expect(preferredViewForPicker("capFinish", "capOff", caps)).toBe("assembled");
        expect(preferredViewForPicker("glass", "capOff", caps)).toBeNull();
        expect(preferredViewForPicker("glass", "dimensions", caps)).toBe("assembled");
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
        // The row lives between Add to Cart and volume pricing, never floating.
        const purchase = mobile.indexOf('data-testid="mobile-pdp-add-to-cart"');
        const grace = mobile.indexOf('data-testid="mobile-pdp-ask-grace"', purchase);
        const volume = mobile.indexOf('data-testid="mobile-pdp-volume-pricing"', grace);
        expect(purchase).toBeGreaterThan(-1);
        expect(grace).toBeGreaterThan(purchase);
        expect(volume).toBeGreaterThan(grace);
        expect(mobile).toContain("openPanel({ anchor: { element: heroRef.current } })");
        expect(mobile).toContain("bringHeroToTop");
        const mobileOpen = pdp.slice(pdp.indexOf("const openGraceFromMobilePdp"), pdp.indexOf("}, [customerDisplayName"));
        expect(mobileOpen).not.toContain("openGracePanel");
        expect(mobileOpen).not.toContain("openGraceFromPdp");
        const drawer = read("src/components/grace/GraceChatDrawer.tsx");
        expect(drawer).toContain("measureGraceDockedSheet");
        expect(drawer).toContain('"grace-pdp-sheet"');
        expect(drawer).toContain("visualViewport");
        const context = read("src/components/GraceContext.ts");
        expect(context).toContain("openPanel: (options?: GracePanelOpenOptions) => void");
        expect(read("src/components/grace/GraceProvider.tsx")).toContain("options?: GracePanelOpenOptions");
    });

    it("hides route chrome only below the breakpoint and only while mounted", () => {
        expect(mobile).toContain("@media (max-width: 767px)");
        expect(mobile).toContain("[data-site-header],[data-mobile-tab-bar]{display:none}");
        expect(read("src/components/Navbar.tsx")).toContain('data-site-header=""');
        expect(read("src/components/mobile/MobileTabBar.tsx")).toContain('data-mobile-tab-bar=""');
    });

    it("keeps the picker a real modal dialog that cancels on dismissal and never closes from a hero tap", () => {
        expect(sheet).toContain('from "@radix-ui/react-dialog"');
        expect(sheet).toContain("onOpenChange={(next) => { if (!next) onCancel(); }}");
        expect(sheet).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
        expect(sheet).toContain("onEscapeKeyDown={() => onCancel()}");
        expect(sheet).toContain("top: `${Math.max(0, Math.round(top))}px`");
    });

    it("never starts a 3D or GLB warm-up for the hidden desktop stage on mobile", () => {
        const configurator = read("src/components/products/ConfiguratorPdp.tsx");
        expect(configurator).toContain('if (saved === "3d" && viewportIsMobile()) return;');
        expect(configurator).toContain("if (viewportIsMobile()) return;\n    const ids = new Set<string>([fam.bodyDefault]);");
    });
});

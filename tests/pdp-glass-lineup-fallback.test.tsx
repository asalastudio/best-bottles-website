// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import PdpStage from "@/components/pdp/PdpStage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;

// 2026-11-07: the frosted 28 ml roll-on has no photograph yet. Its lineup tile was a 40×96 bottle-shaped block of the
// frosted texture, which read as a metal part beside the clear bottle.
describe("glass lineup without a photograph", () => {
    it("draws a round material swatch in a thumbnail-high slot, and the photographed glass as its bottle", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        await act(async () => {
            root.render(createElement(PdpStage, {
                pickLine: "Clear · Black", view: "sidecar", availableViews: ["sidecar"], onViewChange: vi.fn(), kit: null, context: {},
                fallbackImageUrls: ["https://example.test/bottle.png"], fallbackBodyImageUrl: null, fallbackAlt: "28 ml clear cylinder",
                callouts: [], caps: [], activeCapId: null, onCapPick: vi.fn(), onGlassPick: vi.fn(), activeCapName: null, activeGlassLabel: "Clear",
                glasses: [
                    { slug: "cylinder-28ml-clear-16mm-rollon", label: "Clear", active: true, kit: null, imageUrl: "https://example.test/clear-28.png" },
                    { slug: "cylinder-28ml-frosted-16mm-rollon", label: "Frosted", active: false, kit: null },
                ],
            }));
        });
        const lineup = host.querySelector("[data-testid='pdp-glass-lineup']")!;
        const clear = lineup.querySelector("[data-glass-slug='cylinder-28ml-clear-16mm-rollon']")!;
        const frosted = lineup.querySelector("[data-glass-slug='cylinder-28ml-frosted-16mm-rollon']")!;
        expect(clear.querySelector("img")).not.toBeNull();
        expect(clear.querySelector("[data-glass-fallback]")).toBeNull();
        const slot = frosted.querySelector<HTMLElement>("[data-glass-fallback='swatch']")!;
        expect(slot).not.toBeNull();
        expect(slot.style.height).toBe("96px");
        const dot = slot.firstElementChild as HTMLElement;
        expect(dot.style.backgroundImage).toContain("/assets/glass-swatches/frosted-v1.webp");
        expect(frosted.textContent).toContain("Frosted");
        await act(async () => root.unmount());
        host.remove();
    });
});

// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import PdpStage from "@/components/pdp/PdpStage";
import { DEFAULT_ZOOM_ORIGIN, STAGE_ZOOM, zoomOriginAt } from "@/lib/products/pdp-redesign/stage-zoom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia; the stage asks it whether to use the phone layout.
window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;

describe("zoom origin", () => {
    const box = { left: 100, top: 50, width: 400, height: 500 };

    it("is the pointer's place in the stage, in percent", () => {
        expect(zoomOriginAt(300, 300, box)).toEqual({ xPct: 50, yPct: 50 });
        expect(zoomOriginAt(100, 50, box)).toEqual({ xPct: 0, yPct: 0 });
    });

    it("stays inside the stage when the pointer leaves it", () => {
        expect(zoomOriginAt(0, 900, box)).toEqual({ xPct: 0, yPct: 100 });
        expect(zoomOriginAt(300, 300, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ xPct: 50, yPct: 50 });
    });
});

describe("the canvas magnifier", () => {
    function renderStage(view: "sidecar" | "capon" = "sidecar") {
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        const props = {
            pickLine: "Clear · Shiny Black", view, availableViews: ["sidecar", "capon"] as ("sidecar" | "capon")[],
            onViewChange: vi.fn(), kit: null, context: {}, fallbackImageUrls: ["https://example.test/bottle.png"],
            fallbackBodyImageUrl: null, fallbackAlt: "5 ml clear cylinder", callouts: [], caps: [], activeCapId: null,
            onCapPick: vi.fn(), glasses: [], onGlassPick: vi.fn(), activeCapName: null, activeGlassLabel: "Clear",
        };
        return { host, root, props };
    }
    const pointer = (target: Element, type: string, x: number, y: number) =>
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));

    it("zooms where the bottle is clicked, pans with the pointer and zooms out on a second click or Escape", async () => {
        const { host, root, props } = renderStage();
        await act(async () => { root.render(createElement(PdpStage, props)); });
        const stage = host.querySelector<HTMLElement>("[data-testid='pdp-stage']")!;
        const layer = host.querySelector<HTMLElement>("[data-testid='pdp-stage-zoom']")!;
        stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
        expect(stage.dataset.zoomable).toBe("true");

        await act(async () => { pointer(stage, "pointerdown", 50, 100); pointer(stage, "pointerup", 50, 100); });
        expect(stage.dataset.zoomed).toBe("true");
        expect(layer.style.transform).toBe(`scale(${STAGE_ZOOM})`);
        expect(layer.style.transformOrigin).toBe("25% 25%");

        await act(async () => { pointer(stage, "pointermove", 150, 300); });
        expect(layer.style.transformOrigin).toBe("75% 75%");

        // a drag is a pan, not a tap: it does not zoom out
        await act(async () => { pointer(stage, "pointerdown", 150, 300); pointer(stage, "pointermove", 170, 330); pointer(stage, "pointerup", 170, 330); });
        expect(stage.dataset.zoomed).toBe("true");

        await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
        expect(stage.dataset.zoomed).toBeUndefined();
        expect(layer.style.transform).toBe("");

        await act(async () => { pointer(stage, "pointerdown", 100, 200); pointer(stage, "pointerup", 100, 200); });
        await act(async () => { pointer(stage, "pointerdown", 100, 200); pointer(stage, "pointerup", 100, 200); });
        expect(stage.dataset.zoomed).toBeUndefined();

        await act(async () => { root.unmount(); });
        host.remove();
    });

    it("has a lens button that zooms to the neck and back, and a new view starts unzoomed", async () => {
        const { host, root, props } = renderStage();
        await act(async () => { root.render(createElement(PdpStage, props)); });
        const button = host.querySelector<HTMLButtonElement>("[data-testid='pdp-zoom']")!;
        const layer = host.querySelector<HTMLElement>("[data-testid='pdp-stage-zoom']")!;
        expect(button.getAttribute("aria-label")).toBe("Zoom in");

        await act(async () => { button.click(); });
        expect(button.getAttribute("aria-pressed")).toBe("true");
        expect(layer.style.transformOrigin).toBe(`${DEFAULT_ZOOM_ORIGIN.xPct}% ${DEFAULT_ZOOM_ORIGIN.yPct}%`);

        await act(async () => { root.render(createElement(PdpStage, { ...props, view: "capon" })); });
        expect(host.querySelector<HTMLElement>("[data-testid='pdp-stage']")!.dataset.zoomed).toBeUndefined();

        await act(async () => { root.unmount(); });
        host.remove();
    });
});

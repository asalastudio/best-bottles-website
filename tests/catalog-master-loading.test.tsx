// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import CylinderMasterPreview from "@/components/products/CylinderMasterPreview";
import approved from "@/lib/paper-doll/approved-kits.generated.json";
// The master route answers with the kit and its delivery copies; this mock returns the kit alone, so register the
// server-side manifest the way the route would have.
import "@/lib/products/display-derivative.server";
vi.mock("server-only", () => ({}));

it("defers offscreen recipe and image requests, then loads the same registered master near the viewport", async () => {
    let enter: IntersectionObserverCallback;
    const observe = vi.fn(), disconnect = vi.fn();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("IntersectionObserver", class {
        constructor(callback: IntersectionObserverCallback) { enter = callback; }
        observe = observe;
        disconnect = disconnect;
    });
    const kit = approved.rows.GBSleek8SpryGlMatt;
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ kit }) }));
    vi.stubGlobal("fetch", fetcher);
    const el = document.createElement("div"); document.body.append(el);
    const root = createRoot(el);
    try {
        await act(async () => root.render(<CylinderMasterPreview sku={kit.sku} title="8 ml Sleek" fallback={<span>Fallback</span>} />));
        expect(observe).toHaveBeenCalledOnce();
        expect(fetcher).not.toHaveBeenCalled();
        expect(el.querySelector("image")).toBeNull();
        await act(async () => { enter([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
        expect(fetcher).toHaveBeenCalledOnce();
        expect(disconnect).toHaveBeenCalled();
        expect(el.querySelector("svg")?.getAttribute("data-bb-master-sku")).toBe(kit.sku);
        for (const image of el.querySelectorAll("image")) {
            expect(image.getAttribute("href")).toContain("/product-display/v1/");
            expect(image.getAttribute("data-bb-master-source")).toContain("/reviewed-master-media/");
        }
    } finally {
        act(() => root.unmount()); el.remove(); vi.unstubAllGlobals();
    }
});

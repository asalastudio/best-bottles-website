// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import { previewParts, type BuilderConfiguration, type BuilderKit, type BuilderPart } from "@/lib/bottle-builder/model";

const asset = (url: string) => ({ url, key: url, sha256: url, bytes: 1000, width: 1000, height: 1100 });

function part(slot: BuilderPart["slot"], bounds: BuilderPart["bounds"], zOrder: number): BuilderPart {
    return {
        slot, variantKey: slot, zOrder, explodeIndex: zOrder, assembled: { x: 0, y: 0 },
        bounds, exploded: { dx: 0, dy: 0 }, image: asset(`https://blob.example/${slot}.webp`),
        image2x: null, mask: null, derivation: "psd-layer",
    };
}

const kit = {
    sku: "GBCyl9MtlRollMattSl", familyId: "cylinder-9ml-clear-17-415", completeness: "full", conflicts: [],
    canvas: { width: 1000, height: 1100 },
    anchors: { axisX: 500, neckAxisX: 500, seatY: 278, baselineY: 1054, pxPerMm: null },
    plateSha256: "plate", three: null,
    parts: [
        part("body", { left: 426, top: 278, right: 574, bottom: 1054 }, 0),
        part("roller", { left: 411, top: 170, right: 589, bottom: 300 }, 1),
        part("cap", { left: 420, top: 120, right: 580, bottom: 330 }, 2),
    ],
} as BuilderKit;

const config = {
    id: "GBCyl9MtlRollMattSl", bodyId: "cylinder-9ml|17-415|Glass Bottle", family: "Cylinder",
    capacityMl: 9, neck: "17-415", color: "Clear", fitment: "Metal Roller", closure: "Matte Silver",
    kit, photoUrl: null, bodyImage: null, profileLabel: "Cylinder", caseQuantity: 144,
    finishComponent: { websiteSku: "Cap17-415MattSl", imageUrl: null, name: "Matte silver cap" },
    product: { graceSku: "GBCyl9MtlRollMattSl", websiteSku: "GBCyl9MtlRollMattSl", shopifyVariantId: "1", shopifySellable: true, webPrice1pc: 1 },
} as BuilderConfiguration;

let root: ReturnType<typeof createRoot>;
let el: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
});
afterEach(() => { act(() => root.unmount()); el.remove(); vi.unstubAllGlobals(); });

const layer = (slot: string) => el.querySelector(`[data-builder-layer="${slot}"]`);

it("re-requests a kit layer once after an error before giving up on the preview", () => {
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "fitment")} stage="fitment" label="9 ml Cylinder, metal roller" />));
    const first = layer("roller");
    expect(first).toBeTruthy();

    // One dropped request: the layer is remounted (a fresh fetch), the bottle stays on screen.
    act(() => { first!.dispatchEvent(new Event("error")); });
    expect(el.textContent).not.toContain("Image unavailable");
    const second = layer("roller");
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(layer("body")).toBeTruthy();

    // The retry fails as well: now the preview says so.
    act(() => { second!.dispatchEvent(new Event("error")); });
    expect(el.textContent).toContain("Image unavailable");
});

it("re-requests the photo fallback once when a configuration has no kit", () => {
    const plate = { ...config, id: "plate-only", kit: null, photoUrl: "https://blob.example/plate.png" } as BuilderConfiguration;
    act(() => root.render(<BuilderImage config={plate} parts={[]} stage="complete" label="9 ml Cylinder" />));
    const first = el.querySelector("img");
    expect(first).toBeTruthy();
    act(() => { first!.dispatchEvent(new Event("error")); });
    expect(el.textContent).not.toContain("Image unavailable");
    const second = el.querySelector("img");
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    act(() => { second!.dispatchEvent(new Event("error")); });
    expect(el.textContent).toContain("Image unavailable");
});

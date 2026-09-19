// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import { clearBodyPreview, previewParts, type BuilderBody, type BuilderConfiguration, type BuilderKit } from "@/lib/bottle-builder/model";
import { slimBuilderBodies } from "@/lib/bottle-builder/payload";

/** Cylinder has no reviewed 50 ml body webp; its bare glass lives in the kit.
 * Deferring kit layers to first paint left these tiles with nothing to draw. */
const kit: BuilderKit = {
    sku: "GBCyl50Gl", familyId: "cylinder-50ml-clear-18-415", completeness: "full", conflicts: [],
    canvas: { width: 1000, height: 1100 },
    anchors: { axisX: 500, neckAxisX: 500, seatY: 235, baselineY: 980, pxPerMm: null },
    plateSha256: "plate", three: null,
    parts: [
        {
            slot: "body", variantKey: "body", zOrder: 0, explodeIndex: 0, assembled: { x: 0, y: 0 },
            bounds: { left: 398, top: 235, right: 604, bottom: 980 },
            image: { url: "https://blob.example/cylinder-master/body.webp", key: "body", sha256: "body", bytes: 8000, width: 1000, height: 1100 },
            image2x: { url: "https://blob.example/cylinder-master/body@2x.webp", key: "body2x", sha256: "body2x", bytes: 20000, width: 2000, height: 2200 },
            mask: { url: "https://blob.example/cylinder-master/body.mask.webp", key: "mask", sha256: "mask", bytes: 4000, width: 1000, height: 1100 },
            derivation: "psd-layer", exploded: { dx: 0, dy: 0 },
        },
        {
            slot: "cap", variantKey: "cap", zOrder: 1, explodeIndex: 1, assembled: { x: 0, y: 0 },
            bounds: { left: 420, top: 120, right: 580, bottom: 240 },
            image: { url: "https://blob.example/cylinder-master/cap.webp", key: "cap", sha256: "cap", bytes: 6000, width: 1000, height: 1100 },
            image2x: null, mask: null, derivation: "psd-layer", exploded: { dx: 0, dy: 0 },
        },
    ],
} as BuilderKit;

const cylinder50: BuilderBody = {
    id: "cylinder-50ml|18-415|Glass Bottle", profileLabel: "Cylinder", family: "Cylinder", capacityMl: 50, neck: "18-415",
    configurations: [{
        id: "GBCyl50Gl", bodyId: "cylinder-50ml|18-415|Glass Bottle", family: "Cylinder", capacityMl: 50, neck: "18-415",
        color: "Clear", fitment: "Screw Cap", closure: "Regular Shiny Gold", kit, photoUrl: null, bodyImage: null,
        finishComponent: { websiteSku: "CP18-415Gl", imageUrl: null, name: "Shiny gold cap" },
        profileLabel: "Cylinder", caseQuantity: 300,
        product: { graceSku: "GB-CYL-CLR-50ML-GLD", websiteSku: "GBCyl50Gl", itemName: "50 ml Cylinder", shopifyVariantId: "1", shopifySellable: true, quantity: 1, unitPrice: 2, webPrice1pc: 2 },
    } as BuilderConfiguration],
};

function renderTile(body: BuilderBody) {
    const tile = clearBodyPreview(body);
    const el = document.createElement("div");
    const root = createRoot(el);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    try {
        act(() => root.render(<BuilderImage config={tile} parts={previewParts(tile, "body")} label="50 ml Cylinder bottle" scale={1.06} />));
        return { html: el.innerHTML, text: el.textContent ?? "" };
    } finally {
        act(() => root.unmount());
        vi.unstubAllGlobals();
    }
}

it("draws the Cylinder chooser tile from the first-paint payload, not 'Image unavailable'", () => {
    const [slim] = slimBuilderBodies([cylinder50]);
    const { html, text } = renderTile(slim!);
    expect(text).not.toContain("Image unavailable");
    expect(html).toContain("https://blob.example/cylinder-master/body.webp");
    // Bare glass only: the cap belongs to a later step, and the tile never
    // ships the second resolution or the mask.
    expect(html).not.toContain("cylinder-master/cap.webp");
    expect(html).not.toContain("body@2x.webp");
    expect(html).not.toContain("body.mask.webp");
});

it("still draws the tile once the selected bottle's full kit replaces the stand-in", () => {
    const { html, text } = renderTile(cylinder50);
    expect(text).not.toContain("Image unavailable");
    expect(html).toContain("https://blob.example/cylinder-master/body.webp");
});

// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import { previewParts, type BuilderConfiguration, type BuilderKit, type BuilderPart } from "@/lib/bottle-builder/model";
import { neckSeatY } from "@/lib/bottle-builder/preview-registration";

const asset = (url: string) => ({ url, key: url, sha256: url, bytes: 1000, width: 1000, height: 1100 });

function part(slot: BuilderPart["slot"], bounds: BuilderPart["bounds"], zOrder: number): BuilderPart {
    return {
        slot, variantKey: slot, zOrder, explodeIndex: zOrder, assembled: { x: 0, y: 0 },
        bounds, exploded: { dx: 0, dy: 0 }, image: asset(`https://blob.example/${slot}.webp`),
        image2x: null, mask: null, derivation: "psd-layer",
    };
}

const kit: BuilderKit = {
    sku: "GBCyl50SpryShnSl", familyId: "cylinder-50ml-clear-18-415", completeness: "full", conflicts: [],
    canvas: { width: 1000, height: 1100 },
    anchors: { axisX: 500, neckAxisX: 500, seatY: 235, baselineY: 980, pxPerMm: null },
    plateSha256: "plate", three: null,
    parts: [
        part("body", { left: 399, top: 235, right: 605, bottom: 980 }, 0),
        part("diptube", { left: 481, top: 353, right: 524, bottom: 945 }, 1),
        part("sprayer", { left: 435, top: 110, right: 570, bottom: 352 }, 2),
        part("overcap", { left: 425, top: 90, right: 576, bottom: 352 }, 3),
    ],
} as BuilderKit;

const config = {
    id: "GBCyl50SpryShnSl", bodyId: "cylinder-50ml|18-415|Glass Bottle", family: "Cylinder",
    capacityMl: 50, neck: "18-415", color: "Clear", fitment: "Perfume Sprayer", closure: "Shiny Silver",
    kit, photoUrl: null, bodyImage: null, profileLabel: "Cylinder", caseQuantity: 144,
    finishComponent: { websiteSku: "Spry18-415ShnSl", imageUrl: null, name: "Shiny silver sprayer" },
    product: { graceSku: "GBCyl50SpryShnSl", websiteSku: "GBCyl50SpryShnSl", shopifyVariantId: "1", shopifySellable: true, webPrice1pc: 2 },
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

it("applies the neck-seat transform on the assembled preview, not the chooser tile", () => {
    const dy = neckSeatY(kit.anchors) - 352;
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "complete")} stage="complete" label="50 ml Cylinder spray" />));
    expect(el.querySelector("[data-builder-layer=\"sprayer\"]")?.getAttribute("transform")).toBe(`translate(0 ${dy})`);
    expect(el.querySelector("[data-builder-layer=\"body\"]")?.getAttribute("transform")).toBeNull();
    expect(el.querySelector("[data-builder-layer=\"diptube\"]")?.getAttribute("transform")).toBeNull();
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "complete")} stage="complete" thumbnail label="tile" />));
    expect(el.querySelector("[data-builder-layer=\"sprayer\"]")?.getAttribute("transform")).toBeNull();
});

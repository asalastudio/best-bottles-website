// @vitest-environment jsdom
// Own file: register-image.ts keeps a module-wide "optimizer unavailable" flag.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import { previewParts, type BuilderConfiguration, type BuilderKit, type BuilderPart } from "@/lib/bottle-builder/model";

const REGISTER = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/register";
const asset = (url: string) => ({ url, key: url, sha256: url, bytes: 1000, width: 1000, height: 1100 });

function part(slot: BuilderPart["slot"], bounds: BuilderPart["bounds"], zOrder: number): BuilderPart {
    return {
        slot, variantKey: slot, zOrder, explodeIndex: zOrder, assembled: { x: 0, y: 0 },
        bounds, exploded: { dx: 0, dy: 0 }, image: asset(`${REGISTER}/layers/${slot}.png`),
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

it("falls back to the register master first, then retries the master once before giving up", () => {
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "fitment")} stage="fitment" label="9 ml Cylinder, metal roller" />));
    const roller = () => el.querySelector('[data-builder-layer="roller"]');
    expect(roller()?.getAttribute("href")).toContain("/_next/image?url=");

    // The optimizer rejects the register asset: the master is drawn instead, no retry spent.
    act(() => { roller()!.dispatchEvent(new Event("error")); });
    expect(roller()?.getAttribute("href")).toBe(`${REGISTER}/layers/roller.png`);
    expect(el.textContent).not.toContain("Image unavailable");

    // The master drops once: remounted and fetched again.
    const master = roller();
    act(() => { master!.dispatchEvent(new Event("error")); });
    expect(el.textContent).not.toContain("Image unavailable");
    expect(roller()).not.toBe(master);

    // And fails again: now the preview says so.
    act(() => { roller()!.dispatchEvent(new Event("error")); });
    expect(el.textContent).toContain("Image unavailable");
});

it("switches a later next/image tile to the master even after another preview flipped the session flag", () => {
    // Instance A flips the module-wide flag.
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "fitment")} stage="fitment" label="first preview" />));
    act(() => { el.querySelector('[data-builder-layer="roller"]')!.dispatchEvent(new Event("error")); });
    act(() => root.unmount());
    root = createRoot(el);

    // Instance B: the bare body is one layer, drawn by next/image, which builds its own optimizer URL.
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "body")} stage="body" label="bare bottle" />));
    const img = () => el.querySelector("img");
    expect(img()?.getAttribute("src")).toContain("/_next/image?url=");
    act(() => { img()!.dispatchEvent(new Event("error")); });
    expect(el.textContent).not.toContain("Image unavailable");
    expect(img()?.getAttribute("src")).toBe(`${REGISTER}/layers/body.png`);
});

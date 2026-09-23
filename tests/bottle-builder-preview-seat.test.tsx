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

it("preserves native PSD seating in the assembled preview and chooser tile", () => {
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "complete")} stage="complete" label="50 ml Cylinder spray" />));
    expect(el.querySelector("[data-builder-layer=\"sprayer\"]")?.getAttribute("transform")).toBeNull();
    expect(el.querySelector("[data-builder-layer=\"body\"]")?.getAttribute("transform")).toBeNull();
    expect(el.querySelector("[data-builder-layer=\"diptube\"]")?.getAttribute("transform")).toBeNull();
    act(() => root.render(<BuilderImage config={config} parts={previewParts(config, "complete")} stage="complete" thumbnail label="tile" />));
    expect(el.querySelector("[data-builder-layer=\"sprayer\"]")?.getAttribute("transform")).toBeNull();
});

it("keeps one camera across body, tall tops, finishes, and cap-on/off views", async () => {
    const { builderBodyFrame, builderPreviewLayout } = await import("@/lib/bottle-builder/preview-layout");
    const tall = structuredClone(config);
    tall.id = "tall-finish";
    tall.kit!.parts.find(p => p.slot === "overcap")!.bounds.top = -250;
    const wide = structuredClone(config);
    wide.id = "wide-tassel";
    wide.kit!.parts.find(p => p.slot === "sprayer")!.bounds = {left:-250,top:10,right:570,bottom:1000};
    const candidates = [config, tall, wide];
    let locked: ReturnType<typeof builderBodyFrame> | undefined;
    for (const selected of candidates) for (const stage of ["body", "fitment", "complete"] as const) for (const showCover of [false, true]) {
        const layout = builderPreviewLayout(selected, previewParts(selected, stage), {stage,showCover,bodyReference:config})!;
        const frame = builderBodyFrame(selected,candidates,config,layout);
        if (!locked) locked=frame;
        expect(frame).toEqual(locked);
        for (const layer of layout.layers) {
            expect(layer.bounds.left).toBeGreaterThan(frame.x);
            expect(layer.bounds.right).toBeLessThan(frame.x+frame.width);
            expect(layer.bounds.top).toBeGreaterThan(frame.y);
            expect(layer.bounds.bottom).toBeLessThan(frame.y+frame.height);
        }
        expect(layout.layers.find(l=>l.part.slot==="body")!.bounds).toEqual(kit.parts[0].bounds);
    }
    // Another capacity must not make this bottle's frame smaller.
    const unrelated=structuredClone(tall); unrelated.capacityMl=100; unrelated.kit!.parts[0].bounds.top=-5000;
    const layout=builderPreviewLayout(config,previewParts(config,"complete"),{stage:"complete",bodyReference:config})!;
    expect(builderBodyFrame(config,[...candidates,unrelated],config,layout)).toEqual(locked);
});

it("shares the body size across material photos without substituting their glass pixels", async () => {
    const { builderBodyFrame, builderPreviewLayout } = await import("@/lib/bottle-builder/preview-layout");
    const frosted=structuredClone(config); frosted.id="frosted"; frosted.color="Frosted";
    for(const part of frosted.kit!.parts) {
        part.bounds={left:part.bounds.left*1.4+30,right:part.bounds.right*1.4+30,top:part.bounds.top*1.4,bottom:part.bounds.bottom*1.4};
        part.image.url=part.image.url.replace("blob.example","frosted.example");
    }
    frosted.kit!.anchors={...frosted.kit!.anchors,axisX:kit.anchors.axisX*1.4+30,seatY:kit.anchors.seatY*1.4,baselineY:kit.anchors.baselineY*1.4};
    const candidates=[config,frosted];
    const layouts=candidates.map(c=>builderPreviewLayout(c,previewParts(c,"complete"),{stage:"complete",bodyReference:c})!);
    const frames=candidates.map((c,i)=>builderBodyFrame(c,candidates,c,layouts[i]));
    const widths=layouts.map((l,i)=>{const b=l.layers.find(l=>l.part.slot==="body")!.bounds;return (b.right-b.left)/frames[i].width;});
    expect(widths[0]).toBeCloseTo(widths[1],10);
    expect(layouts[1].layers.find(l=>l.part.slot==="body")!.part.image.url).toContain("frosted.example");
});

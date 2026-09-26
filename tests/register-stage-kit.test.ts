import { describe, expect, it } from "vitest";
import { STAGE_DATUMS, assembledKit, datumFromPlate, kitFromRegister, kitsFromRegister, partBoxTransform, type RegisterStagePayload } from "@/lib/register/stage-kit";
import { closurePart, fitmentPart, partCrop, stageLayout } from "@/lib/products/pdp-redesign/stage";
import { layerCropStyleForPart, layerTransform } from "@/lib/bottle-builder/preview-frame";

/**
 * The 9 mL Cylinder pilot as the register holds it on dev (Phase 3 measurements):
 * the Clear plate, the black dotted roll-on cap and the metal roller insert.
 */
const PLATE = {
    plateKey: "cylinder-9ml-17-415|Clear", bodyId: "cylinder-9ml-17-415", glass: "Clear",
    url: "https://blob/register/plates/clear.png", width: 768, height: 2304, pxPerMm: 27.2142,
    anchors: { axisX: 383, seatY: 167, baselineY: 2176, shoulderY: 550 }, approved: true,
};
const CAP = {
    componentId: "CMP-ROC-BLK-17415-DOT", type: "roll-on-cap", approved: true,
    layers: [{ slot: "cap" as const, z: "front" as const, explodeIndex: 1, url: "https://blob/register/components/cap.png", width: 316, height: 431, pxPerMm: 15.7596, anchor: { x: 163.1, y: 203.5 }, approved: true }],
};
const ROLLER = {
    componentId: "LIB-17-415-MtlRollon", type: "roller-insert", approved: true,
    layers: [{ slot: "roller" as const, z: "behind-body" as const, explodeIndex: 0, url: "https://blob/register/components/roller.png", width: 172, height: 135, pxPerMm: 12.3676, anchor: { x: 91.5, y: 126 }, approved: true }],
};
const PUMP = {
    componentId: "CMP-LPM-BLK-17-415", type: "lotion-pump", approved: true,
    layers: [
        { slot: "pump" as const, z: "front" as const, explodeIndex: 3, url: "https://blob/register/components/pump-head.png", width: 248, height: 302, pxPerMm: 15.338, anchor: { x: 129.2, y: 298.7 }, approved: true },
        { slot: "pump" as const, z: "front" as const, explodeIndex: 2, url: "https://blob/register/components/pump-nozzle.png", width: 79, height: 77, pxPerMm: 15.338, anchor: { x: 47.2, y: 276.7 }, approved: true },
        { slot: "collar" as const, z: "front" as const, explodeIndex: 1, url: "https://blob/register/components/collar.png", width: 301, height: 257, pxPerMm: 15.338, anchor: { x: 155.2, y: 29.7 }, approved: true },
        { slot: "overcap" as const, z: "front" as const, explodeIndex: 4, url: "https://blob/register/components/overcap.png", width: 231, height: 297, pxPerMm: 12.3676, anchor: { x: 122.5, y: 291 }, approved: true },
    ],
};
const PAYLOAD: RegisterStagePayload = {
    plates: { [PLATE.plateKey]: PLATE },
    components: { [CAP.componentId]: CAP, [ROLLER.componentId]: ROLLER, [PUMP.componentId]: PUMP },
    bodies: { "cylinder-9ml-17-415": { bodyId: "cylinder-9ml-17-415", family: "Cylinder", capacityMl: 9, neck: "17-415", dims: { heightBareMm: 70, diameterMm: 20, widthMm: 21 } } },
    assemblies: {
        "GB-CYL-CLR-9ML-MRL-BKDT": { graceSku: "GB-CYL-CLR-9ML-MRL-BKDT", websiteSku: "GBCyl9MtlRollBlkDot", bodyId: "cylinder-9ml-17-415", plateKey: PLATE.plateKey, glass: "Clear", neck: "17-415", parts: [{ role: "roller", componentId: ROLLER.componentId }, { role: "cap", componentId: CAP.componentId }], renderable: true, reason: null },
        "LB-CYL-CLR-9ML-LTN-BLK": { graceSku: "LB-CYL-CLR-9ML-LTN-BLK", websiteSku: "LBCyl9LtnBlk", bodyId: "cylinder-9ml-17-415", plateKey: PLATE.plateKey, glass: "Clear", neck: "17-415", parts: [{ role: "pump", componentId: PUMP.componentId }], renderable: true, reason: null },
        "GB-CYL-CLR-9ML-MRL-TUR": { graceSku: "GB-CYL-CLR-9ML-MRL-TUR", websiteSku: "GBCyl9MtlRollTur", bodyId: "cylinder-9ml-17-415", plateKey: PLATE.plateKey, glass: "Clear", neck: "17-415", parts: [], renderable: false, reason: "own parts unresolved" },
        "GB-CYL-CLR-9ML-MRL-GHOST": { graceSku: "GB-CYL-CLR-9ML-MRL-GHOST", websiteSku: null, bodyId: "cylinder-9ml-17-415", plateKey: PLATE.plateKey, glass: "Clear", neck: "17-415", parts: [{ role: "cap", componentId: "CMP-MISSING" }], renderable: true, reason: null },
        "GB-NOT-IN-REGISTER": null,
    },
};
const DATUM = STAGE_DATUMS["cylinder-9ml-17-415"];
const PX_PER_MM = (DATUM.baselineY - DATUM.seatY) / ((2176 - 167) / 27.2142);

describe("kitFromRegister", () => {
    const kit = kitFromRegister("GB-CYL-CLR-9ML-MRL-BKDT", PAYLOAD)!;

    it("stands every SKU of the body on the body's fixed datum", () => {
        expect(kit).not.toBeNull();
        expect(kit.anchors).toMatchObject({ axisX: 500, neckAxisX: 500, seatY: DATUM.seatY, baselineY: 1061 });
        expect(kit.register).toMatchObject({ bodyId: "cylinder-9ml-17-415", plateKey: PLATE.plateKey, glass: "Clear", datum: DATUM });
        expect(kit.register.pxPerMm).toBeCloseTo(PX_PER_MM, 2);
        expect(kit.sku).toBe("GBCyl9MtlRollBlkDot");
        expect(kit.completeness).toBe("full");
        expect(kit.canvas).toEqual({ width: 1000, height: 1100 });
        const pump = kitFromRegister("LB-CYL-CLR-9ML-LTN-BLK", PAYLOAD)!;
        expect(pump.anchors).toEqual(kit.anchors);
        expect(pump.parts.find((part) => part.slot === "body")!.box).toEqual(kit.parts.find((part) => part.slot === "body")!.box);
    });

    it("places the plate so its seat and foot land on the datum, with the glass's own bounds", () => {
        const body = kit.parts.find((part) => part.slot === "body")!;
        const scale = PX_PER_MM / 27.2142;
        expect(body.box.x + 383 * scale).toBeCloseTo(500, 1);
        expect(body.box.y + 167 * scale).toBeCloseTo(DATUM.seatY, 1);
        expect(body.box.y + 2176 * scale).toBeCloseTo(1061, 1);
        expect(body.box.width).toBeCloseTo(768 * scale, 1);
        // bounds are the 20 mm glass, not the plate's canvas
        expect(body.bounds.top).toBe(DATUM.seatY);
        expect(body.bounds.bottom).toBe(1061);
        expect(body.bounds.right - body.bounds.left).toBeCloseTo(20 * PX_PER_MM, 1);
        expect((body.bounds.left + body.bounds.right) / 2).toBeCloseTo(500, 6);
        expect(body.derivation).toBe("psd-layer");
        expect(body.image).toMatchObject({ url: PLATE.url, width: 768, height: 2304 });
    });

    it("lands each layer's anchor on the seat and draws behind-body, plate, front", () => {
        const roller = kit.parts.find((part) => part.slot === "roller")!;
        const cap = kit.parts.find((part) => part.slot === "cap")!;
        const rollerScale = PX_PER_MM / 12.3676;
        expect(roller.box.x + 91.5 * rollerScale).toBeCloseTo(500, 1);
        expect(roller.box.y + 126 * rollerScale).toBeCloseTo(DATUM.seatY, 1);
        const capScale = PX_PER_MM / 15.7596;
        expect(cap.box.x + 163.1 * capScale).toBeCloseTo(500, 1);
        expect(cap.box.y + 203.5 * capScale).toBeCloseTo(DATUM.seatY, 1);
        expect(cap.bounds).toEqual({ left: cap.box.x, top: cap.box.y, right: Math.round((cap.box.x + cap.box.width) * 100) / 100, bottom: Math.round((cap.box.y + cap.box.height) * 100) / 100 });
        expect([...kit.parts].sort((a, b) => a.zOrder - b.zOrder).map((part) => part.slot)).toEqual(["roller", "body", "cap"]);
        expect(roller.componentId).toBe(ROLLER.componentId);
        expect(cap.componentId).toBe(CAP.componentId);
    });

    it("explodes parts straight up in assembly order; a pump's head, nozzle and collar travel as one piece", () => {
        const body = kit.parts.find((part) => part.slot === "body")!;
        const roller = kit.parts.find((part) => part.slot === "roller")!;
        const cap = kit.parts.find((part) => part.slot === "cap")!;
        expect(body.exploded).toEqual({ dx: 0, dy: 0 });
        expect(roller.exploded.dx).toBe(0);
        expect(roller.bounds.bottom + roller.exploded.dy).toBeCloseTo(body.bounds.top - 24, 1);
        expect(cap.bounds.bottom + cap.exploded.dy).toBeCloseTo(roller.bounds.top + roller.exploded.dy - 24, 1);

        const pump = kitFromRegister("LB-CYL-CLR-9ML-LTN-BLK", PAYLOAD)!;
        const heads = pump.parts.filter((part) => part.slot === "pump");
        const collar = pump.parts.find((part) => part.slot === "collar")!;
        const overcap = pump.parts.find((part) => part.slot === "overcap")!;
        expect(heads).toHaveLength(2);
        // one mechanism: the same lift for both heads and the collar
        expect(heads[0].exploded.dy).toBe(heads[1].exploded.dy);
        expect(collar.exploded.dy).toBe(heads[0].exploded.dy);
        const mechanismBottom = Math.max(collar.bounds.bottom, ...heads.map((part) => part.bounds.bottom)) + collar.exploded.dy;
        const mechanismTop = Math.min(collar.bounds.top, ...heads.map((part) => part.bounds.top)) + collar.exploded.dy;
        expect(mechanismBottom).toBeCloseTo(pump.parts.find((part) => part.slot === "body")!.bounds.top - 24, 1);
        // the overcap is the only separate piece, above the mechanism
        expect(overcap.bounds.bottom + overcap.exploded.dy).toBeCloseTo(mechanismTop - 24, 1);
    });

    it("draws a seated insert in CAP ON and SIDECAR and its full plug in EXPLODED when the register carries both", () => {
        const plug = { ...ROLLER.layers[0], url: "https://blob/register/components/roller-plug.png", height: 330, anchor: { x: 91.5, y: 126 }, usage: "exploded" as const, z: "front" as const };
        const seated = { ...ROLLER.layers[0], usage: "seated" as const };
        const payload = { ...PAYLOAD, components: { ...PAYLOAD.components, [ROLLER.componentId]: { ...ROLLER, layers: [seated, plug] } } };
        const both = kitFromRegister("GB-CYL-CLR-9ML-MRL-BKDT", payload)!;
        const rollers = both.parts.filter((part) => part.slot === "roller");
        expect(rollers.map((part) => part.views)).toEqual([["sidecar", "capon"], ["exploded"]]);
        const context = { family: "Cylinder", capacityMl: 9, color: "Clear", applicator: "Metal Roller Ball", websiteSku: "GBCyl9MtlRollBlkDot" };
        expect(stageLayout(both, "capon", context)!.parts.filter((part) => part.slot === "roller").map((part) => part.url)).toEqual([seated.url]);
        expect(stageLayout(both, "exploded", context)!.parts.filter((part) => part.slot === "roller").map((part) => part.url)).toEqual([plug.url]);
        // on its own (the Build Your Bottle strip) the fitment is the whole insert, plug included; a register without a plug keeps the seated layer
        expect(fitmentPart(both)!.image.url).toBe(plug.url);
        expect(fitmentPart(kit)!.image.url).toBe(ROLLER.layers[0].url);
        // a stage with no EXPLODED view (Build Your Bottle) draws the seated insert alone, never both layers
        expect(assembledKit(both).parts.filter((part) => part.slot === "roller").map((part) => part.image.url)).toEqual([seated.url]);
        expect(assembledKit(both).parts.length).toBe(both.parts.length - 1);
        expect(assembledKit(kit).parts).toEqual(kit.parts);
        // the plug lifts as the insert's own unit, the cap above it
        const exploded = stageLayout(both, "exploded", context)!;
        expect(exploded.parts.find((part) => part.slot === "roller")!.dyPct).toBeLessThan(0);
        expect(exploded.parts.find((part) => part.slot === "cap")!.dyPct).toBeLessThan(exploded.parts.find((part) => part.slot === "roller")!.dyPct);
    });

    it("draws nothing for a SKU the register cannot render, and keys the rest by both SKUs", () => {
        expect(kitFromRegister("GB-CYL-CLR-9ML-MRL-TUR", PAYLOAD)).toBeNull();
        expect(kitFromRegister("GB-CYL-CLR-9ML-MRL-GHOST", PAYLOAD)).toBeNull();
        expect(kitFromRegister("GB-NOT-IN-REGISTER", PAYLOAD)).toBeNull();
        expect(kitFromRegister("GB-UNKNOWN", PAYLOAD)).toBeNull();
        const kits = kitsFromRegister(PAYLOAD);
        expect(Object.keys(kits).sort()).toEqual(["GB-CYL-CLR-9ML-MRL-BKDT", "GBCyl9MtlRollBlkDot", "LB-CYL-CLR-9ML-LTN-BLK", "LBCyl9LtnBlk"]);
        expect(kits["GBCyl9MtlRollBlkDot"]).toBe(kits["GB-CYL-CLR-9ML-MRL-BKDT"]);
    });

    it("gives a body with no recorded datum one from its plate: foot on the baseline, the pilot scale", () => {
        const datum = datumFromPlate(PLATE);
        expect(datum.axisX).toBe(500);
        expect(datum.baselineY).toBe(1061);
        expect(datum.seatY).toBe(Math.round(1061 - ((2176 - 167) / 27.2142) * 10.5));
        const tall = datumFromPlate({ ...PLATE, anchors: { ...PLATE.anchors, seatY: 167, baselineY: 167 + 120 * 27.2142 } });
        expect(tall.baselineY - tall.seatY).toBeLessThanOrEqual(800);
        const other = kitFromRegister("GB-CYL-CLR-9ML-MRL-BKDT", { ...PAYLOAD, assemblies: { "GB-CYL-CLR-9ML-MRL-BKDT": { ...PAYLOAD.assemblies["GB-CYL-CLR-9ML-MRL-BKDT"]!, bodyId: "elsewhere" } } })!;
        expect(other.anchors.seatY).toBe(datum.seatY);
    });
});

describe("the two stages draw register parts through their boxes", () => {
    const kit = kitFromRegister("GB-CYL-CLR-9ML-MRL-BKDT", PAYLOAD)!;
    const context = { family: "Cylinder", capacityMl: 9, color: "Clear", applicator: "Metal Roller Ball", websiteSku: "GBCyl9MtlRollBlkDot" };

    it("product page: every part carries its box in canvas percent, the cap parks beside the glass in SIDECAR, the glass stays put", () => {
        const capOn = stageLayout(kit, "capon", context)!;
        expect(capOn.parts.every((part) => part.box)).toBe(true);
        const body = capOn.parts.find((part) => part.slot === "body")!;
        const bodyPart = kit.parts.find((part) => part.slot === "body")!;
        expect(body.box!.leftPct).toBeCloseTo(bodyPart.box.x / 10, 6);
        expect(body.box!.widthPct).toBeCloseTo(bodyPart.box.width / 10, 6);
        const sidecar = stageLayout(kit, "sidecar", context)!;
        expect(sidecar.frameCss).toBe(capOn.frameCss);
        const cap = sidecar.parts.find((part) => part.slot === "cap")!;
        expect(cap.dxPct).toBeGreaterThan(0);
        expect(sidecar.parts.find((part) => part.slot === "body")!.dxPct).toBe(0);
        expect(sidecar.parts.find((part) => part.slot === "roller")!.dyPct).toBe(0);
        const exploded = stageLayout(kit, "exploded", context)!;
        expect(exploded.parts.find((part) => part.slot === "cap")!.dyPct).toBeLessThan(0);
        expect(exploded.anchors.cap!.yPct).toBeLessThan(exploded.anchors.fitment!.yPct);
        expect(exploded.anchors.neck!.yPct).toBeLessThan(exploded.anchors.body!.yPct);
    });

    it("product page: thumbnails crop the register image as its box, not the canvas", () => {
        const cap = closurePart(kit)!;
        expect(cap.slot).toBe("cap");
        const crop = partCrop(cap, kit.canvas, 48);
        const scale = 48 / (cap.bounds.bottom - cap.bounds.top);
        expect(crop.imgWidth).toBeCloseTo(cap.box!.width * scale, 5);
        expect(crop.imgHeight).toBeCloseTo(cap.box!.height * scale, 5);
        expect(crop.left).toBeCloseTo(0, 5);
        expect(crop.top).toBeCloseTo(0, 5);
        const body = kit.parts.find((part) => part.slot === "body")!;
        const glass = partCrop(body, kit.canvas, 96);
        // the plate is wider than the glass: the crop starts inside the image
        expect(glass.left).toBeLessThan(0);
        expect(glass.width).toBeCloseTo((body.bounds.right - body.bounds.left) * (96 / (body.bounds.bottom - body.bounds.top)), 5);
    });

    it("builder: a register part draws with its box transform, after any registration; a kit layer draws as before", () => {
        const cap = kit.parts.find((part) => part.slot === "cap")!;
        expect(partBoxTransform(cap)).toBe(`translate(${cap.box.x} ${cap.box.y}) scale(${cap.box.width / 316})`);
        expect(layerTransform(undefined, cap)).toBe(partBoxTransform(cap));
        expect(layerTransform("translate(3 4)", cap)).toBe(`translate(3 4) ${partBoxTransform(cap)}`);
        const legacy = { image: { width: 1000, height: 1100 } };
        expect(partBoxTransform(legacy)).toBeNull();
        expect(layerTransform("translate(3 4)", legacy)).toBe("translate(3 4)");
        const body = kit.parts.find((part) => part.slot === "body")!;
        const frame = { x: body.box.x, y: body.box.y, width: body.box.width, height: body.box.height };
        const crop = layerCropStyleForPart(body, frame);
        expect(crop).toMatchObject({ left: "0%", top: "0%", width: "100%", height: "100%" });
        expect(layerCropStyleForPart(legacy, { x: 0, y: 0, width: 500, height: 550 })).toMatchObject({ width: "200%", height: "200%" });
    });
});

describe("see-through layers (one per glass)", () => {
    const see = (glass: string) => ({
        slot: "diptube" as const, z: "front" as const, explodeIndex: 5, usage: "seated" as const, glass,
        url: `https://blob/register/components/see-${glass}.png`, width: 90, height: 1400, pxPerMm: 25, anchor: { x: 45, y: 20 }, approved: true,
    });
    const LOTION = { ...PUMP, layers: [...PUMP.layers, see("Clear"), see("Amber")] };
    const AMBER = { ...PLATE, plateKey: "cylinder-9ml-17-415|Amber", glass: "Amber", url: "https://blob/register/plates/amber.png" };
    const payload: RegisterStagePayload = {
        ...PAYLOAD,
        plates: { ...PAYLOAD.plates, [AMBER.plateKey]: AMBER },
        components: { ...PAYLOAD.components, [PUMP.componentId]: LOTION },
        assemblies: {
            ...PAYLOAD.assemblies,
            "LB-CYL-AMB-9ML-LTN-BLK": { graceSku: "LB-CYL-AMB-9ML-LTN-BLK", websiteSku: "LBCylAmb9LtnBlk", bodyId: "cylinder-9ml-17-415", plateKey: AMBER.plateKey, glass: "Amber", neck: "17-415", parts: [{ role: "pump", componentId: PUMP.componentId }], renderable: true, reason: null },
        },
    };

    it("draws only the see-through layer rendered behind the SKU's own glass", () => {
        const clear = kitFromRegister("LB-CYL-CLR-9ML-LTN-BLK", payload)!;
        const amber = kitFromRegister("LB-CYL-AMB-9ML-LTN-BLK", payload)!;
        const urls = (kit: typeof clear) => kit.parts.filter((part) => part.slot === "diptube").map((part) => part.image.url);
        expect(urls(clear)).toEqual(["https://blob/register/components/see-Clear.png"]);
        expect(urls(amber)).toEqual(["https://blob/register/components/see-Amber.png"]);
        // glass-less layers (head, collar, overcap) are shared by every glass
        expect(clear.parts.filter((part) => part.slot !== "diptube" && part.slot !== "body").length).toBe(PUMP.layers.length);
        expect(amber.parts.filter((part) => part.slot !== "diptube" && part.slot !== "body").length).toBe(PUMP.layers.length);
    });

    it("keeps the seated see-through layer out of EXPLODED", () => {
        const clear = kitFromRegister("LB-CYL-CLR-9ML-LTN-BLK", payload)!;
        const layer = clear.parts.find((part) => part.slot === "diptube")!;
        expect(layer.views).toEqual(["sidecar", "capon"]);
        expect(assembledKit(clear).parts.some((part) => part.slot === "diptube")).toBe(true);
    });
});

describe("body-scoped layers", () => {
    const blender = { slot: "cap" as const, z: "front" as const, explodeIndex: 1, url: "https://blob/register/components/cap-blender.png", width: 500, height: 700, pxPerMm: 25, anchor: { x: 250, y: 300 }, approved: true, bodyId: "cylinder-9ml-17-415" };
    const CAP2 = { ...CAP, layers: [...CAP.layers, blender] };
    const OTHER = { ...PLATE, plateKey: "cylinder-5ml-13-415|Clear", bodyId: "cylinder-5ml-13-415", url: "https://blob/register/plates/5ml.png" };
    const payload: RegisterStagePayload = {
        ...PAYLOAD,
        plates: { ...PAYLOAD.plates, [OTHER.plateKey]: OTHER },
        components: { ...PAYLOAD.components, [CAP.componentId]: CAP2 },
        assemblies: {
            ...PAYLOAD.assemblies,
            "GB-CYL-CLR-5ML-CAP": { graceSku: "GB-CYL-CLR-5ML-CAP", websiteSku: "GBCyl5Cap", bodyId: "cylinder-5ml-13-415", plateKey: OTHER.plateKey, glass: "Clear", neck: "13-415", parts: [{ role: "cap", componentId: CAP.componentId }], renderable: true, reason: null },
        },
    };
    const capUrls = (sku: string) => kitFromRegister(sku, payload)!.parts.filter((part) => part.slot === "cap").map((part) => part.image.url);

    it("draws only the body's own layers when the component has them", () => {
        expect(capUrls("GB-CYL-CLR-9ML-MRL-BKDT")).toEqual([blender.url]);
    });

    it("keeps the generic layers for every other body that shares the component", () => {
        expect(capUrls("GB-CYL-CLR-5ML-CAP")).toEqual([CAP.layers[0].url]);
    });
});

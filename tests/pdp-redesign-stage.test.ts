import { describe, expect, it } from "vitest";
import { availableViews, closurePart, effectiveView, partCrop, stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";

/** The published cobalt 9 ml metal roll-on kit (GBCylBlu9MtlRollBlkDot on dev), parts as stored. */
const KIT: KitLike = {
    sku: "GBCylBlu9MtlRollBlkDot",
    canvas: { width: 1000, height: 1100 },
    anchors: { axisX: 500, neckAxisX: 500, seatY: 283, baselineY: 1057 },
    parts: [
        { slot: "roller", zOrder: 1, explodeIndex: 1, bounds: { left: 424, top: 186, right: 575, bottom: 307 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -181 }, image: { url: "https://blob/roller.webp", width: 1000, height: 1100 } },
        { slot: "body", zOrder: 0, explodeIndex: 0, bounds: { left: 402, top: 283, right: 605, bottom: 1057 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "https://blob/body.webp", width: 1000, height: 1100 } },
        { slot: "cap", zOrder: 2, explodeIndex: 2, bounds: { left: 400, top: 144, right: 604, bottom: 427 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -455 }, image: { url: "https://blob/cap.webp", width: 1000, height: 1100 } },
    ],
};

const CONTEXT = { family: "Cylinder", capacityMl: 9, color: "Cobalt Blue", applicator: "Metal Roller Ball", websiteSku: "GBCylBlu9MtlRollBlkDot" };

describe("views", () => {
    it("offers all three views for a kitted roll-on and only SIDECAR without a kit", () => {
        expect(availableViews(KIT, CONTEXT)).toEqual(["sidecar", "capon", "exploded"]);
        expect(availableViews(null, CONTEXT)).toEqual(["sidecar"]);
    });

    it("keeps assembled closures assembled and never explodes a Boston roller", () => {
        const dropper = { ...CONTEXT, applicator: "Dropper" };
        expect(effectiveView("sidecar", KIT, dropper)).toBe("capon");
        expect(effectiveView("exploded", KIT, dropper)).toBe("capon");
        expect(availableViews(KIT, { ...CONTEXT, family: "Boston Round" })).toEqual(["sidecar", "capon"]);
    });

    it.each(["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel"])("offers only assembled color swaps for %s", applicator => {
        const context = { ...CONTEXT, applicator };
        expect(availableViews(KIT, context)).toEqual(["capon"]);
        for (const requested of ["sidecar", "capon", "exploded"] as const) {
            expect(effectiveView(requested, KIT, context)).toBe("capon");
            expect(stageLayout(KIT, requested, context)!.parts.every(part => part.dxPct === 0 && part.dyPct === 0)).toBe(true);
        }
    });
});

describe("reducer cap removal", () => {
    const context = { ...CONTEXT, family: "Elegant", capacityMl: 60, applicator: "Reducer" };
    const reducerKit: KitLike = { ...KIT, parts: KIT.parts.flatMap(part => part.slot === "roller" ? [
        { ...part, slot: "reducer", views: ["sidecar", "capon"], image: { ...part.image, url: "seated.png" } },
        { ...part, slot: "reducer", views: ["exploded"], image: { ...part.image, url: "full-plug.png" } },
    ] : [part]) };
    it("removes the cap while leaving the reducer seated, then shows the full plug exploded", () => {
        expect(availableViews(reducerKit, context)).toEqual(["sidecar", "capon", "exploded"]);
        const off = stageLayout(reducerKit, "sidecar", context)!;
        const on = stageLayout(reducerKit, "capon", context)!;
        expect(off.frameCss).toBe(on.frameCss);
        expect(off.parts.find(p => p.slot === "cap")!.dxPct).toBeGreaterThan(0);
        expect(off.parts.find(p => p.slot === "reducer")).toMatchObject({ url: "seated.png", dxPct: 0, dyPct: 0 });
        const exploded = stageLayout(reducerKit, "exploded", context)!;
        expect(exploded.parts.filter(p => p.slot === "reducer")).toHaveLength(1);
        expect(exploded.parts.find(p => p.slot === "reducer")!.url).toBe("full-plug.png");
        expect(exploded.parts.find(p => p.slot === "reducer")!.dyPct).toBeLessThan(0);
    });
    it("does not offer a fake cap-off view when the reducer insert is missing", () => {
        const missing = { ...KIT, parts: KIT.parts.filter(p => p.slot !== "roller") };
        expect(availableViews(missing, context)).toEqual(["capon"]);
        expect(effectiveView("sidecar", missing, context)).toBe("capon");
        expect(effectiveView("exploded", missing, context)).toBe("capon");
    });
});

describe("layout", () => {
    it("keeps fractional layer priorities above or behind glass with valid CSS indices", () => {
        for (const tubePriority of [-0.5, 0.5]) {
            const kit: KitLike = { ...KIT, parts: [
                ...KIT.parts,
                { ...KIT.parts[0], slot: "diptube", zOrder: tubePriority },
            ] };
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const parts = stageLayout(kit, view, CONTEXT)!.parts;
                const tube = parts.find(part => part.slot === "diptube")!;
                const glass = parts.find(part => part.slot === "body")!;
                expect(parts.every(part => Number.isInteger(part.zIndex) && part.zIndex > 0)).toBe(true);
                expect(Math.sign(tube.zIndex - glass.zIndex)).toBe(Math.sign(tubePriority));
                expect(tube.zIndex).toBeLessThan(parts.find(part => part.slot === "cap")!.zIndex);
            }
        }
    });

    it("paints every part in z order at its assembled position for CAP ON", () => {
        const layout = stageLayout(KIT, "capon", CONTEXT)!;
        expect(layout.parts.map((part) => part.slot)).toEqual(["body", "roller", "cap"]);
        expect(layout.parts.every((part) => part.dxPct === 0 && part.dyPct === 0)).toBe(true);
        expect(layout.baseline).toBe(true);
        expect(layout.grid).toBe(false);
        expect(layout.frame.scale).toBeGreaterThan(0);
        expect(layout.frame.scale).toBeLessThanOrEqual(1);
    });

    it("parks only the cap beside the glass for SIDECAR and keeps the glass where CAP ON had it", () => {
        const capOn = stageLayout(KIT, "capon", CONTEXT)!;
        const sidecar = stageLayout(KIT, "sidecar", CONTEXT)!;
        expect(sidecar.frameCss).toBe(capOn.frameCss);
        const cap = sidecar.parts.find((part) => part.slot === "cap")!;
        const body = sidecar.parts.find((part) => part.slot === "body")!;
        const roller = sidecar.parts.find((part) => part.slot === "roller")!;
        expect(cap.dxPct).toBeGreaterThan(0);
        // the detached cap's foot lands on the glass baseline: 1057 - 427 = 630 px down
        expect(cap.dyPct).toBeCloseTo((1057 - 427) / 11, 5);
        expect(body.dxPct).toBe(0);
        expect(roller.dyPct).toBe(0);
    });

    it("explodes in assembly order, the insert nearest the neck and the cap above it, and turns the callouts on", () => {
        const layout = stageLayout(KIT, "exploded", CONTEXT)!;
        const cap = layout.parts.find((part) => part.slot === "cap")!;
        const roller = layout.parts.find((part) => part.slot === "roller")!;
        const body = layout.parts.find((part) => part.slot === "body")!;
        // recorded per-part offsets are not used: every kit stacks the same way, 24 px apart above the glass
        expect(body.dyPct).toBe(0);
        expect(roller.dyPct).toBeCloseTo(((283 - 24) - 307) / 11, 5);
        const rollerTop = 186 + ((283 - 24) - 307);
        expect(cap.dyPct).toBeCloseTo(((rollerTop - 24) - 427) / 11, 5);
        expect(cap.dxPct).toBe(0);
        expect(layout.grid).toBe(true);
        expect(layout.baseline).toBe(false);
        expect(Object.keys(layout.anchors).sort()).toEqual(["body", "cap", "fitment", "neck"]);
        // anchors sit inside the canvas box and read top to bottom: cap, fitment, neck, body
        for (const anchor of Object.values(layout.anchors)) {
            expect(anchor!.xPct).toBeGreaterThan(0);
            expect(anchor!.xPct).toBeLessThan(100);
            expect(anchor!.yPct).toBeGreaterThan(0);
            expect(anchor!.yPct).toBeLessThan(100);
        }
        expect(layout.anchors.cap!.yPct).toBeLessThan(layout.anchors.fitment!.yPct);
        expect(layout.anchors.fitment!.yPct).toBeLessThan(layout.anchors.neck!.yPct);
        expect(layout.anchors.neck!.yPct).toBeLessThan(layout.anchors.body!.yPct);
    });

    it("keeps a sprayer's head and collar together in EXPLODED and lifts only the overcap away", () => {
        const sprayer: KitLike = {
            ...KIT,
            parts: [
                { slot: "body", zOrder: 0, explodeIndex: 0, bounds: { left: 402, top: 278, right: 617, bottom: 1054 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "https://blob/body.webp", width: 1000, height: 1100 } },
                { slot: "sprayer", zOrder: 1, explodeIndex: 3, bounds: { left: 424, top: 80, right: 581, bottom: 278 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -477 }, image: { url: "https://blob/sprayer.webp", width: 1000, height: 1100 } },
                { slot: "overcap", zOrder: 2, explodeIndex: 2, bounds: { left: 407, top: 42, right: 592, bottom: 283 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -217 }, image: { url: "https://blob/overcap.webp", width: 1000, height: 1100 } },
                { slot: "collar", zOrder: 3, explodeIndex: 1, bounds: { left: 406, top: 265, right: 603, bottom: 429 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -175 }, image: { url: "https://blob/collar.webp", width: 1000, height: 1100 } },
            ],
        };
        const layout = stageLayout(sprayer, "exploded", { ...CONTEXT, applicator: "Fine Mist Sprayer" })!;
        const head = layout.parts.find((part) => part.slot === "sprayer")!;
        const collar = layout.parts.find((part) => part.slot === "collar")!;
        const overcap = layout.parts.find((part) => part.slot === "overcap")!;
        expect(collar.dyPct).toBe(head.dyPct);
        // the assembly's collar sits 24 px above the glass; the overcap 24 px above the head
        expect(collar.dyPct).toBeCloseTo(((278 - 24) - 429) / 11, 5);
        expect(overcap.dyPct).toBeLessThan(head.dyPct);
        expect(overcap.dyPct).toBeCloseTo((((80 + ((278 - 24) - 429)) - 24) - 283) / 11, 5);
    });

    it("returns nothing without a kit, so the stage falls back to the photograph", () => {
        expect(stageLayout(null, "capon", CONTEXT)).toBeNull();
    });
});

describe("crops", () => {
    it("scales a full-canvas layer so its bounds fill the requested height", () => {
        const cap = closurePart(KIT)!;
        expect(cap.slot).toBe("cap");
        const crop = partCrop(cap, KIT.canvas, 48);
        const scale = 48 / (427 - 144);
        expect(crop.height).toBe(48);
        expect(crop.width).toBeCloseTo((604 - 400) * scale, 5);
        expect(crop.imgWidth).toBeCloseTo(1000 * scale, 5);
        expect(crop.left).toBeCloseTo(-400 * scale, 5);
        expect(crop.top).toBeCloseTo(-144 * scale, 5);
    });
});

describe("behind the glass", () => {
    /** A register kit: the plate is opaque and the sprayer's dip tube, cut on a taller bottle's photo, runs past the foot. */
    const REGISTER_KIT: KitLike = {
        sku: "GBRndFrst78AnSpGl",
        canvas: { width: 1000, height: 1100 },
        anchors: { axisX: 500, neckAxisX: 500, seatY: 300, baselineY: 1000 },
        register: { bodyId: "round-78ml-18-415", plateKey: "round-78ml-18-415|Frosted", glass: "Frosted" },
        parts: [
            { slot: "diptube", zOrder: 0, explodeIndex: 0, bounds: { left: 480, top: 300, right: 520, bottom: 1200 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "https://blob/tube.png", width: 40, height: 900 }, box: { x: 480, y: 300, width: 40, height: 900 } },
            { slot: "body", zOrder: 1, explodeIndex: 0, bounds: { left: 300, top: 300, right: 700, bottom: 1000 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "https://blob/plate.png", width: 500, height: 800 }, box: { x: 250, y: 250, width: 500, height: 800 } },
            { slot: "sprayer", zOrder: 2, explodeIndex: 1, bounds: { left: 440, top: 120, right: 560, bottom: 300 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "https://blob/sprayer.png", width: 120, height: 180 }, box: { x: 440, y: 120, width: 120, height: 180 } },
        ],
    };
    const context = { family: "Round", capacityMl: 78, color: "Frosted", applicator: "Vintage Bulb Sprayer", websiteSku: "GBRndFrst78AnSpGl" };

    it("uses the tinted-glass blend only for the seated tube", () => {
        const kit = structuredClone(REGISTER_KIT);
        const tube = kit.parts[0];
        tube.views = ["sidecar", "capon"];
        tube.blendMode = "multiply";
        tube.opacity = .5;
        const lifted = { ...tube, views: ["exploded"] as const, blendMode: undefined, opacity: undefined };
        kit.parts.push({ ...lifted, views: ["exploded"] });
        for (const view of ["sidecar", "capon"] as const) {
            expect(stageLayout(kit, view, { ...context, applicator: "Fine Mist Sprayer" })!.parts.find(p => p.slot === "diptube")?.blendMode).toBe("multiply");
        }
        expect(stageLayout(kit, "exploded", { ...context, applicator: "Fine Mist Sprayer" })!.parts.find(p => p.slot === "diptube")?.blendMode).toBeUndefined();
    });

    it("keeps the physical tube trim when lifted, without changing its image scale", () => {
        const kit = structuredClone(REGISTER_KIT);
        kit.parts[0].trimBottomPct = 30;
        kit.parts[0].bounds.bottom = 930;
        kit.parts[0].explodeIndex = 1;
        for (const view of ["sidecar", "capon", "exploded"] as const) {
            const tube = stageLayout(kit, view, context)!.parts.find(part => part.slot === "diptube")!;
            expect(tube.clipBottomPct).toBe(30);
            expect(tube.box?.heightPct).toBeCloseTo(900 / 1100 * 100);
        }
    });

    it("clips a dip tube at the plate's baseline when it is seated, and never the plate or the sprayer", () => {
        const layout = stageLayout(REGISTER_KIT, "capon", context)!;
        const tube = layout.parts.find((part) => part.slot === "diptube")!;
        expect(tube.clipBottomPct).toBeCloseTo((200 / 900) * 100, 3);
        expect(layout.parts.find((part) => part.slot === "body")!.clipBottomPct).toBeUndefined();
        expect(layout.parts.find((part) => part.slot === "sprayer")!.clipBottomPct).toBeUndefined();
    });

    it("clips less once the tube is lifted with its sprayer", () => {
        const seated = stageLayout(REGISTER_KIT, "capon", context)!.parts.find((part) => part.slot === "diptube")!;
        const lifted = stageLayout(REGISTER_KIT, "exploded", context)?.parts.find((part) => part.slot === "diptube");
        if (lifted && lifted.dyPct < 0) expect(lifted.clipBottomPct ?? 0).toBeLessThan(seated.clipBottomPct!);
    });
});

describe("studio backdrop", () => {
    // The Tall 9 mL 13-415 register kit on the 1000 x 1100 canvas (Frosted, 7.2 px/mm).
    const TALL: KitLike = {
        ...KIT,
        sku: "GBTallCylFrst9SpryBlkSh",
        anchors: { axisX: 500, neckAxisX: 500, seatY: 300, baselineY: 1061, pxPerMm: 7.2 },
        register: { bodyId: "cylinder-9ml-13-415", plateKey: "cylinder-9ml-13-415|Frosted", glass: "Frosted", pxPerMm: 7.2 },
    };

    it("pins the body's studio under the kit, its floor point on the kit's baseline under the axis", () => {
        const layout = stageLayout(TALL, "capon", CONTEXT)!;
        const b = layout.backdrop!;
        expect(b.url).toBe("/images/pdp/backdrops/cylinder-9ml-13-415-frosted.webp");
        // the studio's own floor replaces the drawn baseline
        expect(layout.baseline).toBe(false);
        // backdrop px/mm 6 -> kit 7.2: the floor point (750, 1109.51) lands on (500, 1061)
        const k = 7.2 / 6;
        expect(b.box.leftPct).toBeCloseTo(((500 - 750 * k) / 1000) * 100, 3);
        expect(b.box.topPct).toBeCloseTo(((1061 - 1109.51 * k) / 1100) * 100, 3);
        expect(b.box.widthPct).toBeCloseTo(((1500 * k) / 1000) * 100, 3);
    });

    it("keeps the measuring grid in EXPLODED and the flat canvas for bodies without a studio", () => {
        expect(stageLayout(TALL, "exploded", CONTEXT)!.backdrop).toBeNull();
        expect(stageLayout(KIT, "capon", CONTEXT)!.backdrop).toBeNull();
        expect(stageLayout({ ...TALL, register: { ...TALL.register!, bodyId: "cylinder-9ml-17-415" } }, "capon", CONTEXT)!.backdrop).toBeNull();
    });
});

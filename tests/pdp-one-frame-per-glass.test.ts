import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexHttpClient } from "convex/browser";
import { getFunctionName } from "convex/server";

const state = vi.hoisted(() => ({ calls: [] as Array<{ name: string; args: unknown }>, fail: false }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/convexServerClient", () => ({ createResilientConvexHttpClient: () => fakeConvex() }));

import { drawableRegisterKits } from "@/lib/register/load";
import type { RegisterStagePayload } from "@/lib/register/stage-kit";
import { glassStageEnvelopes, loadGlassStageEnvelopes } from "@/lib/register/stage-envelopes";
import { glassEnvelope, stageEnvelope, stageFrameBounds, stageFrameKey, stageLayout, type KitLike, type StageLayout } from "@/lib/products/pdp-redesign/stage";

/**
 * One 30 mL glass on the register (130 mm seat to foot, so its datum draws it
 * 800 px tall at 6.15 px/mm) and four tops: a short cap, a lotion pump whose
 * overcap stands above the canvas, a fine mist sprayer whose dip tube runs
 * past the foot, and a vintage bulb sprayer whose hose and tassel hang far
 * beside and below the glass.
 */
const BODY = "test-30ml-18-415";
const PLATE = {
    plateKey: `${BODY}|Clear`, bodyId: BODY, glass: "Clear", url: "https://blob/register/plates/clear.png",
    width: 800, height: 1600, pxPerMm: 10, anchors: { axisX: 400, seatY: 200, baselineY: 1500, shoulderY: 400 }, approved: true,
};
const layer = (slot: string, url: string, width: number, height: number, anchor: { x: number; y: number }, z: "front" | "behind-body" = "front", explodeIndex = 1) =>
    ({ slot, z, explodeIndex, url: `https://blob/register/components/${url}.png`, width, height, pxPerMm: 10, anchor, approved: true }) as RegisterStagePayload["components"][string]["layers"][number];
const component = (componentId: string, type: string, layers: ReturnType<typeof layer>[]) => ({ componentId, type, layers, approved: true });
const COMPONENTS = {
    "CMP-CAP": component("CMP-CAP", "cap", [layer("cap", "cap", 200, 300, { x: 100, y: 280 })]),
    "CMP-PUMP": component("CMP-PUMP", "lotion-pump", [
        layer("pump", "pump", 200, 500, { x: 100, y: 480 }, "front", 1),
        layer("overcap", "overcap", 260, 700, { x: 130, y: 680 }, "front", 2),
    ]),
    "CMP-SPRAY": component("CMP-SPRAY", "fine-mist", [
        layer("sprayer", "sprayer", 200, 400, { x: 100, y: 380 }, "front", 1),
        layer("diptube", "diptube", 40, 1800, { x: 20, y: 0 }, "behind-body", 0),
    ]),
    "CMP-BULB": component("CMP-BULB", "bulb-sprayer", [layer("sprayer", "bulb", 1400, 1800, { x: 1300, y: 300 })]),
};
const SKUS = {
    "GB-ROLL": { part: "CMP-CAP", role: "cap", applicator: "Metal Roller Ball" },
    "GB-PUMP": { part: "CMP-PUMP", role: "pump", applicator: "Lotion Pump" },
    "GB-SPRAY": { part: "CMP-SPRAY", role: "sprayer", applicator: "Fine Mist Sprayer" },
    "GB-BULB": { part: "CMP-BULB", role: "sprayer", applicator: "Vintage Bulb Sprayer with Tassel" },
} as const;
type Sku = keyof typeof SKUS;
const PAYLOAD: RegisterStagePayload = {
    plates: { [PLATE.plateKey]: PLATE },
    components: COMPONENTS,
    bodies: { [BODY]: { bodyId: BODY, family: "Test", capacityMl: 30, neck: "18-415", dims: { heightBareMm: 150, diameterMm: 40, widthMm: 40 } } },
    assemblies: Object.fromEntries(Object.entries(SKUS).map(([sku, { part, role }]) => [sku, {
        graceSku: sku, websiteSku: `${sku}-web`, bodyId: BODY, plateKey: PLATE.plateKey, glass: "Clear", neck: "18-415",
        parts: [{ role, componentId: part }], renderable: true, reason: null,
    }])),
};
const KITS = drawableRegisterKits(PAYLOAD);
const kit = (sku: Sku) => KITS[sku] as KitLike;
const context = (sku: Sku, family = "Test") => ({ family, capacityMl: 30, color: "Clear", applicator: SKUS[sku].applicator, websiteSku: `${sku}-web` });
const STANDARD: Sku[] = ["GB-ROLL", "GB-PUMP", "GB-SPRAY"];

/** Where a layout puts a canvas point on the 1000 x 1100 canvas. */
const onCanvas = (layout: StageLayout, x: number, y: number) => ({ x: layout.frame.x * 10 + x * layout.frame.scale, y: layout.frame.y * 11 + y * layout.frame.scale });

function fakeConvex() {
    return {
        async query(ref: Parameters<typeof getFunctionName>[0], args: Record<string, unknown>) {
            const name = getFunctionName(ref);
            state.calls.push({ name, args });
            if (state.fail) throw new Error("fetch failed");
            switch (name) {
                case "products:getGroupsByFamily": return [
                    { _id: "g-clear-roll", capacityMl: 30, neckThreadSize: "18-415" },
                    { _id: "g-clear-bulb", capacityMl: 30, neckThreadSize: "18-400" },
                    { _id: "g-other-size", capacityMl: 50, neckThreadSize: "18-415" },
                ];
                case "products:getCatalogGroupVariantPreviewData": return (args.groupIds as string[]).map((groupId) => ({
                    groupId,
                    variants: groupId === "g-clear-roll"
                        ? [...STANDARD.map((sku) => ({ graceSku: sku, websiteSku: `${sku}-web`, applicator: SKUS[sku].applicator })),
                            { graceSku: "GB-OLD", websiteSku: "GBOld__RETIRED__", applicator: "Lotion Pump" }]
                        : groupId === "g-clear-bulb" ? [{ graceSku: "GB-BULB", websiteSku: "GB-BULB-web", applicator: SKUS["GB-BULB"].applicator }] : [{ graceSku: "GB-FIFTY", websiteSku: "GBFifty", applicator: "Lotion Pump" }],
                }));
                case "registerStage:forSkus": {
                    const wanted = new Set(args.graceSkus as string[]);
                    return { ...PAYLOAD, assemblies: Object.fromEntries(Object.entries(PAYLOAD.assemblies).filter(([sku]) => wanted.has(sku))) };
                }
                default: throw new Error(`Unexpected query: ${name}`);
            }
        },
    };
}

describe("one frame per glass", () => {
    it("draws the glass at one size in one place whichever top is picked", () => {
        const envelope = stageEnvelope(STANDARD.map(kit));
        const layouts = STANDARD.map((sku) => stageLayout(kit(sku), "sidecar", context(sku), { envelope })!);
        for (const layout of layouts) expect(layout.frame).toEqual(layouts[0].frame);
        const body = kit("GB-ROLL").parts.find((part) => part.slot === "body")!;
        for (const layout of layouts) {
            expect(layout.parts.find((part) => part.slot === "body")!.box).toEqual(layouts[0].parts.find((part) => part.slot === "body")!.box);
            expect(onCanvas(layout, body.bounds.left, body.bounds.bottom)).toEqual(onCanvas(layouts[0], body.bounds.left, body.bounds.bottom));
        }
        // Framed alone, the tall overcap shrank the pump's glass: the defect this fixes.
        const alone = STANDARD.map((sku) => stageLayout(kit(sku), "sidecar", context(sku))!.frame.scale);
        expect(new Set(alone).size).toBeGreaterThan(1);
        expect(layouts[0].frame.scale).toBe(Math.min(...alone));
    });

    it("keeps CAP ON and SIDECAR on the same frame", () => {
        const envelope = stageEnvelope(STANDARD.map(kit));
        expect(stageLayout(kit("GB-PUMP"), "capon", context("GB-PUMP"), { envelope })!.frame)
            .toEqual(stageLayout(kit("GB-PUMP"), "sidecar", context("GB-PUMP"), { envelope })!.frame);
    });

    it("widens the frame for a top that reaches past the envelope rather than cutting it", () => {
        const layout = stageLayout(kit("GB-BULB"), "capon", context("GB-BULB"), { envelope: stageEnvelope(STANDARD.map(kit)) })!;
        const bounds = stageFrameBounds(kit("GB-BULB"))!;
        const topLeft = onCanvas(layout, bounds.left, bounds.top);
        const bottomRight = onCanvas(layout, bounds.right, bounds.bottom);
        expect(topLeft.x).toBeGreaterThanOrEqual(39.9);
        expect(topLeft.y).toBeGreaterThanOrEqual(43.9);
        expect(bottomRight.x).toBeLessThanOrEqual(960.1);
        expect(bottomRight.y).toBeLessThanOrEqual(1056.1);
    });

    it("sizes a register glass by its datum, never by a plate-era capacity lock", () => {
        // Slim 50 mL's lock (0.40) was written for its plate; it shrank the register drawing to less than the 30 mL.
        const slim50 = { ...context("GB-ROLL", "Slim"), capacityMl: 50 };
        expect(stageLayout(kit("GB-ROLL"), "sidecar", slim50)!.frame.scale).toBe(1);
        const legacy: KitLike = { ...kit("GB-ROLL"), register: null };
        expect(stageLayout(legacy, "sidecar", slim50)!.frame.scale).toBeLessThanOrEqual(0.4);
    });

    it("frames a behind-glass tube only down to the foot, where the stage clips it", () => {
        const spray = kit("GB-SPRAY");
        const tube = spray.parts.find((part) => part.slot === "diptube")!;
        expect(tube.bounds.bottom).toBeGreaterThan(spray.anchors.baselineY);
        expect(stageFrameBounds(spray)!.bottom).toBe(spray.anchors.baselineY);
        const withoutTube: KitLike = { ...spray, parts: spray.parts.filter((part) => part.slot !== "diptube") };
        expect(stageLayout(spray, "capon", context("GB-SPRAY"))!.frame).toEqual(stageLayout(withoutTube, "capon", context("GB-SPRAY"))!.frame);
        expect(stageLayout(spray, "capon", context("GB-SPRAY"))!.parts.find((part) => part.slot === "diptube")!.clipBottomPct).toBeGreaterThan(0);
    });
});

describe("frame keys", () => {
    it("gives every top on a glass one key and each hanging top its own", () => {
        expect(stageFrameKey(BODY, "Lotion Pump")).toBe(BODY);
        expect(stageFrameKey(BODY, "Reducer")).toBe(BODY);
        expect(stageFrameKey(BODY, null)).toBe(BODY);
        expect(stageFrameKey(BODY, "Vintage Bulb Sprayer")).toBe(`${BODY}|vintage bulb sprayer`);
        expect(stageFrameKey(BODY, " vintage bulb sprayer with tassel ")).toBe(`${BODY}|vintage bulb sprayer with tassel`);
    });

    it("frames a page's kit to its key's shared envelope, widened only by the page's kits of that key", () => {
        const page = [...STANDARD, "GB-BULB" as const].map((sku) => ({ kit: kit(sku), applicator: SKUS[sku].applicator }));
        const standard = stageEnvelope(STANDARD.map(kit))!;
        expect(glassEnvelope(page[0], page, {})).toEqual(standard);
        const wide = { ...standard, left: standard.left - 100 };
        expect(glassEnvelope(page[0], page, { [BODY]: wide })).toEqual(wide);
        expect(glassEnvelope(page[3], page, {})).toEqual(stageFrameBounds(kit("GB-BULB")));
        expect(glassEnvelope({ kit: { ...kit("GB-ROLL"), register: null }, applicator: "Metal Roller Ball" }, page, { [BODY]: wide })).toBeNull();
    });
});

describe("envelopes from the catalogue and the register", () => {
    beforeEach(() => { state.calls = []; state.fail = false; });

    it("merges every listed SKU of the glass by frame key, whatever its page's neck label", async () => {
        const envelopes = await glassStageEnvelopes(fakeConvex() as unknown as Pick<ConvexHttpClient, "query">, { family: "Test", capacityMl: 30 });
        expect(envelopes).toEqual({
            [BODY]: stageEnvelope(STANDARD.map(kit)),
            [`${BODY}|vintage bulb sprayer with tassel`]: stageFrameBounds(kit("GB-BULB")),
        });
        const previewCall = state.calls.find((call) => call.name === "products:getCatalogGroupVariantPreviewData")!;
        expect(previewCall.args).toEqual({ groupIds: ["g-clear-roll", "g-clear-bulb"] });
        const requested = state.calls.filter((call) => call.name === "registerStage:forSkus").flatMap((call) => (call.args as { graceSkus: string[] }).graceSkus);
        expect(requested.sort()).toEqual(["GB-BULB", "GB-PUMP", "GB-ROLL", "GB-SPRAY"]);
    });

    it("leaves a page on its own kits when the lookup fails, and never throws", async () => {
        state.fail = true;
        await expect(loadGlassStageEnvelopes({ family: "Test", capacityMl: 30 })).resolves.toEqual({});
    });

    it("reads nothing when the register stage is off", async () => {
        vi.stubEnv("NEXT_PUBLIC_REGISTER_STAGE", "off");
        try {
            await expect(loadGlassStageEnvelopes({ family: "Test", capacityMl: 30 })).resolves.toEqual({});
            expect(state.calls).toEqual([]);
        } finally {
            vi.unstubAllEnvs();
        }
    });
});

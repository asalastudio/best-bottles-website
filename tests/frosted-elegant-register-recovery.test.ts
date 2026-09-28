import { describe, expect, it } from "vitest";
import { composeFrostedElegantGold } from "@/lib/register/load";
import type { RegisterStagePayload } from "@/lib/register/stage-kit";

const bodyId = "elegant-15ml-13-415";
const frostedSku = "GB-ELG-FRS-15ML-SPR";
const goldSku = "GB-ELG-CLR-15ML-SPR-MGLD";
const componentId = "CMP-CAP-SGLD-13-415-02";
const payload: RegisterStagePayload = {
    plates: {
        [`${bodyId}|Frosted`]: {
            plateKey: `${bodyId}|Frosted`, bodyId, glass: "Frosted", url: "https://example.test/frosted.png",
            width: 600, height: 1000, pxPerMm: 15,
            anchors: { axisX: 300, seatY: 100, baselineY: 915, shoulderY: 130 }, approved: true,
        },
    },
    bodies: { [bodyId]: { bodyId, family: "Elegant", capacityMl: 15, neck: "13-415", dims: { heightBareMm: 61, diameterMm: 36, widthMm: 36 } } },
    components: {
        [componentId]: { componentId, type: "fine-mist-sprayer", approved: true, layers: [{
            slot: "sprayer", z: "front", explodeIndex: 1, url: "https://example.test/matte-gold.png",
            width: 100, height: 150, pxPerMm: 15, anchor: { x: 50, y: 145 }, approved: true,
        }] },
    },
    assemblies: {
        [frostedSku]: { graceSku: frostedSku, websiteSku: "GBElgFrst15SpryBluMatt", bodyId,
            plateKey: `${bodyId}|Frosted`, glass: "Frosted", neck: "13-415", parts: [{ role: "sprayer", componentId }], renderable: true, reason: null },
        [goldSku]: { graceSku: goldSku, websiteSku: "GBElg15SpryGlMatt", bodyId,
            plateKey: `${bodyId}|Clear`, glass: "Clear", neck: "13-415", parts: [{ role: "sprayer", componentId }], renderable: true, reason: null },
    },
};

describe("frosted Elegant matte-gold register recovery", () => {
    it("draws the approved frosted body and exact matte-gold sprayer for the missing SKU", () => {
        const kit = composeFrostedElegantGold(payload);
        expect(kit?.sku).toBe("GBElgFrst15SpryGlMatt");
        expect(kit?.parts.map((part) => [part.slot, part.image.url])).toEqual([
            ["body", "https://example.test/frosted.png"],
            ["sprayer", "https://example.test/matte-gold.png"],
        ]);
    });

    it("refuses a donor from another physical body", () => {
        expect(composeFrostedElegantGold({ ...payload, assemblies: {
            ...payload.assemblies,
            [goldSku]: { ...payload.assemblies[goldSku]!, bodyId: "different-body" },
        } })).toBeNull();
    });
});

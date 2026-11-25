import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import psd from "@/lib/register/psd-tubes.generated.json";
import hero from "@/lib/register/hero-tubes.json";
import { heroTube } from "@/lib/register/dip-tubes";
import type { PlateGeometry } from "@/lib/register/compose";

type Tube = {
    bodyId: string; glass: string; kind: string; plateKey: string; families: string[];
    seated: { url: string; width: number; height: number }; exploded: { url: string; width: number; height: number };
    box: { x: number; y: number; width: number; height: number }; floorY: number; innerFloorY: number; opacity: number;
    datum: { axisX: number; seatY: number; pxPerMm: number }; glassBounds: { left: number; right: number; top: number; bottom: number };
    stemExits: [number, number]; sourcePxPerMm: number;
};
const tubes = (psd as unknown as { tubes: Record<string, Tube> }).tubes;
const heroKeys = Object.keys((hero as unknown as { tubes: Record<string, unknown> }).tubes);
const TYPE = { bulb: "vintage-bulb-sprayer", tassel: "tassel-bulb-sprayer", spray: "fine-mist-sprayer", lotion: "lotion-pump" } as const;
const BODIES = ["circle-50ml-18-415", "circle-100ml-18-415", "round-78ml-18-415", "round-128ml-18-415", "slim-30ml-18-415", "slim-50ml-18-415",
    "slim-100ml-18-415", "elegant-15ml-13-415", "circle-15ml-13-415", "flair-15ml-13-415", "footed-rectangle-10ml-13-415",
    "tall-rectangle-10ml-13-415", "royal-13ml-13-415", "square-15ml-13-415", "bell-10ml-13-415"];

/** The tube heroTube() draws for one plate and family on a frame (the stage datum unless given). */
function draw(key: string, frame?: { axisX: number; seatY: number; pxPerMm: number }) {
    const tube = tubes[key];
    const [plateKey, family] = [key.slice(0, key.lastIndexOf("|")), key.slice(key.lastIndexOf("|") + 1)];
    const f = { width: 1000, height: 1100, ...(frame ?? tube.datum) };
    const plate = { anchors: { axisX: 0, seatY: 0, baselineY: 0 }, pxPerMm: 1 } as unknown as PlateGeometry;
    return heroTube({ plateKey, parts: [{ role: family === "lotion" ? "pump" : "sprayer", componentId: "C" }] },
        { C: { type: TYPE[family as keyof typeof TYPE] } }, plate, f)!;
}

describe("register dip tubes from the PSDs (24 Nov 2026 dip-tube audit, P1)", () => {
    it("replaces every hero cut on the 15 register bodies and no other", () => {
        const expected = heroKeys.filter(key => BODIES.some(body => key.startsWith(`${body}|`)));
        // Every hero cut on these bodies is replaced; the only extra key is a tassel sharing its body's bulb tube.
        for (const key of expected) expect(Object.hasOwn(tubes, key), key).toBe(true);
        for (const key of Object.keys(tubes).filter(key => !expected.includes(key))) expect(key).toMatch(/\|tassel$/);
        for (const key of Object.keys(tubes)) expect(BODIES.some(body => key.startsWith(`${body}|`)), key).toBe(true);
        expect(new Set(Object.values(tubes).map(tube => tube.bodyId))).toEqual(new Set(BODIES));
        for (const tube of Object.values(tubes)) {
            expect(tube.seated.url).toMatch(/^\/images\/approved-masters\/dip-tube-register-[\w.-]+\.png$/);
            expect(existsSync(`public${tube.seated.url}`), tube.seated.url).toBe(true);
            expect(existsSync(`public${tube.exploded.url}`), tube.exploded.url).toBe(true);
        }
    });

    it("draws each tube on the neck axis, inside the glass, from the closure to the inner floor less 1 mm, undistorted", () => {
        for (const [key, tube] of Object.entries(tubes)) {
            const drawn = draw(key);
            const { box, bounds } = drawn.seated!;
            const mm = tube.datum.pxPerMm;
            // On axis within 1 mm (the straight shaft; the last 2 mm bend at the foot is in the bounds).
            expect(Math.abs(box.x + box.width / 2 - tube.datum.axisX) / mm, key).toBeLessThan(1);
            // Inside the glass.
            expect(bounds!.left, key).toBeGreaterThan(tube.glassBounds.left);
            expect(bounds!.right, key).toBeLessThan(tube.glassBounds.right);
            expect(bounds!.bottom, key).toBeLessThan(tube.glassBounds.bottom);
            // Its foot 1 mm above the inner floor.
            expect(bounds!.bottom, key).toBeCloseTo(tube.innerFloorY - mm, 0);
            // No glass between the closure and the tube: it starts at or above the highest measured stem exit.
            expect(bounds!.top, key).toBeLessThanOrEqual(tube.stemExits[0]);
            // Undistorted, at the plate's physical scale.
            expect(box.width / box.height, key).toBeCloseTo(drawn.seated!.width / drawn.seated!.height, 2);
            expect(box.width / drawn.seated!.width, key).toBeCloseTo(mm / tube.sourcePxPerMm, 3);
        }
    });

    it("treats the glass: 0.9 in clear, 0.3 in frosted, no blur; EXPLODED lifts the same tube at full strength", () => {
        for (const [key, tube] of Object.entries(tubes)) {
            const drawn = draw(key);
            expect(drawn.seated!.opacity, key).toBe(tube.glass === "Frosted" ? 0.3 : 0.9);
            expect(drawn.exploded!.opacity, key).toBeUndefined();
            expect(drawn.exploded!.url, key).toBe(drawn.seated!.url);
            expect(drawn.exploded!.box, key).toEqual(drawn.seated!.box);
        }
    });

    it("uses the 13-415 tube on the 13-415 sprayers and the 18-415 tubes elsewhere, bulb and tassel sharing theirs", () => {
        for (const [key, tube] of Object.entries(tubes)) {
            expect(tube.kind, key).toBe(tube.bodyId.endsWith("-13-415") ? "spray13" : key.endsWith("|tassel") ? "bulb" : key.split("|").at(-1));
        }
    });

    it("follows the frame: a smaller frame scales the tube about the seat on the axis", () => {
        const key = "round-78ml-18-415|Clear|bulb";
        const datum = tubes[key].datum;
        const at = draw(key).seated!.box;
        const half = draw(key, { axisX: datum.axisX, seatY: datum.seatY, pxPerMm: datum.pxPerMm / 2 }).seated!.box;
        expect(half.width).toBeCloseTo(at.width / 2, 1);
        expect(half.y - datum.seatY).toBeCloseTo((at.y - datum.seatY) / 2, 1);
        expect(half.x + half.width / 2).toBeCloseTo(at.x + at.width / 2, 1);
    });
});

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import before from "../docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json";
import prior from "../docs/reviews/cylinder-lotion-pumps-2026-11-02/previous-recipe-hashes.json";
import approved from "@/lib/paper-doll/approved-kits.generated.json";
import { CYLINDER_LOTION_TUBE_IMAGE, lotionTubeGeometry, withCylinder25LotionTube } from "@/lib/register/cylinder-lotion-tube";
import { stageLayout, type KitLike, type KitPartLike } from "@/lib/products/pdp-redesign/stage";

describe("Cylinder lotion internals from the 25 ml hero", () => {
    it("preserves all 441 other approved recipes byte for byte", () => {
        let unchanged = 0;
        for (const [sku, kit] of Object.entries(approved.rows)) {
            if (Object.hasOwn(before.rows, sku) || !Object.hasOwn(prior.recipes, sku)) continue;
            expect(createHash("sha256").update(JSON.stringify(kit)).digest("hex"), sku).toBe(prior.recipes[sku as keyof typeof prior.recipes]);
            unchanged++;
        }
        expect(unchanged).toBe(441);
    });
    it("replaces only the 15 nine ml tube sets, preserving every exterior, body, neck and overcap", () => {
        const rows = approved.rows as unknown as Record<string, KitLike>;
        expect(Object.keys(before.rows)).toHaveLength(15);
        const colors = new Set<string>();
        for (const [sku, original] of Object.entries(before.rows) as [string, KitLike][]) {
            const kit = rows[sku];
            colors.add(kit.register!.glass);
            expect(kit.parts.filter(part => part.slot !== "diptube"), sku).toEqual(original.parts.filter(part => part.slot !== "diptube"));
            expect(kit.anchors).toEqual(original.anchors);
            expect(kit.register).toEqual(original.register);
            const tubes = kit.parts.filter(part => part.slot === "diptube");
            expect(tubes).toHaveLength(original.parts.filter(part => part.slot === "diptube").length);
            for (const tube of tubes) {
                expect(tube.image.url).toBe(CYLINDER_LOTION_TUBE_IMAGE.url);
                expect(tube.bounds.bottom).toBe(original.parts.find(part => part.slot === "diptube")!.bounds.bottom);
                expect(tube.box!.width / tube.box!.height).toBeCloseTo(725 / 2170, 10);
                const body = kit.parts.find(part => part.slot === "body")!;
                expect(tube.bounds.bottom).toBeLessThan(body.bounds.bottom);
                expect(tube.bounds.left).toBeGreaterThan(body.bounds.left);
                expect(tube.bounds.right).toBeLessThan(body.bounds.right);
            }
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const context = { websiteSku: sku, family: "Cylinder", applicator: "Lotion Pump" };
                const old = stageLayout(original, view, context)!, next = stageLayout(kit, view, context)!;
                expect(next.frame, sku + view).toEqual(old.frame);
                expect(next.parts.filter(part => part.slot !== "diptube").map(part => [part.slot, part.url, part.box, part.dxPct, part.dyPct]), sku + view)
                    .toEqual(old.parts.filter(part => part.slot !== "diptube").map(part => [part.slot, part.url, part.box, part.dxPct, part.dyPct]));
                if (view === "exploded") {
                    expect(new Set(next.parts.filter(part => ["pump", "collar", "diptube"].includes(part.slot)).map(part => JSON.stringify([part.dxPct, part.dyPct]))).size).toBe(1);
                }
            }
        }
        expect([...colors].sort()).toEqual(["Amber", "Clear", "Cobalt Blue", "Frosted", "Swirl"]);
    });

    it("cleans only the 25 ml lotion crop and keeps one connected part in seated and exploded views", () => {
        const part = (slot: string, image: string, bounds: KitPartLike["bounds"], views?: KitPartLike["views"]): KitPartLike => ({
            slot, image: { url: image, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top }, bounds, box: { x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top },
            assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, zOrder: 1, explodeIndex: 1, views,
        });
        const body = part("body", "body.png", { left: 350, top: 261, right: 650, bottom: 1061 });
        const pump = part("pump", "pump.png", { left: 375, top: -21.39, right: 624, bottom: 400.92 });
        const cap = part("overcap", "cap.png", { left: 371, top: -24.79, right: 625, bottom: 413.18 });
        const tube = part("diptube", "/images/register/tubes/cylinder-25ml-18-415-clear-lotion.8365ab47547d.png", { left: 442.95, top: 261, right: 527.1, bottom: 995.33 }, ["sidecar", "capon"]);
        const parts: KitPartLike[] = [body, tube, { ...tube, views: ["exploded"] }, pump, cap];
        const result = withCylinder25LotionTube(parts, "cylinder-25ml-18-415", 500, 9.31);
        expect(result.filter(p => p.slot !== "diptube")).toEqual([body, pump, cap]);
        const internals = result.filter(p => p.slot === "diptube");
        expect(internals).toHaveLength(2);
        expect(internals[0].box).toEqual(internals[1].box);
        expect(internals[0].bounds.top).toBeCloseTo(400.92 - 9.31, 8);
        expect(internals[0].bounds.bottom).toBeCloseTo(261 + 734.33 * 1723 / 1789, 8);
        expect(internals[0].opacity).toBe(0.62);
        expect(internals[1].opacity).toBe(1);
        expect(withCylinder25LotionTube(result, "cylinder-25ml-18-415", 500, 9.31)).toEqual(result);
        expect(withCylinder25LotionTube(parts, "cylinder-50ml-18-415", 500, 9.31)).toBe(parts);
    });

    it("registers the same clean material to a new connection and tip without stretching it", () => {
        const small = lotionTubeGeometry(500, 440, 986), large = lotionTubeGeometry(500, 390, 1000);
        expect(small.image).toEqual(large.image);
        expect(small.box.width / small.box.height).toBeCloseTo(large.box.width / large.box.height, 10);
        expect(small.bounds).toMatchObject({ top: 440, bottom: 986 });
    });
});

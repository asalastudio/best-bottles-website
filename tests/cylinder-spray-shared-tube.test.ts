import { describe, expect, it, vi } from "vitest";
import catalog from "../data/asset-ledger/builder-catalog-snapshot.json";
import sprayKits from "@/lib/paper-doll/cylinder-spray-kits.generated.json";
import { stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";
vi.mock("server-only", () => ({}));
import { approvedComponentKit } from "@/lib/paper-doll/approved-component-kits";

const kits = sprayKits.rows as unknown as Record<string, KitLike>;
const sprayRows = catalog.rows.filter(row => row.family === "Cylinder"
    && [25, 50, 100].includes(row.capacityMl ?? 0) && row.neck === "18-415"
    && /spray|bulb/i.test(row.applicator ?? ""));

describe("25, 50 and 100 ml Cylinder spray internals", () => {
    it("covers every catalog spray, bulb and tassel variant in the snapshot", () => {
        expect(sprayRows).toHaveLength(71);
        expect(sprayRows.map(row => row.sku).sort()).toEqual(Object.keys(kits).sort());
    });

    it("uses one shared tube and one body per size with a single tube in every view", () => {
        const bodies = new Map<number, Set<string>>();
        for (const row of sprayRows) {
            const kit = approvedComponentKit(row.sku)!;
            const body = kit.parts.find(part => part.slot === "body")!;
            const bodySet = bodies.get(row.capacityMl!) ?? new Set<string>();
            bodySet.add(body.image.url);
            bodies.set(row.capacityMl!, bodySet);
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const parts = stageLayout(kit, view, { websiteSku: row.sku, applicator: row.applicator })!.parts;
                const tubes = parts.filter(part => part.slot === "diptube");
                expect(tubes, `${row.sku} ${view}`).toHaveLength(1);
                expect(tubes[0].url).toBe("/images/cylinder-sprays/finemist-tube-90380032f33f.png");
                const sourceTube = kit.parts.find(part => part.slot === "diptube" && (!part.views || part.views.includes(view)))!;
                expect(sourceTube.bounds.bottom).toBeLessThan(body.bounds.bottom);
                expect(sourceTube.box!.width / sourceTube.box!.height).toBeCloseTo(sourceTube.image.width / sourceTube.image.height, 8);
                expect(sourceTube.trimBottomPct).toBeGreaterThanOrEqual(0);
            }
        }
        expect([...bodies.keys()].sort((a, b) => a - b)).toEqual([25, 50, 100]);
        for (const bodySet of bodies.values()) expect(bodySet.size).toBe(1);
    });

    it("shortens the 100 ml fine-mist shaft for smaller bottles without shrinking its physical width", () => {
        const samples = ["GBcyl25SpryMtGl", "GBCyl50SpryMtGl", "GBCyl100SpryMtGl"].map(sku => {
            const kit = approvedComponentKit(sku)!;
            const tube = kit.parts.find(part => part.slot === "diptube" && part.views?.includes("sidecar"))!;
            return { widthMm: tube.box!.width / kit.anchors.pxPerMm!, trim: tube.trimBottomPct! };
        });
        expect(samples[0].widthMm).toBeCloseTo(samples[2].widthMm, 8);
        expect(samples[1].widthMm).toBeCloseTo(samples[2].widthMm, 8);
        expect(samples[0].trim).toBeGreaterThan(samples[1].trim);
        expect(samples[1].trim).toBeGreaterThan(samples[2].trim);
    });
});

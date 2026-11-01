import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import index from "@/lib/products/cylinder5-sprayer-index.json";
vi.mock("server-only", () => ({}));
import { localPdpComponentKits, readLocalComponentKits } from "@/lib/paper-doll/local-component-kits";
const before = JSON.parse(readFileSync("docs/reviews/cylinder5-finemist-2026-11-01/before-kits.json", "utf8")).rows as Record<string, BuilderKit>;
const review = JSON.parse(readFileSync(index.kitFile, "utf8")) as { rows: Record<string, BuilderKit>; defaultPdpSkus: string[] };
afterEach(() => vi.unstubAllEnvs());
describe("5 ml fine-mist review registration", () => {
    it("covers only the fifteen existing sprayer SKUs and leaves each body and scale untouched", () => {
        const expected = Object.keys(before).filter(sku => sku.includes("Spry"));
        expect(Object.keys(review.rows).sort()).toEqual(expected.sort());
        expect(review.defaultPdpSkus.sort()).toEqual(expected.sort());
        expect(expected.filter(sku => sku.startsWith("GBCylBlu"))).toHaveLength(7);
        for (const [sku, kit] of Object.entries(review.rows)) {
            expect(kit.parts.find(p => p.slot === "body")).toEqual(before[sku].parts.find(p => p.slot === "body"));
            expect(kit.anchors).toEqual(before[sku].anchors);
            expect(kit.glassSizing).toEqual(before[sku].glassSizing);
        }
    });
    it("keeps a single tube attached to the sprayer, above the inner floor, with no ghost on cobalt", () => {
        for (const [sku, kit] of Object.entries(review.rows)) {
            const sprayer = kit.parts.find(p => p.slot === "sprayer")!;
            const body = kit.parts.find(p => p.slot === "body")!;
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const tubes = kit.parts.filter(p => p.slot === "diptube" && (!p.views || p.views.includes(view)));
                expect(tubes).toHaveLength(sku.startsWith("GBCylBlu") && view !== "exploded" ? 0 : 1);
                for (const tube of tubes) {
                    expect(tube.componentId).toBe(sprayer.componentId);
                    expect(tube.explodeIndex).toBe(sprayer.explodeIndex);
                    expect(tube.bounds.bottom).toBeLessThan(body.bounds.bottom - 4.43 * kit.register!.pxPerMm);
                    // The 39 px source shaft becomes 1.1 mm without changing its aspect ratio.
                    expect(39 * tube.box!.width / tube.image.width / kit.register!.pxPerMm).toBeCloseTo(1.1, 5);
                    expect(tube.box!.width / tube.image.width).toBeCloseTo(tube.box!.height / tube.image.height, 5);
                }
            }
        }
    });
    it("seats the visible hardware bottom at the common shoulder and preserves source aspect", () => {
        for (const kit of Object.values(review.rows)) for (const p of kit.parts.filter(p => ["sprayer", "overcap"].includes(p.slot))) {
            expect(p.bounds.bottom).toBeCloseTo(kit.glassSizing!.landmarkY!, 5);
            expect((p.bounds.left + p.bounds.right) / 2).toBeCloseTo(kit.anchors.axisX, 5);
            expect(p.box!.width / p.image.width).toBeCloseTo(p.box!.height / p.image.height, 5);
        }
    });
    it("serves identical review layers to the local PDP and builder without altering other kits", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("BUILDER_LOCAL_KITS", "");
        const actual = readLocalComponentKits()!;
        for (const sku of index.skus) {
            expect(actual[sku]).toEqual(review.rows[sku]);
            expect(localPdpComponentKits("localhost:3010", undefined, [{ websiteSku: sku }])[sku]).toEqual(actual[sku]);
        }
        for (const sku of Object.keys(before).filter(sku => !sku.includes("Spry"))) expect(actual[sku]).toEqual(before[sku]);
        vi.stubEnv("VERCEL", "1");
        expect(readLocalComponentKits()).toBeNull();
    });
    it("keeps content-addressed local assets intact", () => {
        const assets = new Map(Object.values(review.rows).flatMap(k => k.parts.map(p => [p.image.url, p.image.sha256] as const)));
        for (const [url, expected] of assets) expect(createHash("sha256").update(readFileSync("public" + url)).digest("hex")).toBe(expected);
    });
});

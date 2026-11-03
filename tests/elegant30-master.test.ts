import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { elegant30ReviewSku, ELEGANT30_MASTER_REVIEW_VERSION } from "../src/lib/products/elegant30-master";
import { localPdpComponentKits, readLocalComponentKits } from "../src/lib/paper-doll/local-component-kits";

const review = JSON.parse(readFileSync("public/local-kits/elegant30-master-2026-11-03/kits.json", "utf8"));
afterEach(() => vi.unstubAllEnvs());
describe("30 ml Elegant local master candidates", () => {
    it("uses one body per glass finish across the exact reviewed product and builder kits", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        expect(review.version).toBe(ELEGANT30_MASTER_REVIEW_VERSION);
        const entries = Object.entries(review.rows) as Array<[string, any]>;
        expect(entries).toHaveLength(14);
        const builder = readLocalComponentKits()!;
        const pdp = localPdpComponentKits("localhost:3010", undefined, entries.map(([websiteSku]) => ({ websiteSku })));
        for (const [sku, source] of entries) {
            const body = source.parts.find((part: any) => part.slot === "body");
            const glass = source.familyId.includes("-frosted-") ? "frosted" : "clear";
            // Clear is the Sunburst regeneration of the register plate; the candidate's body was filled white.
            expect(body.image.url).toBe(`/reviews/elegant-master-candidates-2026-11-03/elegant30-${glass === "clear" ? "clear-master-r3" : "frosted-candidate"}.png`);
            expect(elegant30ReviewSku(sku.toLowerCase())).toBe(sku);
            expect(builder[sku]?.parts.find(part => part.slot === "body")?.image.url).toBe(body.image.url);
            expect(pdp[sku]).toEqual(builder[sku]);
        }
        // The three clear sprayers once missing are cut from their own capped PSDs, never another finish's.
        for (const [sku, psd] of [["GBElg30SpryShGl", "GBElg30SpryShnGl"], ["GBElg30SpryShnSl", "GBElg30SpryShSl"], ["GBElg30SpryBlk", "GBElg30SpryBlk."]]) {
            expect(elegant30ReviewSku(sku)).toBe(sku);
            expect(review.rows[sku].source.psd).toContain(`${psd}.psd`);
        }
    });

    it("sizes every kit by the elegant-30ml-15-415 scaler, so each glass renders at the same reviewed size", async () => {
        const scale = JSON.parse(readFileSync("src/lib/register/catalog-scale.generated.json", "utf8"))["elegant-30ml-15-415"];
        const { pdpReviewedGlassFrame } = await import("../src/lib/products/pdp-stage-frame");
        for (const [sku, kit] of Object.entries(review.rows) as Array<[string, any]>) {
            expect(kit.glassSizing, sku).toMatchObject({ heightPct: scale.targetPct, baselinePct: scale.baselinePct });
            const body = kit.parts.find((part: any) => part.slot === "body");
            // The landmark is the glass shoulder (neck base), below the neck top and above the foot.
            expect(kit.glassSizing.landmarkY).toBeGreaterThan(body.bounds.top);
            expect(kit.glassSizing.landmarkY).toBeLessThan(body.bounds.bottom);
            const frame = pdpReviewedGlassFrame(body.bounds, kit.anchors.axisX, kit.glassSizing, kit.canvas.width, kit.canvas.height)!;
            const span = (body.bounds.bottom - kit.glassSizing.landmarkY) * frame.scale / kit.canvas.height * 100;
            expect(span).toBeCloseTo(scale.targetPct, 6);
            expect(frame.y + body.bounds.bottom * frame.scale / kit.canvas.height * 100).toBeCloseTo(scale.baselinePct, 6);
        }
    });

    it("shares the approved Cylinder dip tube across every 30 ml sprayer kit", () => {
        const tubes = (Object.entries(review.rows) as Array<[string, any]>)
            .map(([sku, kit]) => [sku, kit, kit.parts.find((part: any) => part.slot === "diptube")] as const)
            .filter(([, kit]) => kit.parts.some((part: any) => part.slot === "sprayer"));
        expect(tubes).toHaveLength(10);
        expect(new Set(tubes.map(([, , tube]) => tube?.image.url)).size).toBe(1);
        for (const [sku, kit, tube] of tubes) {
            const sprayer = kit.parts.find((part: any) => part.slot === "sprayer").bounds;
            // The straight run (77 of the source's 180 px) stands on the sprayer axis; the top tucks under the collar.
            expect(Math.abs(tube.box.x + 77 / 180 * tube.box.width - (sprayer.left + sprayer.right) / 2), sku).toBeLessThan(0.6);
            expect(sprayer.bottom - tube.box.y, sku).toBeCloseTo(8, 6);
            // The box keeps the image's own aspect, so the catalog's SVG <image> (aspect "meet") cannot letterbox it.
            expect(tube.box.width / tube.box.height, sku).toBeCloseTo(tube.image.width / tube.image.height, 4);
            expect(review.universalDipTube.url).toBe(tube.image.url);
            // Frosted glass hides the tube until the parts come apart.
            expect(tube.views, sku).toEqual(kit.familyId.includes("-frosted-") ? ["exploded"] : undefined);
        }
    });
});

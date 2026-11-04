import { describe, expect, it, vi } from "vitest";
import snapshot from "@/lib/paper-doll/sleek-large-tubes.generated.json";
import cylinder25 from "@/lib/paper-doll/cylinder25-body-index.json";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";
import { pdpReviewedGlassFrame } from "@/lib/products/pdp-stage-frame";
vi.mock("server-only", () => ({}));
import { approvedComponentKit } from "@/lib/paper-doll/approved-component-kits";

describe("Sleek 18-415 shared tubes", () => {
    it("keeps each registered glass and fitment and places its correct tube inside the floor", () => {
        expect(Object.keys(snapshot.rows)).toHaveLength(84);
        for (const [sku, original] of Object.entries(snapshot.rows)) {
            const kit = approvedComponentKit(sku)!;
            expect(kit.parts.find(p => p.slot === "body")?.image.url).toBe(original.parts.find(p => p.slot === "body")?.image.url);
            const body = kit.parts.find(p => p.slot === "body")!;
            const lotion = kit.parts.some(p => p.slot === "pump");
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const tubes = stageLayout(kit, view, { websiteSku: sku })!.parts.filter(p => p.slot === "diptube");
                expect(tubes, sku + " " + view).toHaveLength(1);
                expect(tubes[0].url).toContain(lotion ? "/lotion" : "/finemist-tube-90380032f33f.png");
                const source = kit.parts.find(p => p.slot === "diptube" && (!p.views || p.views.includes(view)))!;
                expect(source.bounds.bottom).toBeLessThan(body.bounds.bottom);
                expect(source.bounds.top).toBeLessThan(source.bounds.bottom);
            }
        }
    });
});

describe("25 ml Cylinder dropper", () => {
    it("uses one body and framing across every current 25 ml Cylinder fitment", () => {
        const master = approvedComponentKit("GBcyl25SpryMtGl")!;
        const body = master.parts.find(p => p.slot === "body")!;
        expect(cylinder25.skus).toHaveLength(45);
        for (const sku of cylinder25.skus) {
            const kit = approvedComponentKit(sku)!;
            expect(kit, sku).toBeTruthy();
            expect(kit.parts.find(p => p.slot === "body")!.image.url, sku).toBe(body.image.url);
            expect(kit.parts.find(p => p.slot === "body")!.box, sku).toEqual(body.box);
            expect(kit.glassSizing, sku).toEqual(master.glassSizing);
        }
    });
    it("shares the Cylinder glass and shows the same pipette for all three finishes", () => {
        const body = approvedComponentKit("GBcyl25SpryMtGl")!.parts.find(p => p.slot === "body")!.image.url;
        for (const sku of ["GBCyl25DrpCu", "GBCyl25DrpGl", "GBCyl25DrpSl"]) {
            const kit = approvedComponentKit(sku)!;
            expect(kit.parts.find(p => p.slot === "body")!.image.url).toBe(body);
            const pipette = kit.parts.find(p => p.slot === "pipette")!;
            const fitment = kit.parts.find(p => p.slot === "fitment")!;
            expect(pipette.image.url).toContain("cylinder25-glass-pipette-v1.png");
            expect(pipette.exploded).toEqual(fitment.exploded);
            expect(pipette.bounds.bottom).toBeLessThan(kit.parts.find(p => p.slot === "body")!.bounds.bottom);
            expect(stageLayout(kit, "capon", { websiteSku: sku })!.parts.find(p => p.slot === "pipette")?.maskImage).toContain("linear-gradient");
        }
    });
});


describe("measured jumbo roller glass", () => {
    it("keeps the 28 ml bare bottle in physical proportion to the 50 ml", () => {
        const ratio = (sku: string) => {
            const kit = approvedComponentKit(sku)!;
            const body = kit.parts.find(part => part.slot === "body")!;
            const frame = pdpReviewedGlassFrame(body.bounds, kit.anchors.axisX, kit.glassSizing!, kit.canvas.width, kit.canvas.height)!;
            return (body.bounds.bottom - body.bounds.top) * frame.scale;
        };
        expect(ratio("GBRoll28Blk") / ratio("GBCyl50MtlRollBlk")).toBeCloseTo(81.73 / 97.77, 8);
    });
});

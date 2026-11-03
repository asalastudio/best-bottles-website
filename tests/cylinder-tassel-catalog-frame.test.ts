import { describe, expect, it } from "vitest";
import * as stage from "@/lib/products/pdp-redesign/stage";
import kits from "@/lib/paper-doll/cylinder-spray-kits.generated.json";

describe("Cylinder tassel catalog framing", () => {
    it("keeps the whole bottle and tassel in frame for all 25, 50 and 100 ml finishes", () => {
        const frame = (stage as unknown as { catalogTasselViewport?: (sku: string, layout: any) => { x: number; y: number; width: number; height: number } }).catalogTasselViewport;
        expect(frame).toBeTypeOf("function");
        const entries = Object.entries(kits.rows).filter(([sku]) => /^gbcyl(25|50|100)ansptsl/i.test(sku));
        expect(entries).toHaveLength(27);
        for (const [sku, kit] of entries) {
            const layout = stage.stageLayout(kit as any, "sidecar", { websiteSku: sku })!;
            const viewport = frame!(sku, layout);
            for (const part of layout.parts.filter(part => part.slot === "body" || part.slot === "sprayer")) {
                const left = ((part.box?.leftPct ?? 0) + part.dxPct) / 100 * layout.canvas.width;
                const top = ((part.box?.topPct ?? 0) + part.dyPct) / 100 * layout.canvas.height;
                const right = left + (part.box?.widthPct ?? 100) / 100 * layout.canvas.width;
                const bottom = top + (part.box?.heightPct ?? 100) / 100 * layout.canvas.height;
                expect(left, `${sku} ${part.slot} left`).toBeGreaterThanOrEqual(viewport.x);
                expect(right, `${sku} ${part.slot} right`).toBeLessThanOrEqual(viewport.x + viewport.width);
                expect(top, `${sku} ${part.slot} top`).toBeGreaterThanOrEqual(viewport.y);
                expect(bottom, `${sku} ${part.slot} bottom`).toBeLessThanOrEqual(viewport.y + viewport.height);
            }
        }
    });
    it("keeps the 25 ml tassel inside the product-page canvas", () => {
        const kit = kits.rows.GBcyl25AnSpTslIvyGl;
        const layout = stage.stageLayout(kit as any, "sidecar", { websiteSku: kit.sku })!;
        const sprayer = layout.parts.find(part => part.slot === "sprayer")!;
        const left = ((sprayer.box!.leftPct + sprayer.dxPct) * layout.frame.scale) + layout.frame.x;
        const bottom = ((sprayer.box!.topPct + sprayer.dyPct + sprayer.box!.heightPct) * layout.frame.scale) + layout.frame.y;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(bottom).toBeLessThanOrEqual(100);
    });
});

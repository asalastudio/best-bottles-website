import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { approvedComponentKit } from "@/lib/paper-doll/approved-component-kits";
import lotions from "@/lib/paper-doll/cylinder-lotion-kits.generated.json";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";

describe("25 ml cylinder lotion tube", () => {
    it("uses the separate generated lotion artwork with each pump and the shared bottle", () => {
        const skus = Object.keys(lotions.rows).filter(sku => /^L[Bb]Cyl25Ltn/i.test(sku));
        expect(skus).toHaveLength(7);
        const spray = approvedComponentKit("GBcyl25SpryMtGl")!;
        const body = spray.parts.find(part => part.slot === "body")!.image.url;
        for (const sku of skus) {
            const kit = approvedComponentKit(sku)!;
            expect(kit.parts.find(part => part.slot === "body")!.image.url).toBe(body);
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const tubes = stageLayout(kit, view, { websiteSku: sku, applicator: "Lotion Pump" })!.parts.filter(part => part.slot === "diptube");
                expect(tubes).toHaveLength(1);
                expect(tubes[0].url).toContain("lotion-tube-d100d687646a.png");
            }
        }
    });

    it("uses each larger bottle's own generated tube and the matching glass master", () => {
        for (const size of [50, 100]) {
            const skus = Object.keys(lotions.rows).filter(sku => new RegExp(`^L[Bb]Cyl${size}Ltn`, "i").test(sku));
            expect(skus).toHaveLength(7);
            const body = approvedComponentKit(`GBCyl${size}SpryMtGl`)!.parts.find(part => part.slot === "body")!.image.url;
            for (const sku of skus) {
                const kit = approvedComponentKit(sku)!;
                const original = (lotions.rows as unknown as Record<string, typeof kit>)[sku];
                expect(kit.parts.find(part => part.slot === "body")!.image.url).toBe(body);
                expect(kit.parts.find(part => part.slot === "pump")!.image.url).toBe(original.parts.find(part => part.slot === "pump")!.image.url);
                for (const view of ["sidecar", "capon", "exploded"] as const) {
                    const parts = stageLayout(kit, view, { websiteSku: sku, applicator: "Lotion Pump" })!.parts;
                    const tube = parts.find(part => part.slot === "diptube");
                    expect(tube?.url).toContain(`lotion${size}-`);
                    if (/ClOvrCap$/i.test(sku)) {
                        const covers = parts.filter(part => part.slot === "overcap");
                        expect(covers).toHaveLength(1);
                        expect(covers[0].url).toBe("/assets/register/overcaps/ltn-18-415-clear-overcap.webp");
                    }
                }
            }
        }
    });
});

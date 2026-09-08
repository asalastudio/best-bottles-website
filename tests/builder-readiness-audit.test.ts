import { describe, expect, it } from "vitest";
import { auditFamilyReadiness } from "../scripts/lib/builder-readiness";
import type { CatalogRow, BuilderKit } from "@/lib/bottle-builder/model";

function fixture() {
    const row = { websiteSku: "GBAuditSpryBlkSh", graceSku: "assembly", family: "Audit", capacityMl: 5,
        color: "Cobalt Blue", category: "Glass Bottle", neckThreadSize: "13-415", applicator: "Fine Mist Sprayer",
        itemName: "5 ml Cobalt Blue Audit bottle with shiny black sprayer", capColor: "Shiny Black", resolution: "bottle_listed",
        webPrice1pc: 1, shopifyVariantId: "assembly-variant", shopifySellable: true, stockStatus: "In Stock",
        components: { Sprayer: [{ websiteSku: "CP13-415SpryBlkSh", graceSku: "component", shopifySellable: true, stockStatus: "In Stock" }] },
    } as unknown as CatalogRow;
    const kit = { sku: row.websiteSku, familyId: "audit-5ml-cobalt-blue-13-415", completeness: "full", conflicts: [],
        canvas: { width: 1000, height: 1100 }, anchors: { axisX: 500, seatY: 300, baselineY: 1000 },
        parts: ["body", "sprayer", "overcap"].map(slot => ({ slot, derivation: "psd-layer", assembled: { x: 0, y: 0 },
            bounds: { left: 400, top: 200, right: 600, bottom: 1000 },
            image: { url: `https://example.com/${slot}.webp`, width: 1000, height: 1100 } })),
    } as unknown as BuilderKit;
    return { row, kit };
}
describe("read-only builder readiness audit", () => {
    it("separates standalone publication from a sellable exact assembly and never mutates it", () => {
        const { row, kit } = fixture(); row.components.Sprayer[0].shopifySellable = false;
        const before = structuredClone(row);
        const [audit] = auditFamilyReadiness([row], [kit]);
        expect(audit.visible).toBe(true);
        expect(audit.blockers).toEqual([]);
        expect(audit.componentStandaloneSellable).toBe(false);
        expect(row).toEqual(before);
    });
    it("does not override assembly sale, retirement or stock restrictions", () => {
        for (const change of ["assembly", "retired", "stock"]) {
            const { row, kit } = fixture();
            if (change === "assembly") row.shopifySellable = false;
            if (change === "retired") row.components.Sprayer[0].websiteSku += "__RETIRED__component__old";
            if (change === "stock") row.components.Sprayer[0].stockStatus = "Out of Stock";
            const [audit] = auditFamilyReadiness([row], [kit]);
            expect(audit.visible).toBe(false);
        }
    });
    it("keeps missing compatibility separate from invalid artwork", () => {
        const a = fixture(); a.row.components = {}; a.row.resolution = "unknown";
        expect(auditFamilyReadiness([a.row], [a.kit])[0].blockers).toContain("missing_bottle_component_links");
        const b = fixture(); b.kit.parts[0].image.width = 12;
        expect(auditFamilyReadiness([b.row], [b.kit])[0].blockers).toEqual(["media_or_configuration_invalid"]);
    });
    it("allows a roller bare preview from a sellable assembly with an unpublished loose sprayer", () => {
        const { row, kit } = fixture(); row.components.Sprayer[0].shopifySellable = false;
        const roller: CatalogRow = { ...row, websiteSku: "GBAuditMtlRollBlkSh", applicator: "Metal Roller Ball",
            components: { "Roll-On Cap": [{ ...row.components.Sprayer[0], websiteSku: "CPRoll13-415BlkSh", shopifySellable: true }] } };
        const rollerKit = { ...kit, sku: roller.websiteSku, completeness: "capSplit", parts: [kit.parts[0], { ...kit.parts[2], slot: "cap" }] } as BuilderKit;
        const result = auditFamilyReadiness([row, roller], [kit, rollerKit]);
        expect(result[1].blockers).toEqual([]);
        expect(result[1].visible).toBe(true);
    });
});

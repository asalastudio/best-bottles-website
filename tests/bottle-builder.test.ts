import { describe, expect, it } from "vitest";
import {
    builderCartItem, builderOrder, configurationFromRow, deriveBuilder, emptySelection,
    groupBuilderBodies, previewParts, reconcileSelection, type BuilderConfiguration, type BuilderKit, type CatalogRow,
} from "@/lib/bottle-builder/model";

function fixture(overrides: Partial<CatalogRow> = {}, slots = ["body", "roller", "cap"]): { row: CatalogRow; kit: BuilderKit } {
    const row = {
        graceSku: "GB-CYL-CLEAR-METAL-BLACK", websiteSku: "Cylinder9MetalBlack", itemName: "9 ml clear Cylinder metal roller with black cap",
        family: "Cylinder", color: "Clear", category: "Glass Bottle", capacityMl: 9, capacity: "9 ml",
        neckThreadSize: "17-415", applicator: "Metal Roller Ball", capColor: "Black", capStyle: null,
        resolution: "fitment_rule", components: { "Roll-On Cap": [{ graceSku: "CAP", itemName: "Black cap", imageUrl: null, capColor: "Black", stockStatus: "In Stock", webPrice1pc: .2, webPrice12pc: null, websiteSku: "CapBlack", productGroupSlug: "caps", shopifyVariantId: "gid://shopify/ProductVariant/2", shopifySellable: true }] },
        webPrice1pc: 1, webPrice10pc: null, webPrice12pc: .9, shopifyVariantId: "gid://shopify/ProductVariant/1", shopifySellable: true,
        caseQuantity: 724, stockStatus: "In Stock", productGroupSlug: "cylinder-9ml-clear-17-415-rollon", bottleOnly: true,
        ...overrides,
    } as CatalogRow;
    const kit = {
        sku: row.websiteSku!, familyId: `cylinder-${row.capacityMl}ml-${row.color!.toLowerCase().replaceAll(" ", "-")}-${row.neckThreadSize}`,
        completeness: "full", conflicts: [], canvas: { width: 1000, height: 1100 },
        anchors: { axisX: 500, neckAxisX: 500, seatY: 300, baselineY: 1000, pxPerMm: null }, plateSha256: "same-plate", three: null,
        parts: slots.map((slot, i) => ({ slot, variantKey: slot, zOrder: i, explodeIndex: i, assembled: { x: 0, y: 0 },
            bounds: { left: 400, top: i === 0 ? 300 : 150, right: 600, bottom: i === 0 ? 1000 : 300 },
            image: { url: `https://example.com/${row.websiteSku}-${slot}.webp`, key: slot, sha256: slot, bytes: 100, width: 1000, height: 1100 },
            image2x: null, mask: null, derivation: "psd-layer", exploded: { dx: 0, dy: 0 },
        })),
    } as BuilderKit;
    return { row, kit };
}
function configuration(overrides: Partial<CatalogRow> = {}): BuilderConfiguration {
    const { row, kit } = fixture(overrides);
    return configurationFromRow(row, kit)!;
}

describe("builder catalog boundary", () => {
    it("requires mapped compatibility, sellability, price and exact verified media", () => {
        for (const overrides of [{ resolution: "unknown" }, { components: {} }, { shopifySellable: false }, { shopifyVariantId: null }, { webPrice1pc: null }, { stockStatus: "Out of Stock" }, { category: "Component" }]) {
            const { row, kit } = fixture(overrides as Partial<CatalogRow>);
            expect(configurationFromRow(row, kit)).toBeNull();
        }
        const { row, kit } = fixture();
        expect(configurationFromRow(row, null)).toBeNull();
        expect(configurationFromRow(row, { ...kit, sku: "another-sku" })).toBeNull();
        expect(configurationFromRow(row, { ...kit, familyId: "cylinder-5ml-clear-13-415" })).toBeNull();
        expect(configurationFromRow(row, { ...kit, conflicts: [kit.sku] })).toBeNull();
        expect(configurationFromRow(row, { ...kit, completeness: "capSplit" })).toBeNull();
        expect(configurationFromRow(row, { ...kit, canvas: { width: 2000, height: 2200 } })).toBeNull();
        expect(configurationFromRow(row, kit)?.id).toBe(row.websiteSku);
    });
    it("only permits capSplit bodies for an actual cap-only assembly", () => {
        const { row, kit } = fixture({ applicator: "Cap/Closure", itemName: "9 ml clear Cylinder bottle with black cap" }, ["body", "cap"]);
        expect(configurationFromRow(row, { ...kit, completeness: "capSplit" })?.fitment).toBe("Screw Cap");
    });
    it("collapses SKU assemblies and colors into bottle bodies while keeping necks distinct", () => {
        const bodies = groupBuilderBodies([configuration(), configuration({ websiteSku: "Amber", graceSku: "AMBER", color: "Amber" }), configuration({ websiteSku: "TALL", graceSku: "TALL", neckThreadSize: "13-415" })]);
        expect(bodies).toHaveLength(2);
        expect(bodies.find(b => b.neck === "17-415")?.configurations).toHaveLength(2);
    });
    it("excludes ambiguous tuples instead of silently buying the first SKU", () => {
        expect(groupBuilderBodies([configuration(), configuration({ websiteSku: "OTHER", graceSku: "OTHER" })])).toEqual([]);
    });
});

describe("selection transitions and preview", () => {
    const clear = configuration();
    const amber = configuration({ websiteSku: "AmberSpray", graceSku: "AMBER", color: "Amber", applicator: "Fine Mist Sprayer", capColor: "Gold" });
    const bodies = groupBuilderBodies([clear, amber]);
    it("starts without a preassembled configuration or arbitrary color", () => {
        const state = reconcileSelection(bodies, { ...emptySelection(), bodyId: clear.bodyId });
        expect(state.color).toBeNull();
        expect(deriveBuilder(bodies, state).configuration).toBeNull();
        expect(previewParts(clear, "body").map(p => p.slot)).toEqual(["body"]);
    });
    it("preselects a sole color but never invents a fitment", () => {
        const state = reconcileSelection(groupBuilderBodies([clear]), { ...emptySelection(), bodyId: clear.bodyId });
        expect(state.color).toBe("Clear");
        expect(state.fitment).toBeNull();
    });
    it("changing color removes incompatible fitment and cap", () => {
        const selected = { bodyId: clear.bodyId, color: "Clear", fitment: clear.fitment, closure: clear.closure, quantity: 50 };
        expect(deriveBuilder(bodies, selected).configuration?.id).toBe(clear.id);
        const next = reconcileSelection(bodies, { ...selected, color: "Amber" });
        expect(next.fitment).toBeNull(); expect(next.closure).toBeNull();
        expect(deriveBuilder(bodies, next).fitments).toEqual(["Fine Mist Sprayer"]);
        expect(deriveBuilder(bodies, { ...selected, bodyId: "wrong-neck" }).configuration).toBeNull();
    });
    it("preserves only valid changes and shows fitment before the closure", () => {
        const state = reconcileSelection(bodies, { bodyId: clear.bodyId, color: "Clear", fitment: clear.fitment, closure: null, quantity: 50 });
        expect(state.closure).toBe(clear.closure);
        expect(previewParts(clear, "fitment").map(p => p.slot)).toEqual(["body", "roller"]);
        expect(previewParts(clear, "complete").map(p => p.slot)).toEqual(["body", "roller", "cap"]);
    });
});

describe("configured purchasing", () => {
    const config = configuration({ webPrice1pc: .53 });
    it("adds exactly the assembled product, with no duplicate loose cap charge", () => {
        const item = builderCartItem(config, 100);
        expect(item).toMatchObject({ graceSku: config.product.graceSku, websiteSku: config.id, quantity: 100, shopifyVariantId: config.product.shopifyVariantId, unitPrice: .53 });
    });
    it("calculates the $50 order minimum in units without imposing the case pack", () => {
        const below = builderOrder(config, 50, []);
        expect(below).toMatchObject({ total: 26.5, minimumQuantity: 95, remainingUnits: 45, canAdd: false });
        expect(builderOrder(config, 95, [])).toMatchObject({ total: 50.35, remainingUnits: 0, canAdd: true });
    });
    it("counts existing checkout-ready cart items and merges the same SKU", () => {
        const other = { ...builderCartItem(config, 50), graceSku: "OTHER" };
        expect(builderOrder(config, 45, [other]).canAdd).toBe(true);
        expect(builderOrder(config, 45, [builderCartItem(config, 50)]).canAdd).toBe(true);
        expect(builderOrder(config, 45, [{ ...other, shopifySellable: false }]).canAdd).toBe(false);
        expect(builderOrder(config, 45, [{ ...other, shopifyVariantId: null }]).canAdd).toBe(false);
    });
    it("rejects fractional, empty, negative, and excessive quantities", () => {
        for (const qty of [NaN, 0, -1, 1.5, Infinity, 1_000_001]) {
            expect(builderOrder(config, qty, []).canAdd).toBe(false);
            expect(() => builderCartItem(config, qty)).toThrow();
        }
        expect(builderOrder(null, 100, []).canAdd).toBe(false);
    });
});

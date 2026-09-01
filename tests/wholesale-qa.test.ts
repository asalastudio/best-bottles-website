import { describe, it, expect } from "vitest";
import {
    checkProduct, verdictFor, summarizeFamily, findDuplicateSkus,
    expectsComponents, type QaProductRow,
} from "../src/lib/wholesale/catalogQa";

const good = (over: Partial<QaProductRow> = {}): QaProductRow => ({
    graceSku: "GB-CYL-CLR-9ML-T-21",
    websiteSku: "CYL-9-CLR",
    itemName: "9 ml Clear Cylinder",
    family: "Cylinder",
    color: "Clear",
    capacity: "9 ml",
    capacityMl: 9,
    neckThreadSize: "17-415",
    heightWithCap: "70mm",
    diameter: "20mm",
    caseQuantity: 724,
    webPrice1pc: 0.73,
    stockStatus: null,
    imageUrl: "https://example.test/a.png",
    imageUrlCapOff: null,
    components: [{ grace_sku: "CMP-ROC-MSLV-17415" }],
    category: "Glass Bottle",
    assemblyType: "3-part",
    productGroupId: "grp_1",
    shopifySellable: true,
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    paperDollBodyUrl: "https://example.test/body.glb",
    ...over,
});

describe("QA: components are only required of configurable bottles", () => {
    // this is the rule production data forced — a naive check produced 35
    // false positives out of 59 findings
    it("does NOT flag a component row for having no components", () => {
        const dropper = good({
            family: "Dropper", category: "Component",
            assemblyType: "component", components: [],
        });
        expect(expectsComponents(dropper)).toBe(false);
        expect(checkProduct(dropper).map((f) => f.code)).not.toContain("missing_components");
    });

    it("does NOT flag an integrated complete-set (metal atomizer)", () => {
        const atomizer = good({
            family: "Atomizer", category: "Metal Atomizer",
            assemblyType: "complete-set", components: [],
        });
        expect(expectsComponents(atomizer)).toBe(false);
        expect(checkProduct(atomizer).map((f) => f.code)).not.toContain("missing_components");
    });

    it("DOES flag a real 2-part/3-part bottle with no components", () => {
        const bottle = good({ assemblyType: "2-part", components: [] });
        expect(expectsComponents(bottle)).toBe(true);
        const codes = checkProduct(bottle).map((f) => f.code);
        expect(codes).toContain("missing_components");
    });

    it("stays silent when the kind is unmarked and unclear", () => {
        expect(expectsComponents(good({ assemblyType: null, category: "Accessory" }))).toBe(false);
    });
});

describe("QA: severity and status", () => {
    it("calls a fully-populated row complete", () => {
        expect(verdictFor(good()).status).toBe("complete");
    });

    it("treats a missing image as degraded, not blocking", () => {
        const v = verdictFor(good({ imageUrl: null, imageUrlCapOff: null }));
        expect(v.status).toBe("degraded");
        expect(v.blocking).toBe(0);
    });

    it("treats an unsellable variant as blocking", () => {
        const v = verdictFor(good({ shopifySellable: false }));
        expect(v.status).toBe("incomplete");
        expect(v.findings.map((f) => f.code)).toContain("not_sellable");
    });

    it("only expects 3D for families that ship a configurator", () => {
        expect(checkProduct(good({ family: "Vial", paperDollBodyUrl: null }))
            .map((f) => f.code)).not.toContain("missing_3d");
        expect(checkProduct(good({ family: "Cylinder", paperDollBodyUrl: null }))
            .map((f) => f.code)).toContain("missing_3d");
    });
});

describe("QA: aggregation", () => {
    it("computes family completion and ranks blocking issues first", () => {
        const health = summarizeFamily("Cylinder", [
            verdictFor(good()),
            verdictFor(good({ graceSku: "B", assemblyType: "2-part", components: [] })),
            verdictFor(good({ graceSku: "C", imageUrl: null, imageUrlCapOff: null })),
        ]);
        expect(health.total).toBe(3);
        expect(health.complete).toBe(1);
        expect(health.completionPct).toBe(33);
        expect(health.topIssues[0].severity).toBe("blocking");
    });

    it("finds duplicate SKUs across rows", () => {
        expect(findDuplicateSkus([{ graceSku: "A" }, { graceSku: "B" }, { graceSku: "A" }]))
            .toEqual(["A"]);
    });
});

// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const fn = (name: string) => makeFunctionReference<"mutation">(`catalogCorrections:${name}`);
const token = "test-token";

/** A bottle row with every field the schema requires; the tests override what they exercise. */
const bottle = {
    websiteSku: "GBPillar9SpryBlkMatt", graceSku: "GB-PIL-CLR-9ML-SPR-MBLK", family: "Pillar", category: "Glass Bottle", shape: "Pillar", color: "Clear",
    capacity: "9 ml (0.3 oz)", capacityMl: 9, capacityOz: 0.3, applicator: "Fine Mist Sprayer", capColor: "Matte Black", trimColor: "Matte Black", capStyle: "Spray",
    neckThreadSize: "17-415", heightWithCap: "20", heightWithoutCap: "57 mm", diameter: "21 ±0.5 mm", bottleWeightG: null, caseQuantity: 1000, qbPrice: null,
    webPrice1pc: 0.97, webPrice10pc: null, webPrice12pc: 0.92, stockStatus: "In Stock",
    itemName: "Pillar design 9ml Clear glass bottle with matte black spray.", itemDescription: null, productUrl: null, dataGrade: "B",
    bottleCollection: "Pillar", fitmentStatus: "verified", components: [{ grace_sku: "CMP-SPR-BLK-17-415-01" }, { grace_sku: "CMP-ROC-WHT-17415" }],
    graceDescription: "9ml Clear Pillar bottle with matte black spray. Thread 17-415.", verified: true,
};
const sibling = {
    ...bottle, websiteSku: "GBTallCyl9SpryBlkMatt", graceSku: "GB-CYL-CLR-9ML-SPR-MBLK-TALL", family: "Cylinder", neckThreadSize: "13-415",
    components: [{ grace_sku: "CMP-CAP-WHT-S-13-415" }, { grace_sku: "CMP-SPR-MTBK-13-415-07" }], graceDescription: null,
};
const group = {
    slug: "pillar-9ml-clear-17-415-finemist", displayName: "9 ml Clear Pillar Fine Mist Spray Bottle", family: "Pillar", capacity: "9 ml (0.3 oz)", capacityMl: 9,
    color: "Clear", category: "Glass Bottle", bottleCollection: "Pillar", neckThreadSize: "17-415", variantCount: 1, priceRangeMin: 0.97, priceRangeMax: 0.97,
};

const changeLog = (t: ReturnType<typeof convexTest>) => t.run(ctx => ctx.db.query("catalogChangeLog").collect());
type Written = { field: string; before: string | null; after: string | null };
const describeWrite = (w: Written) => `${w.field}:${w.before}→${w.after}`;

describe("catalogue corrections (guarded, conditional, logged)", () => {
    const saved = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
    afterEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = saved; });

    it("dry-runs by default, then writes only the fields that still hold the expected value, logging each", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", bottle as never));
        const entries = [{
            websiteSku: bottle.websiteSku,
            expect: { neckThreadSize: "17-415", heightWithCap: "20", useCaseDescription: "Component - Multi-Use" },
            patch: { neckThreadSize: "13-415", heightWithCap: null, useCaseDescription: "Multi-Use" },
        }];
        const dry = await t.mutation(fn("correctProductFields"), { writeToken: token, reason: "test", entries });
        expect(dry.dryRun).toBe(true);
        // Convex hands the patch back with its keys sorted, so compare the set of writes, not their order.
        expect(dry.written.map(describeWrite).sort()).toEqual(["heightWithCap:20→null", "neckThreadSize:17-415→13-415"]);
        // useCaseDescription is unset on the row, so its expectation ("Component - Multi-Use") does not hold
        expect(dry.changedSince).toEqual([{ websiteSku: bottle.websiteSku, field: "useCaseDescription", now: null }]);
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ neckThreadSize: "17-415", heightWithCap: "20" });
        expect(await changeLog(t)).toHaveLength(0);

        const wet = await t.mutation(fn("correctProductFields"), { writeToken: token, dryRun: false, reason: "test", entries });
        expect(wet.written).toHaveLength(2);
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ neckThreadSize: "13-415", heightWithCap: null, family: "Pillar", websiteSku: bottle.websiteSku });
        const log = await changeLog(t);
        expect(log.map(l => [l.targetType, l.label, l.field, l.before, l.after, l.source]).sort((a, b) => a[2].localeCompare(b[2]))).toEqual([
            ["product", bottle.websiteSku, "heightWithCap", '"20"', "null", "catalog-correction: test"],
            ["product", bottle.websiteSku, "neckThreadSize", '"17-415"', '"13-415"', "catalog-correction: test"],
        ]);

        const again = await t.mutation(fn("correctProductFields"), { writeToken: token, dryRun: false, reason: "test", entries });
        expect(again.written).toHaveLength(0);
        expect(again.alreadyCorrect.sort()).toEqual([`${bottle.websiteSku}.heightWithCap`, `${bottle.websiteSku}.neckThreadSize`]);
    });

    it("refuses without the write token and refuses an unknown SKU", async () => {
        const t = convexTest(schema, modules);
        await expect(t.mutation(fn("correctProductFields"), { writeToken: "wrong", reason: "test", entries: [] })).rejects.toThrow(/unauthorized/);
        const result = await t.mutation(fn("correctProductFields"), { writeToken: token, reason: "test", entries: [{ websiteSku: "GBNope", expect: {}, patch: { neckThreadSize: "13-415" } }] });
        expect(result.notFound).toEqual(["GBNope"]);
    });

    it("renames a group's slug and neck finish conditionally, and refuses a slug another group owns", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("productGroups", group as never));
        const entries = [{ slug: group.slug, expect: { slug: group.slug, neckThreadSize: "17-415" }, patch: { slug: "pillar-9ml-clear-13-415-finemist", neckThreadSize: "13-415" } }];
        const result = await t.mutation(fn("correctGroupFields"), { writeToken: token, dryRun: false, reason: "test", entries });
        expect(result.written.map(describeWrite).sort()).toEqual(["neckThreadSize:17-415→13-415", "slug:pillar-9ml-clear-17-415-finemist→pillar-9ml-clear-13-415-finemist"]);
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ slug: "pillar-9ml-clear-13-415-finemist", neckThreadSize: "13-415", displayName: group.displayName, variantCount: 1 });
        expect((await changeLog(t)).map(l => [l.targetType, l.label, l.field]).sort((a, b) => a[2].localeCompare(b[2]))).toEqual([["group", group.slug, "neckThreadSize"], ["group", group.slug, "slug"]]);

        // the old slug no longer resolves; a stale expectation is reported, never written
        const stale = await t.mutation(fn("correctGroupFields"), { writeToken: token, dryRun: false, reason: "test", entries });
        expect(stale.notFound).toEqual([group.slug]);
        const mismatch = await t.mutation(fn("correctGroupFields"), { writeToken: token, dryRun: false, reason: "test",
            entries: [{ slug: "pillar-9ml-clear-13-415-finemist", expect: { neckThreadSize: "17-415" }, patch: { neckThreadSize: "18-415" } }] });
        expect(mismatch.changedSince).toEqual([{ slug: "pillar-9ml-clear-13-415-finemist", field: "neckThreadSize", now: "13-415" }]);

        await t.run(ctx => ctx.db.insert("productGroups", { ...group, slug: "pillar-9ml-clear-13-415" } as never));
        await expect(t.mutation(fn("correctGroupFields"), { writeToken: token, dryRun: false, reason: "test",
            entries: [{ slug: "pillar-9ml-clear-13-415-finemist", expect: { slug: "pillar-9ml-clear-13-415-finemist" }, patch: { slug: "pillar-9ml-clear-13-415" } }] }))
            .rejects.toThrow(/already belongs/);
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ slug: "pillar-9ml-clear-13-415-finemist" });
    });

    it("copies a sibling's component list only while the bottle still lists exactly the expected components", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", bottle as never));
        await t.run(ctx => ctx.db.insert("products", sibling as never));
        const args = { writeToken: token, reason: "test", websiteSku: bottle.websiteSku, copyFromWebsiteSku: sibling.websiteSku };

        const wrongExpectation = await t.mutation(fn("correctProductComponents"), { ...args, dryRun: false, expectComponentSkus: ["CMP-SPR-BLK-17-415-01"] });
        expect(wrongExpectation.outcome).toBe("changed-since");
        expect(wrongExpectation.before).toEqual(["CMP-SPR-BLK-17-415-01", "CMP-ROC-WHT-17415"]);

        const dry = await t.mutation(fn("correctProductComponents"), { ...args, expectComponentSkus: ["CMP-SPR-BLK-17-415-01", "CMP-ROC-WHT-17415"] });
        expect(dry.outcome).toBe("would-write");
        expect((await t.run(ctx => ctx.db.get(id)))?.components).toEqual(bottle.components);

        const wet = await t.mutation(fn("correctProductComponents"), { ...args, dryRun: false, expectComponentSkus: ["CMP-SPR-BLK-17-415-01", "CMP-ROC-WHT-17415"] });
        expect(wet).toMatchObject({ outcome: "written", after: ["CMP-CAP-WHT-S-13-415", "CMP-SPR-MTBK-13-415-07"] });
        expect((await t.run(ctx => ctx.db.get(id)))?.components).toEqual(sibling.components);
        const log = await changeLog(t);
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({ targetType: "product", label: bottle.websiteSku, field: "components", source: `catalog-correction: test (copied from ${sibling.websiteSku})` });
        expect(JSON.parse(log[0].before)).toEqual(["CMP-SPR-BLK-17-415-01", "CMP-ROC-WHT-17415"]);

        const again = await t.mutation(fn("correctProductComponents"), { ...args, dryRun: false, expectComponentSkus: [] });
        expect(again.outcome).toBe("already-correct");
        expect(await changeLog(t)).toHaveLength(1);
    });
});

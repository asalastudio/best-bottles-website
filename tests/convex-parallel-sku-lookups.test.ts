// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { mapInBatches } from "../convex/lib/batches";

/**
 * productPlates.forSkus, productKits.forSkus and registerStage.forSkus read in parallel batches since
 * 7 Nov 2026 instead of one await per SKU. These pin their answers: which row wins, conflicts,
 * duplicates and unknown SKUs, so the change is read-order only. (Key order is not part of an answer:
 * Convex returns object keys sorted.)
 */
const modules = import.meta.glob("../convex/**/*.ts");
const platesForSkus = makeFunctionReference<"query">("productPlates:forSkus");
const kitsForSkus = makeFunctionReference<"query">("productKits:forSkus");
const kitForSku = makeFunctionReference<"query">("productKits:forSku");
const stageForSkus = makeFunctionReference<"query">("registerStage:forSkus");

type Row = { sku: string; plate: Record<string, unknown> & { websiteSku: string; graceSku: string }; kit: Record<string, unknown> };
const rows = (JSON.parse(readFileSync("docs/reviews/component-release-2026-09-22/publication-payload.json", "utf8")).rows as Row[]).slice(0, 20);

async function seedMedia() {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
        for (const [index, row] of rows.entries()) {
            await ctx.db.insert("productPlates", { ...row.plate, revision: 1, importedAt: 1_000 + index } as never);
            await ctx.db.insert("productKits", { ...row.kit, revision: 1, importedAt: 1_000 + index } as never);
        }
        // A second, newer plate under the first SKU's Grace SKU: the newest wins and the SKU is a conflict.
        await ctx.db.insert("productPlates", { ...rows[0].plate, websiteSku: "GBDuplicateWebsite", revision: 2, importedAt: 9_999 } as never);
    });
    return t;
}

describe("mapInBatches", () => {
    it("keeps input order across batches and never runs more than a batch at once", async () => {
        let running = 0;
        let peak = 0;
        const out = await mapInBatches(Array.from({ length: 40 }, (_, i) => i), async (n) => {
            running++;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, (40 - n) % 3));
            running--;
            return n * 2;
        });
        expect(out).toEqual(Array.from({ length: 40 }, (_, i) => i * 2));
        expect(peak).toBeLessThanOrEqual(16);
    });
});

describe("productPlates.forSkus", () => {
    it("answers every SKU asked, newest row first, duplicates reported", async () => {
        const t = await seedMedia();
        const sorted = (keys: string[]) => [...keys].sort();
        const asked = [rows[2].plate.websiteSku, rows[0].plate.graceSku, "unknown-sku", rows[1].plate.websiteSku, ` ${rows[2].plate.websiteSku} `, rows[5].plate.graceSku];
        const result = await t.query(platesForSkus, { skus: asked });
        expect(Object.keys(result.plates)).toEqual(sorted([rows[2].plate.websiteSku, rows[0].plate.graceSku, rows[1].plate.websiteSku, rows[5].plate.graceSku]));
        expect(result.conflicts).toEqual([rows[0].plate.graceSku]);
        // The newer duplicate wins for the shared Grace SKU.
        const newest = await t.query(platesForSkus, { skus: ["GBDuplicateWebsite"] });
        expect(result.plates[rows[0].plate.graceSku]).toEqual(newest.plates.GBDuplicateWebsite);
        // A website SKU with one row is not a conflict and resolves to its own row.
        const single = await t.query(platesForSkus, { skus: [rows[3].plate.websiteSku] });
        expect(single.conflicts).toEqual([]);
        expect(Object.keys(single.plates)).toEqual([rows[3].plate.websiteSku]);
    });
});

describe("productKits.forSkus", () => {
    it("matches forSku for every pair, the first pair per key winning, unknowns null", async () => {
        const t = await seedMedia();
        const pairs = [
            ...rows.slice(0, 18).map((row) => ({ websiteSku: row.plate.websiteSku, graceSku: row.plate.graceSku })),
            { websiteSku: rows[1].plate.websiteSku, graceSku: "a-later-duplicate" },
            { websiteSku: null, graceSku: rows[19].plate.graceSku },
            { websiteSku: "unknown-sku", graceSku: null },
            { websiteSku: null, graceSku: null },
        ];
        const kits = await t.query(kitsForSkus, { pairs });
        const expectedKeys = [...rows.slice(0, 18).map((row) => row.plate.websiteSku), rows[19].plate.graceSku, "unknown-sku"];
        expect(Object.keys(kits)).toEqual([...expectedKeys].sort());
        for (const pair of [...pairs.slice(0, 18), pairs[19], pairs[20]]) {
            const key = pair.websiteSku || pair.graceSku!;
            expect(kits[key], key).toEqual(await t.query(kitForSku, pair));
        }
        expect(kits["unknown-sku"]).toBeNull();
    });
});

const stamp = { snapshot: "test", source: "test", confidence: "high" as const };
const asset = (name: string) => ({ url: `https://example.test/${name}.webp`, key: name, sha256: name.padEnd(64, "0"), bytes: 1, width: 10, height: 20 });
const body = (bodyId: string) => ({
    bodyId, builderBodyId: bodyId, family: "Cylinder", shape: null, capacityMl: 9, neck: "17-415", category: "Glass Bottle",
    compatibilityClass: "glass-17-415", classSource: "test", glassVariants: ["Clear"], fitmentTypes: ["sprayer"],
    dims: { heightBareMm: 70, diameterMm: 18, widthMm: null, confidence: "high", source: "test" },
    representative: { graceSku: `${bodyId}-rep`, websiteSku: `${bodyId}-rep` }, status: "current" as const, register: stamp, revision: 1, loadedAt: 1,
});
const plate = (bodyId: string, approved: boolean) => ({
    plateKey: `${bodyId}|Clear`, bodyId, glass: "Clear", image: asset(`${bodyId}-plate`), thumb: null, pxPerMm: 10,
    anchors: { axisX: 5, seatY: 2, baselineY: 19, shoulderY: null }, anchorStatus: approved ? "approved" as const : "measured" as const,
    anchorMeasuredBy: null, source: { library: "test", path: "test", psdSha256: null, layer: null }, derivedFrom: null,
    storageProvider: "vercel-blob" as const, revision: 1, importedAt: 1,
});
const component = (componentId: string, approved: boolean) => ({
    componentId, graceSku: componentId, websiteSku: null, sellable: true, type: "fine-mist-sprayer" as const, neck: "17-415",
    finish: { capColor: null, capStyle: null, color: null, trimColor: null, dotted: false, rollerMaterial: null },
    itemName: componentId, psd: null, status: "current" as const, statusReason: null, register: stamp,
    layers: [{ slot: "sprayer" as const, layerName: null, z: "front" as const, image: asset(componentId), image2x: null, pxPerMm: 10,
        anchor: { x: 5, y: 2 }, anchorStatus: approved ? "approved" as const : "measured" as const, explodeIndex: 1 }],
    layersStatus: approved ? "approved" as const : "measured" as const, storageProvider: "vercel-blob" as const, revision: 1, loadedAt: 1,
});
const assembly = (graceSku: string, bodyId: string, parts: string[], status: "verified" | "quarantine" = "verified") => ({
    graceSku, websiteSku: `${graceSku}-web`, bodyId, plateKey: `${bodyId}|Clear`, neck: "17-415", glass: "Clear",
    compatibilityClass: "glass-17-415", fitmentType: "sprayer", capColor: null, capStyle: null, assemblyType: "2-part" as const,
    compatible: parts, unresolvedListed: [], excludedByRule: [],
    build: { parts: parts.map((componentId) => ({ role: "sprayer" as const, componentId })), status: "resolved" as const, reason: null },
    status, statusReason: "", legacy: { kitPlateSha256: null, capOffPlateSha256: null }, register: stamp, revision: 1, loadedAt: 1,
});

describe("registerStage.forSkus", () => {
    it("returns every assembly asked with the plates, bodies and components it names", async () => {
        const t = convexTest(schema, modules);
        await t.run(async (ctx) => {
            for (const id of ["body-b", "body-a"]) await ctx.db.insert("registerBodies", body(id));
            await ctx.db.insert("registerBodyPlates", plate("body-a", true));
            await ctx.db.insert("registerBodyPlates", plate("body-b", false));
            await ctx.db.insert("registerComponents", component("comp-1", true));
            await ctx.db.insert("registerComponents", component("comp-2", true));
            await ctx.db.insert("registerComponents", component("comp-3", false));
            await ctx.db.insert("registerAssemblies", assembly("ok", "body-a", ["comp-2", "comp-1"]));
            await ctx.db.insert("registerAssemblies", assembly("unapproved-plate", "body-b", ["comp-1"]));
            await ctx.db.insert("registerAssemblies", assembly("missing-part", "body-a", ["comp-9"]));
            await ctx.db.insert("registerAssemblies", assembly("unapproved-layer", "body-a", ["comp-3"]));
            await ctx.db.insert("registerAssemblies", assembly("quarantined", "body-a", ["comp-1"], "quarantine"));
            await ctx.db.insert("registerAssemblies", assembly("no-body", "body-z", ["comp-1"]));
        });
        const result = await t.query(stageForSkus, { graceSkus: ["unapproved-plate", "ok", "unknown", "missing-part", "ok", "unapproved-layer", "quarantined", "no-body"] });
        expect(Object.keys(result.assemblies).sort()).toEqual(["missing-part", "no-body", "ok", "quarantined", "unapproved-layer", "unapproved-plate", "unknown"]);
        expect(Object.keys(result.plates).sort()).toEqual(["body-a|Clear", "body-b|Clear"]);
        expect(Object.keys(result.bodies).sort()).toEqual(["body-a", "body-b"]);
        expect(Object.keys(result.components).sort()).toEqual(["comp-1", "comp-2", "comp-3"]);
        expect(result.assemblies.unknown).toBeNull();
        const reasons = Object.fromEntries(Object.entries(result.assemblies).map(([sku, row]) => [sku, row ? (row as { reason: string | null }).reason : "absent"]));
        expect(reasons).toEqual({
            "unapproved-plate": "body plate not approved",
            ok: null,
            unknown: "absent",
            "missing-part": "a part has no component record",
            "unapproved-layer": "a part's layers are not approved",
            quarantined: "assembly is quarantine",
            "no-body": "no body plate for this glass",
        });
        expect((result.assemblies.ok as { renderable: boolean; parts: unknown[] }).renderable).toBe(true);
        expect((result.assemblies.ok as { parts: unknown[] }).parts).toEqual([{ role: "sprayer", componentId: "comp-2" }, { role: "sprayer", componentId: "comp-1" }]);
    });
});

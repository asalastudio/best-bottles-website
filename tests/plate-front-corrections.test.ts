// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const replacePlateFronts = makeFunctionReference<"mutation">("productPlates:replacePlateFronts");
const token = "test-token";
const HOST = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com";

const asset = (sku: string, sha: string, state = "on") => {
    const key = `plates/vial-4ml-clear-13-425/${sku}/${sha}.front-${state}-1000x1100.webp`;
    return { url: `${HOST}/${key}`, key, sha256: sha, bytes: 1234, width: 1000, height: 1100 };
};
const thumb = (sku: string, sha: string) => {
    const key = `plates/vial-4ml-clear-13-425/${sku}/${sha}.front-on-240x240.webp`;
    return { url: `${HOST}/${key}`, key, sha256: sha, bytes: 99, width: 240, height: 240 };
};
const plateRow = (sku: string, frontSha: string) => ({
    sku, websiteSku: sku, graceSku: `GRACE-${sku}`, familyId: "vial-4ml-clear-13-425",
    front: asset(sku, frontSha), frontCapOff: asset(sku, "c".repeat(64), "off"), thumb: thumb(sku, "d".repeat(64)), thumbCapOff: null,
    views: [], source: { library: "master", path: `12. Vials/${sku}.psd`, psdSha256: "e".repeat(64), psdSha256CapOff: null },
    builder: { name: "publish.mjs", version: "1.0.0", builtAt: 1 }, storageProvider: "vercel-blob" as const, revision: 1, importedAt: 1,
});
const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const entry = (sku: string, from = OLD, to = NEW) => ({ sku, expectFront: { sha256: from, url: asset(sku, from).url }, front: asset(sku, to) });

describe("replacePlateFronts (guarded, all or nothing)", () => {
    const saved = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
    afterEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = saved; });

    it("dry-runs by default, then replaces only the front, and a re-run is a no-op", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("productPlates", plateRow("GBV1DrmBlackCapSht", OLD)));
        const entries = [entry("GBV1DrmBlackCapSht")];

        const dry = await t.mutation(replacePlateFronts, { writeToken: token, entries });
        expect(dry).toEqual({ dryRun: true, replaced: ["GBV1DrmBlackCapSht"], alreadyReplaced: [], refused: [] });
        expect((await t.run(ctx => ctx.db.get(id)))?.front.sha256).toBe(OLD);

        const wet = await t.mutation(replacePlateFronts, { writeToken: token, dryRun: false, entries });
        expect(wet.replaced).toEqual(["GBV1DrmBlackCapSht"]);
        const after = await t.run(ctx => ctx.db.get(id));
        expect(after?.front).toEqual(asset("GBV1DrmBlackCapSht", NEW));
        expect(after?.revision).toBe(2);
        // everything else on the row is untouched
        expect(after?.frontCapOff).toEqual(plateRow("GBV1DrmBlackCapSht", OLD).frontCapOff);
        expect(after?.thumb).toEqual(plateRow("GBV1DrmBlackCapSht", OLD).thumb);
        expect(after?.source).toEqual(plateRow("GBV1DrmBlackCapSht", OLD).source);

        const again = await t.mutation(replacePlateFronts, { writeToken: token, dryRun: false, entries });
        expect(again).toEqual({ dryRun: false, replaced: [], alreadyReplaced: ["GBV1DrmBlackCapSht"], refused: [] });
        expect((await t.run(ctx => ctx.db.get(id)))?.revision).toBe(2);
    });

    it("writes nothing when any row holds a third value or is missing", async () => {
        const t = convexTest(schema, modules);
        const good = await t.run(ctx => ctx.db.insert("productPlates", plateRow("GBElg30SpryBlk", OLD)));
        await t.run(ctx => ctx.db.insert("productPlates", plateRow("GBBstnBlu15BlkDrpr", "f".repeat(64))));
        const entries = [entry("GBElg30SpryBlk"), entry("GBBstnBlu15BlkDrpr"), entry("NoSuchSku")];

        const dry = await t.mutation(replacePlateFronts, { writeToken: token, entries });
        expect(dry.replaced).toEqual(["GBElg30SpryBlk"]);
        expect(dry.refused).toEqual([
            { sku: "GBBstnBlu15BlkDrpr", reason: "front_changed", now: asset("GBBstnBlu15BlkDrpr", "f".repeat(64)).url },
            { sku: "NoSuchSku", reason: "no_row", now: null },
        ]);
        await expect(t.mutation(replacePlateFronts, { writeToken: token, dryRun: false, entries })).rejects.toThrow(/nothing written/);
        expect((await t.run(ctx => ctx.db.get(good)))?.front.sha256).toBe(OLD);
    });

    it("rolls back with the two fronts swapped", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("productPlates", plateRow("Alu500", OLD)));
        await t.mutation(replacePlateFronts, { writeToken: token, dryRun: false, entries: [entry("Alu500")] });
        const back = await t.mutation(replacePlateFronts, {
            writeToken: token, dryRun: false,
            entries: [{ sku: "Alu500", expectFront: { sha256: NEW, url: asset("Alu500", NEW).url }, front: asset("Alu500", OLD) }],
        });
        expect(back.replaced).toEqual(["Alu500"]);
        expect((await t.run(ctx => ctx.db.get(id)))?.front).toEqual(asset("Alu500", OLD));
    });

    it("refuses a front that is not a plate-store object of the plate size, and a wrong token", async () => {
        const t = convexTest(schema, modules);
        await t.run(ctx => ctx.db.insert("productPlates", plateRow("Alu500", OLD)));
        const foreign = { ...entry("Alu500"), front: { ...asset("Alu500", NEW), url: `https://example.com/${asset("Alu500", NEW).key}` } };
        await expect(t.mutation(replacePlateFronts, { writeToken: token, entries: [foreign] })).rejects.toThrow(/host is not allowed/);
        const small = { ...entry("Alu500"), front: { ...asset("Alu500", NEW), width: 240 } };
        await expect(t.mutation(replacePlateFronts, { writeToken: token, entries: [small] })).rejects.toThrow(/not 1000x1100/);
        const mismatched = { ...entry("Alu500"), front: { ...asset("Alu500", NEW), sha256: "9".repeat(64) } };
        await expect(t.mutation(replacePlateFronts, { writeToken: token, entries: [mismatched] })).rejects.toThrow(/do not agree/);
        await expect(t.mutation(replacePlateFronts, { writeToken: "wrong", entries: [entry("Alu500")] })).rejects.toThrow(/unauthorized/);
    });
});

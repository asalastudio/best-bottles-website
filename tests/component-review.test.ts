// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { componentFindings, validateReview } from "../convex/componentReconciliationData";
import { compatibleFinishComponent } from "../src/lib/bottle-builder/model";
import { resolveListedComponents } from "../src/lib/bottle-builder/components";

const modules = import.meta.glob("../convex/**/*.ts");
const mutation = (name: string) => makeFunctionReference<"mutation">(`componentReconciliation:${name}`);
const query = (name: string) => makeFunctionReference<"query">(`componentReconciliation:${name}`);
const fixture = JSON.parse(gunzipSync(readFileSync("tests/fixtures/four-family-reconciliation.json.gz")).toString()) as { products: Omit<Doc<"products">, "_id" | "_creationTime">[] };
const finding = componentFindings.find(f => f.id === "GBCrclFrst50DrpGl")!;
const token = "test-token", actor = { id: "staff_1", email: "reviewer@bestbottles.com" };
const draft = { decision: "correction_proposed", correctComponentSku: "Drp18-415Sl", notes: "Test-only reviewed correction with exact catalog evidence.", sourceUrl: "https://www.bestbottles.com/product/test-evidence" };
const saveArgs = () => ({ writeToken: token, caseId: finding.id, evidenceSha: finding.evidenceSha, expectedRevision: 0, actor, draft });
const applyArgs = () => ({ writeToken: token, caseId: finding.id, evidenceSha: finding.evidenceSha, expectedReviewRevision: 1, expectedCatalogVersion: 0, actor });
async function setup() {
    const t = convexTest(schema, modules);
    const wanted = [finding.bottleSku, finding.componentSku, "Drp18-415Sl", "AnSp18-415Gl", "CP13-415SpryGlMt"];
    await t.run(async ctx => { for (const row of fixture.products.filter(p => wanted.includes(p.websiteSku))) await ctx.db.insert("products", row); });
    return t;
}

describe("shared component review and catalog submission", () => {
    const savedToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
    afterEach(() => { if (savedToken === undefined) delete process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN; else process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = savedToken; });
    it("keeps private reviews behind a token gate for reads and writes", async () => {
        const t = await setup();
        await expect(t.query(query("list"), { writeToken: "wrong" })).rejects.toThrow("unauthorized");
        await expect(t.mutation(mutation("save"), { ...saveArgs(), writeToken: "wrong" })).rejects.toThrow("unauthorized");
        await expect(t.mutation(mutation("apply"), { ...applyArgs(), writeToken: "wrong" })).rejects.toThrow("unauthorized");
    });
    it("shares saved decisions, records history and detects concurrent or stale saves", async () => {
        const t = await setup();
        expect(await t.mutation(mutation("save"), saveArgs())).toMatchObject({ ok: true, review: { revision: 1, actorId: actor.id } });
        expect(await t.mutation(mutation("save"), saveArgs())).toMatchObject({ ok: false, error: expect.stringContaining("Another reviewer") });
        expect(await t.mutation(mutation("save"), { ...saveArgs(), evidenceSha: "stale" })).toMatchObject({ ok: false });
        const queue = await t.query(query("list"), { writeToken: token });
        expect(queue.rows.find((r: { id: string }) => r.id === finding.id).review.correctComponentSku).toBe("Drp18-415Sl");
        expect(await t.query(query("history"), { writeToken: token, caseId: finding.id })).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(0);
    });
    it("lists exact-neck components without exposing complete bottles as parts", async () => {
        const t = await setup();
        const result = await t.query(query("choices"), { writeToken: token, caseId: finding.id });
        expect(result.candidates.map((p: { sku: string }) => p.sku)).toContain("Drp18-415Sl");
        expect(result.candidates.map((p: { sku: string }) => p.sku)).not.toContain(finding.bottleSku);
        expect(result.candidates.every((p: { neck: string }) => p.neck === "18-415")).toBe(true);
    });
    it("submits once, preserves history, and makes Matrix, PDP and Grace agree without a code redeploy", async () => {
        const t = await setup();
        await t.mutation(mutation("save"), saveArgs());
        expect(await t.mutation(mutation("apply"), applyArgs())).toMatchObject({ ok: true, appliedSku: "Drp18-415Sl", catalogVersion: 1 });
        expect(await t.mutation(mutation("apply"), applyArgs())).toMatchObject({ ok: false, error: expect.stringContaining("changed") });
        const matrix = await t.query(api.matrix.getFamilyRows, { family: "Circle" });
        const row = matrix.rows.find(r => r.websiteSku === finding.bottleSku)!;
        const grace = await t.query(api.grace.getBottleComponents, { websiteSku: finding.bottleSku });
        expect(row.components.Dropper.map(p => p.websiteSku)).toEqual(grace!.components.Dropper.map(p => p.websiteSku));
        expect(row.components.Dropper.map(p => p.websiteSku)).toContain("Drp18-415Sl");
        expect(row.components.Dropper.map(p => p.websiteSku)).not.toContain("Drp18-415Gl");
        expect(compatibleFinishComponent(row)?.websiteSku).toBe("Drp18-415Sl");
        const restored = await resolveListedComponents([row], async sku => fixture.products.find(p => p.graceSku === sku) ?? null);
        expect(restored[0].components.Dropper.map(p => p.websiteSku)).not.toContain("Drp18-415Gl");
        const log = await t.run(ctx => ctx.db.query("catalogChangeLog").collect());
        expect(log).toHaveLength(1); expect(log[0]).toMatchObject({ source: "component-review", actorId: actor.id });
        const bottle = await t.run(ctx => ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", finding.bottleSku)).unique());
        expect(bottle!.shopifyVariantId).toBe(fixture.products.find(p => p.websiteSku === finding.bottleSku)!.shopifyVariantId);
    });
    it("rejects wrong-neck and different-mechanism substitutions even with a saved proposal", async () => {
        for (const sku of ["CP13-415SpryGlMt", "AnSp18-415Gl"]) {
            const t = await setup();
            await t.mutation(mutation("save"), { ...saveArgs(), draft: { ...draft, correctComponentSku: sku } });
            expect(await t.mutation(mutation("apply"), applyArgs())).toMatchObject({ ok: false });
            expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(0);
        }
    });
    it("rejects catalog identity drift and requires evidence for a confirmation", async () => {
        const t = await setup();
        await t.mutation(mutation("save"), saveArgs());
        await t.run(async ctx => { const row = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", finding.bottleSku)).unique(); await ctx.db.patch(row!._id, { color: "Clear" }); });
        expect(await t.mutation(mutation("apply"), applyArgs())).toMatchObject({ ok: false, error: expect.stringContaining("identity changed") });
        expect(validateReview({ ...draft, decision: "confirmed", correctComponentSku: "", sourceUrl: "" })).toContain("source URL");
        expect(validateReview({ ...draft, decision: "confirmed", correctComponentSku: "", sourceUrl: "javascript:alert(1)" })).toContain("HTTPS");
    });
});

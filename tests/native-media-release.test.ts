// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import type { Doc } from "../convex/_generated/dataModel";
const modules = import.meta.glob("../convex/**/*.ts");
const call = (name: string) => makeFunctionReference<"mutation">(`nativeMediaRelease:${name}`);
const check = makeFunctionReference<"query">("nativeMediaRelease:checkInsertions");
const row = JSON.parse(readFileSync("docs/reviews/component-release-2026-09-22/publication-payload.json", "utf8")).rows[0];
const products = JSON.parse(gunzipSync(readFileSync("tests/fixtures/four-family-reconciliation.json.gz")).toString()).products as Omit<Doc<"products">, "_id" | "_creationTime">[];
const product = products.find(p => p.websiteSku === row.sku)!;
const identity = Object.fromEntries(["graceSku", "family", "capacityMl", "color", "neckThreadSize", "category", "applicator"].map(k => [k, product[k as keyof typeof product]]));
const token = "scoped-test-token";
const args = () => ({ writeToken: token, plate: row.plate, kit: row.kit, identity });
const rollback = () => ({ writeToken: token, plate: row.plate, kit: row.kit });
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("products", product));
  return t;
}
describe("atomic native media insertion and exact rollback", () => {
  const before = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
  beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
  afterEach(() => { if (before === undefined) delete process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN; else process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = before; });
  it("requires authorization, publishes both indexes and safely retries or restores absence", async () => {
    const t = await setup();
    await expect(t.mutation(call("insertPair"), { ...args(), writeToken: "wrong" })).rejects.toThrow("unauthorized");
    await expect(t.mutation(call("rollbackInsertedPair"), { ...rollback(), writeToken: "wrong" })).rejects.toThrow("unauthorized");
    expect(await t.query(check, { rows: [{ sku: row.sku, graceSku: row.kit.graceSku }] })).toBeNull();
    expect(await t.mutation(call("insertPair"), args())).toBe("inserted");
    expect(await t.mutation(call("insertPair"), args())).toBe("unchanged");
    const served = await t.query(makeFunctionReference<"query">("productKits:forSku"), { websiteSku: row.sku, graceSku: row.kit.graceSku });
    expect(served.plateSha256).toBe(row.plate.front.sha256);
    expect(await t.mutation(call("rollbackInsertedPair"), rollback())).toBe("restored_absence");
    expect(await t.mutation(call("rollbackInsertedPair"), rollback())).toBe("already_absent");
    expect(await t.run(ctx => ctx.db.query("productPlates").collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("productKits").collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("products").collect())).toHaveLength(1);
  });
  it("rejects registration/identity mismatch before either index is created", async () => {
    const t = await setup();
    await expect(t.mutation(call("insertPair"), { ...args(), kit: { ...row.kit, plateSha256: "wrong" } })).rejects.toThrow("registration");
    await expect(t.mutation(call("insertPair"), { ...args(), identity: { ...identity, color: "wrong" } })).rejects.toThrow("identity changed");
    expect(await t.run(ctx => ctx.db.query("productPlates").collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("productKits").collect())).toHaveLength(0);
  });
  it("rejects hidden kit aliases and concurrent releases even when storefront queries hide them", async () => {
    const t = await setup();
    await t.run(ctx => ctx.db.insert("productKits", { ...row.kit, sku: "alias", websiteSku: "alias", importedAt: 1, revision: 1 }));
    await expect(t.query(check, { rows: [{ sku: row.sku, graceSku: row.kit.graceSku }] })).rejects.toThrow("already exists");
    await expect(t.mutation(call("insertPair"), args())).rejects.toThrow("already exists");
    expect(await t.run(ctx => ctx.db.query("productPlates").collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("productKits").collect())).toHaveLength(1);
  });
  it("refuses rollback after changes to anchors or metadata even with identical plate URLs", async () => {
    const t = await setup();
    await t.mutation(call("insertPair"), args());
    await t.run(async ctx => { const kit = await ctx.db.query("productKits").first(); await ctx.db.patch(kit!._id, { anchors: { ...kit!.anchors, seatY: kit!.anchors.seatY + 1 } }); });
    await expect(t.mutation(call("rollbackInsertedPair"), rollback())).rejects.toThrow("Later or partial release");
    expect(await t.run(ctx => ctx.db.query("productPlates").collect())).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query("productKits").collect())).toHaveLength(1);
  });
});

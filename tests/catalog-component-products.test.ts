// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { createComponentProductResolver } from "../convex/catalogComponentProducts";
import type { Doc } from "../convex/_generated/dataModel";
import type { NormalizedComponent } from "../convex/componentUtils";

const modules = import.meta.glob("../convex/**/*.ts");
const fixture = JSON.parse(gunzipSync(readFileSync("tests/fixtures/four-family-reconciliation.json.gz")).toString());
type Product = Omit<Doc<"products">, "_id" | "_creationTime">;
const sample: Product = fixture.products.find((p: Product) => p.category === "Component");
const part = { graceSku: "old", websiteSku: "cap", itemName: "stale", imageUrl: "old-image",
    stockStatus: "Out of Stock", webPrice1pc: 1, webPrice12pc: 1, capColor: "Gold" } as NormalizedComponent;
const product = (overrides: Partial<Product> = {}): Product => ({ ...sample, graceSku: "old", websiteSku: "cap",
    neckThreadSize: "18-415", stockStatus: "In Stock", webPrice1pc: 2, imageUrl: "new-image", ...overrides });
async function resolve(products: Product[]) {
    const t = convexTest(schema, modules);
    return t.run(async ctx => {
        for (const p of products) await ctx.db.insert("products", p);
        return createComponentProductResolver(ctx)(part, "18-415");
    });
}
describe("exact catalog component products", () => {
    it("refreshes stock, imagery and price from the current exact component", async () => {
        expect(await resolve([product()])).toMatchObject({ stockStatus: "In Stock", imageUrl: "new-image", webPrice1pc: 2 });
    });
    it("recovers a retired reference only through its single exact active SKU", async () => {
        const retired = product({ websiteSku: "cap__RETIRED__old__duplicate" });
        const active = product({ graceSku: "current" });
        expect(await resolve([retired, active])).toMatchObject({ graceSku: "current", websiteSku: "cap" });
        expect(await resolve([retired])).toBeNull();
        expect(await resolve([retired, active, product({ graceSku: "another" })])).toBeNull();
    });
    it("rejects ambiguous identifiers, assembled products and the wrong neck", async () => {
        expect(await resolve([product(), product({ websiteSku: "other" })])).toBeNull();
        expect(await resolve([product({ category: "Glass Bottle" })])).toBeNull();
        expect(await resolve([product({ neckThreadSize: "13-415" })])).toBeNull();
    });
});

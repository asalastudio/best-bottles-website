// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import links from "../convex/catalog-component-links.json";
import { catalogIncludedAssembly } from "../convex/catalogIncludedAssemblies";
import { compatibleFinishComponent } from "@/lib/bottle-builder/model";

const modules = import.meta.glob("../convex/**/*.ts");
const fixture = JSON.parse(gunzipSync(readFileSync("tests/fixtures/four-family-reconciliation.json.gz")).toString()) as {
    products: Omit<Doc<"products">, "_id" | "_creationTime">[];
    fitments: Omit<Doc<"fitments">, "_id" | "_creationTime">[];
};

describe("four-family catalog reconciliation", () => {
    it("gives PDP and Builder identical exact components for all 925 source records", async () => {
        const t = convexTest(schema, modules);
        await t.run(async ctx => {
            for (const product of fixture.products) await ctx.db.insert("products", product);
            for (const rule of fixture.fitments) await ctx.db.insert("fitments", rule);
        });
        const audit: unknown[] = [];
        const identity = (components: Record<string, { websiteSku: string | null; graceSku: string; imageUrl: string | null; shopifyVariantId: string | null; shopifySellable: boolean | null; stockStatus: string | null }[]>) =>
            Object.fromEntries(Object.entries(components).map(([kind, parts]) => [kind, parts.map(p => ({
                websiteSku: p.websiteSku, graceSku: p.graceSku, imageUrl: p.imageUrl,
                shopifyVariantId: p.shopifyVariantId, shopifySellable: p.shopifySellable, stockStatus: p.stockStatus,
            })).sort((a,b) => a.graceSku.localeCompare(b.graceSku))]).sort(([a],[b]) => String(a).localeCompare(String(b))));
        let checked = 0;
        for (const family of ["Circle", "Cylinder", "Empire", "Round"]) {
            const matrix = await t.query(api.matrix.getFamilyRows, { family });
            expect(matrix.truncated).toBe(false);
            for (const row of matrix.rows) {
                const pdp = await t.query(api.grace.getBottleComponents, { websiteSku: row.websiteSku! });
                expect(pdp, row.websiteSku!).not.toBeNull();
                expect(identity(pdp!.components), row.websiteSku!).toEqual(identity(row.components));
                const source = links.find(link => link.assemblySku === row.websiteSku);
                if (source) {
                    expect(Object.values(row.components).flat().some(part => part.websiteSku === source.componentSku), row.websiteSku!).toBe(true);
                    expect(compatibleFinishComponent(row)?.websiteSku, row.websiteSku!).toBe(catalogIncludedAssembly(row)?.websiteSku ?? source.componentSku);
                }
                for (const part of Object.values(row.components).flat()) {
                    expect(part.websiteSku, row.websiteSku!).not.toMatch(/__RETIRED__/);
                    const exact = fixture.products.find(p => p.graceSku === part.graceSku)!;
                    expect(exact.category).toBe("Component");
                    if (exact.neckThreadSize) expect(exact.neckThreadSize).toBe(row.neckThreadSize);
                }
                checked++;
            }
            audit.push(matrix);
        }
        expect(checked).toBe(925);
        if (process.env.BB_RECONCILIATION_AUDIT_OUTPUT) {
            writeFileSync(process.env.BB_RECONCILIATION_AUDIT_OUTPUT, JSON.stringify(audit, null, 2));
        }
    }, 120_000);
});

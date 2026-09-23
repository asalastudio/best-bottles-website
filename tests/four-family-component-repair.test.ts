// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import type { Doc, Id } from "../convex/_generated/dataModel";
import fixture from "./fixtures/four-family-components.json";
import { FOUR_FAMILY_COMPONENT_REPAIR as scope, planCircleKitRepair } from "../convex/repairs/fourFamilyComponents";
import { filterVariantsForGroupIntent } from "@/lib/products/group-variant-intent";
import { previewParts, type BuilderConfiguration, type BuilderKit } from "@/lib/bottle-builder/model";
import { registerVintagePreview } from "@/lib/bottle-builder/preview-registration";

const modules = import.meta.glob("../convex/**/*.ts");
const repair = makeFunctionReference<"mutation">("repairFourFamilyComponents:run");
const forSku = makeFunctionReference<"query">("productKits:forSku");
const kits = fixture.kits as Record<string, BuilderKit>;
const defaults = {
    shape: null, capacityOz: null, heightWithCap: null, heightWithoutCap: null, diameter: null,
    bottleWeightG: null, caseQuantity: null, qbPrice: null, webPrice10pc: null, webPrice12pc: null,
    productUrl: null, dataGrade: null, bottleCollection: null, fitmentStatus: null, components: [],
    graceDescription: null, verified: true,
};

async function seeded() {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
        const groups = new Map<string, Id<"productGroups">>();
        for (const g of Object.values(fixture.groups)) {
            const { _id, _creationTime: _time, ...fields } = g;
            groups.set(_id, await ctx.db.insert("productGroups", fields));
        }
        for (const p of Object.values(fixture.products)) {
            await ctx.db.insert("products", { ...defaults, ...p, productGroupId: groups.get(p.productGroupId) } as Doc<"products">);
        }
        for (const kit of Object.values(kits)) {
            const { conflicts: _conflicts, ...fields } = kit;
            const product = (fixture.products as Record<string, {graceSku: string}>)[kit.sku];
            const common = { websiteSku: kit.sku, graceSku: product.graceSku,
                builder: {name: "test-fixture", version: "1", builtAt: 1},
                storageProvider: "vercel-blob" as const, revision: 1, importedAt: 1 };
            await ctx.db.insert("productKits", { ...fields, ...common,
                source: {library: "test-fixture", path: kit.sku, releaseVersion: null} });
            const asset = { ...kit.parts[0].image, sha256: kit.plateSha256 };
            await ctx.db.insert("productPlates", { ...common, sku: kit.sku, familyId: kit.familyId,
                front: asset, thumb: asset, frontCapOff: null, thumbCapOff: null, views: [],
                source: {library: "test-fixture", path: kit.sku, psdSha256: null, psdSha256CapOff: null} });
        }
    });
    return t;
}

describe("reviewed Circle roles in both PDP and Build Your Bottle", () => {
    for (const recipe of scope.kitRoles) it(`${recipe.sku}: correct glass, fixed baseline and intact top assembly`, () => {
        const original = kits[recipe.sku];
        const updated = { ...original, ...planCircleKitRepair(recipe.sku, original, original.plateSha256)! };
        const glass = updated.parts.find(p => p.slot === "body")!;
        const sprayer = updated.parts.find(p => p.slot === "sprayer")!;
        expect(glass.image.sha256).toBe(original.parts.find(p => p.slot === "sprayer")!.image.sha256);
        expect(sprayer.image.sha256).toBe(original.parts.find(p => p.slot === "body")!.image.sha256);
        expect(updated.anchors.baselineY).toBe(glass.bounds.bottom);
        expect(updated.anchors.seatY).toBe(glass.bounds.top);
        expect(glass.exploded).toEqual({dx: 0, dy: 0});
        expect(sprayer.bounds.right + sprayer.exploded.dx).toBeLessThan(glass.bounds.left);
        for (let i = 0; i < original.parts.length; i++) {
            // Renaming slots must not change the composed photograph or a source asset.
            for (const key of ["image", "image2x", "mask", "bounds", "assembled", "zOrder"] as const) {
                expect(updated.parts[i][key]).toEqual(original.parts[i][key]);
            }
        }
        const config = {id: recipe.sku, family: "Circle", capacityMl: recipe.sku.includes("100") ? 100 : 50,
            neck: "18-415", color: recipe.sku.includes("Frst") ? "Frosted" : "Clear", fitment: "Vintage Bulb Sprayer with Tassel",
            kit: updated } as BuilderConfiguration;
        expect(previewParts(config, "body").map(p => p.image.sha256)).toEqual([glass.image.sha256]);
        const reference = { ...config, id: "reference-glass", kit: { ...updated, parts: [glass] } };
        const registered = registerVintagePreview(config, previewParts(config, "complete"), reference)!;
        expect(registered.layers.filter(l => l.part.slot === "body")).toHaveLength(1);
        expect(registered.layers.find(l => l.part.slot === "sprayer")!.part.image.sha256).toBe(sprayer.image.sha256);
        expect(registered.layers.findIndex(l => l.part.slot === "sprayer")).toBeGreaterThan(registered.layers.findIndex(l => l.part.slot === "body"));
        expect(planCircleKitRepair(recipe.sku, updated, original.plateSha256)).toBeNull();
    });
    it("refuses changed plate, part, anchor and out-of-scope inputs", () => {
        const recipe = scope.kitRoles[0], kit = kits[recipe.sku];
        expect(() => planCircleKitRepair(recipe.sku, kit, "new-plate")).toThrow("source changed");
        const changed = structuredClone(kit); changed.parts[0].image.sha256 = "new-layer";
        expect(() => planCircleKitRepair(recipe.sku, changed, recipe.plateSha256)).toThrow("metadata changed");
        expect(() => planCircleKitRepair(recipe.sku, {...kit, anchors: {...kit.anchors, baselineY: 999}}, recipe.plateSha256)).toThrow("metadata changed");
        expect(() => planCircleKitRepair("unreviewed", kit, kit.plateSha256)).toThrow("outside reviewed");
    });
});

describe("atomic four-family component repair", () => {
    it("dry-runs by default, repairs exact records, preserves commerce/plates, and is idempotent", async () => {
        const t = await seeded();
        const before = await t.run(async ctx => ({products: await ctx.db.query("products").collect(), plates: await ctx.db.query("productPlates").collect()}));
        const preview = await t.mutation(repair, {});
        expect(preview).toMatchObject({dryRun: true});
        expect(preview.kitChanges).toHaveLength(9);
        expect(preview.productChanges).toHaveLength(26);
        expect(preview.newGroups).toHaveLength(2);
        expect(await t.run(ctx => ctx.db.query("products").collect())).toEqual(before.products);
        const applied = await t.mutation(repair, {dryRun: false});
        expect(applied.kitChanges).toHaveLength(9);
        const after = await t.run(async ctx => ({products: await ctx.db.query("products").collect(), groups: await ctx.db.query("productGroups").collect(), plates: await ctx.db.query("productPlates").collect()}));
        expect(after.products).toHaveLength(before.products.length);
        expect(after.plates).toEqual(before.plates);
        for (const product of after.products) {
            const old = before.products.find(p => p._id === product._id)!;
            const {applicator: _app, productGroupId: _gid, ...untouched} = product;
            const {applicator: _oldApp, productGroupId: _oldGid, ...oldUntouched} = old;
            expect(untouched).toEqual(oldUntouched);
            const recipe = scope.membership.find(r => r.sku === product.websiteSku);
            if (!recipe) expect(product).toEqual(old);
            else {
                const group = after.groups.find(g => g._id === product.productGroupId)!;
                expect(group.slug).toBe(recipe.proposedGroup);
                expect(filterVariantsForGroupIntent(group.slug, [product])).toEqual([product]);
            }
        }
        for (const group of after.groups) {
            const rows = after.products.filter(p => p.productGroupId === group._id);
            expect(group.variantCount).toBe(rows.length);
            expect(filterVariantsForGroupIntent(group.slug, rows)).toHaveLength(rows.length);
            if (preview.newGroups.includes(group.slug)) {
                expect(group.shopifyProductId).toBeUndefined();
                expect(group.heroImageUrl).toBeUndefined();
            }
        }
        for (const recipe of scope.kitRoles) {
            const view = await t.query(forSku, {websiteSku: recipe.sku, graceSku: null});
            expect(view.parts.find((p: {slot: string}) => p.slot === "body").image.sha256).toBe(kits[recipe.sku].parts.find(p => p.slot === "sprayer")!.image.sha256);
        }
        expect(await t.mutation(repair, {dryRun: false})).toMatchObject({kitChanges: [], productChanges: [], newGroups: [], groupChanges: []});
    });
    it("refuses a concurrent product edit before changing any kit", async () => {
        const t = await seeded();
        await t.run(async ctx => {
            const p = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", scope.membership[0].sku)).unique();
            await ctx.db.patch(p!._id, {applicator: "Fine Mist Sprayer"});
        });
        await expect(t.mutation(repair, {dryRun: false})).rejects.toThrow("membership changed");
        expect((await t.run(ctx => ctx.db.query("productKits").collect())).every(k => k.revision === 1)).toBe(true);
    });
    it("refuses duplicate source kits instead of silently choosing one", async () => {
        const t = await seeded();
        await t.run(async ctx => {
            const {_id: _id, _creationTime: _time, ...fields} = (await ctx.db.query("productKits").first())!;
            await ctx.db.insert("productKits", fields);
        });
        await expect(t.mutation(repair, {dryRun: false})).rejects.toThrow("Expected one exact kit");
    });
});

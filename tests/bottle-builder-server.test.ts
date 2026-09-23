import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { BuilderKit, CatalogRow } from "@/lib/bottle-builder/model";

const state = vi.hoisted(() => ({ rows: [] as unknown[], kits: {} as Record<string, unknown>, truncated: false, missingPlates: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/paper-doll/local-component-kits", () => ({ readLocalComponentKits: () => null }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class {
    async query(ref: Parameters<typeof getFunctionName>[0], args: { pairs?: { websiteSku: string }[]; skus?: string[] }) {
        switch (getFunctionName(ref)) {
            case "matrix:getFamilyRows": return { rows: state.rows, truncated: state.truncated };
            case "productKits:forSkus": return Object.fromEntries(args.pairs!.map(p => [p.websiteSku, state.kits[p.websiteSku] ?? null]));
            case "productPlates:forSkus": return { plates: Object.fromEntries(args.skus!.filter(sku => !state.missingPlates.includes(sku)).map(sku => [sku, { image: `https://example.com/${sku}.png` }])) };
            case "products:lookupSku": return null;
            default: throw new Error(`Unexpected query: ${getFunctionName(ref)}`);
        }
    }
} }));
import { freshConfiguration, loadBuilderBodies } from "@/lib/bottle-builder/server";

function row(sku: string, finish: string): CatalogRow {
    return { websiteSku: sku, graceSku: `grace-${sku}`, family: "Cylinder", capacityMl: 9,
        category: "Glass Bottle", color: "Swirl", neckThreadSize: "17-415", applicator: "Metal Roller Ball",
        itemName: `9 ml Swirl metal roller with ${finish} cap`, capColor: finish, resolution: "bottle_listed",
        shopifyVariantId: `gid://shopify/ProductVariant/${sku}`, shopifySellable: true, webPrice1pc: 1,
        productGroupSlug: "cylinder-9ml-swirl-17-415-rollon", stockStatus: "In Stock",
        components: { "Roll-On Cap": [{ websiteSku: `CPRoll17-415${finish === "Matte Silver" ? "MtSl" : "ShnGl"}`,
            graceSku: `cap-${finish}`, itemName: finish, stockStatus: "In Stock" }] },
    } as unknown as CatalogRow;
}
function kit(sku: string): BuilderKit {
    return { sku, familyId: "cylinder-9ml-swirl-17-415", completeness: "full", conflicts: [],
        canvas: { width: 1000, height: 1100 }, anchors: { axisX: 500, neckAxisX: 500, seatY: 300, baselineY: 1000, pxPerMm: null },
        parts: ["body", "roller", "cap"].map((slot, index) => ({ slot, variantKey: slot, zOrder: index,
            explodeIndex: index, assembled: { x: 0, y: 0 }, bounds: { left: 400, top: slot === "body" ? 300 : 150, right: 600, bottom: slot === "body" ? 1000 : 300 },
            image: { url: `https://example.com/${sku}-${slot}.png`, key: slot, sha256: slot, width: 1000, height: 1100, bytes: 100 },
            derivation: "psd-layer", exploded: { dx: 0, dy: 0 }, image2x: null, mask: null })),
        plateSha256: "plate", three: null,
    } as BuilderKit;
}

describe("fresh builder purchase reconciliation", () => {
    beforeEach(() => {
        state.rows = [row("GBCylSwrl9MtlRollMattSl", "Matte Silver"), row("GBCylSwrl9MtlRollShnGl", "Shiny Gold")];
        state.kits = { GBCylSwrl9MtlRollMattSl: kit("GBCylSwrl9MtlRollMattSl") };
        state.truncated = false;
        state.missingPlates = [];
    });
    it("accepts the exact listed plate with a sibling bare-body proof, without requiring its own layered kit", async () => {
        const listed = (await loadBuilderBodies(state.rows as CatalogRow[])).flatMap(body => body.configurations);
        const target = listed.find(c => c.id === "GBCylSwrl9MtlRollShnGl");
        expect(target).toBeDefined();
        expect(target!.kit?.parts.map(part => part.slot)).toEqual(["body"]);
        expect(target!.photoUrl).toBe("https://example.com/GBCylSwrl9MtlRollShnGl.png");
        expect(await freshConfiguration("Cylinder", target!.id)).toEqual(target);
    });
    it("loads a new finish's exact full kit even when a sibling supplied the chooser body", async () => {
        const sku = "GBCylSwrl9MtlRollShnGl";
        state.missingPlates = [sku];
        state.kits[sku] = kit(sku);
        const listed = (await loadBuilderBodies(state.rows as CatalogRow[])).flatMap(body => body.configurations);
        expect(listed.find(c => c.id === sku)?.kit?.sku).toBe(sku);
        expect((await freshConfiguration("Cylinder", sku))?.kit?.sku).toBe(sku);
    });
    it("rechecks current stock and price instead of trusting cached chooser data", async () => {
        const target = state.rows[1] as CatalogRow;
        target.webPrice1pc = 2;
        const current = await freshConfiguration("Cylinder", target.websiteSku!);
        expect(current?.product.unitPrice).toBe(2);
        target.shopifySellable = false;
        expect(await freshConfiguration("Cylinder", target.websiteSku!)).toBeNull();
    });
    it("rejects duplicate identities, truncated catalogs, and ambiguous selection tuples", async () => {
        const target = state.rows[1] as CatalogRow;
        state.rows.push(structuredClone(target));
        expect(await freshConfiguration("Cylinder", target.websiteSku!)).toBeNull();
        state.rows.pop(); state.truncated = true;
        expect(await freshConfiguration("Cylinder", target.websiteSku!)).toBeNull();
        state.truncated = false;
        state.rows.push({ ...target, websiteSku: "AnotherSwirlShnGl", graceSku: "another-grace" });
        expect(await freshConfiguration("Cylinder", target.websiteSku!)).toBeNull();
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { BuilderKit, CatalogRow } from "@/lib/bottle-builder/model";

const state = vi.hoisted(() => ({ rows: [] as unknown[], kits: {} as Record<string, unknown>, truncated: false, missingPlates: [] as string[], register: null as unknown }));
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
            case "registerStage:forSkus": return state.register ?? { plates: {}, components: {}, bodies: {}, assemblies: {} };
            default: throw new Error(`Unexpected query: ${getFunctionName(ref)}`);
        }
    }
} }));
import { freshConfiguration, loadBuilderBodies, loadBuilderBodyKits, loadBuilderFamily } from "@/lib/bottle-builder/server";

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

describe("register kits in the builder", () => {
    const PLATE = { plateKey: "cylinder-9ml-17-415|Swirl", bodyId: "cylinder-9ml-17-415", glass: "Swirl", url: "https://blob/register/plates/swirl.png", width: 768, height: 2304, pxPerMm: 27.2142, anchors: { axisX: 383, seatY: 167, baselineY: 2176, shoulderY: 550 }, approved: true };
    const layer = (slot: string, hash: string, extra: Record<string, unknown> = {}) => ({ slot, z: "front", explodeIndex: 1, url: `https://blob/register/components/${hash}.png`, width: 172, height: 135, pxPerMm: 12.3676, anchor: { x: 91.5, y: 126 }, approved: true, ...extra });
    beforeEach(() => {
        state.rows = [row("GBCylSwrl9MtlRollMattSl", "Matte Silver"), row("GBCylSwrl9MtlRollShnGl", "Shiny Gold")];
        state.kits = {};
        state.truncated = false;
        state.missingPlates = [];
        state.register = {
            plates: { [PLATE.plateKey]: PLATE },
            components: {
                "CMP-ROC-MSLV-17415": { componentId: "CMP-ROC-MSLV-17415", type: "roll-on-cap", approved: true, layers: [layer("cap", "269a6debdadd773ab5df125b4cedf15a95c0b9d521b7d385738129cf92b74e3b")] },
                "LIB-17-415-MtlRollon": { componentId: "LIB-17-415-MtlRollon", type: "roller-insert", approved: true, layers: [
                    layer("roller", "d64975a48a1c447a1ab6f2a68a1c5252cf5a56e6d07c41d3ab6b3c17e3f94bba", { z: "behind-body", explodeIndex: 0 }),
                    layer("roller", "4c3c4a5090ce2c419265e57716991288dc02fc0d0d0a0b2d7c2a91dff5921c48", { explodeIndex: 0, usage: "seated" }),
                    layer("roller", "f8cff0279a097bef36eeab798dbe9559ced76c8c0b51baba465e70c52da2d6bf", { explodeIndex: 0, height: 255, usage: "exploded" }),
                ] },
            },
            bodies: { "cylinder-9ml-17-415": { bodyId: "cylinder-9ml-17-415", family: "Cylinder", capacityMl: 9, neck: "17-415", dims: { heightBareMm: 70, diameterMm: 20, widthMm: 21 } } },
            assemblies: { "grace-GBCylSwrl9MtlRollMattSl": { graceSku: "grace-GBCylSwrl9MtlRollMattSl", websiteSku: "GBCylSwrl9MtlRollMattSl", bodyId: "cylinder-9ml-17-415", plateKey: PLATE.plateKey, glass: "Swirl", neck: "17-415", parts: [{ role: "roller", componentId: "LIB-17-415-MtlRollon" }, { role: "cap", componentId: "CMP-ROC-MSLV-17415" }], renderable: true, reason: null } },
        };
    });
    it("adopts a register kit with the seated insert only: the EXPLODED plug layer never paints in the assembled builder", async () => {
        // The chooser lists the glass from the register plate; the body's exact kits (the builder's kits API) come from the register too.
        const listed = (await loadBuilderBodies(state.rows as CatalogRow[])).flatMap(body => body.configurations);
        expect(listed.map(c => c.id).sort()).toEqual(["GBCylSwrl9MtlRollMattSl", "GBCylSwrl9MtlRollShnGl"]);
        const [body] = await loadBuilderFamily("Cylinder");
        const kit = (await loadBuilderBodyKits("Cylinder", body.id))["GBCylSwrl9MtlRollMattSl"]!;
        expect(kit.register?.plateKey).toBe(PLATE.plateKey);
        expect(kit.parts.map(part => part.slot).sort()).toEqual(["body", "cap", "roller", "roller"]);
        expect(kit.parts.filter(part => part.slot === "roller").map(part => part.image.url)).toEqual([
            "https://blob/register/components/d64975a48a1c447a1ab6f2a68a1c5252cf5a56e6d07c41d3ab6b3c17e3f94bba.png",
            "https://blob/register/components/4c3c4a5090ce2c419265e57716991288dc02fc0d0d0a0b2d7c2a91dff5921c48.png",
        ]);
        state.register = null;
    });
});

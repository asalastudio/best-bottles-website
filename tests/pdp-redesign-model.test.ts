import { describe, expect, it } from "vitest";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import {
    callouts,
    capOptions,
    capacityEyebrow,
    collectionDescription,
    collectionFor,
    derivePicks,
    glassOptions,
    lineLabel,
    pageTitle,
    pickLine,
    pickQuery,
    resolveVariant,
    rollerOptions,
    slugifyPick,
    statusLine,
    techSheetRows,
    unitPriceAt,
} from "@/lib/products/pdp-redesign/model";

function variant(overrides: Partial<ProductVariant> & { websiteSku: string; graceSku: string }): ProductVariant {
    return {
        _id: `id-${overrides.websiteSku}`,
        itemName: overrides.websiteSku,
        itemDescription: null,
        imageUrl: null,
        stockStatus: "In Stock",
        webPrice1pc: 0.85,
        webPrice10pc: null,
        webPrice12pc: 0.81,
        priceTiers: [
            { minQty: 1, unitPrice: 0.85 }, { minQty: 12, unitPrice: 0.81 }, { minQty: 144, unitPrice: 0.77 }, { minQty: 576, unitPrice: 0.72 },
        ],
        category: "Glass Bottle",
        family: "Cylinder",
        shape: null,
        color: "Cobalt Blue",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        capacityOz: 0.3,
        heightWithCap: "85 ±1 mm",
        heightWithoutCap: "70 ±1 mm",
        diameter: "20 ±0.5 mm",
        bottleWeightG: 30.14,
        neckThreadSize: "17-415",
        bottleCollection: "Cylinder",
        caseQuantity: 724,
        applicator: "Metal Roller Ball",
        capStyle: "Roll-On",
        capColor: "Shiny Black",
        trimColor: null,
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        shopifySellable: true,
        ...overrides,
    };
}

const GROUP = {
    slug: "cylinder-9ml-cobalt-blue-17-415-rollon",
    family: "Cylinder",
    capacity: "9 ml (0.3 oz)",
    capacityMl: 9,
    color: "Cobalt Blue",
    category: "Glass Bottle",
    neckThreadSize: "17-415",
    primaryWebsiteSku: "GBCylBlu9RollBlkDot",
    primaryGraceSku: "GB-CYL-BLU-9ML-ROL-BKDT",
    applicatorTypes: ["Metal Roller Ball", "Plastic Roller Ball"],
};

const VARIANTS: ProductVariant[] = [
    variant({ websiteSku: "GBCylBlu9MtlRollBlkDot", graceSku: "GB-CYL-BLU-9ML-MRL-BKDT", capColor: "Black Dotted", capStyle: "Dot Cap" }),
    variant({ websiteSku: "GBCylBlu9MtlRollMattCu", graceSku: "GB-CYL-BLU-9ML-MRL-MCPR", capColor: "Matte Copper", webPrice1pc: 0.86 }),
    variant({ websiteSku: "GBCylBlu9MtlRollShBlk", graceSku: "GB-CYL-BLU-9ML-MRL-SBLK", capColor: "Shiny Black" }),
    variant({ websiteSku: "GBCylBlu9RollBlkDot", graceSku: "GB-CYL-BLU-9ML-ROL-BKDT", applicator: "Plastic Roller Ball", capColor: "Black Dotted", capStyle: "Dot Cap", webPrice1pc: 0.76, priceTiers: [{ minQty: 1, unitPrice: 0.76 }, { minQty: 12, unitPrice: 0.72 }] }),
    variant({ websiteSku: "GBCylBlu9RollShBlk", graceSku: "GB-CYL-BLU-9ML-ROL-SBLK", applicator: "Plastic Roller Ball", capColor: "Shiny Black", webPrice1pc: 0.76, priceTiers: null, stockStatus: "Out of Stock" }),
];

describe("picks", () => {
    it("offers both rollers and the caps sold for the active roller", () => {
        expect(rollerOptions(VARIANTS).map((option) => option.id)).toEqual(["metal", "plastic"]);
        expect(capOptions(VARIANTS, "metal").map((option) => option.name)).toEqual(["Black with Dots", "Matte Copper", "Shiny Black"]);
        expect(capOptions(VARIANTS, "plastic").map((option) => option.id)).toEqual(["black-with-dots", "shiny-black"]);
    });

    it("hides the roller toggle when a group sells one material", () => {
        expect(rollerOptions(VARIANTS.filter((row) => /Mtl/.test(row.websiteSku)))).toEqual([]);
    });

    it("starts from the group's primary SKU and honours ?sku=, ?roller= and ?cap=", () => {
        expect(derivePicks(VARIANTS, GROUP, {})).toEqual({ roller: "plastic", cap: "black-with-dots" });
        expect(derivePicks(VARIANTS, GROUP, { sku: "GBCylBlu9MtlRollMattCu" })).toEqual({ roller: "metal", cap: "matte-copper" });
        expect(derivePicks(VARIANTS, GROUP, { roller: "metal", cap: "shiny-black" })).toEqual({ roller: "metal", cap: "shiny-black" });
        // an unknown cap falls back to the primary's cap
        expect(derivePicks(VARIANTS, GROUP, { roller: "metal", cap: "lavender" })).toEqual({ roller: "metal", cap: "black-with-dots" });
    });

    it("resolves the exact SKU and falls back within the material when a finish is missing", () => {
        expect(resolveVariant(VARIANTS, { roller: "metal", cap: "matte-copper" })?.websiteSku).toBe("GBCylBlu9MtlRollMattCu");
        // matte copper is not sold on the plastic roller: first plastic cap wins, deterministically
        expect(resolveVariant(VARIANTS, { roller: "plastic", cap: "matte-copper" })?.websiteSku).toBe("GBCylBlu9RollBlkDot");
    });

    it("writes only the dimensions the group offers into the URL", () => {
        expect(pickQuery({ roller: "metal", cap: "black-with-dots" }, rollerOptions(VARIANTS))).toBe("roller=metal&cap=black-with-dots");
        expect(pickQuery({ roller: "metal", cap: "black-with-dots" }, [])).toBe("cap=black-with-dots");
        expect(slugifyPick("Black & Gold Stripe")).toBe("black-and-gold-stripe");
    });

    it("lists the glass options this group first", () => {
        const glasses = glassOptions(GROUP, [
            { slug: "cylinder-9ml-clear-17-415-rollon", color: "Clear", displayName: "Cylinder 9ml Clear" },
            { slug: "cylinder-9ml-blue-17-415-rollon", color: "Blue", displayName: "duplicate blue" },
        ]);
        expect(glasses.map((glass) => glass.label)).toEqual(["Cobalt Blue", "Clear"]);
        expect(glasses[0].active).toBe(true);
        expect(glasses[0].shortLabel).toBe("Cobalt");
    });
});

describe("copy", () => {
    it("writes the pick line, the line label, the eyebrow and the title", () => {
        const roller = rollerOptions(VARIANTS)[0];
        expect(pickLine("Cobalt", roller, null, "Black with Dots")).toBe("COBALT · METAL ROLLER · BLACK WITH DOTS");
        expect(lineLabel("Cobalt", roller, null, "Black with Dots")).toBe("Cobalt · Metal · Black with Dots");
        expect(capacityEyebrow(GROUP)).toBe("CYLINDER · 9 ML · 17-415");
        expect(pageTitle(GROUP, "Metal roller")).toBe("9 ml Cobalt Blue Cylinder Roll-On Bottle");
    });

    it("reads stock and case pack for the status line", () => {
        expect(statusLine(VARIANTS[0])).toEqual({ inStock: true, text: "In stock · ships in 1–3 business days · 724 per case" });
        expect(statusLine(VARIANTS[4]).text).toBe("Out of stock · 724 per case");
    });

    it("prices the active break", () => {
        expect(unitPriceAt(VARIANTS[0], 1)).toBe(0.85);
        expect(unitPriceAt(VARIANTS[0], 12)).toBe(0.81);
        expect(unitPriceAt(VARIANTS[0], 600)).toBe(0.72);
        expect(unitPriceAt(VARIANTS[4], 500)).toBe(0.76);
    });
});

describe("exploded callouts (render only what the field holds)", () => {
    it("names cap, fitment, neck and body from the SKU", () => {
        const rows = callouts(VARIANTS[0], "Black with Dots");
        expect(rows.map((row) => row.key)).toEqual(["cap", "fitment", "neck", "body"]);
        expect(rows[0]).toEqual({ key: "cap", title: "CAP", line1: "Black with Dots", line2: "Fits 17-415" });
        expect(rows[1]).toEqual({ key: "fitment", title: "FITMENT", line1: "Metal Roller Ball plug", line2: "Press-fit into 17-415 neck" });
        expect(rows[2]).toEqual({ key: "neck", title: "NECK THREAD", line1: "17-415", line2: "17 mm outer Ø · 415 finish" });
        expect(rows[3]).toEqual({ key: "body", title: "BODY", line1: "Cobalt Blue glass · 9 ml (0.3 oz)", line2: "H 70 mm · Ø 20 mm · 30 g" });
    });

    it("drops lines whose fields are empty and never fills them", () => {
        const rows = callouts(variant({
            websiteSku: "x", graceSku: "y", neckThreadSize: "Ground", heightWithoutCap: null, diameter: null, bottleWeightG: null, applicator: null, capacityMl: 32, capacityOz: null,
        }), null);
        expect(rows.map((row) => row.key)).toEqual(["neck", "body"]);
        expect(rows[0]).toEqual({ key: "neck", title: "NECK THREAD", line1: "Ground", line2: null });
        expect(rows[1]).toEqual({ key: "body", title: "BODY", line1: "Cobalt Blue glass · 32 ml", line2: null });
    });
});

describe("tech sheet and collection", () => {
    it("lists the spec rows the SKU carries", () => {
        expect(techSheetRows(VARIANTS[0], GROUP).map((row) => `${row.k}: ${row.v}`)).toEqual([
            "Capacity: 9 ml · 0.3 oz",
            "Neck finish: 17-415",
            "Glass: Cobalt Blue",
            "Fitment: Metal roller ball, pre-fitted",
            "Height with cap: 85 ±1 mm",
            "Height without cap: 70 ±1 mm",
            "Diameter: 20 ±0.5 mm",
            "Bottle weight: 30.1 g",
            "Case pack: 724 pcs",
        ]);
    });

    it("matches the first shop collection and describes it from the catalogue", () => {
        const band = collectionFor(GROUP);
        expect(band?.key).toBe("roll-on-bottles");
        expect(band?.href).toBe("/catalog?shop=roll-on-bottles&sort=capacity-asc");
        const description = collectionDescription(band!, [
            { slug: "a", family: "Cylinder", category: "Glass Bottle", capacityMl: 9, applicatorTypes: ["Metal Roller Ball"] },
            { slug: "b", family: "Circle", category: "Glass Bottle", capacityMl: 15, applicatorTypes: ["Plastic Roller Ball"] },
            { slug: "c", family: "Circle", category: "Glass Bottle", capacityMl: 15, applicatorTypes: ["Fine Mist Sprayer"] },
            { slug: "d", family: "Slim", category: "Glass Bottle", capacityMl: 3, applicatorTypes: ["Metal Roller Ball"] },
        ]);
        expect(description).toBe("A precise, personal application. 3 roll-on bottles across Cylinder, Circle and Slim, from 3 ml to 15 ml.");
    });
});

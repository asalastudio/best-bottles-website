import { describe, expect, it } from "vitest";
import {
    annotateGraceSearchRows,
    buildGraceSearchTiles,
    graceVerifiedProductHref,
    preferHeroRepresentative,
    type GraceTileImageSources,
} from "../src/lib/grace/searchTiles";

type Row = { slug?: string | null; websiteSku?: string | null; graceSku?: string | null; itemName: string };

/** The group's hero is the row whose SKU ends in "-HERO", if the search returned it. */
const sources: GraceTileImageSources<Row> = {
    heroForGroup: (slug, rows) => {
        const hero = rows.find((row) => row.websiteSku?.endsWith("-HERO"));
        return hero?.websiteSku ? { websiteSku: hero.websiteSku, url: `/images/catalog/${slug}/${hero.websiteSku}.webp` } : null;
    },
    plateForSku: (sku) => (sku?.startsWith("PLATED") ? `https://blob.example/plates/${sku}.png` : null),
};

describe("Grace search tiles", () => {
    it("links a verified row to its own product page with its own SKU", () => {
        expect(graceVerifiedProductHref({
            slug: "cylinder-9ml-amber-17-415-rollon",
            websiteSku: "GBCyl9AmbMtlRollGl",
            graceSku: "GB-CYL-AMB-9ML",
        })).toBe("/products/cylinder-9ml-amber-17-415-rollon?sku=GBCyl9AmbMtlRollGl");
    });

    it("uses graceSku only when websiteSku is missing, and no link without a slug", () => {
        expect(graceVerifiedProductHref({ slug: "vial-1ml-clear-plug", websiteSku: null, graceSku: "GB-VIAL-1ML" }))
            .toBe("/products/vial-1ml-clear-plug?sku=GB-VIAL-1ML");
        expect(graceVerifiedProductHref({ slug: "  ", websiteSku: "GBX" })).toBeNull();
        expect(graceVerifiedProductHref({ slug: "vial-1ml-clear-plug", websiteSku: "", graceSku: "" })).toBeNull();
    });

    it("gives the group's Sunburst hero to exactly its SKU, a plate to the others, and never borrows a photo", () => {
        const rows: Row[] = [
            { slug: "a-group", websiteSku: "PLATED-A1", itemName: "A matte" },
            { slug: "a-group", websiteSku: "A2-HERO", itemName: "A shiny" },
            { slug: "a-group", websiteSku: "BARE-A3", itemName: "A black" },
            { slug: "b-group", websiteSku: "PLATED-B1", itemName: "B" },
            { slug: null, websiteSku: "BARE-C", graceSku: "GB-C", itemName: "C" },
        ];
        const annotated = annotateGraceSearchRows(rows, sources);
        expect(annotated.map((row) => [row.websiteSku, row.heroImageKind, row.heroImageUrl])).toEqual([
            ["PLATED-A1", "plate", "https://blob.example/plates/PLATED-A1.png"],
            ["A2-HERO", "sunburst", "/images/catalog/a-group/A2-HERO.webp"],
            ["BARE-A3", null, null],
            ["PLATED-B1", "plate", "https://blob.example/plates/PLATED-B1.png"],
            ["BARE-C", null, null],
        ]);
        expect(annotated.map((row) => row.verifiedPdpHref)).toEqual([
            "/products/a-group?sku=PLATED-A1",
            "/products/a-group?sku=A2-HERO",
            "/products/a-group?sku=BARE-A3",
            "/products/b-group?sku=PLATED-B1",
            null,
        ]);
    });

    it("represents each group by its hero row, else a plated row, else the first row, in search order", () => {
        const rows: Row[] = [
            { slug: "a-group", websiteSku: "PLATED-A1", itemName: "A matte" },
            { slug: "b-group", websiteSku: "BARE-B1", itemName: "B bare" },
            { slug: "a-group", websiteSku: "A2-HERO", itemName: "A shiny" },
            { slug: "b-group", websiteSku: "PLATED-B2", itemName: "B plated" },
            { slug: "c-group", websiteSku: "BARE-C1", itemName: "C one" },
            { slug: "c-group", websiteSku: "BARE-C2", itemName: "C two" },
        ];
        const tiles = buildGraceSearchTiles(rows, sources);
        expect(tiles.map((tile) => [tile.websiteSku, tile.heroImageKind])).toEqual([
            ["A2-HERO", "sunburst"],
            ["PLATED-B2", "plate"],
            ["BARE-C1", null],
        ]);
        // The photo and the link name the same variant.
        expect(tiles[0].verifiedPdpHref).toBe("/products/a-group?sku=A2-HERO");
        expect(buildGraceSearchTiles(rows, sources, 2).map((tile) => tile.websiteSku)).toEqual(["A2-HERO", "PLATED-B2"]);
        expect(buildGraceSearchTiles([], sources)).toEqual([]);
    });

    it("lets the client prefer the same representative among raw rows", () => {
        const annotated = annotateGraceSearchRows([
            { slug: "a-group", websiteSku: "PLATED-A1", itemName: "A matte" },
            { slug: "a-group", websiteSku: "A2-HERO", itemName: "A shiny" },
            { slug: null, websiteSku: "BARE-L1", graceSku: "GB-L1", itemName: "loose one" },
            { slug: null, websiteSku: "BARE-L2", graceSku: "GB-L2", itemName: "loose two" },
        ] as Row[], sources);
        expect(preferHeroRepresentative(annotated).map((row) => row.websiteSku)).toEqual(["A2-HERO", "BARE-L1", "BARE-L2"]);
    });
});

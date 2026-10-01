import { describe, expect, it } from "vitest";
import links from "../convex/catalog-component-links.json";
import assemblies from "../convex/catalog-included-assemblies.json";
import { compatibleFinishComponent, isBuilderCandidate, type CatalogRow } from "@/lib/bottle-builder/model";

/**
 * Build Your Bottle checklist, batch 2 (Jordan, 2026-10-01): each bottle pairs with the part it ships with, as its
 * bestbottles.com page says. Rows are shaped the way matrix.getFamilyRows returns them.
 */
type Part = { websiteSku: string; graceSku: string };
const part = ({ websiteSku, graceSku }: Part) => ({ websiteSku, graceSku, itemName: websiteSku, imageUrl: null, stockStatus: "In Stock",
    shopifyVariantId: `variant-${websiteSku}`, shopifySellable: true, capColor: null, productGroupSlug: null, webPrice1pc: null, webPrice12pc: null });
const row = (identity: Record<string, unknown>, components: Record<string, Part[]>) => ({
    category: "Glass Bottle", itemName: "Catalog bottle", resolution: "fitment_rule", shopifyVariantId: "assembly-variant", shopifySellable: true,
    stockStatus: "In Stock", webPrice1pc: 1, ...identity,
    components: Object.fromEntries(Object.entries(components).map(([kind, parts]) => [kind, parts.map(part)])),
}) as unknown as CatalogRow;
const linkIdentity = (link: (typeof links)[number]) => ({ websiteSku: link.assemblySku, graceSku: link.assemblyGraceSku, family: link.family,
    capacityMl: link.capacityMl, color: link.color, neckThreadSize: link.neck, applicator: link.applicator, capColor: link.finish });

/** The eleven 13-415 glasses sold with every short lined cap (no short shiny silver Square 15 exists). */
const GLASSES = ["GBElgFrst15", "GBElg15", "GBFlair15", "GBRect10", "GBTallRect10", "GBRoyal13", "GBSleek5", "GBSleek8", "GBSqr15", "GBTulipAmb5", "GBTulip6"];
const SHORT_CAPS: Record<string, Part & { bottles: string[] }> = {
    "Matte Copper": { websiteSku: "CP13-415CuSht", graceSku: "CMP-CLS-MTCP-S-13-415", bottles: GLASSES.map(g => `${g}CuSht`) },
    "Matte Gold": { websiteSku: "CP13-415GlMattSht", graceSku: "CMP-CLS-MTGD-S-13-415", bottles: GLASSES.map(g => `${g}GlMattSht`) },
    "Matte Silver": { websiteSku: "CP13-415SlMattSht", graceSku: "CMP-CLS-MTSL-S-13-415", bottles: GLASSES.map(g => `${g}SlMattSht`) },
    "Shiny Gold": { websiteSku: "CP13-415GlSht", graceSku: "CMP-CLS-SHGD-S-13-415", bottles: GLASSES.map(g => `${g}GlSht`) },
    "Shiny Silver": { websiteSku: "CP13-415SlSht", graceSku: "CMP-CLS-SHSL-S-13-415-02", bottles: GLASSES.filter(g => g !== "GBSqr15").map(g => `${g}SlSht`) },
};
/** Every 13-415 cap a short-cap bottle's rule lists: the ribbed and tall lined caps and all six short lined ones. */
const LISTED_13_415_CAPS: Part[] = [
    { websiteSku: "CP13-415BlkSht", graceSku: "CMP-CAP-BLK-S-13-415" }, { websiteSku: "CP13-415WhtSht", graceSku: "CMP-CAP-WHT-S-13-415" },
    { websiteSku: "CP13-415Gl", graceSku: "CMP-CAP-SGLD-13-415-01" }, { websiteSku: "CP13-415Sl", graceSku: "CMP-CAP-SLV-13-415-01" },
    { websiteSku: "CP13-415BlkShShtMtl", graceSku: "CMP-CAP-SBLK-13-415" },
    ...Object.values(SHORT_CAPS).map(({ websiteSku, graceSku }) => ({ websiteSku, graceSku })),
];
const BLACK_DROPPER: Part = { websiteSku: "Drp18-40015mlBlckBulb", graceSku: "CMP-DRP-BLK-18400-90MM" };
const LISTED_18_400_DROPPERS: Part[] = [
    { websiteSku: "Drp18-40015mlWhiteBulb", graceSku: "CMP-DRP-WHT-18400-66" }, { websiteSku: "Drp18-40015mlShnSlTrimBlkBulb", graceSku: "CMP-DRP-BKSL-18400-66" },
    { websiteSku: "Drp18-40015mlShnGlTrimWhiteBulb", graceSku: "CMP-DRP-WTGD-18400-66" }, { websiteSku: "Drp18-40015mlShnGlTrimBlkBulb", graceSku: "CMP-DRP-BKGD-18400-66" },
    BLACK_DROPPER,
];

describe("Build Your Bottle checklist batch 2 (2026-10-01)", () => {
    it("pairs each short cap bottle with the short lined cap of its finish (1a-1e), each from its own bestbottles.com page", () => {
        for (const [finish, cap] of Object.entries(SHORT_CAPS)) {
            const paired = links.filter(link => cap.bottles.includes(link.assemblySku));
            expect(paired.map(link => link.assemblySku).sort(), finish).toEqual([...cap.bottles].sort());
            for (const link of paired) {
                expect(link).toMatchObject({ componentGraceSku: cap.graceSku, finish, neck: "13-415", componentType: "Cap" });
                expect(link.assemblySourceUrl).toMatch(/^https:\/\/www\.bestbottles\.com\/product\//);
                expect(link.assemblySourceSha256).toMatch(/^[0-9a-f]{64}$/);
                const bottle = row(linkIdentity(link), { Cap: LISTED_13_415_CAPS });
                expect(compatibleFinishComponent(bottle)?.websiteSku, link.assemblySku).toBe(cap.websiteSku);
                expect(isBuilderCandidate(bottle), link.assemblySku).toBe(true);
            }
        }
    });

    it("pairs the three Boston Round 15 black dropper bottles with the plain black 18-400 dropper (3c, 4a)", () => {
        const paired = links.filter(link => link.componentSku === BLACK_DROPPER.websiteSku);
        expect(paired.map(link => link.assemblySku).sort()).toEqual(["GBBstn15BlkDrp", "GBBstnAmb15mlBlkDropper", "GBBstnBlu15BlkDrpr"]);
        for (const link of paired) {
            expect(link).toMatchObject({ applicator: "Dropper", finish: "Black", componentType: "Dropper", neck: "18-400" });
            // Its stem is 66 mm, made for the 1/2 oz Boston round, whatever its record id says.
            expect(link.componentName).toMatch(/66 mm/);
            expect(compatibleFinishComponent(row(linkIdentity(link), { Dropper: LISTED_18_400_DROPPERS }))?.websiteSku, link.assemblySku).toBe(BLACK_DROPPER.websiteSku);
        }
        // The clear one has no bestbottles.com page; its witness is its own product photograph.
        expect(paired.find(link => link.assemblySku === "GBBstn15BlkDrp")?.assemblySourceUrl).toMatch(/^https:\/\/cdn\.shopify\.com\//);
    });

    it("offers the 16 reducer bottles with their included shiny black cap, the record the other 13 already have (2a)", () => {
        const reducers = assemblies.filter(source => source.fitment === "Reducer");
        expect(reducers).toHaveLength(29);
        for (const source of reducers) {
            expect(source).toMatchObject({ applicator: "Reducer", capColor: "Shiny Black", finish: "Shiny Black", neckThreadSize: "18-415" });
            expect(compatibleFinishComponent(row(source, { Cap: [] }))?.websiteSku, source.websiteSku).toBe(source.websiteSku);
        }
        const frosted = reducers.find(source => source.websiteSku === "GBDivaFrst46RdcrShnBlk")!;
        // Only once its cap colour is corrected: today it says "Clear".
        expect(compatibleFinishComponent(row({ ...frosted, capColor: "Clear" }, { Cap: [] }))).toBeNull();
    });

    it("breaks the Vial 9 and Vial 2 black cap ties toward the short cap (1h, 4c)", () => {
        const vial9 = row({ websiteSku: "GB09BlackCapSht", graceSku: "GB-CYL-CLR-9ML-S-01", family: "Vial", capacityMl: 9, color: "Clear", neckThreadSize: "18-400",
            applicator: null, capColor: "Black" }, { Cap: [{ websiteSku: "18-400CpShortBlk", graceSku: "CMP-CAP-BLK-18-400" }, { websiteSku: "18-400CpAppBlk", graceSku: "CMP-APP-BLK-18-400" }] });
        expect(compatibleFinishComponent(vial9)?.websiteSku).toBe("18-400CpShortBlk");
        const vial2 = row({ websiteSku: "GBVialClr2mlBlackCap", graceSku: "GB-VIA-CLR-2ML-BLK-T", family: "Vial", capacityMl: 2, color: "Clear", neckThreadSize: "8-425",
            applicator: null, capColor: "Black" }, { Cap: [{ websiteSku: "8-425CpShortBlack", graceSku: "CMP-CAP-BLK-8-425" }, { websiteSku: "CP8-425TallBlack", graceSku: "CMP-CAP-BLK-8425-T" }] });
        expect(compatibleFinishComponent(vial2)?.websiteSku).toBe("8-425CpShortBlack");
    });
});

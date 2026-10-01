import { describe, expect, it } from "vitest";
import links from "../convex/catalog-component-links.json";
import assemblies from "../convex/catalog-included-assemblies.json";
import { compatibleFinishComponent, isBuilderCandidate, type CatalogRow } from "@/lib/bottle-builder/model";

/**
 * Build Your Bottle checklist, items Jordan approved on 2026-10-01: each bottle pairs with the part it ships with.
 * Rows are shaped the way matrix.getFamilyRows returns them; the parts are the ones each bottle lists.
 */
type Part = { websiteSku: string; graceSku: string };
const part = ({ websiteSku, graceSku }: Part) => ({ websiteSku, graceSku, itemName: websiteSku, imageUrl: null, stockStatus: "In Stock",
    shopifyVariantId: `variant-${websiteSku}`, shopifySellable: true, capColor: null, productGroupSlug: null, webPrice1pc: null, webPrice12pc: null });
const row = (identity: Record<string, unknown>, components: Record<string, Part[]>) => ({
    category: "Glass Bottle", itemName: "Catalog bottle", resolution: "fitment_rule", shopifyVariantId: "assembly-variant", shopifySellable: true,
    stockStatus: "In Stock", webPrice1pc: 1, ...identity,
    components: Object.fromEntries(Object.entries(components).map(([kind, parts]) => [kind, parts.map(part)])),
}) as unknown as CatalogRow;

const SHORT_SHINY_BLACK = { websiteSku: "CP13-415BlkShShtMtl", graceSku: "CMP-CAP-SBLK-13-415" };
const LISTED_13_415_CAPS = [
    { websiteSku: "CP13-415BlkSht", graceSku: "CMP-CAP-BLK-S-13-415" }, { websiteSku: "CP13-415WhtSht", graceSku: "CMP-CAP-WHT-S-13-415" },
    { websiteSku: "CP13-415Gl", graceSku: "CMP-CAP-SGLD-13-415-01" }, { websiteSku: "CP13-415Sl", graceSku: "CMP-CAP-SLV-13-415-01" },
];
const BATCH_1F = ["GBBell10BlkShSht", "GBElgFrst15BlkShSht", "GBElg15BlkShSht", "GBFlair15BlkShSht", "GBPillar9BlkShSht", "GBRect10BlkShSht",
    "GBTallRect10BlkShSht", "GBRoyal13BlkShSht", "GBSleek5BlkShSht", "GBSleek8BlkShSht", "GBSqr15BlkShSht", "GBTulip6BlkShSht", "GBTulipAmb5BlkShSht"];

describe("Build Your Bottle checklist batch 1 (2026-10-01)", () => {
    it("pairs each short shiny black cap bottle with CP13-415BlkShShtMtl, whose own SKU names no finish the builder can read", () => {
        const added = links.filter(link => BATCH_1F.includes(link.assemblySku));
        expect(added.map(link => link.assemblySku).sort()).toEqual([...BATCH_1F].sort());
        for (const link of added) {
            expect(link).toMatchObject({ componentSku: SHORT_SHINY_BLACK.websiteSku, componentGraceSku: SHORT_SHINY_BLACK.graceSku, finish: "Shiny Black", neck: "13-415" });
            expect(link.assemblySourceUrl).toMatch(/^https:\/\/www\.bestbottles\.com\/product\//);
            const identity = { websiteSku: link.assemblySku, graceSku: link.assemblyGraceSku, family: link.family, capacityMl: link.capacityMl, color: link.color,
                neckThreadSize: link.neck, applicator: link.applicator, capColor: link.finish };
            const bottle = row(identity, { Cap: [...LISTED_13_415_CAPS, SHORT_SHINY_BLACK] });
            expect(compatibleFinishComponent(bottle)?.websiteSku, link.assemblySku).toBe(SHORT_SHINY_BLACK.websiteSku);
            expect(isBuilderCandidate(bottle), link.assemblySku).toBe(true);
            // The pairing holds only for the bottle's corrected cap colour: three rows stored a blank or "Clear" one.
            expect(compatibleFinishComponent(row({ ...identity, capColor: "Clear" }, { Cap: [...LISTED_13_415_CAPS, SHORT_SHINY_BLACK] }))).toBeNull();
        }
    });

    it("offers the Elegant and Sleek lotion bottles with their included white rectangular pump, as Empire already is", () => {
        const lotion = assemblies.filter(source => /^LB(Elg|Slk)/.test(source.websiteSku));
        expect(lotion.map(source => source.websiteSku).sort()).toEqual(["LBElg100WhtClOvrCp", "LBElg60WhtClOvrCp", "LBElgFrst100WhtClOvrCp",
            "LBElgFrst60WhtClOvrCp", "LBSlk100WhtRectClOverCap", "LBSlk30WhtRectClOverCap", "LBSlk50WhtRectClOverCap"]);
        for (const source of lotion) {
            expect(source).toMatchObject({ applicator: "Lotion Pump", fitment: "Lotion Pump", finish: "White rectangular pump, clear overcap" });
            const bottle = row(source, { "Lotion Pump": [{ websiteSku: "Ltn18-415MtSlCl", graceSku: "CMP-LPM-MSLV-18-415-02" }] });
            expect(compatibleFinishComponent(bottle)).toMatchObject({ websiteSku: source.websiteSku, name: "White rectangular pump, clear overcap Lotion Pump included with this bottle" });
        }
    });

    it("names the Minarets as Minarets: the silver ones no longer pair with the tall shiny silver screw cap", () => {
        const minarets = assemblies.filter(source => /Minar(Cu|Sl)$/.test(source.websiteSku));
        expect(minarets).toHaveLength(10);
        for (const source of minarets) {
            expect(source.finish).toBe(`${source.capColor} Minaret`);
            const bottle = row(source, { Cap: LISTED_13_415_CAPS });
            expect(compatibleFinishComponent(bottle)).toMatchObject({ websiteSku: source.websiteSku, name: `${source.finish} Cap/Closure included with this bottle` });
        }
        const flair = minarets.find(source => source.websiteSku === "GBFlair15MinarSl")!;
        // Without the record, "Silver" from the SKU matched the tall lined CP13-415Sl, and the builder sold it as "Tall Shiny Silver".
        expect(compatibleFinishComponent(row({ ...flair, capColor: "Silver" }, { Cap: LISTED_13_415_CAPS }))?.websiteSku).toBe("CP13-415Sl");
    });

    it("pairs the Elegant 60 red tassel sprayer and the Diva 46 lavender ring sprayer with their own bulbs", () => {
        const sprayers = [
            { websiteSku: "AnSpTsl18-415Red", graceSku: "CMP-SPR-RDSLWH-18-415-02" }, { websiteSku: "AnSpTsl18-415Lvn", graceSku: "CMP-SPR-LVSLWH-18-415-02" },
            { websiteSku: "AnSp18-415Red", graceSku: "CMP-SPR-RDSL-18-415-02" }, { websiteSku: "AnSp18-415Lvn", graceSku: "CMP-SPR-LVSL-18-415-02" },
            { websiteSku: "Spry18-415ShnSl", graceSku: "CMP-SPR-SHSL-18-415-06" },
        ];
        const red = row({ websiteSku: "GBElg60AnSpTslRed", graceSku: "GB-ELG-CLR-60ML-ASP-04", family: "Elegant", capacityMl: 60, color: "Clear",
            neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capColor: "Clear" }, { Sprayer: sprayers });
        expect(compatibleFinishComponent(red)?.websiteSku).toBe("AnSpTsl18-415Red");
        const lavender = row({ websiteSku: "GBDiva46AnSpLvnRng", graceSku: "GB-DVA-CLR-46ML-T-04", family: "Diva", capacityMl: 46, color: "Clear",
            neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer", capColor: "Clear" }, { Sprayer: sprayers });
        expect(compatibleFinishComponent(lavender)?.websiteSku).toBe("AnSp18-415Lvn");
    });
});

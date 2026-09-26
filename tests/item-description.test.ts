import { describe, expect, it } from "vitest";
import { classifyUses, parseLegacyDescription, parseUses, stripLegacyFraming } from "@/lib/products/item-description/legacy-facts";
import { composeItemDescription, millimetres, type ComposeInput } from "@/lib/products/item-description/compose";
import { fallbackItemType, normalizeLegacyItemType } from "@/lib/products/item-description/item-type";
import { curatedItemDescription, resolveItemDescription } from "@/lib/products/item-description/resolve";

const COBALT_ROLLON: ComposeInput = {
    websiteSku: "GBCylBlu9MtlRollBlkDot",
    graceSku: "GB-CYL-BLU-9ML-MRL-BKDT",
    family: "Cylinder",
    category: "Glass Bottle",
    capacity: "9 ml (0.3 oz)",
    capacityMl: 9,
    capacityOz: 0.3,
    color: "Cobalt Blue",
    applicator: "Metal Roller Ball",
    ballMaterial: "Metal",
    capColor: "Black Dotted",
    capStyle: "Dot Cap",
    neckThreadSize: "17-415",
    heightWithCap: "85 ±1 mm",
    heightWithoutCap: "70 ±1 mm",
    diameter: "20 ±0.5 mm",
    bottleWeightG: 30.14,
    caseQuantity: 724,
    legacyDescription: "Cylinder design 9ml,1/3 oz Cobalt blue glass bottle with metal roller ball plug and black dot cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, Small sized bottle for promotion samples and travel. Pric",
    familyProfile: { capacitiesMl: [5, 9, 25], fitmentsAtNeck: ["Metal Roller Ball", "Plastic Roller Ball", "Fine Mist Sprayer", "Lotion Pump"], plasticCheaperThanMetal: true },
};

describe("legacy facts", () => {
    it("strips the old site's framing, including a truncated price tail", () => {
        expect(stripLegacyFraming("Item Description: Bell design 10ml. Price each")).toBe("Bell design 10ml.");
        expect(stripLegacyFraming("Bell design 10ml. Pric")).toBe("Bell design 10ml.");
        expect(stripLegacyFraming("Bell design 10ml. P")).toBe("Bell design 10ml.");
    });

    it("keeps 'face and body spray' as one use and splits only the final 'X and Y'", () => {
        expect(parseUses("For use with cologne, Eau de Parfum, air freshner, face and body spray, or room spray."))
            .toEqual(["cologne", "eau de parfum", "air freshener", "face and body spray", "room spray"]);
        expect(parseUses("For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy."))
            .toEqual(["perfume or fragrance oil", "essential oils", "aromatic oils", "aromatherapy"]);
    });

    it("recovers flags and marks truncated text without copying it forward", () => {
        const facts = parseLegacyDescription("Boston round design 30ml, 1oz Amber glass bottle with metal roll on and black cap. For use with perfume or fragrance oil. Refillable bottle with large, 12mm diameter metal-roller ball. Antique or vintage bulb sprayers enhance the beau");
        expect(facts?.flags.refillable).toBe(true);
        expect(facts?.flags.rollerBallMm).toBe(12);
        expect(facts?.truncated).toBe(true);
        expect(facts?.extras).toEqual([]);
        expect(facts?.configuration).toBe("metal roll on and black cap");
    });

    it("classifies a use list", () => {
        expect(classifyUses(["serums", "light creams"])).toBe("lotion");
        expect(classifyUses(["cologne", "aftershave", "splash-on"])).toBe("splash-on");
        expect(classifyUses(["perfume or fragrance oil", "aromatherapy"])).toBe("fragrance-oil");
    });
});

describe("composer", () => {
    it("writes the reference cobalt roll-on from its fields and legacy facts", () => {
        const result = composeItemDescription(COBALT_ROLLON);
        expect(result).not.toBeNull();
        const text = result!.text;
        expect(text.startsWith("A 9 ml (0.3 oz) cobalt blue glass cylinder, fitted with a steel roller ball and a black cap with dots.")).toBe(true);
        expect(text).toContain("For perfume or fragrance oil, essential oils, aromatic oils and aromatherapy.");
        expect(text).toContain("It stands 70 mm without the cap and 85 mm with it and 20 mm across, on a 17-415 neck.");
        expect(text).toContain("Refillable. Sold assembled, 724 to a case.");
        expect(text).not.toContain("Price");
        expect(text).not.toContain("Pric");
        expect(result!.words).toBeLessThanOrEqual(110);
    });

    it("keeps the velvet-hammer tone: no em dashes, exclamation points or hype", () => {
        const text = composeItemDescription(COBALT_ROLLON)!.text;
        expect(text).not.toMatch(/[—!]/);
        expect(text).not.toMatch(/\b(amazing|premium|perfect|elevate|must-have|best)\b/i);
    });

    it("prices the plastic roller against steel only when the group says it is cheaper", () => {
        const plastic = composeItemDescription({ ...COBALT_ROLLON, websiteSku: "GBCylBlu9RollBlkDot", applicator: "Plastic Roller Ball", ballMaterial: "Plastic" })!.text;
        expect(plastic).toContain("fitted with a plastic roller ball and a black cap with dots");
        expect(plastic).toContain("weighs less and costs less");
        const unknown = composeItemDescription({ ...COBALT_ROLLON, applicator: "Plastic Roller Ball", familyProfile: { capacitiesMl: [], fitmentsAtNeck: [], plasticCheaperThanMetal: null } })!.text;
        expect(unknown).toContain("rolls the same thin line as steel and weighs less.");
        expect(unknown).not.toContain("costs less");
    });

    it("omits every measurement it does not have and never invents one", () => {
        const text = composeItemDescription({
            ...COBALT_ROLLON, heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null, caseQuantity: null, neckThreadSize: null,
        })!.text;
        expect(text).not.toContain("It stands");
        expect(text).not.toContain("mm");
        expect(text).not.toContain("neck");
        expect(text).toContain("Sold assembled.");
    });

    it("drops a closed height that is lower than the open height as a data error", () => {
        const text = composeItemDescription({ ...COBALT_ROLLON, heightWithCap: "20 ±1 mm" })!.text;
        expect(text).toContain("It stands 70 mm without the cap and 20 mm across");
        expect(text).not.toContain("with it");
    });

    it("treats a sprayer's collar as the closure and names the overcap the legacy page mentions", () => {
        const text = composeItemDescription({
            ...COBALT_ROLLON, websiteSku: "GBCyl9SpryBlk", color: "Clear", applicator: "Fine Mist Sprayer", capColor: "Black", capStyle: "Tall",
            legacyDescription: "Cylinder design 9ml,1/3 oz clear glass bottle with fine mist sprayer with black trim and plastic overcap. For use with cologne, Eau de Parfum. Price each",
        })!.text;
        expect(text).toContain("fitted with a black fine-mist sprayer under a plastic overcap.");
        expect(text).not.toContain("and a black cap");
    });

    it("writes screw-cap bottles with the fitments their neck takes", () => {
        const text = composeItemDescription({
            ...COBALT_ROLLON, websiteSku: "GBCyl5Sl", graceSku: null, capacityMl: 5, capacityOz: 0.17, color: "Clear", applicator: null, capColor: "Shiny Silver", capStyle: "Tall", neckThreadSize: "13-415", caseQuantity: null,
            legacyDescription: "Cylinder design 5ml, 1/6oz Clear glass bottle with shiny silver cap. For use with perfume or fragrance oil. Refillable, Small sized bottle. Price each",
            familyProfile: { capacitiesMl: [5], fitmentsAtNeck: ["Fine Mist Sprayer", "Metal Roller Ball"], plasticCheaperThanMetal: null },
        })!.text;
        expect(text).toContain("with a shiny silver tall cap.");
        expect(text).toContain("the 13-415 neck also takes the fine-mist sprayer and roll-on sold for this bottle.");
        expect(text).toContain("Refillable. Ships capped.");
    });

    it("recovers a cap colour the import replaced with the glass colour", () => {
        const text = composeItemDescription({
            ...COBALT_ROLLON, websiteSku: "GBVAmb1DrmBlackCapSht", graceSku: null, family: "Vial", capacityMl: 4, capacityOz: 0.14, color: "Amber", applicator: null, capColor: "Clear", capStyle: "Short", neckThreadSize: "13-425", caseQuantity: null,
            legacyDescription: "Vial design 1 dram Amber glass vial with black short cap. For use with perfume or fragrance oil, sample or trial size. Price each",
            familyProfile: null,
        })!.text;
        expect(text).toContain("amber glass vial with a black short cap.");
        expect(text).not.toContain("trial size");
    });

    it("reads a ground-glass neck as a stopper and says so honestly", () => {
        const text = composeItemDescription({
            ...COBALT_ROLLON, websiteSku: "GB1ozGenieBl", graceSku: null, family: "Decorative", capacityMl: 32, capacityOz: 1.08, applicator: null, capColor: "Clear", capStyle: "Tall", neckThreadSize: "Ground", caseQuantity: null,
            legacyDescription: "Blue Genie glass bottle.", familyProfile: null,
        })!.text;
        expect(text).toContain("fitted with a ground-glass stopper.");
        expect(text).toContain("not leak-proof");
        expect(text).toContain("without the stopper");
        expect(text).toContain("Ships with the stopper.");
    });

    it("uses 'an' before eighteen and eight", () => {
        expect(composeItemDescription({ ...COBALT_ROLLON, neckThreadSize: "18-415" })!.text).toContain("on an 18-415 neck");
        expect(composeItemDescription({ ...COBALT_ROLLON, neckThreadSize: "8mm" })!.text).toContain("with an 8 mm neck");
    });

    it("falls back to cleaned legacy prose for components", () => {
        const result = composeItemDescription({
            ...COBALT_ROLLON, category: "Component", family: "Roll-On Cap",
            legacyDescription: "Item Description: Matte silver cap or closure for rollon bottles. Metal shell cap with plastic insert. Thread size 13-4",
        });
        expect(result?.text).toBe("Matte silver cap or closure for rollon bottles. Metal shell cap with plastic insert.");
    });

    it("formats millimetre fields without tolerances", () => {
        expect(millimetres("70 ±1 mm")).toBe("70 mm");
        expect(millimetres("17.5mm")).toBe("17.5 mm");
        expect(millimetres("n/a")).toBeNull();
    });
});

describe("item type", () => {
    it("keeps the legacy category line and fixes only spelling", () => {
        expect(normalizeLegacyItemType("Alluminum Bottles With Fine Mist Sprayers")).toBe("Aluminum Bottles With Fine Mist Sprayers");
        expect(normalizeLegacyItemType("Caps, Rollon Plugs and Spray Tops")).toBe("Caps, Roll-on Plugs and Spray Tops");
        expect(normalizeLegacyItemType("Clear glass roll on bottles. Capacity range about 1/2oz ( from 12ml to 15ml)"))
            .toBe("Clear glass roll-on bottles. Capacity range about 1/2oz (from 12ml to 15ml)");
    });

    it("builds a category line for SKUs the legacy site never carried", () => {
        expect(fallbackItemType({ category: "Glass Bottle", family: "Bell", applicator: "Metal Roller Ball" }))
            .toBe("Clear, frosted and colored glass roll-on bottles with steel or plastic roller balls");
        expect(fallbackItemType({ category: "Glass Jar", family: "Cream Jar" })).toBe("Cream jars");
    });
});

describe("resolver", () => {
    it("finds curated copy by website SKU and by Grace SKU", () => {
        const byWebsite = curatedItemDescription({ websiteSku: "GBCylBlu9MtlRollBlkDot" });
        expect(byWebsite?.description).toContain("cobalt blue glass cylinder");
        const byGrace = curatedItemDescription({ graceSku: "GB-CYL-BLU-9ML-MRL-BKDT" });
        expect(byGrace?.websiteSku).toBe("GBCylBlu9MtlRollBlkDot");
    });

    it("composes at request time for a SKU the JSON does not know", () => {
        const resolved = resolveItemDescription({ ...COBALT_ROLLON, websiteSku: "GBCylBlu9MtlRollNEW", graceSku: "GB-NEW", familyProfile: undefined });
        expect(resolved?.source).toBe("composed");
        expect(resolved?.description).toContain("fitted with a steel roller ball");
        expect(resolved?.itemType).toContain("roll-on bottles");
    });
});

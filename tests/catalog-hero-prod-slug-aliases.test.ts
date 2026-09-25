import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCatalogHero, getReleasedCatalogHero, resolveLiveCatalogCardHero } from "@/lib/products/catalog-heroes";

// Production group slugs (prod Convex, 2026-09-25) and the SKUs they hold.
const aluminum65 = [{ websiteSku: "Alu65mlLotionPumpWhite" }, { websiteSku: "Alu65mlLotionPumpBlack" }];
const aluminum120 = [{ websiteSku: "Alu120mlLotionPumpWhite" }, { websiteSku: "Alu120mlLotionPumpBlack" }];

describe("heroes recorded under slugs production has since renamed", () => {
    const previous = process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT;
    beforeEach(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = "families-2026-09-22"; });
    afterEach(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = previous; });

    it("shows the released Aluminum heroes on production's merged groups", () => {
        const white = getCatalogHero("aluminum-bottle-65ml-mixed-20-410", aluminum65, "Alu65mlLotionPumpWhite");
        expect(white?.url).toContain("/next-four-approved-2026-09-24/Alu65mlLotionPumpWhite.");
        expect(white?.groupSlug).toBe("aluminum-bottle-65ml-mixed-20-410");
        expect(getCatalogHero("aluminum-bottle-65ml-mixed-20-410", aluminum65, "Alu65mlLotionPumpBlack")?.url)
            .toContain("/next-four-approved-2026-09-24/Alu65mlLotionPumpBlack.");
        expect(getCatalogHero("aluminum-bottle-120ml-mixed-20-410", aluminum120)?.url)
            .toContain("/next-four-approved-2026-09-24/Alu120mlLotionPumpBlack.");
        expect(getReleasedCatalogHero("aluminum-bottle-65ml-mixed-20-410", "Alu65mlLotionPumpBlack")?.url)
            .toContain("/Alu65mlLotionPumpBlack.");
    });

    it("lets the released hero win the card on a renamed group", () => {
        const staticHero = getCatalogHero("aluminum-bottle-65ml-mixed-20-410", aluminum65);
        // A live Shopify group photo outranks every hero except a released one.
        const heroImageUrl = "https://cdn.shopify.com/s/files/1/0000/files/alu65.png";
        const card = resolveLiveCatalogCardHero({ heroImageUrl, staticHero, variants: aluminum65 });
        expect(card.imageUrl).toBe(staticHero?.url);
        expect(card.imageUrl).toContain("/next-four-approved-2026-09-24/");
    });

    it("restores the recorded heroes of the other renamed Aluminum and Heart groups", () => {
        expect(getCatalogHero("aluminum-bottle-100ml-mixed-20-410", [{ websiteSku: "Alu100mlSprayBlack" }])?.url).toContain("/Alu100mlSprayBlack.");
        expect(getCatalogHero("aluminum-bottle-500ml-mixed-20-410", [{ websiteSku: "Alu500" }])?.url).toContain("/Alu500.");
        expect(getCatalogHero("heart-4ml-frosted-8mm-keychain", [{ websiteSku: "GBHeartFrst4KeyGld" }])?.url).toContain("/GBHeartFrst4KeyGld.");
        expect(getCatalogHero("heart-4ml-frosted-8mm-tassel", [{ websiteSku: "GBHeartFrst4TslRed" }])?.url).toContain("/GBHeartFrst4TslRed.");
    });

    it("still requires the exact SKU in the group", () => {
        expect(getCatalogHero("aluminum-bottle-120ml-mixed-20-410", [{ websiteSku: "Alu120mlLotionPumpWhite" }])).toBeNull();
        expect(getReleasedCatalogHero("aluminum-bottle-65ml-mixed-20-410", "Alu120mlLotionPumpBlack")).toBeNull();
    });
});

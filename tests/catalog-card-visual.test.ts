import { describe, expect, it } from "vitest";
import { resolveCatalogCardVisual } from "../src/lib/products/catalog-card-visual";
const hero = { heroImageUrl: "premium-empty", heroHoverImageUrl: "premium-filled", heroHovered: false, fallbackImageUrl: "sku-plate" };

describe("premium catalog hero preservation", () => {
    it("keeps the premium hero even when fallback component imagery is loaded", () => {
        expect(resolveCatalogCardVisual(hero)).toEqual({ mode: "hero", url: "premium-empty" });
    });
    it("uses the separately supplied filled hero only for hero hover", () => {
        expect(resolveCatalogCardVisual({ ...hero, heroHovered: true })).toEqual({ mode: "hero-hover", url: "premium-filled" });
        expect(resolveCatalogCardVisual({ ...hero, heroHovered: false }).url).toBe("premium-empty");
    });
    it("never substitutes a plate for a missing oil-fill asset", () => {
        expect(resolveCatalogCardVisual({ ...hero, heroHovered: true, heroHoverImageUrl: null }).url).toBe("premium-empty");
    });
    it("uses catalog imagery only if the premium default is unavailable", () => {
        expect(resolveCatalogCardVisual({ ...hero, heroImageUrl: null })).toEqual({ mode: "fallback", url: "sku-plate" });
    });
});

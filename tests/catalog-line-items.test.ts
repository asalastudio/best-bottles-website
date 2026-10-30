import { describe, expect, it } from "vitest";
import heroRows from "../src/lib/products/catalog-heroes.json";
import { getCatalogVariantThumbnail, resolveCatalogLineThumbnail } from "../src/lib/products/catalog-line-items";

// A real base-registry hero, so the test holds without the release flag.
const hero = heroRows[0];
const PLATE = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/plates/x/y/abc.front-on-240x240.webp";
const SHOPIFY = "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/live.png?v=1";
const LEGACY = "https://www.bestbottles.com/images/store/enlarged_pics/old.gif";
const SANITY = "https://cdn.sanity.io/images/gh97irjh/production/old.png";

describe("resolveCatalogLineThumbnail", () => {
    it("shows the group's approved hero before anything else", () => {
        const url = resolveCatalogLineThumbnail(
            { slug: hero.groupSlug, heroImageUrl: SHOPIFY },
            [{ websiteSku: hero.websiteSku, graceSku: null, imageUrl: SHOPIFY, imageUrlCapOff: null, plateThumbUrl: PLATE }],
            hero.websiteSku,
        );
        expect(url).toBe(hero.url);
    });

    it("falls back to the representative variant's plate when no hero matches", () => {
        const url = resolveCatalogLineThumbnail(
            { slug: "no-such-group", heroImageUrl: SHOPIFY },
            [
                { websiteSku: "OTHER", graceSku: null, imageUrl: SHOPIFY, imageUrlCapOff: null, plateThumbUrl: null },
                { websiteSku: "PRIMARY", graceSku: null, imageUrl: LEGACY, imageUrlCapOff: null, plateThumbUrl: PLATE },
            ],
            "PRIMARY",
        );
        expect(url).toBe(PLATE);
    });

    it("prefers a reconciled local image over a Convex URL", () => {
        const url = getCatalogVariantThumbnail({ websiteSku: "GBElg15GlSht", graceSku: null, imageUrl: SHOPIFY, imageUrlCapOff: null });
        expect(url).toBe("/images/pdp/reconciled-2026-09-27/GBElg15GlSht.webp");
    });

    it("uses a live Convex URL only when nothing better exists, never a blocked one", () => {
        expect(getCatalogVariantThumbnail({ websiteSku: "X", graceSku: null, imageUrl: SHOPIFY, imageUrlCapOff: null })).toBe(SHOPIFY);
        expect(getCatalogVariantThumbnail({ websiteSku: "X", graceSku: null, imageUrl: LEGACY, imageUrlCapOff: SANITY })).toBeNull();
    });

    it("borrows another variant's art before showing an empty tile, then the group hero, then nothing", () => {
        const variants = [
            { websiteSku: "PRIMARY", graceSku: null, imageUrl: LEGACY, imageUrlCapOff: null, plateThumbUrl: null },
            { websiteSku: "SIBLING", graceSku: null, imageUrl: null, imageUrlCapOff: SHOPIFY, plateThumbUrl: null },
        ];
        expect(resolveCatalogLineThumbnail({ slug: "no-such-group", heroImageUrl: null }, variants, "PRIMARY")).toBe(SHOPIFY);
        expect(resolveCatalogLineThumbnail({ slug: "no-such-group", heroImageUrl: SHOPIFY }, [variants[0]], "PRIMARY")).toBe(SHOPIFY);
        expect(resolveCatalogLineThumbnail({ slug: "no-such-group", heroImageUrl: LEGACY }, [variants[0]], "PRIMARY")).toBeNull();
    });
});

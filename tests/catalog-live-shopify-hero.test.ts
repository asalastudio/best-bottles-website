import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    getCatalogHero,
    resolveLiveCatalogCardHero,
} from "@/lib/products/catalog-heroes";

const SHOPIFY_SBLK =
    "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/GB-CYL-CLR-5ML-SPR-SBLK.png?v=1789691870";

describe("resolveLiveCatalogCardHero", () => {
    const staticHero = getCatalogHero("cylinder-5ml-clear-13-415-finemist", [
        { websiteSku: "GBCyl5SprySlMatt" },
        { websiteSku: "GBCyl5SpryBlkSh" },
    ]);

    it("replaces the baked 5 ml bone-review plate with a Shopify Convex hero", () => {
        expect(staticHero?.websiteSku).toBe("GBCyl5SprySlMatt");
        expect(staticHero?.url).toContain("/images/catalog/bone-review/GBCyl5SprySlMatt");

        const live = resolveLiveCatalogCardHero({
            heroImageUrl: SHOPIFY_SBLK,
            staticHero,
            variants: [
                { websiteSku: "GBCyl5SprySlMatt", imageUrl: "https://example.com/mslv.png" },
                { websiteSku: "GBCyl5SpryBlkSh", imageUrl: SHOPIFY_SBLK },
            ],
        });

        expect(live.catalogHero).toBeNull();
        expect(live.imageUrl).toBe(SHOPIFY_SBLK);
        expect(live.picturedWebsiteSku).toBe("GBCyl5SpryBlkSh");
    });

    it("keeps the baked plate when Convex has no Shopify CDN hero", () => {
        const live = resolveLiveCatalogCardHero({
            heroImageUrl: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/plates/mslv.png",
            staticHero,
            variants: [{ websiteSku: "GBCyl5SprySlMatt", imageUrl: "https://example.com/mslv.png" }],
        });

        expect(live.catalogHero).toEqual(staticHero);
        expect(live.imageUrl).toBe(staticHero?.url);
        expect(live.picturedWebsiteSku).toBe("GBCyl5SprySlMatt");
    });

    it("wires the catalog grid through the live-hero resolver", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        expect(source).toContain("resolveLiveCatalogCardHero");
        expect(source).toContain("catalogHero={displayHero}");
    });
});

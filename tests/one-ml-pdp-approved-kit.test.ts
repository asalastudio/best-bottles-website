import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localPdpComponentKits } from "../src/lib/paper-doll/local-component-kits";
import { approvedComponentKit } from "../src/lib/paper-doll/approved-component-kits";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SKUS = ["GB1mlAmbVBlk", "GB1mlAmbVialWht", "GB1mlVBlk", "GB1mlVWht"];

describe("1 ml plug vial product pages (2026-11-25)", () => {
    it("draw the approved kit on desktop and phone instead of withholding it", () => {
        const desktop = read("src/app/products/[slug]/ProductDetailClient.tsx");
        const phone = read("src/components/products/mobile/MobileProductPdp.tsx");
        expect(desktop).not.toMatch(/oneMlVialApplicator\([^)]*\)\s*\?\s*undefined\s*:\s*selectedKitQuery/);
        expect(desktop).toContain("kitQuery={selectedKitQuery}");
        expect(desktop).toContain("selectedKitQuery={selectedKitQuery}");
        expect(phone).toContain("const shownKitQuery: KitQueryResult = previewing ? undefined : selectedKitQuery;");
        for (const sku of SKUS) expect(approvedComponentKit(sku)?.sku).toBe(sku);
        // Where a surface shows the kit composite as a photo, it gets the bone stage the glass was composited on.
        for (const path of ["src/components/products/ConfiguratorPdp.tsx", "src/components/products/mobile/MobileProductHero.tsx",
            "src/components/products/mobile/MobileProductViewer.tsx", "src/components/catalog/CatalogCardPreview.tsx"]) {
            expect(read(path)).toContain("isOneMlVialStill(");
        }
    });

    it("show the local component review banner only for localhost review kits, never for approved kits", () => {
        const page = read("src/app/products/[slug]/page.tsx");
        const client = read("src/app/products/[slug]/ProductDetailClient.tsx");
        expect(page).toContain("localComponentReview: Object.keys(localReviewKits).length > 0");
        expect(client).toContain("{localComponentReview && <aside");
        expect(client).not.toContain("{Object.keys(localComponentKits).length > 0 && <aside");
        expect(client).toContain("const localComponentPreview = localComponentReview;");
        // On a hosted build there are no review kits, so the banner and ?assetPreview=kits never appear.
        const variants = SKUS.map(websiteSku => ({ websiteSku }));
        for (const host of ["best-bottles-website.vercel.app", "www.bestbottles.com", null]) {
            expect(localPdpComponentKits(host, "kits", variants)).toEqual({});
        }
    });
});

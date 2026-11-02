import { describe, expect, it } from "vitest";
import { parseProductSlug, filterVariantsForGroupIntent } from "@/lib/products/group-variant-intent";
import { getCatalogCardVariantPreviews } from "@/lib/products/product-card-variant-previews";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { rectangleApplicatorGlass } from "@/lib/products/rectangle-applicator";
import { capOptions, derivePicks, resolveVariant } from "@/lib/products/pdp-redesign/model";
import { normalizeImportedCapColor } from "@/lib/products/cap-finish-evidence";
import { productCopyFor } from "@/lib/products/item-description/product-copy";
import { availableViews } from "@/lib/products/pdp-redesign/stage";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";

const slug = "rectangle-9ml-clear-Ground-glassapplicator";
const variants = [["GBSQSTClear", "GB-RCT-CLR-9ML-T-02", "53343694258468"],
    ["GBSQSTBlue", "GB-RCT-CLR-9ML-T-01", "53343694225700"],
    ["GBSQSTGREEN", "GB-RCT-CLR-9ML-T-03", "53343694291236"]].map(([websiteSku, graceSku, shopifyId], index) => ({
    _id: `rectangle-${index}`, websiteSku, graceSku,
    color: "Clear", capColor: "Clear", capStyle: "Tall", applicator: "Glass Stopper",
    shopifyVariantId: "gid://shopify/ProductVariant/" + shopifyId, webPrice1pc: 3.2,
} as ProductVariant));

describe("Rectangle 9 ml applicator presentation", () => {
    it("keeps the existing mixed-case ground-neck URL on the new product page grammar", () => {
        expect(parseProductSlug(slug)).toEqual({ family: "rectangle", capacityMl: 9, color: "clear", neck: "ground", closure: "glassapplicator" });
        expect(filterVariantsForGroupIntent(slug, variants)).toHaveLength(3);
    });
    it("offers all three exact glass SKUs despite imported Clear cap metadata", () => {
        expect(capOptions(variants, null).map(option => option.name)).toEqual(["Cobalt Blue", "Clear", "Green"]);
        for (const variant of variants) {
            const picks = derivePicks(variants, {}, { sku: variant.websiteSku });
            expect(resolveVariant(variants, picks)?.websiteSku).toBe(variant.websiteSku);
            const fromGrace = resolveVariant(variants, derivePicks(variants, {}, { sku: variant.graceSku }));
            expect([fromGrace?.websiteSku, fromGrace?.shopifyVariantId]).toEqual([variant.websiteSku, variant.shopifyVariantId]);
        }
        expect(variants.every(variant => variant.color === "Clear" && variant.capColor === "Clear")).toBe(true);
        const unrelated = { websiteSku: "OTHER", color: "Clear", capColor: "Clear" };
        expect(normalizeImportedCapColor(unrelated)).toEqual(unrelated);
    });
    it("keeps the catalog group name and its three glass labels consistent with the PDP", () => {
        const previews = getCatalogCardVariantPreviews(variants, { productTitle: "9 ml Rectangle Applicator Bottle", productHref: "/products/" + slug });
        expect(previews.map(preview => preview.label).sort()).toEqual(["Clear", "Cobalt Blue", "Green"]);
        for (const variant of variants) {
            expect(getCustomerFacingProductName({ variant }).displayName).toBe("9 ml Rectangle Applicator Bottle");
        }
        expect(rectangleApplicatorGlass("constructor")).toBeNull();
        expect(rectangleApplicatorGlass("GBSQST")).toBeNull();
    });
    it("describes the ground-glass applicator and supports only the photographed assembly", () => {
        for (const variant of variants) {
            const copy = productCopyFor(variant);
            expect(copy?.sentences.join(" ")).toMatch(/glass applicator/i);
            expect(JSON.stringify(copy)).not.toMatch(/fine.mist|sprayer|screw cap/i);
            expect(availableViews(null, { websiteSku: variant.websiteSku, applicator: variant.applicator })).toEqual(["capon"]);
        }
    });
});

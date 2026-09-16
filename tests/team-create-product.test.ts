import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    CREATE_PRODUCT_SECTIONS,
    EMPTY_CREATE_PRODUCT_DRAFT,
    buildStaffProductSlug,
    prepareCreateProduct,
    previewCreateProduct,
} from "@/lib/team/createProduct";

describe("Team Hub create product", () => {
    it("uses the live PDP sections instead of a Sanity editorial form", () => {
        expect(CREATE_PRODUCT_SECTIONS.map((section) => section.id)).toEqual([
            "identity",
            "configurator",
            "specs",
            "pricing",
            "imagery",
        ]);
        expect(CREATE_PRODUCT_SECTIONS.every((section) => section.pdpAnchor.length > 0)).toBe(true);
    });

    it("builds the same slug grammar the storefront already uses", () => {
        expect(buildStaffProductSlug({
            family: "Cylinder",
            category: "Glass Bottle",
            capacityMl: 9,
            color: "Clear",
            neckThreadSize: "17-415",
            applicator: "Metal Roller Ball",
        })).toBe("cylinder-9ml-clear-17-415-rollon");
    });

    it("prepares a Convex-ready first variant from PDP fields", () => {
        const ready = prepareCreateProduct({
            ...EMPTY_CREATE_PRODUCT_DRAFT,
            displayName: "Cylinder 9ml Clear",
            websiteSku: "BB-CYL-9-CLR-17415-MR",
            itemName: "Cylinder 9ml Clear — Metal Roller",
            itemDescription: "Clear cylinder bottle with a metal roller.",
            webPrice1pc: "0.42",
            webPrice12pc: "0.36",
            heightWithoutCap: "2.4 in",
            diameter: "0.9 in",
            caseQuantity: "724",
            imageUrl: "https://cdn.shopify.com/example/hero.png",
        });

        expect(ready.slug).toBe("cylinder-9ml-clear-17-415-rollon");
        expect(ready.capacity).toBe("9 ml");
        expect(ready.graceSku).toBe("BB-CYL-9-CLR-17415-MR");
        expect(ready.priceTiers).toEqual([
            { minQty: 1, unitPrice: 0.42, totalPrice: 0.42 },
            { minQty: 12, unitPrice: 0.36, totalPrice: 4.32 },
        ]);
        expect(ready.paperDollEligible).toBe(true);
        expect(ready.imageUrl).toContain("cdn.shopify.com");
    });

    it("lets staff upload photos instead of pasting URLs", () => {
        const form = readFileSync(new URL("../src/components/team/CreateProductForm.tsx", import.meta.url), "utf8");
        const drop = readFileSync(new URL("../src/components/team/ProductImageDropField.tsx", import.meta.url), "utf8");
        expect(form).toContain("ProductImageDropField");
        expect(drop).toContain("data-desktop-drop-zone");
        expect(drop).toContain("Drop an image here");
        expect(drop).toContain('type="file"');
        expect(drop).toContain("Take or choose a photo");
        expect(drop).toContain("PRODUCT_IMAGE_SPEC_SUMMARY");
    });

    it("rejects Sanity CDN imagery so the PDP stays on product truth", () => {
        expect(() => prepareCreateProduct({
            ...EMPTY_CREATE_PRODUCT_DRAFT,
            displayName: "Cylinder 9ml Clear",
            websiteSku: "BB-CYL-9-CLR-17415-MR",
            webPrice1pc: "0.42",
            heroImageUrl: "https://cdn.sanity.io/images/gh97irjh/production/hero.jpg",
        })).toThrow(/Sanity CDN/);
    });

    it("previews the PDP heading before save", () => {
        const preview = previewCreateProduct({
            ...EMPTY_CREATE_PRODUCT_DRAFT,
            displayName: "",
        });
        expect(preview.displayName).toBe("Cylinder 9ml Clear");
        expect(preview.slug).toContain("cylinder-9ml-clear");
    });
});

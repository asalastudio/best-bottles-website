import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("focused PDP customer/editor language", () => {
    it("does not advertise a retired unified builder outside the internal media pipeline", () => {
        const catalog = readFileSync(new URL("../src/app/catalog/CatalogClient.tsx", import.meta.url), "utf8");
        const familySchema = readFileSync(new URL("../src/sanity/schemaTypes/documents/productFamilyContent.ts", import.meta.url), "utf8");
        const beautySchema = readFileSync(new URL("../src/sanity/schemaTypes/documents/paperDollBeautyGallery.ts", import.meta.url), "utf8");
        expect(catalog).not.toMatch(/Paper Doll builder|family & builder/i);
        expect(familySchema).not.toMatch(/Featured Builder Cohort|unified PDP slug/i);
        expect(familySchema).toContain("Featured Focused PDP Slug");
        expect(beautySchema).not.toMatch(/Paper Doll builder|Stable builder-family|the builder continues/i);
    });
});

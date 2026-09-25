import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("mobile page headings sit with the wordmark", () => {
    it("defines a phone-only page title just above the 19px lockup", () => {
        const css = read("src/app/globals.css");
        expect(css).toContain("@media (max-width: 1023px)");
        expect(css).toContain(".page-heading");
        expect(css).toContain("font-size: 1.75rem");
        expect(css).toContain("letter-spacing: 0.05em");
        expect(css).toContain("font-weight: 500");
    });

    it("uses the shared page heading on catalog and family mobile titles", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        const family = read("src/components/catalog/MobileFamilyCatalog.tsx");
        const familyCss = read("src/components/catalog/MobileFamilyCatalog.module.css");
        expect(catalog).toContain("page-heading");
        expect(catalog).not.toContain("text-[32px]");
        expect(catalog).toContain("lg:text-[28px]");
        expect(family).toContain('className="page-heading"');
        expect(familyCss).not.toContain("font-size: 34px");
    });
});

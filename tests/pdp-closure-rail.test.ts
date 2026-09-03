/**
 * Guided PDP closure rail — the 5 ml cobalt 13-415 findings (2026-09-02):
 * pill photographs join on the variant's SKU token, the plain caps published
 * into roll-on-cap-<neck> still reach a bottle on its cap, the dotted
 * colourways never fall back to a blank dot, and the panel is simplified —
 * no overcap chooser, no "Product photo" chip, no sample CTA.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getMaterialSwatchBackground } from "../src/lib/products/material-swatches";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const configurator = read("src/components/products/ConfiguratorPdp.tsx");
const pdp = read("src/app/products/[slug]/ProductDetailClient.tsx");

describe("closure rail photographs", () => {
    it("pills resolve their photo through the token join, not by catalogue name alone", () => {
        expect(configurator).toContain('import { resolveCapOptionPhoto } from "@/lib/products/closure-swatch-keys"');
        expect(configurator).toContain("resolveCapOptionPhoto(name, thumbBySwatch, capOptionPhotoKeys)");
        expect(configurator).not.toContain("const photo = thumbBySwatch.get(name);");
        expect(pdp).toContain("buildCapOptionPhotoKeys(");
        expect(pdp).toContain("capOptionPhotoKeys={capOptionPhotoKeys}");
    });

    it("a bottle on its cap can draw plain caps from the roll-on-cap family when no cap-closure family exists at that neck", () => {
        expect(configurator).toContain("familyId: `roll-on-cap-${neckSize}`");
        expect(configurator).toContain("/^CP(?!Roll)/i.test(row.websiteSku)");
    });

    it("the dotted colourways have a swatch background", () => {
        for (const name of ["Black with Dots", "Silver with Dots", "Pink with Dots", "Matte Copper"]) {
            expect(getMaterialSwatchBackground(name), name).toBeDefined();
        }
        // prefixes the catalogue sometimes adds are stripped before lookup
        expect(getMaterialSwatchBackground("Roller Pink with Dots")).toBeDefined();
    });
});

describe("roller material switches the SKU", () => {
    it("the guided chooser is controlled by the product page's applicator switch", () => {
        expect(configurator).toContain("onRollerVariantChange?: (variant: \"metal\" | \"plastic\") => void");
        expect(configurator).toContain("disabled={!rollerOffered(id)}");
        expect(pdp).toContain("onRollerVariantChange={handleRollerVariantChange}");
        expect(pdp).toMatch(/handleRollerVariantChange[\s\S]*setSelectedApplicator\(opt\.value\)/);
    });
});

describe("guided PDP simplification", () => {
    it("the stage toggle is the only cap control — the overcap chooser is gone", () => {
        expect(configurator).not.toContain("Without overcap");
        expect(configurator).not.toContain("With overcap");
        expect(configurator).toContain('aria-label="Cap on or off"');
    });

    it("the plain photograph carries no 'Product photo' badge", () => {
        expect(configurator).not.toContain('"Product photo"');
    });

    it("the sample CTA and its copy are gone from the guided page", () => {
        expect(configurator).not.toContain("Request a free sample");
        expect(configurator).not.toContain("Samples ship fast");
        expect(pdp).not.toContain("sampleHref=");
    });
});

/**
 * Focused PDP finish selection — photographed pills join on the variant's SKU
 * token, including the plain caps published into roll-on-cap-<neck>. The PDP
 * deliberately has no cross-application rail above the fold.
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
        expect(configurator).toContain('from "@/lib/products/closure-swatch-keys"');
        expect(configurator).toContain("componentPhotoSkuBelongsToBase(activeBase, row.websiteSku)");
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

describe("focused intent selection", () => {
    it("keeps roller material inside the current Roll-On intent and resolves it at the product route", () => {
        expect(configurator).toContain("onRollerVariantChange?: (variant: \"metal\" | \"plastic\") => void");
        expect(configurator).toContain("disabled={!rollerOffered(id)}");
        expect(pdp).toContain("onRollerVariantChange={handleRollerVariantChange}");
        expect(pdp).toContain("onVariantSelectionChange={handleGuidedVariantSelection}");
        expect(pdp).toContain("const canonicalVariantUrl");
    });

    it("does not offer a cross-application switcher in the purchase panel", () => {
        expect(configurator).not.toContain("Closure Type");
        expect(configurator).not.toContain("const closureRow");
        expect(configurator).not.toContain("const ranked");
        expect(configurator).not.toContain("const commit =");
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

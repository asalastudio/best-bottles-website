/**
 * Contract tests for the 2026-08-06 audit P1 fixes.
 *
 * P1-1 the catalog `category` argument is enum-constrained (an invented value
 *      like "bottles" matched nothing and showed an empty catalog).
 * P1-2 the Realtime instructions carry the capability limits — Grace offered to
 *      "charge your card on file" and to "export as PDF", neither of which exists.
 * P1-3 no-result searches terminate instead of looping until the reply is blank.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GRACE_OPENAI_TOOL_SPECS, CATALOG_CATEGORY_VALUES } from "../src/lib/knowledge/toolSchemas";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";

const specFor = (name: string) => GRACE_OPENAI_TOOL_SPECS.find((s) => s.name === name);

describe("P1-1 — catalog category is enum-constrained", () => {
    it("pins the customer-facing category vocabulary and excludes Internal", () => {
        expect(CATALOG_CATEGORY_VALUES).toContain("Glass Bottle");
        expect(CATALOG_CATEGORY_VALUES).toContain("Component");
        // "Internal" exists in the catalog but must never be offered to customers.
        expect(CATALOG_CATEGORY_VALUES as readonly string[]).not.toContain("Internal");
    });

    it("constrains category on both filtering tools, allowing null", () => {
        for (const [tool, prop] of [["setCatalogRefinements", "category"], ["searchCatalog", "categoryLimit"]] as const) {
            const enumValues = specFor(tool)?.parameters.properties[prop]?.enum as unknown[] | undefined;
            expect(enumValues, `${tool}.${prop} must be enum-constrained`).toBeDefined();
            expect(enumValues).toContain("Glass Bottle");
            expect(enumValues).toContain(null);
            // The exact value Grace invented during the audit must be rejected.
            expect(enumValues).not.toContain("bottles");
        }
    });

    it("tells the model there is no stock/availability filter", () => {
        const desc = specFor("setCatalogRefinements")?.parameters.properties.category?.description as string;
        expect(desc.toLowerCase()).toContain("no stock");
        expect(GRACE_REALTIME_INSTRUCTIONS.toLowerCase()).toContain("no stock or availability filter");
    });
});

describe("P1-2 — capability limits are stated in the Realtime instructions", () => {
    const text = GRACE_REALTIME_INSTRUCTIONS.toLowerCase();

    it("forbids implying payment capability", () => {
        expect(text).toContain("cannot take payment");
        expect(text).toContain("charge your card on file");
        expect(text).toContain("saved card");
    });

    it("forbids offering exports, files, or PDFs", () => {
        expect(text).toContain("pdf");
        expect(text).toContain("cannot export");
    });

    it("forbids offering order lookups, refunds, and PII retrieval", () => {
        expect(text).toContain("refund");
        expect(text).toContain("personal data");
    });

    it("forbids non-existent UI controls", () => {
        expect(text).toContain("pin");
        expect(text).toContain("bookmark");
    });
});

describe("P1-3 — no-result searches terminate", () => {
    it("caps searches per request and requires a reply", () => {
        const text = GRACE_REALTIME_INSTRUCTIONS.toLowerCase();
        expect(text).toContain("at most two catalog searches");
        expect(text).toContain("never end a turn without a reply");
        // The cap must not become a licence to deny real products (B6 regression,
        // 2026-08-06): the limit governs searches run, never the conclusion drawn.
        expect(text).toContain("never licenses");
        expect(text).toContain("only when the returned rows genuinely contain no match");
    });
});

describe("applicator vocabularies must not be confused across tools", () => {
    // 2026-08-06: Grace passed the Refine bucket slug "antiquespray-tassel" into
    // searchCatalog.applicatorFilter, which expects EXACT catalog values. The
    // filter matched nothing and silently removed the very products she wanted
    // (0 tassel rows instead of 16), so she reported a real product as missing.
    it("searchCatalog.applicatorFilter documents exact values and rejects bucket slugs", () => {
        const desc = specFor("searchCatalog")?.parameters.properties.applicatorFilter?.description as string;
        expect(desc).toContain("Vintage Bulb Sprayer with Tassel");
        expect(desc).toContain("Metal Roller Ball");
        expect(desc.toLowerCase()).toContain("do not pass the canonical refine bucket slugs");
        expect(desc).toContain("antiquespray-tassel");
    });

    it("setCatalogRefinements.applicators stays on canonical bucket slugs", () => {
        const items = specFor("setCatalogRefinements")?.parameters.properties.applicators?.items as { enum?: string[] };
        expect(items?.enum).toContain("rollon");
        expect(items?.enum).toContain("antiquespray-tassel");
        // Customer-facing labels must never be valid here.
        expect(items?.enum).not.toContain("Vintage Bulb Sprayer with Tassel");
    });
});

describe("coverage warnings force enumeration of every option", () => {
    // Grace reports whichever value she saw first unless the tool result tells
    // her to enumerate. Glass colour and neck thread already had a coverage
    // warning; closure colour did not, so a 1ml vial was reported as
    // "white plug only" when black and clear were also in the result set.
    const src = readFileSync("convex/graceSearchUtils.ts", "utf8");

    it("emits a closure-colour coverage warning", () => {
        expect(src).toContain("CLOSURE COLOR COVERAGE");
        expect(src).toContain("list EVERY closure color");
        expect(src).toContain("never say a closure color is unavailable");
    });

    it("still emits the neck-thread and glass-colour coverage warnings", () => {
        expect(src).toContain("NECK THREAD COVERAGE");
        expect(src).toContain("CATALOG COVERAGE");
    });
});

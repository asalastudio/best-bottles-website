import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { enrichSearchCatalogWithJev } from "../src/lib/grace/enrichSearchCatalogWithJev";
import {
    classifyNamedFinish,
    hasExplicitCapApplicatorLanguage,
    isFinishOnlyRequest,
    shouldSuppressCapApplicatorFilter,
} from "../src/lib/grace/finishOnlyIntent";
import {
    intentToSearchArgs,
    NONE_NAMED,
    type GraceIntentAnswers,
} from "../src/lib/grace/jevIntent";

function choice(value: string, confidence = 0.92): GraceIntentAnswers["applicator"] {
    return { type: "choice", choice: value, confidence, probabilities: { [value]: confidence } };
}

function answers(partial: {
    applicator?: string;
    family?: string;
    glassColour?: string;
    atomizerFinish?: string;
    capFinish?: string;
    wants?: string;
    useCase?: string;
    tassel?: number;
    travel?: number;
}): GraceIntentAnswers {
    return {
        applicator: choice(partial.applicator ?? "cap"),
        family: choice(partial.family ?? NONE_NAMED),
        glass_colour: choice(partial.glassColour ?? NONE_NAMED),
        atomizer_finish: choice(partial.atomizerFinish ?? NONE_NAMED),
        cap_finish: choice(partial.capFinish ?? NONE_NAMED),
        wants: choice(partial.wants ?? "complete_bottle"),
        tassel: { type: "noul", noul: partial.tassel ?? 0 },
        use_case: choice(partial.useCase ?? "not_stated"),
        travel: { type: "noul", noul: partial.travel ?? 0 },
    };
}

describe("finish-only classification", () => {
    it("reads shiny/matte metal colours as cap finishes, never glass", () => {
        expect(classifyNamedFinish("shiny gold")).toEqual({ kind: "cap", capFinish: "Shiny Gold" });
        expect(classifyNamedFinish("matte black")).toEqual({ kind: "cap", capFinish: "Matte Black" });
        expect(classifyNamedFinish("matte gold")).toEqual({ kind: "cap", capFinish: "Matte Gold" });
        expect(classifyNamedFinish("shiny gold cap")).toEqual({ kind: "cap", capFinish: "Shiny Gold" });
        expect(isFinishOnlyRequest("shiny gold")).toBe(true);
        expect(isFinishOnlyRequest("matte black")).toBe(true);
    });

    it("reads decorated metal-shell phrases as atomizer finishes", () => {
        expect(classifyNamedFinish("pink with dots")).toEqual({
            kind: "atomizer",
            atomizerFinish: "Pink with Dots",
        });
        expect(classifyNamedFinish("silver with stars")).toEqual({
            kind: "atomizer",
            atomizerFinish: "Silver with Star Patterns",
        });
        expect(classifyNamedFinish("pink with dots atomizer")).toEqual({
            kind: "atomizer",
            atomizerFinish: "Pink with Dots",
        });
        expect(isFinishOnlyRequest("pink with dots")).toBe(true);
    });

    it("does not treat glass-only requests as finishes", () => {
        expect(classifyNamedFinish("frosted glass bottles")).toBeNull();
        expect(classifyNamedFinish("amber glass")).toBeNull();
        expect(isFinishOnlyRequest("frosted glass bottles")).toBe(false);
        expect(isFinishOnlyRequest("amber glass")).toBe(false);
        expect(shouldSuppressCapApplicatorFilter("amber glass")).toBe(false);
    });

    it("keeps explicit Cap/Closure product language", () => {
        expect(hasExplicitCapApplicatorLanguage("bottle with a black cap")).toBe(true);
        expect(hasExplicitCapApplicatorLanguage("replacement screw caps")).toBe(true);
        expect(hasExplicitCapApplicatorLanguage("just the caps")).toBe(true);
        expect(hasExplicitCapApplicatorLanguage("shiny gold")).toBe(false);
        expect(hasExplicitCapApplicatorLanguage("shiny gold cap")).toBe(false);
        expect(shouldSuppressCapApplicatorFilter("bottle with a black cap")).toBe(false);
        expect(shouldSuppressCapApplicatorFilter("shiny gold")).toBe(true);
    });
});

describe("intentToSearchArgs finish-only guard", () => {
    it("does not apply Cap/Closure when Jev misfires on a cap-finish-only phrase", () => {
        const result = intentToSearchArgs(
            answers({ applicator: "cap", capFinish: "Shiny Gold" }),
            { requestText: "shiny gold" },
        );
        expect(result.applicatorFilter).toBeUndefined();
        expect(result.capFinish).toBe("Shiny Gold");
        expect(result.atomizerFinish).toBeUndefined();
        expect(result.glassColour).toBeUndefined();
        expect(result.decisions.applicator).toMatch(/finish-only/i);
    });

    it("backfills matte black as cap_finish when Jev only set applicator=cap", () => {
        const result = intentToSearchArgs(
            answers({ applicator: "cap" }),
            { requestText: "matte black" },
        );
        expect(result.applicatorFilter).toBeUndefined();
        expect(result.capFinish).toBe("Matte Black");
        expect(result.glassColour).toBeUndefined();
    });

    it("routes pink with dots to atomizer_finish, not Cap/Closure", () => {
        const result = intentToSearchArgs(
            answers({ applicator: "cap", capFinish: "Pink with Dots" }),
            { requestText: "pink with dots" },
        );
        expect(result.applicatorFilter).toBeUndefined();
        expect(result.atomizerFinish).toBe("Pink with Dots");
        expect(result.capFinish).toBeUndefined();
        expect(result.glassColour).toBeUndefined();
    });

    it("keeps the Cap/Closure filter when request text is not supplied (legacy eval path)", () => {
        const result = intentToSearchArgs(answers({ applicator: "cap", capFinish: "Shiny Gold" }));
        expect(result.applicatorFilter).toBe("Cap/Closure");
        expect(result.capFinish).toBe("Shiny Gold");
    });

    it("keeps Cap/Closure when the customer names a bottle with a cap", () => {
        const result = intentToSearchArgs(
            answers({ applicator: "cap", capFinish: "Black" }),
            { requestText: "bottle with a black cap" },
        );
        expect(result.applicatorFilter).toBe("Cap/Closure");
        expect(result.capFinish).toBe("Black");
    });

    it("does not invent glass colour for gold/silver/black/white/shiny/matte/dots", () => {
        for (const phrase of ["shiny gold", "matte black", "pink with dots"]) {
            const result = intentToSearchArgs(
                answers({ applicator: "cap", glassColour: "Clear" }),
                { requestText: phrase },
            );
            expect(result.glassColour, phrase).toBeUndefined();
        }
    });

    it("leaves glass-only and atomizer-finish-with-family cases intact", () => {
        const glass = intentToSearchArgs(
            answers({ applicator: "not_stated", glassColour: "Frosted" }),
            { requestText: "frosted glass bottles" },
        );
        expect(glass.glassColour).toBe("Frosted");
        expect(glass.applicatorFilter).toBeUndefined();
        expect(glass.capFinish).toBeUndefined();

        const atomizer = intentToSearchArgs(
            answers({ applicator: "not_stated", atomizerFinish: "Pink with Dots" }),
            { requestText: "pink with dots atomizer" },
        );
        expect(atomizer.atomizerFinish).toBe("Pink with Dots");
        expect(atomizer.applicatorFilter).toBeUndefined();
        expect(atomizer.capFinish).toBeUndefined();
    });
});

describe("enrichSearchCatalogWithJev finish-only", () => {
    it("does not inherit a Cap/Closure filter on a finish-only search", async () => {
        const enriched = await enrichSearchCatalogWithJev(
            { searchTerm: "shiny gold", applicatorFilter: "Cap/Closure" },
            {
                requestText: "shiny gold",
                cachedAnswers: answers({ applicator: "cap", capFinish: "Shiny Gold" }),
            },
        );
        expect(enriched.args.applicatorFilter).toBeUndefined();
        expect(enriched.args.searchTerm.toLowerCase()).toContain("shiny gold");
        expect(enriched.decisions?.applicator).toMatch(/finish-only/i);
        expect(enriched.applied).toBe(true);
    });

    it("scopes decorated atomizer finishes to Metal Atomizer", async () => {
        const enriched = await enrichSearchCatalogWithJev(
            { searchTerm: "pink with dots" },
            {
                requestText: "pink with dots",
                cachedAnswers: answers({ applicator: "cap" }),
            },
        );
        expect(enriched.args.applicatorFilter).toBeUndefined();
        expect(enriched.args.categoryLimit).toBe("Metal Atomizer");
        expect(enriched.args.searchTerm.toLowerCase()).toContain("pink with dots");
    });
});

describe("labelled finish-only eval cases", () => {
    const caseFile = JSON.parse(
        readFileSync(resolve("data/grace-evals/jev-intent-cases.json"), "utf8"),
    ) as {
        cases: Array<{
            id: string;
            text: string;
            tags?: string[];
            expect: {
                applicator: string;
                glassColour: string | null;
                atomizerFinish?: string | null;
                capFinish?: string | null;
            };
        }>;
    };

    const finishOnly = caseFile.cases.filter((c) => c.tags?.includes("finish-only"));

    it("covers glass, atomizer, and cap finish-only labels", () => {
        expect(finishOnly.some((c) => c.tags?.includes("cap-finish") && c.expect.capFinish)).toBe(true);
        expect(finishOnly.some((c) => c.tags?.includes("atomizer-finish") && c.expect.atomizerFinish)).toBe(true);
        expect(finishOnly.some((c) => c.tags?.includes("glass-colour") && c.expect.glassColour)).toBe(true);
    });

    it("does not label finish-only phrases as the Cap/Closure applicator", () => {
        for (const c of finishOnly) {
            expect(c.expect.applicator, c.id).toBe("not_stated");
        }
    });

    it("resolves cap and atomizer finish-only phrases to the labelled finish", () => {
        for (const c of finishOnly) {
            if (c.expect.capFinish) {
                const result = intentToSearchArgs(
                    answers({ applicator: "cap" }),
                    { requestText: c.text },
                );
                expect(result.applicatorFilter, c.id).toBeUndefined();
                expect(result.capFinish, c.id).toBe(c.expect.capFinish);
                expect(result.glassColour, c.id).toBeUndefined();
            }
            if (c.expect.atomizerFinish) {
                const result = intentToSearchArgs(
                    answers({ applicator: "cap" }),
                    { requestText: c.text },
                );
                expect(result.applicatorFilter, c.id).toBeUndefined();
                expect(result.atomizerFinish, c.id).toBe(c.expect.atomizerFinish);
                expect(result.glassColour, c.id).toBeUndefined();
            }
            if (c.expect.glassColour) {
                expect(shouldSuppressCapApplicatorFilter(c.text), c.id).toBe(false);
                expect(isFinishOnlyRequest(c.text), c.id).toBe(false);
            }
        }
    });
});

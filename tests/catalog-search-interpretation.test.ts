import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));

import { EMPTY_FILTERS, catalogBrowseRedirect, type CatalogFilters } from "@/lib/catalogFilters";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "@/lib/catalogSearchFallback";
import type { GraceIntentAnswers } from "@/lib/grace/jevIntent";
import {
    buildInterpretationCandidates,
    describeSuggestion,
    extractTypedConstraints,
    parseInterpretationMode,
    rankSuggestions,
    type CatalogValidValues,
} from "@/lib/catalog/searchInterpretation";
import { interpretCatalogSearch } from "@/lib/catalog/searchInterpretationServer";
import { NextRequest } from "next/server";
import { POST as interpretRoute } from "@/app/api/catalog/interpret/route";

// ─── Fixture catalogue ──────────────────────────────────────────────────────

function group(partial: Partial<CatalogSearchGroup> & Pick<CatalogSearchGroup, "_id" | "displayName">): CatalogSearchGroup {
    return {
        slug: partial._id,
        family: null,
        capacity: null,
        capacityMl: null,
        color: null,
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: null,
        variantCount: 4,
        priceRangeMin: 0.5,
        priceRangeMax: 1,
        applicatorTypes: [],
        ...partial,
    } as CatalogSearchGroup;
}

const GROUPS: CatalogSearchGroup[] = [
    group({ _id: "cyl9-rollon", displayName: "9 ml Clear Cylinder Roll-On Bottle", family: "Cylinder", capacityMl: 9, color: "Clear", neckThreadSize: "17-415", applicatorTypes: ["Metal Roller Ball"] }),
    group({ _id: "cyl9-spray-amber", displayName: "9 ml Amber Cylinder Perfume Spray Bottle", family: "Cylinder", capacityMl: 9, color: "Amber", neckThreadSize: "17-415", applicatorTypes: ["Fine Mist Sprayer"] }),
    group({ _id: "bell10-rollon", displayName: "10 ml Clear Bell Roll-On Bottle", family: "Bell", capacityMl: 10, color: "Clear", neckThreadSize: "13-415", applicatorTypes: ["Metal Roller Ball"] }),
    group({ _id: "boston30-dropper", displayName: "30 ml Amber Boston Round Dropper Bottle", family: "Boston Round", capacityMl: 30, color: "Amber", neckThreadSize: "20-400", applicatorTypes: ["Dropper"] }),
    group({ _id: "boston30-reducer", displayName: "30 ml Amber Boston Round Reducer Bottle", family: "Boston Round", capacityMl: 30, color: "Amber", neckThreadSize: "20-400", applicatorTypes: ["Reducer"] }),
    group({ _id: "empire50-bulb", displayName: "50 ml Clear Empire Vintage Bulb Spray Bottle", family: "Empire", capacityMl: 50, color: "Clear", neckThreadSize: "18-415", applicatorTypes: ["Vintage Bulb Sprayer"] }),
    group({ _id: "sprayer-13-415", displayName: "Fine Mist Sprayer 13-415", family: "Sprayer", category: "Component", neckThreadSize: "13-415", applicatorTypes: ["Fine Mist Sprayer"] }),
    group({ _id: "atomizer-5", displayName: "5 ml Pink Metal Atomizer", family: "Atomizer", category: "Metal Atomizer", capacityMl: 5, applicatorTypes: ["Metal Atomizer"] }),
];

const SNAPSHOT = { groups: GROUPS, primarySkus: [], variantPreviewRows: [] };

function count(filters: CatalogFilters): number {
    return buildCatalogSearchResult({ ...SNAPSHOT, filters, sort: "featured", view: "visual", limit: 1, cursor: null }).totalCount;
}

const VALID: CatalogValidValues = {
    capacities: [5, 9, 10, 30, 50].map((ml) => ({ label: `${ml} ml`, ml })),
    neckThreadSizes: ["13-415", "17-415", "18-415", "20-400"],
    families: ["Cylinder", "Bell", "Boston Round", "Empire", "Atomizer"],
    categories: { "Glass Bottle": 6, Component: 1, "Metal Atomizer": 1 },
};

// ─── Jev answer builder ─────────────────────────────────────────────────────

type Choice = { choice: string; confidence?: number };
function choice({ choice: value, confidence = 0.95 }: Choice) {
    return { type: "choice" as const, choice: value, confidence, probabilities: { [value]: confidence } };
}
function answers(over: Partial<Record<"applicator" | "family" | "glass_colour" | "atomizer_finish" | "cap_finish" | "wants" | "use_case", Choice>> & { tassel?: number } = {}): GraceIntentAnswers {
    return {
        applicator: choice(over.applicator ?? { choice: "not_stated" }),
        family: choice(over.family ?? { choice: "none_named" }),
        glass_colour: choice(over.glass_colour ?? { choice: "none_named" }),
        atomizer_finish: choice(over.atomizer_finish ?? { choice: "none_named" }),
        cap_finish: choice(over.cap_finish ?? { choice: "none_named" }),
        wants: choice(over.wants ?? { choice: "complete_bottle" }),
        tassel: { type: "noul", noul: over.tassel ?? 0.05 },
        use_case: choice(over.use_case ?? { choice: "not_stated" }),
        travel: { type: "noul", noul: 0.05 },
    };
}

function suggest(query: string, jev: GraceIntentAnswers | null, shopper: Partial<CatalogFilters> = {}, useCases = false) {
    const typed = extractTypedConstraints(query, VALID);
    const candidates = buildInterpretationCandidates(query, typed, jev, VALID, { useCases });
    return rankSuggestions(candidates, { ...EMPTY_FILTERS, ...shopper }, count);
}

// ─── Typed sizes and necks (code, never Jev) ────────────────────────────────

describe("typed sizes and neck finishes", () => {
    it("reads millilitres and ounces as the real sizes within 10%", () => {
        expect(extractTypedConstraints("10ml roller", VALID).capacities).toEqual(["9 ml", "10 ml"]);
        expect(extractTypedConstraints("amber dropper 1oz", VALID).capacities).toEqual(["30 ml"]);
        expect(extractTypedConstraints("1 fl oz dropper", VALID).capacities).toEqual(["30 ml"]);
    });

    it("reads neck codes with a slash or hyphen and keeps only necks the catalogue has", () => {
        const typed = extractTypedConstraints("sprayer that fits 13/415", VALID);
        expect(typed.neckThreadSizes).toEqual(["13-415"]);
        expect(typed.remainingWords).toEqual(["sprayer"]);
        expect(extractTypedConstraints("cap for 22-400", VALID).neckThreadSizes).toEqual([]);
    });

    it("leaves only the words Jev has to read", () => {
        expect(extractTypedConstraints("30 ml glass bottles", VALID).remainingWords).toEqual([]);
        expect(extractTypedConstraints("essential oil bottle", VALID).remainingWords).toEqual(["essential", "oil"]);
    });
});

// ─── Readings → suggestions ─────────────────────────────────────────────────

describe("closest-match suggestions", () => {
    it("turns a confident reading into one counted filter set", () => {
        const [top, ...rest] = suggest("amber dropper 1oz", answers({ applicator: { choice: "dropper" }, glass_colour: { choice: "Amber" } }));
        expect(rest).toHaveLength(0);
        expect(top.filters).toMatchObject({ applicators: ["dropper"], colors: ["Amber"], capacities: ["30 ml"], search: "" });
        expect(top.count).toBe(1);
        expect(top.label).toBe("Amber Dropper bottles · 30 ml");
        expect(top.autoEligible).toBe(true);
    });

    it("offers but never auto-applies a medium-confidence reading", () => {
        const [top] = suggest("roller bottle", answers({ applicator: { choice: "rollon", confidence: 0.7 } }));
        expect(top.filters.applicators).toEqual(["rollon"]);
        expect(top.autoEligible).toBe(false);
    });

    it("ignores low-confidence readings", () => {
        expect(suggest("something odd", answers({ applicator: { choice: "rollon", confidence: 0.4 } }))).toEqual([]);
    });

    it("offers nothing for things the store does not sell", () => {
        expect(suggest("airless pump", answers({ applicator: { choice: "not_carried" } }))).toEqual([]);
    });

    it("uses the use table only when enabled, one button per dispenser, never auto", () => {
        const jev = answers({ use_case: { choice: "essential_oils" } });
        expect(suggest("essential oil bottle", jev, {}, false)).toEqual([]);
        const withTable = suggest("essential oil bottle", jev, {}, true);
        expect(withTable.map((s) => s.label)).toEqual(["Reducer bottles", "Dropper bottles", "Roll-On bottles"]);
        expect(withTable.every((s) => !s.autoEligible && s.note === "Often used for essential oils")).toBe(true);
    });

    it("loosens colour before giving up, and says what it left out", () => {
        const [top] = suggest("cobalt roll-on 9ml", answers({ applicator: { choice: "rollon" }, glass_colour: { choice: "Cobalt Blue" } }));
        expect(top.filters).toMatchObject({ applicators: ["rollon"], colors: [], capacities: ["9 ml"] });
        expect(top.dropped).toEqual(["Cobalt Blue"]);
        expect(top.autoEligible).toBe(false);
    });

    it("never drops a typed neck finish: a part that does not fit is not a match", () => {
        expect(suggest("dropper 13-415", answers({ applicator: { choice: "dropper" } }))).toEqual([]);
    });

    it("keeps the shopper's own filters and only suggests leaving their category", () => {
        const kept = suggest("roller", answers({ applicator: { choice: "rollon" } }), { applicators: ["dropper"] });
        expect(kept[0]?.filters.applicators ?? ["dropper"]).toEqual(["dropper"]);

        const [part] = suggest("sprayer that fits 13-415", answers({ applicator: { choice: "spray" } }), { category: "Glass Bottle" });
        expect(part.filters).toMatchObject({ category: null, neckThreadSizes: ["13-415"], applicators: ["finemist", "perfumespray"] });
        expect(part.dropped).toEqual(["category Glass Bottle"]);
        expect(part.autoEligible).toBe(false);
        expect(part.label).toBe("Spray bottles · 13-415");
    });

    it("sends parts-only requests to components", () => {
        const [top] = suggest("replacement sprayer 13-415", answers({ applicator: { choice: "spray" }, wants: { choice: "component_only" } }));
        expect(top.filters.category).toBe("Component");
        expect(top.label).toBe("Sprayers · 13-415");
    });

    it("keeps a named glass colour and roll-on over a weaker metal-atomizer reading", () => {
        const [top] = suggest("cobalt roll on 9ml", answers({
            applicator: { choice: "rollon", confidence: 1 },
            glass_colour: { choice: "Cobalt Blue", confidence: 0.99 },
            atomizer_finish: { choice: "Blue", confidence: 0.71 },
        }));
        expect(top.filters.category).not.toBe("Metal Atomizer");
        expect(top.filters.applicators).toEqual(["rollon"]);
        expect(top.dropped).toEqual(["Cobalt Blue"]);
    });

    it("reads a metal atomizer finish as the Metal Atomizer category", () => {
        const [top] = suggest("pink travel atomiser", answers({ applicator: { choice: "spray" }, atomizer_finish: { choice: "Pink" } }));
        expect(top.filters.category).toBe("Metal Atomizer");
    });

    it("never returns a suggestion that shows zero products", () => {
        const all = [
            suggest("amber dropper 1oz", answers({ applicator: { choice: "dropper" }, glass_colour: { choice: "Amber" } })),
            suggest("essential oil bottle", answers({ use_case: { choice: "essential_oils" } }), {}, true),
            suggest("cobalt roll-on 9ml", answers({ applicator: { choice: "rollon" }, glass_colour: { choice: "Cobalt Blue" } })),
        ].flat();
        expect(all.length).toBeGreaterThan(0);
        expect(all.every((s) => s.count > 0 && count(s.filters) === s.count)).toBe(true);
    });

    it("describes filter sets in shopper words", () => {
        expect(describeSuggestion({ ...EMPTY_FILTERS, applicators: ["vintagestyle", "vintagestyle-tassel"], families: ["Empire"] })).toBe("Empire Vintage bulb spray bottles");
        expect(describeSuggestion({ ...EMPTY_FILTERS, capacities: ["9 ml", "10 ml"] })).toBe("Bottles · 9–10 ml");
    });
});

// ─── Server orchestration: flags, locale, failures ──────────────────────────

describe("interpretCatalogSearch", () => {
    const input = { query: "amber dropper 1oz", filters: EMPTY_FILTERS, locale: "en" };
    const jev = vi.fn(async () => answers({ applicator: { choice: "dropper" }, glass_colour: { choice: "Amber" } }));

    it("does nothing while the flag is off", async () => {
        expect(parseInterpretationMode(undefined)).toBe("off");
        expect(parseInterpretationMode("sometimes")).toBe("off");
        const result = await interpretCatalogSearch(input, { mode: "off", snapshot: SNAPSHOT, jev });
        expect(result).toMatchObject({ reason: "disabled", suggestions: [] });
    });

    it("leaves the Spanish site on today's page", async () => {
        const result = await interpretCatalogSearch({ ...input, locale: "es" }, { mode: "suggest", snapshot: SNAPSHOT, jev });
        expect(result.reason).toBe("locale");
    });

    it("returns counted suggestions in suggest mode", async () => {
        const result = await interpretCatalogSearch(input, { mode: "suggest", snapshot: SNAPSHOT, jev, useCases: false });
        expect(result.reason).toBe("ok");
        expect(result.suggestions[0]?.label).toBe("Amber Dropper bottles · 30 ml");
    });

    it("falls back to today's page when Jev is unavailable and nothing was typed that code can read", async () => {
        const result = await interpretCatalogSearch({ ...input, query: "attar bottle" }, { mode: "suggest", snapshot: SNAPSHOT, jev: async () => null });
        expect(result).toMatchObject({ reason: "jev_unavailable", suggestions: [] });
    });

    it("still uses typed sizes when Jev is unavailable", async () => {
        const result = await interpretCatalogSearch({ ...input, query: "30ml flacon" }, { mode: "suggest", snapshot: SNAPSHOT, jev: async () => null });
        expect(result.suggestions[0]?.filters.capacities).toEqual(["30 ml"]);
    });

    it("does not call Jev when code can read every word", async () => {
        const spy = vi.fn(async () => null);
        await interpretCatalogSearch({ ...input, query: "30 ml bottles" }, { mode: "suggest", snapshot: SNAPSHOT, jev: spy });
        expect(spy).not.toHaveBeenCalled();
    });
});

// ─── Endpoint ───────────────────────────────────────────────────────────────

describe("POST /api/catalog/interpret", () => {
    // The route is imported at the top: its first load is slow and must not eat the test timeout.
    function post(body: unknown) {
        return interpretRoute(new NextRequest("http://localhost/api/catalog/interpret", { method: "POST", body: JSON.stringify(body) }));
    }

    it("answers 'disabled' without touching Jev or Convex while the flag is off", async () => {
        vi.stubEnv("CATALOG_SEARCH_INTERPRETATION", "");
        const response = await post({ query: "attar bottle", filters: {}, locale: "en" });
        expect(await response.json()).toMatchObject({ mode: "off", reason: "disabled", suggestions: [] });
        vi.unstubAllEnvs();
    });

    it("rejects empty and over-long queries", async () => {
        vi.stubEnv("CATALOG_SEARCH_INTERPRETATION", "suggest");
        expect((await post({ query: "   " })).status).toBe(400);
        expect((await post({ query: "x".repeat(121) })).status).toBe(400);
        vi.unstubAllEnvs();
    });
});

// ─── URL contract ───────────────────────────────────────────────────────────

describe("interpreted catalogue URLs", () => {
    it("are not redirected to the default bottle browse", () => {
        expect(catalogBrowseRedirect(new URLSearchParams("applicators=rollon&sort=capacity-asc&interpreted=attar+bottle"))).toBeNull();
    });
});

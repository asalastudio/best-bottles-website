/**
 * Jev (TypeSafe System One) reading of a customer's catalogue request.
 *
 * One request asks a handful of independent questions about the customer's
 * words — which applicator, which bottle family, which glass colour, bottle or
 * part — and `intentToSearchArgs` turns confident answers into the arguments
 * `grace.searchCatalog` already accepts. Capacity, neck threads and fitment
 * stay in code; Jev never sees numbers it would have to reason about.
 *
 * Wired into Grace via `enrichSearchCatalogWithJev` (askGrace + browser tool
 * gateway). `scripts/grace-jev-intent-eval.mts` still measures it against the
 * word-list rules; keep evaluating before trusting production metrics.
 */

import {
    ATOMIZER_FINISHES,
    CANONICAL_GLASS_COLORS,
    CAP_FINISHES,
    CATALOG_FAMILIES,
    displayCapFinishLabel,
} from "../catalogFilters";
import {
    classifyNamedFinish,
    isFinishOnlyRequest,
    shouldSuppressCapApplicatorFilter,
} from "./finishOnlyIntent";
import { COMPONENT_VOCABULARY } from "../../../convex/componentVocabulary";
import { applicatorsForUseCase } from "./useCaseApplicators";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
/** Pinned so thresholds tuned against it do not move when `jev-latest` does. */
export const JEV_MODEL = "jev-1.13.0";

export const APPLICATOR_INTENTS = [
    "rollon",
    "spray",
    "bulb_spray",
    "lotionpump",
    "dropper",
    "reducer",
    "cap",
    "stopper",
    "several",
    "not_stated",
    "not_carried",
] as const;
export type ApplicatorIntent = (typeof APPLICATOR_INTENTS)[number];

export type FilterableApplicatorIntent = Exclude<ApplicatorIntent, "several" | "not_stated" | "not_carried">;

/** Exact `products.applicator` values each intent searches for (`searchCatalog.applicatorFilter`). */
export const APPLICATOR_INTENT_FILTER_VALUES: Record<FilterableApplicatorIntent, readonly string[]> = {
    rollon: ["Metal Roller Ball", "Plastic Roller Ball"],
    spray: ["Fine Mist Sprayer", "Perfume Spray Pump", "Atomizer"],
    bulb_spray: ["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel"],
    lotionpump: ["Lotion Pump"],
    dropper: ["Dropper"],
    reducer: ["Reducer"],
    cap: ["Cap/Closure"],
    stopper: ["Glass Stopper", "Glass Rod"],
};

export function isFilterableApplicatorIntent(value: string | null | undefined): value is FilterableApplicatorIntent {
    return Boolean(value && value in APPLICATOR_INTENT_FILTER_VALUES);
}

export const NONE_NAMED = "none_named";

/**
 * Families whose names are also everyday words. They only count when the
 * customer uses them as the name of a bottle line.
 */
const FAMILY_NAME_ONLY_WHEN_NAMED: Record<string, string> = {
    Elegant: "The Elegant bottle line. Only when the customer names it as a product (\"the Elegant 60ml\"), not when they want an elegant-looking bottle.",
    Sleek: "The Sleek bottle line. Only when named as a product, not when they want a sleek-looking bottle.",
    Royal: "The Royal bottle line. Only when named as a product.",
    Grace: "The Grace bottle line. Only when named as a bottle; Grace is also the name of the shopping assistant.",
    Flair: "The Flair bottle line. Only when named as a product.",
    Slim: "The Slim bottle line. Only when named as a product, not when they just want a narrow bottle.",
    // Jordan, 2026-09-21: a travel atomizer means these metal atomizers.
    Atomizer: "Metal travel atomizers: small refillable perfume sprayers in a metal case, 5 ml and 10 ml. Choose it when the customer asks for a travel, purse, pocket, portable or metal atomizer. Not when 'atomizer' only names the sprayer on a glass bottle, such as a 50 ml bottle with an atomizer.",
    Decorative: "Ornamental or novelty bottles: hearts, genie shapes, crystal or marble stoppers.",
    Vial: "Small sample vials.",
    // Product-type lines: generic words that also describe bottles in every other line.
    "Lotion Bottle": "Only when the customer asks for the plain Lotion Bottle line by name. A bottle that holds lotion or has a lotion pump is not this line.",
    "Cream Jar": "Jars for creams and balms.",
    "Aluminum Bottle": "Bottles made of aluminum.",
    "Plastic Bottle": "Bottles made of plastic.",
};

export type GraceIntentState = {
    /** The customer's words, as typed or transcribed. */
    request: string;
    /** Optional earlier turns, oldest first, when the request depends on them. */
    recentTurns?: string[];
    /** Optional description of the product page the customer is on. */
    pageContext?: string;
};

export function buildGraceIntentQuestions() {
    const familyCriteria: Record<string, string | null> = {};
    for (const family of CATALOG_FAMILIES) familyCriteria[family] = FAMILY_NAME_ONLY_WHEN_NAMED[family] ?? null;
    familyCriteria[NONE_NAMED] = "The customer does not name any of these bottle lines or shapes.";

    const colourCriteria: Record<string, string> = {
        Clear: "Clear or flint (colourless) glass",
        Frosted: "Frosted, matte or acid-etched glass",
        Amber: "Amber or brown glass",
        "Cobalt Blue": "Cobalt or blue glass",
        Green: "Green glass",
        Swirl: "Swirl-patterned glass",
    };
    for (const colour of CANONICAL_GLASS_COLORS) colourCriteria[colour] ??= colour;
    colourCriteria[NONE_NAMED] = "The customer does not ask for a glass colour.";

    const atomizerFinishCriteria: Record<string, string> = {};
    for (const finish of ATOMIZER_FINISHES) {
        atomizerFinishCriteria[finish] = `Metal travel/purse atomizer body finish: ${finish} (not glass, not a bottle cap)`;
    }
    atomizerFinishCriteria[NONE_NAMED] = "The customer does not ask for a metal atomizer body finish.";

    const capFinishCriteria: Record<string, string> = {};
    for (const finish of CAP_FINISHES) {
        capFinishCriteria[finish] = `Bottle cap or closure finish: ${displayCapFinishLabel(finish)} (not bottle glass, not an atomizer shell)`;
    }
    capFinishCriteria[NONE_NAMED] = "The customer does not ask for a cap or closure finish.";

    return {
        applicator: {
            type: "choice",
            instructions: {
                question: "Which single dispensing applicator or closure type does the customer ask for in `request`?",
                focus: "Judge only what the customer states or clearly describes. Do not infer an applicator from the liquid they will use. A type the customer rejects (\"not a roller\") is not the one they want. Finish or colour words alone (shiny gold, matte black, pink with dots, gold, silver) are never an applicator — those belong on cap_finish or atomizer_finish, and this question is not_stated.",
                shared_catalog_terms: COMPONENT_VOCABULARY,
                vocabulary_scope: "These are search synonyms, not fitment rules. The Sprayer library group includes several mechanisms: use the distinct spray and bulb_spray criteria below. A roller cap is a cap, not the ball itself. Always obtain exact compatibility from the live bottle component lookup.",
            },
            criteria: {
                rollon: { what: "A rolling ball that applies liquid to skin", examples: ["roll-on", "roller bottle", "rollerball", "ball applicator", "role on (a misheard roll-on)"] },
                spray: { what: "A modern sprayer that makes a mist: fine mist sprayer, perfume spray pump, atomizer", not_for: "Squeeze-bulb vintage sprayers, and pumps that dispense lotion or serum", examples: ["atomiser", "mister", "spritz", "pump spray", "spray top"] },
                bulb_spray: { what: "A Vintage Style Bulb Sprayer — squeeze-bulb sprayer (with or without tassel), not a fine mist or perfume spray pump, and not a metal travel atomizer", examples: ["bulb atomizer", "puffer ball", "vintage style bulb sprayer", "vintage sprayer with tassel"] },
                lotionpump: { what: "A pump that dispenses a dose of lotion, cream, serum or foundation", not_for: "A pump that sprays a mist", examples: ["lotion pump", "treatment pump", "serum pump", "cream dispenser"] },
                dropper: { what: "A squeeze-bulb dropper with a glass or plastic pipette", not_for: "A plastic insert in the neck, even when it is called a dropper insert, dropper orifice, dropper tip or euro dropper", examples: ["glass dropper", "pipette", "eye dropper", "tincture bottle"] },
                reducer: { what: "A plastic insert in the bottle neck that limits flow to drops or a splash, with no bulb or pipette", examples: ["orifice reducer", "euro dropper (may be transcribed as 'your oh dropper')", "dropper insert", "dropper orifice", "dripper insert", "reducer cap", "splash-on bottle"] },
                cap: { what: "A plain screw cap or lid named as the product or closure type", not_for: "Finish-only colour words with no cap/lid/screw product: shiny gold, matte black, pink with dots, gold, silver. Those are cap_finish or atomizer_finish. A metal travel atomizer body colour is never this.", examples: ["screw cap", "lid", "a bottle with a black cap", "replacement caps"] },
                stopper: { what: "A glass stopper, glass rod, wand or dabber", examples: ["glass stopper", "dabber", "glass wand"] },
                several: "The customer asks for two or more different applicator types at once, or offers alternatives",
                not_stated: "The customer does not state or describe any applicator or closure type. Finish-only requests such as shiny gold, matte black, or pink with dots belong here.",
                not_carried: { what: "Something a glass perfume-bottle store does not sell, even when it is closure-related", examples: ["airless or vacuum pump", "trigger sprayer", "foaming pump", "squeeze tube", "crimp-on perfume pump or crimping tool", "press-fit or O-ring sprayer", "child-resistant closure", "candle jar", "reed diffuser bottle", "labels, boxes or shrink bands"] },
            },
        },
        family: {
            type: "choice",
            instructions: {
                question: "Which Best Bottles bottle line or shape does the customer name in `request`?",
                focus: "Shape words such as square, round, cylinder, diamond or teardrop name a shape line. Style words such as elegant, sleek or royal only count when used as the name of a bottle line.",
            },
            criteria: familyCriteria,
        },
        glass_colour: {
            type: "choice",
            instructions: {
                question: "Which colour of glass does the customer ask for in `request`?",
                focus: "ONLY Clear, Frosted, Amber, Cobalt Blue, Green, or Swirl glass. Ignore caps, lids, collars, sprayers, pumps, rollers, tassels, dots, stars, shiny/matte metals, and metal atomizer shells. Black, white, gold, silver, pink, red, lavender, and dotted finishes are never glass.",
            },
            criteria: colourCriteria,
        },
        atomizer_finish: {
            type: "choice",
            instructions: {
                question: "Which metal travel/purse atomizer body finish does the customer ask for in `request`?",
                focus: "Only for coloured metal-shell perfume atomizers (5–10 ml travel/purse). Not glass bottles. Not bottle caps. Prefer this when they say atomizer, travel atomizer, purse spray, or name decorated finishes like pink with dots or silver with stars — those are never glass and not the Cap/Closure applicator.",
            },
            criteria: atomizerFinishCriteria,
        },
        cap_finish: {
            type: "choice",
            instructions: {
                question: "Which bottle cap or closure finish does the customer ask for in `request`?",
                focus: "Cap/closure colour or decoration on a glass bottle (shiny gold, matte black, shiny gold cap). Not bottle glass. Not the body finish of a metal travel atomizer — use atomizer_finish for those. When the request is only a finish with no glass, family, or named applicator, choose the finish here and leave applicator as not_stated. When both a glass colour and a cap colour appear, put glass in glass_colour and the cap here.",
            },
            criteria: capFinishCriteria,
        },
        wants: {
            type: "choice",
            instructions: "Does the customer in `request` say they want only parts for bottles they already have?",
            criteria: {
                complete_bottle: { what: "Anything that is not an explicit parts-only request. This includes naming only an applicator or style, such as a lotion pump or an atomizer for perfume.", examples: ["roll on bottles for perfume oil", "a tomizer for perfume", "lotion pump, not a spray", "dripper insert bottle"] },
                component_only: { what: "The customer says they already have bottles, or asks for parts only: replacement, spare, just the caps, fits my bottle", examples: ["caps for my 18-415 bottles", "replacement sprayer that fits my bottle", "droppers only, no bottles"] },
                unclear: "The customer explicitly mentions both new bottles and parts for other bottles",
            },
        },
        tassel: {
            type: "noul",
            instructions: "Does the customer in `request` ask for a tassel on the bottle's sprayer?",
        },
        use_case: {
            type: "choice",
            instructions: "What does the customer in `request` say will go in the bottle?",
            criteria: {
                perfume_oil: "Perfume oil, attar, ittar, oud, or another oil-based fragrance",
                alcohol_perfume: "Alcohol-based perfume, eau de parfum, eau de toilette or cologne",
                body_or_room_mist: "Body mist, hair mist, facial toner, room or linen spray",
                essential_oils: "Essential oils or aromatherapy blends",
                face_or_beard_oil: "Serum, face oil, beard oil, hair oil or cuticle oil",
                lotion_or_cream: "Lotion, cream, foundation, liquid soap or massage lotion",
                samples: "Samples, testers, decants or discovery sets of a fragrance",
                other: "Something else",
                not_stated: "The customer does not say what goes in the bottle",
            },
        },
        travel: {
            type: "noul",
            instructions: "Does the customer in `request` want the bottle for travel, a purse, a pocket or carrying around?",
        },
    } as const;
}

type ChoiceAnswer = { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };
type NoulAnswer = { type: "noul"; noul: number };

export type GraceIntentAnswers = {
    applicator: ChoiceAnswer;
    family: ChoiceAnswer;
    glass_colour: ChoiceAnswer;
    atomizer_finish: ChoiceAnswer;
    cap_finish: ChoiceAnswer;
    wants: ChoiceAnswer;
    tassel: NoulAnswer;
    use_case: ChoiceAnswer;
    travel: NoulAnswer;
};

export type GraceIntentResult =
    | { ok: true; answers: GraceIntentAnswers; model: string; ms: number; inputTokens: number | null }
    | { ok: false; error: string; ms: number };

export async function classifyGraceIntent(
    state: GraceIntentState,
    options: { apiKey: string; timeoutMs?: number; model?: string; fetchImpl?: typeof fetch },
): Promise<GraceIntentResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 2500);
    try {
        const response = await (options.fetchImpl ?? fetch)(JEV_ENDPOINT, {
            method: "POST",
            headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ state, model: options.model ?? JEV_MODEL, questions: buildGraceIntentQuestions() }),
            signal: controller.signal,
        });
        if (!response.ok) {
            return { ok: false, error: `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`, ms: Date.now() - started };
        }
        const body = await response.json();
        return {
            ok: true,
            answers: body.answers as GraceIntentAnswers,
            model: String(body.model ?? ""),
            ms: Date.now() - started,
            inputTokens: typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
        };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
    } finally {
        clearTimeout(timer);
    }
}

export type IntentSearchArgs = {
    applicatorFilter?: string;
    familyLimit?: string;
    /** Canonical glass colour; searchCatalog has no colour argument yet — appended to searchTerm by enrich. */
    glassColour?: string;
    /** Metal atomizer body finish — appended to searchTerm (never treated as glass). */
    atomizerFinish?: string;
    /** Cap/closure finish — appended to searchTerm with a Cap suffix when useful. */
    capFinish?: string;
    /** Why each argument was or was not set, for logs and the eval report. */
    decisions: {
        applicator: string;
        family: string;
        glassColour: string;
        atomizerFinish: string;
        capFinish: string;
    };
};

/**
 * Turns confident answers into searchCatalog arguments. Unsure or "none" answers add nothing.
 * With `useCaseTable`, a request that names no applicator but a confident use case
 * ("10 ml bottle for attar") gets the applicators from the reviewed use-case table.
 */
export function intentToSearchArgs(answers: GraceIntentAnswers, options: { minConfidence?: number; useCaseTable?: boolean; requestText?: string } = {}): IntentSearchArgs {
    const min = options.minConfidence ?? 0.6;
    const args: IntentSearchArgs = { decisions: { applicator: "", family: "", glassColour: "", atomizerFinish: "", capFinish: "" } };
    const requestText = options.requestText?.trim() ?? "";
    const suppressCapFromFinish = requestText.length > 0 && shouldSuppressCapApplicatorFilter(requestText);

    const applicator = answers.applicator;
    if (applicator.confidence < min) {
        args.decisions.applicator = `unsure (${applicator.choice} @ ${applicator.confidence.toFixed(2)})`;
    } else if (isFilterableApplicatorIntent(applicator.choice)) {
        if (applicator.choice === "cap" && suppressCapFromFinish) {
            args.decisions.applicator = "no filter (finish-only; Cap/Closure applicator suppressed)";
        } else {
            let values = [...APPLICATOR_INTENT_FILTER_VALUES[applicator.choice]];
            if (applicator.choice === "bulb_spray" && answers.tassel.noul >= 0.7) {
                values = values.filter((value) => value.endsWith("with Tassel"));
            }
            args.applicatorFilter = values.join(",");
            args.decisions.applicator = `filter ${applicator.choice}`;
        }
    } else if (
        options.useCaseTable
        && applicator.choice === "not_stated"
        && answers.use_case.confidence >= min
        && applicatorsForUseCase(answers.use_case.choice)
    ) {
        const intents = applicatorsForUseCase(answers.use_case.choice)!;
        args.applicatorFilter = intents.flatMap((intent) => [...APPLICATOR_INTENT_FILTER_VALUES[intent]]).join(",");
        args.decisions.applicator = `use case ${answers.use_case.choice} → ${intents.join(", ")}`;
    } else {
        args.decisions.applicator = `no filter (${applicator.choice})`;
    }

    const family = answers.family;
    if (family.choice === NONE_NAMED) {
        args.decisions.family = "none named";
    } else if (family.confidence < min) {
        args.decisions.family = `unsure (${family.choice} @ ${family.confidence.toFixed(2)})`;
    } else {
        args.familyLimit = family.choice;
        args.decisions.family = `limit ${family.choice}`;
    }

    const colour = answers.glass_colour;
    if (colour.choice === NONE_NAMED) {
        args.decisions.glassColour = "none named";
    } else if (colour.confidence < min) {
        args.decisions.glassColour = `unsure (${colour.choice} @ ${colour.confidence.toFixed(2)})`;
    } else {
        args.glassColour = colour.choice;
        args.decisions.glassColour = colour.choice;
    }

    const atomizerFinish = answers.atomizer_finish;
    if (!atomizerFinish || atomizerFinish.choice === NONE_NAMED) {
        args.decisions.atomizerFinish = "none named";
    } else if (atomizerFinish.confidence < min) {
        args.decisions.atomizerFinish = `unsure (${atomizerFinish.choice} @ ${atomizerFinish.confidence.toFixed(2)})`;
    } else {
        args.atomizerFinish = atomizerFinish.choice;
        args.decisions.atomizerFinish = atomizerFinish.choice;
        // A named atomizer finish is never glass — clear any glass colour conflict.
        if (args.glassColour) {
            args.decisions.glassColour = `cleared (atomizer finish ${atomizerFinish.choice})`;
            delete args.glassColour;
        }
    }

    const capFinish = answers.cap_finish;
    if (!capFinish || capFinish.choice === NONE_NAMED) {
        args.decisions.capFinish = "none named";
    } else if (capFinish.confidence < min) {
        args.decisions.capFinish = `unsure (${capFinish.choice} @ ${capFinish.confidence.toFixed(2)})`;
    } else {
        args.capFinish = capFinish.choice;
        args.decisions.capFinish = displayCapFinishLabel(capFinish.choice);
    }

    if (requestText && isFinishOnlyRequest(requestText)) {
        const named = classifyNamedFinish(requestText);
        if (named?.kind === "atomizer" && named.atomizerFinish) {
            if (!args.atomizerFinish) {
                args.atomizerFinish = named.atomizerFinish;
                args.decisions.atomizerFinish = `${named.atomizerFinish} (finish-only)`;
            }
            if (args.capFinish) {
                args.decisions.capFinish = `cleared (atomizer finish ${named.atomizerFinish})`;
                delete args.capFinish;
            }
            if (args.glassColour) {
                args.decisions.glassColour = `cleared (atomizer finish ${named.atomizerFinish})`;
                delete args.glassColour;
            }
        } else if (named?.kind === "cap" && named.capFinish) {
            if (!args.capFinish) {
                args.capFinish = named.capFinish;
                args.decisions.capFinish = `${displayCapFinishLabel(named.capFinish)} (finish-only)`;
            }
            if (args.atomizerFinish) {
                args.decisions.atomizerFinish = `cleared (cap finish ${named.capFinish})`;
                delete args.atomizerFinish;
            }
            if (args.glassColour) {
                args.decisions.glassColour = `cleared (cap finish ${named.capFinish})`;
                delete args.glassColour;
            }
        }
    }

    return args;
}

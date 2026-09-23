/**
 * Finish-only catalogue requests ("shiny gold", "matte black", "pink with dots").
 *
 * These name a cap or metal-atomizer finish, never glass and never the
 * Cap/Closure applicator. Jev still sometimes answers applicator=cap because
 * the words look like a lid; this module is the deterministic override.
 */

import {
    detectAtomizerFinish,
    detectCanonicalGlassColor,
    detectCapFinish,
    type AtomizerFinish,
    type CapFinish,
} from "../catalogFilters";

/**
 * The customer named Cap/Closure as the product (screw caps, lids, a bottle
 * with a plain cap). Finish words sitting next to "cap" ("shiny gold cap")
 * do not count — that is still a finish, not an applicator.
 */
const CAP_AS_APPLICATOR_RE =
    /\b(screw[- ]?caps?|lids?|closures?|replacement\s+caps?|just\s+the\s+caps?|caps?\s+for\b|\bcaps\b|bottle\s+with\s+(an?\s+)?[\w][\w\s-]*\bcap\b)\b/i;

const ATOMIZER_CONTEXT_RE =
    /\b(atomizer|atomiser|travel(?:\s+mist)?|purse(?:\s+spray)?|pocket|metal\s+shell|stars?|star\s+patterns?)\b/i;

const CAP_FINISH_CONTEXT_RE = /\b(cap|lid|closure|collar|plug|trim|shiny|matte)\b/i;

const DECORATED_FINISH_RE = /\b(with\s+dots?|dotted|with\s+stars?|star\s+patterns?)\b/i;

/** Distinctive finish words that are never glass (gold/silver/black/white/shiny/matte/dots). */
const DISTINCTIVE_FINISH_RE =
    /\b(shiny|matte|dots?|dotted|stars?|star\s+patterns?|leather|gold|silver|rose\s+gold|copper|black|white|pink|red|lavender|turquoise|ivory)\b/i;

export function hasExplicitCapApplicatorLanguage(text: string): boolean {
    return CAP_AS_APPLICATOR_RE.test(text);
}

export function hasDistinctiveFinishSignal(text: string): boolean {
    return DISTINCTIVE_FINISH_RE.test(text);
}

export type NamedFinishKind = "cap" | "atomizer";

export type NamedFinish = {
    kind: NamedFinishKind;
    capFinish?: CapFinish;
    atomizerFinish?: AtomizerFinish;
};

/**
 * Which finish vocabulary the words belong to, when they name one at all.
 * Decorated metal-shell phrases (dots, stars) prefer atomizer; shiny/matte
 * and bare metal colours prefer cap.
 */
export function classifyNamedFinish(text: string): NamedFinish | null {
    if (!hasDistinctiveFinishSignal(text)) return null;

    const capFinish = detectCapFinish(text);
    const atomizerFinish = detectAtomizerFinish(text);
    if (!capFinish && !atomizerFinish) return null;

    const lower = text.toLowerCase();
    const atomizerCtx = ATOMIZER_CONTEXT_RE.test(lower);
    const capCtx = CAP_FINISH_CONTEXT_RE.test(lower);
    const decorated = DECORATED_FINISH_RE.test(lower);

    let kind: NamedFinishKind;
    if (atomizerCtx && !capCtx && atomizerFinish) {
        kind = "atomizer";
    } else if (capCtx && !atomizerCtx && capFinish) {
        kind = "cap";
    } else if (decorated && !capCtx && atomizerFinish) {
        kind = "atomizer";
    } else if (capFinish && !atomizerFinish) {
        kind = "cap";
    } else if (atomizerFinish && !capFinish) {
        kind = "atomizer";
    } else if (atomizerCtx && atomizerFinish) {
        kind = "atomizer";
    } else {
        kind = capFinish ? "cap" : "atomizer";
    }

    if (kind === "atomizer" && atomizerFinish) {
        return { kind, atomizerFinish };
    }
    if (kind === "cap" && capFinish) {
        return { kind, capFinish };
    }
    if (atomizerFinish) return { kind: "atomizer", atomizerFinish };
    if (capFinish) return { kind: "cap", capFinish };
    return null;
}

/**
 * True when the request names a cap/atomizer finish and does not name
 * Cap/Closure as the product type. Glass or a bottle family may also be
 * present — those do not make the finish an applicator.
 */
export function shouldSuppressCapApplicatorFilter(requestText: string): boolean {
    const text = requestText.trim();
    if (!text) return false;
    if (hasExplicitCapApplicatorLanguage(text)) return false;
    return classifyNamedFinish(text) !== null;
}

/**
 * Finish-only: a distinctive finish, no glass colour, no explicit cap product.
 * Used to backfill cap_finish / atomizer_finish when Jev left them empty.
 */
export function isFinishOnlyRequest(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (hasExplicitCapApplicatorLanguage(trimmed)) return false;
    if (detectCanonicalGlassColor(trimmed)) return false;
    return classifyNamedFinish(trimmed) !== null;
}

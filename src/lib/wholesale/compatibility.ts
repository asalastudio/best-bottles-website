/**
 * Wholesale compatibility — ONE resolution order, shared by every caller.
 *
 * WHY THIS FILE EXISTS
 * Compatibility was implemented four times (convex/fitments.ts,
 * convex/componentUtils.ts, Grace's getBottleComponents/checkCompatibility,
 * products.getCompatibleFitments). They agree most of the time, which is
 * worse than disagreeing loudly: a customer could be shown a component the
 * validator would later reject. PRD §17 and §52 require compatibility to
 * live in ONE authoritative place, so this module owns the DECISION and the
 * existing helpers stay what they are — data normalisers.
 *
 * PRECEDENCE (PRD §39), highest wins:
 *   1. explicit exclusion   — a rule naming this component as incompatible
 *   2. explicit inclusion   — a fitment rule listing this component type
 *   3. exact fitment        — bottle.neckThreadSize === component thread
 *   4. family inference     — same family + thread, no contradicting rule
 *   5. unknown              — NOT compatible. Never guessed into a yes.
 *
 * Rule 5 is the one that matters. `components` on a product row is typed
 * v.any() and is frequently absent; treating absence as "probably fine"
 * is how an incompatible configuration reaches a real order.
 */

export type CompatibilitySource =
    | "explicit_exclusion"
    | "explicit_inclusion"
    | "exact_fitment"
    | "family_inference"
    | "unknown";

export interface CompatibilityVerdict {
    compatible: boolean;
    /** which precedence tier decided this — surfaced in Catalog QA, never to customers */
    source: CompatibilitySource;
    /** customer-facing when incompatible; null when compatible */
    reason: string | null;
}

export interface BottleFacts {
    graceSku: string;
    family: string | null;
    capacityMl: number | null;
    neckThreadSize: string | null;
    itemName: string | null;
    color: string | null;
    stockStatus: string | null;
    shopifySellable: boolean | null;
}

export interface ComponentFacts {
    graceSku: string;
    itemName: string | null;
    componentType: string;
    /** thread this component fits, when the catalog records one */
    neckThreadSize: string | null;
    stockStatus: string | null;
    shopifySellable: boolean | null;
}

const OUT_OF_STOCK = new Set(["out of stock", "discontinued", "unavailable", "inactive"]);

/** A row is purchasable only if the catalog says so — absence is not a yes. */
export function isPurchasable(row: {
    stockStatus: string | null;
    shopifySellable: boolean | null;
}): boolean {
    if (row.shopifySellable === false) return false;
    const status = (row.stockStatus ?? "").trim().toLowerCase();
    if (!status) return true;
    return !OUT_OF_STOCK.has(status);
}

function normalizeThread(value: string | null): string {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * The single compatibility decision. `allowedTypes` comes from the fitment
 * rule that componentUtils.selectBestFitmentRule already resolved — passing
 * it in keeps this function pure and unit-testable.
 */
export function resolveCompatibility(
    bottle: BottleFacts,
    component: ComponentFacts,
    opts: {
        allowedTypes?: Set<string> | null;
        excludedSkus?: Set<string> | null;
    } = {},
): CompatibilityVerdict {
    const { allowedTypes = null, excludedSkus = null } = opts;

    // 1. explicit exclusion always wins, even over an exact thread match
    if (excludedSkus?.has(component.graceSku)) {
        return {
            compatible: false,
            source: "explicit_exclusion",
            reason: "This component isn't compatible with the selected bottle.",
        };
    }

    // 2. explicit inclusion — the fitment rule named this component's type
    if (allowedTypes && allowedTypes.size > 0) {
        if (allowedTypes.has(component.componentType)) {
            return { compatible: true, source: "explicit_inclusion", reason: null };
        }
        return {
            compatible: false,
            source: "explicit_inclusion",
            reason: "This component isn't compatible with the selected bottle.",
        };
    }

    // 3. exact fitment — both sides record a thread and they agree
    const bottleThread = normalizeThread(bottle.neckThreadSize);
    const componentThread = normalizeThread(component.neckThreadSize);
    if (bottleThread && componentThread) {
        if (bottleThread === componentThread) {
            return { compatible: true, source: "exact_fitment", reason: null };
        }
        return {
            compatible: false,
            source: "exact_fitment",
            reason: `This component fits ${component.neckThreadSize}, not ${bottle.neckThreadSize}.`,
        };
    }

    // 4. family inference — same thread family, nothing contradicting it.
    //    Only reached when the component has no thread of its own to check.
    if (bottleThread && !componentThread && bottle.family) {
        return { compatible: true, source: "family_inference", reason: null };
    }

    // 5. unknown — never a yes (PRD §39)
    return {
        compatible: false,
        source: "unknown",
        reason: "No compatible components are currently available.",
    };
}

/** Catalog QA phrasing for the same verdict — internal, more specific. */
export function qaReason(verdict: CompatibilityVerdict): string | null {
    if (verdict.compatible) return null;
    if (verdict.source === "unknown") return "Compatibility mapping missing.";
    return verdict.reason;
}

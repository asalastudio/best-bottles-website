/**
 * What goes in the bottle → which applicators to show, when the customer did
 * not name one ("a 10 ml bottle for my attar").
 *
 * DRAFT (2026-09-21) — written from the phrase research in
 * docs/research/grace-phrase-catalog/raw/, not yet reviewed by Best Bottles.
 * This is business knowledge, so it lives in a table people can read and
 * correct, not inside a model. Jev only decides which use case the customer
 * described (src/lib/grace/jevIntent.ts); this table decides what to show.
 */

import type { FilterableApplicatorIntent } from "./jevIntent";

export const USE_CASES = [
    "perfume_oil",
    "alcohol_perfume",
    "body_or_room_mist",
    "essential_oils",
    "face_or_beard_oil",
    "lotion_or_cream",
    "samples",
    "other",
    "not_stated",
] as const;
export type UseCase = (typeof USE_CASES)[number];

export type UseCaseRow = {
    /** Applicators to show, most usual first. */
    applicators: readonly FilterableApplicatorIntent[];
    why: string;
    evidence: readonly string[];
};

/** Use cases with no row (samples, other, not_stated) add no filter. */
export const USE_CASE_APPLICATORS: Partial<Record<UseCase, UseCaseRow>> = {
    perfume_oil: {
        applicators: ["rollon", "reducer", "stopper"],
        why: "Oils clog sprayers. Indie oil brands sell roll-ons first, then reducer (splash) and dabber bottles.",
        evidence: ["community-notes.md finding 8 (oil + spray = clogging)", "indie-brand-notes.md finding 6 (rollerball, reducer cap, wand cap)"],
    },
    alcohol_perfume: {
        applicators: ["spray", "bulb_spray"],
        why: "Alcohol fragrance is sprayed; fine mist below about 30 ml, perfume spray pump above.",
        evidence: ["trade-notes.md finding 3", "catalogFilters.ts APPLICATOR_BUCKETS comments (finemist < 30 ml, perfumespray ≥ 30 ml)"],
    },
    body_or_room_mist: {
        applicators: ["spray"],
        why: "Mists and room sprays use fine mist sprayers.",
        evidence: ["community-notes.md finding 3 (route by liquid)"],
    },
    essential_oils: {
        applicators: ["reducer", "dropper", "rollon"],
        why: "The standard amber essential oil bottle has an orifice reducer (euro dropper); droppers for measuring; roll-ons for diluted blends.",
        evidence: ["trade-notes.md finding 5", "search-demand-notes.md finding 4"],
    },
    face_or_beard_oil: {
        applicators: ["dropper", "lotionpump"],
        why: "Serums and face or beard oils use glass droppers; thicker serums use treatment pumps.",
        evidence: ["trade-notes.md finding 4 (treatment pumps)"],
    },
    lotion_or_cream: {
        applicators: ["lotionpump"],
        why: "Lotions and creams use lotion or treatment pumps (jars are a separate category).",
        evidence: ["trade-notes.md finding 4"],
    },
};

export function applicatorsForUseCase(useCase: string): readonly FilterableApplicatorIntent[] | null {
    return USE_CASE_APPLICATORS[useCase as UseCase]?.applicators ?? null;
}

/**
 * The compact configuration rows on the mobile PDP are derived from what the
 * family actually offers: a property with one compatible option is product
 * information, not a decision, so it becomes a static fact instead of a row.
 * Nothing here knows about SKUs — callers pass the option lists the existing
 * catalogue/resolver already produced for the desktop configurator.
 */
import type { CSSProperties } from "react";
import type { ClosureBase } from "@/lib/configurator/families";
import type { MobilePickerType } from "./mobile-pdp-view-modes";

export type MobileConfigOption = {
    id: string;
    label: string;
    /** Real product/component thumbnail. Never fabricated — omitted when missing. */
    thumbUrl?: string | null;
    /** Colour fallback for finishes with no photograph (existing swatch styles). */
    swatchStyle?: CSSProperties;
    /** Short supporting copy shown on large cards (roller). */
    note?: string;
};

export type MobilePickerLayout = "list" | "cards" | "grid";

export type MobileConfigRow = {
    picker: MobilePickerType;
    /** Row label on the PDP: "Glass Finish", "Roller", "Cap Color". */
    label: string;
    /** Sheet heading: "Select Glass", "Select Roller", "Select Cap Color". */
    title: string;
    hint?: string;
    options: MobileConfigOption[];
    selectedId: string;
    layout: MobilePickerLayout;
};

export type MobileConfigFact = { label: string; value: string };

export type MobileConfigDimension = {
    options: MobileConfigOption[];
    selectedId: string | null;
};

export type MobileConfigInput = {
    closureBase: ClosureBase;
    glass?: MobileConfigDimension | null;
    roller?: MobileConfigDimension | null;
    capFinish?: MobileConfigDimension | null;
};

/** Two-row horizontal grid once a finish set is too long for a stacked list (PRD §24). */
export const CLOSURE_GRID_MIN_OPTIONS = 6;

/** Family-appropriate wording for the closure finish property (PRD §89). */
export function closureFinishLabels(base: ClosureBase): { label: string; title: string } {
    switch (base) {
        case "sprayer":
            return { label: "Sprayer Finish", title: "Select Sprayer Finish" };
        case "pump":
            return { label: "Pump Finish", title: "Select Pump Finish" };
        case "dropper":
            return { label: "Dropper Finish", title: "Select Dropper Finish" };
        case "antique":
        case "antiqueTassel":
            return { label: "Closure Finish", title: "Select Closure Finish" };
        default:
            return { label: "Cap Color", title: "Select Cap Color" };
    }
}

function selectedLabel(dim: MobileConfigDimension): string | null {
    const match = dim.options.find((option) => option.id === dim.selectedId) ?? dim.options[0];
    return match?.label ?? null;
}

export function buildMobileConfigRows(input: MobileConfigInput): { rows: MobileConfigRow[]; facts: MobileConfigFact[] } {
    const rows: MobileConfigRow[] = [];
    const facts: MobileConfigFact[] = [];

    const place = (
        dim: MobileConfigDimension | null | undefined,
        meta: { picker: MobilePickerType; label: string; title: string; hint?: string; layout: MobilePickerLayout },
    ) => {
        if (!dim || dim.options.length === 0) return;
        const value = selectedLabel(dim);
        if (dim.options.length === 1) {
            if (value) facts.push({ label: meta.label, value });
            return;
        }
        rows.push({
            picker: meta.picker,
            label: meta.label,
            title: meta.title,
            hint: meta.hint,
            options: dim.options,
            selectedId: dim.selectedId ?? dim.options[0]!.id,
            layout: meta.layout,
        });
    };

    // Physical order: the bottle, what touches the product, what closes it (PRD §90).
    place(input.glass, {
        picker: "glass",
        label: "Glass Finish",
        title: "Select Glass",
        hint: "Bottle updates above in real time.",
        layout: "list",
    });
    place(input.roller, {
        picker: "roller",
        label: "Roller",
        title: "Select Roller",
        hint: "Choose the roller material. Bottle updates above in real time.",
        layout: "cards",
    });
    const finish = closureFinishLabels(input.closureBase);
    place(input.capFinish, {
        picker: "capFinish",
        label: finish.label,
        title: finish.title,
        hint: "Bottle updates above in real time.",
        layout: (input.capFinish?.options.length ?? 0) >= CLOSURE_GRID_MIN_OPTIONS ? "grid" : "list",
    });

    return { rows, facts };
}

/** "Select Amber" once a choice is previewed; "Select Glass" before then. */
export function confirmLabelFor(row: MobileConfigRow, previewId: string | null): string {
    const option = previewId ? row.options.find((candidate) => candidate.id === previewId) : null;
    return option ? `Select ${option.label}` : row.title;
}

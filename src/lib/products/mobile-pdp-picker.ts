/**
 * Picker state for the mobile PDP. Pure so the open / preview / confirm /
 * cancel contract can be unit-tested without React.
 *
 * Three concepts stay independent: the committed commerce configuration
 * (owned by ProductDetailClient), the presentation view mode, and the picker
 * (what is being edited). Only `confirm` is allowed to change commerce state,
 * and even then the reducer just reports which id to commit — the caller runs
 * the existing resolver.
 */
import type { MobilePickerType, ProductViewMode } from "./mobile-pdp-view-modes";

export type MobilePickerState = {
    activePicker: MobilePickerType | null;
    /** Selection driving the hero while a picker is open; equals committed at open. */
    previewSelectionId: string | null;
    /** Snapshot of the committed selection taken when the picker opened. */
    committedSelectionId: string | null;
    /** View to return to when the picker closes, if opening changed it. */
    previousViewMode: ProductViewMode | null;
    viewMode: ProductViewMode;
};

export type MobilePickerAction =
    | { type: "open"; picker: MobilePickerType; committedId: string; preferredView: ProductViewMode | null }
    | { type: "preview"; id: string }
    | { type: "confirm" }
    | { type: "cancel" }
    | { type: "setView"; view: ProductViewMode };

export function initialMobilePickerState(viewMode: ProductViewMode = "assembled"): MobilePickerState {
    return {
        activePicker: null,
        previewSelectionId: null,
        committedSelectionId: null,
        previousViewMode: null,
        viewMode,
    };
}

function closePicker(state: MobilePickerState): MobilePickerState {
    return {
        activePicker: null,
        previewSelectionId: null,
        committedSelectionId: null,
        previousViewMode: null,
        viewMode: state.previousViewMode ?? state.viewMode,
    };
}

export function mobilePickerReducer(state: MobilePickerState, action: MobilePickerAction): MobilePickerState {
    switch (action.type) {
        case "open": {
            const changesView = action.preferredView !== null && action.preferredView !== state.viewMode;
            return {
                activePicker: action.picker,
                previewSelectionId: action.committedId,
                committedSelectionId: action.committedId,
                previousViewMode: changesView ? state.viewMode : null,
                viewMode: changesView ? action.preferredView! : state.viewMode,
            };
        }
        case "preview":
            if (!state.activePicker) return state;
            return { ...state, previewSelectionId: action.id };
        case "confirm":
        case "cancel":
            if (!state.activePicker) return state;
            return closePicker(state);
        case "setView":
            return state.viewMode === action.view ? state : { ...state, viewMode: action.view };
    }
}

/** True once the customer has previewed something other than the committed option. */
export function pickerHasPendingChange(state: MobilePickerState): boolean {
    return state.activePicker !== null
        && state.previewSelectionId !== null
        && state.previewSelectionId !== state.committedSelectionId;
}

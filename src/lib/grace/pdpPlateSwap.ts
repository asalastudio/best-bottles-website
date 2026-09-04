/**
 * Grace → current PDP plate swap.
 *
 * Kits already keep the bottle still while a cap or roller layer changes
 * (`PaperDollLayers`). The picker commits that change through
 * `resolveGuidedVariant` + `?sku=`. This event is the same commit, requested
 * by Grace, not a catalog-wide builder and not `setPaperDollSelection`.
 */

export const GRACE_PDP_PLATE_EVENT = "bestbottles:grace-pdp-plate";

export type GracePdpPlateViewMode = "assembled" | "capOff";
export type GracePdpRollerVariant = "metal" | "plastic";

export type GracePdpPlateCommand = {
    sku?: string | null;
    capOption?: string | null;
    rollerVariant?: GracePdpRollerVariant | null;
    viewMode?: GracePdpPlateViewMode | null;
};

export function isGracePdpPlateCommand(value: unknown): value is GracePdpPlateCommand {
    if (!value || typeof value !== "object") return false;
    const command = value as GracePdpPlateCommand;
    return Boolean(command.sku || command.capOption || command.rollerVariant || command.viewMode);
}

export function matchListedOption(requested: string, options: readonly string[]): string | null {
    const needle = requested.trim().toLowerCase();
    if (!needle || options.length === 0) return null;
    const exact = options.find((option) => option.toLowerCase() === needle);
    if (exact) return exact;
    return options.find((option) => {
        const optionName = option.toLowerCase();
        return optionName.includes(needle) || needle.includes(optionName);
    }) ?? null;
}

export function parseRollerVariant(value: string | null | undefined): GracePdpRollerVariant | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === "metal" || /\b(metal|steel|stainless)\b/.test(normalized)) return "metal";
    if (normalized === "plastic" || /\bplastic\b/.test(normalized)) return "plastic";
    return null;
}

export function parsePlateViewMode(value: string | null | undefined): GracePdpPlateViewMode | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (/\bcap\s*off\b|\buncapped\b|\bwithout\s+(the\s+)?cap\b/.test(normalized)) return "capOff";
    if (/\bassembled\b|\bcap\s*on\b|\bwith\s+(the\s+)?cap\b/.test(normalized)) return "assembled";
    const compact = normalized.replace(/[\s_-]/g, "");
    if (compact === "capoff") return "capOff";
    if (compact === "capon" || compact === "withcap") return "assembled";
    return null;
}

export function dispatchGracePdpPlateCommand(command: GracePdpPlateCommand): boolean {
    if (typeof window === "undefined") return false;
    if (!isGracePdpPlateCommand(command)) return false;
    window.dispatchEvent(new CustomEvent<GracePdpPlateCommand>(GRACE_PDP_PLATE_EVENT, { detail: command }));
    return true;
}

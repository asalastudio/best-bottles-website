import type { PaperDollConfiguration, PaperDollMode } from "@/lib/paper-doll/types";
import { selectCylinderConfiguration } from "@/lib/products/unified-cylinder-pdp";

export const GRACE_PAPER_DOLL_SELECT_EVENT = "grace:paperDollSelect";

export type GracePaperDollSelectionRequest = {
    glass: string | null;
    deliverySystem: PaperDollMode | null;
    rollerMaterial: "Metal" | "Plastic" | null;
    finish: string | null;
    configurationSku: string | null;
    view: "beauty" | "build";
};

export type GracePaperDollSelectionResult =
    | { ok: true; configuration: PaperDollConfiguration }
    | { ok: false; reason: string };

export function resolveGracePaperDollSelection(
    configurations: readonly PaperDollConfiguration[],
    current: PaperDollConfiguration,
    request: GracePaperDollSelectionRequest,
): GracePaperDollSelectionResult {
    if (request.configurationSku) {
        const exact = configurations.find((configuration) =>
            configuration.graceSku === request.configurationSku
            && configuration.capacityMl === 9
            && configuration.neckThreadSize === "17-415",
        );
        return exact
            ? { ok: true, configuration: exact }
            : { ok: false, reason: "That configuration is not available for this 9 mL 17-415 bottle." };
    }

    let next = current;
    if (request.glass) next = selectCylinderConfiguration(configurations, next, { dimension: "glass", value: request.glass });
    if (request.deliverySystem) next = selectCylinderConfiguration(configurations, next, { dimension: "deliverySystem", value: request.deliverySystem });
    if (request.rollerMaterial) next = selectCylinderConfiguration(configurations, next, { dimension: "rollerMaterial", value: request.rollerMaterial });
    if (request.finish) next = selectCylinderConfiguration(configurations, next, { dimension: "finish", value: request.finish });

    const matches = next.capacityMl === 9
        && next.neckThreadSize === "17-415"
        && (!request.glass || next.glassLabel === request.glass)
        && (!request.deliverySystem || next.mode === request.deliverySystem)
        && (!request.rollerMaterial || next.applicatorKey === `${request.rollerMaterial.toLowerCase()}-roller`)
        && (!request.finish || next.finishLabel === request.finish);

    return matches
        ? { ok: true, configuration: next }
        : { ok: false, reason: "That exact combination is not available for this 9 mL 17-415 bottle." };
}

export function requestGracePaperDollSelection(
    request: GracePaperDollSelectionRequest,
    eventTarget: Pick<Window, "dispatchEvent"> | null = typeof window === "undefined" ? null : window,
): boolean {
    if (!eventTarget) return false;
    return eventTarget.dispatchEvent(new CustomEvent(GRACE_PAPER_DOLL_SELECT_EVENT, { detail: request }));
}

import type { CatalogHero } from "./catalog-heroes";

/**
 * The clear 4 ml hero has no matching white-cap sidecar plate. Its black-cap
 * plate has older glass, so only the detached cap may replace the approved
 * artwork. Coordinates were checked against the 1560 × 1716 hero and the
 * 1000 × 1100 black-cap plate. Both source images remain unchanged.
 */
export function catalogCapOnlySwap(hero: CatalogHero | null | undefined, sku: string | null) {
    if (hero?.url !== "/images/catalog/vials-approved-2026-09-25/GBV1DrmWhtCapSht.e2b04790b812.webp"
        || sku !== "GBV1DrmBlackCapSht") return null;

    return {
        // Cover the white cap with clean backdrop sampled directly above it.
        patch: { left: 800 / 1560, top: 1348 / 1716, width: 320 / 1560, height: 214 / 1716 },
        backdrop: { left: -800 / 320, top: -1100 / 214, width: 1560 / 320, height: 1716 / 214 },
        // Uniformly scale the short black cap to the same footprint/baseline.
        // The enclosing patch clips away all of the plate's obsolete glass.
        plate: { left: (815 - 530 * 0.91 - 800) / 320, top: (1554 - 1055 * 0.91 - 1348) / 214,
            width: 1000 * 0.91 / 320, height: 1100 * 0.91 / 214 },
    };
}

export function capOnlyBox(rect: { left: number; top: number; width: number; height: number }) {
    return { left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` };
}

import { getFinishFromWebsiteSku } from "../paper-doll/tokens.generated";

type CapEvidence = { websiteSku?: string | null; color?: string | null; capColor?: string | null };

/** Some imports repeat the bottle's glass color in capColor. Only replace that
 * value when the exact website SKU supplies a known component finish. */
export function normalizeImportedCapColor<T extends CapEvidence>(variant: T): T {
    const glass = variant.color?.trim().toLowerCase();
    const cap = variant.capColor?.trim().toLowerCase();
    if (!glass || glass !== cap) return variant;
    const finish = getFinishFromWebsiteSku(variant.websiteSku)?.label;
    return finish ? { ...variant, capColor: finish } : variant;
}

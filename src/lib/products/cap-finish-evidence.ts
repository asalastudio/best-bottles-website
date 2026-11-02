import { rectangleApplicatorGlass } from "./rectangle-applicator";
import { getFinishFromWebsiteSku } from "../paper-doll/tokens.generated";

// Exact legacy descriptions identify these short black/white vial caps;
// their imported capColor is incorrectly "Clear". See the saved 4 ml catalog
// evidence and component-matches.generated.json for the two 2 ml variants.
const VERIFIED_VIAL_CAPS: Readonly<Record<string, { glass: string; finish: string }>> = {
    GBVAmb2BlackCap: { glass: "amber", finish: "Black" },
    GBVAmb2WhtCap: { glass: "amber", finish: "White" },
    GBV1DrmBlackCapSht: { glass: "clear", finish: "Black" },
    GBV1DrmWhtCapSht: { glass: "clear", finish: "White" },
    GBVAmb1DrmBlackCapSht: { glass: "amber", finish: "Black" },
    GBVAmb1DrmWhtCapSht: { glass: "amber", finish: "White" },
    GBVBlu1DrmBlackCapSht: { glass: "blue", finish: "Black" },
    GBVBlu1DrmWhtCapSht: { glass: "blue", finish: "White" },
    GBVGr1DrmBlackCapSht: { glass: "green", finish: "Black" },
    GBVGr1DrmWhtCapSht: { glass: "green", finish: "White" },
};

type CapEvidence = { websiteSku?: string | null; color?: string | null; capColor?: string | null };

/** Some imports repeat the bottle's glass color in capColor. Only replace that
 * value when the exact website SKU supplies a known component finish. */
export function normalizeImportedCapColor<T extends CapEvidence>(variant: T): T {
    const rectangleGlass = rectangleApplicatorGlass(variant.websiteSku);
    if (rectangleGlass) return { ...variant, capColor: rectangleGlass };
    const glass = variant.color?.trim().toLowerCase();
    const cap = variant.capColor?.trim().toLowerCase();
    const verified = VERIFIED_VIAL_CAPS[variant.websiteSku ?? ""];
    if (verified && (glass === verified.glass || (verified.glass === "blue" && glass === "cobalt blue")) && cap === "clear") {
        return { ...variant, capColor: verified.finish };
    }
    if (!glass || glass !== cap) return variant;
    const finish = getFinishFromWebsiteSku(variant.websiteSku)?.label;
    return finish ? { ...variant, capColor: finish } : variant;
}

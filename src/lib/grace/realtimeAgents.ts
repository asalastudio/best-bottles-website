import { GRACE_REALTIME_INSTRUCTIONS } from "./realtimeInstructions";
import type { GraceOpenAIToolName } from "@/lib/knowledge/toolSchemas";

export const GRACE_MERCHANDISER_NAME = "Grace";
export const GRACE_NAVIGATOR_NAME = "Navigator";

export const GRACE_SHARED_TOOL_NAMES = [
    "getCurrentPageContext",
    "getCartContents",
    "getBrowsingHistory",
    "getSiteCapabilities",
    "rememberCustomerNote",
    "getPolicy",
    "configureCurrentProduct",
] as const satisfies readonly GraceOpenAIToolName[];

export const GRACE_MERCHANDISER_TOOL_NAMES = [
    ...GRACE_SHARED_TOOL_NAMES,
    "searchCatalog",
    "getProductBySku",
    "getFamilyOverview",
    "getPriceStats",
    "getBottleComponents",
    "checkCompatibility",
    "getCatalogStats",
    "getProductMeasurements",
    "compareProducts",
    "showProductPresentation",
    "displayProductCard",
    "displayFamilyCard",
    "displayCompatibility",
    "displayBuildKit",
    "displayComparison",
    "displayCatalogStrip",
    "displayShortlist",
    "displayAnatomy",
    "listGraceProjects",
    "proposeProjectSave",
] as const satisfies readonly GraceOpenAIToolName[];

export const GRACE_NAVIGATOR_TOOL_NAMES = [
    ...GRACE_SHARED_TOOL_NAMES,
    "navigateToPage",
    "showProducts",
    "setCatalogRefinements",
    "proposeCartAdd",
    "proceedToCheckout",
    "prefillForm",
    "updateFormField",
    "submitForm",
    "prepareQuoteRequest",
] as const satisfies readonly GraceOpenAIToolName[];

const MERCHANDISER_ADDENDUM = `
ROLE: You are Grace the merchandiser on this same Realtime session.
- Answer from catalog tools. Use getProductMeasurements for height, diameter, or measurementSource.
- Use getSiteCapabilities when they ask what you can do.
- On THIS product page, call configureCurrentProduct immediately for cap finish, metal/plastic roller, or cap on/off. Do not hand off for a plate swap. Do not leave a chat card as the only path.
- If they say take me, show me, go to, or open a different bottle, glass color, or applicator, hand off to Navigator.
- After a catalog tool, follow the CATALOG HINT in session context. Do not re-read JSON.
`.trim();

const NAVIGATOR_ADDENDUM = `
ROLE: You are Grace the navigator on this same Realtime session. Same voice, same customer.
- Move the customer when they ask to go somewhere. Call navigateToPage or showProducts immediately.
- On the current PDP only, call configureCurrentProduct for cap, roller, or cap on/off.
- Glass color and applicator changes are different URLs — navigate, do not plate-swap.
- If they ask a catalog fact you do not have, hand off to Grace (merchandiser).
- Honor MEMORY last correction and last destination.
`.trim();

export function buildMerchandiserInstructions(base: string = GRACE_REALTIME_INSTRUCTIONS): string {
    return `${base.trim()}\n\n${MERCHANDISER_ADDENDUM}`;
}

export function buildNavigatorInstructions(base: string = GRACE_REALTIME_INSTRUCTIONS): string {
    return `${base.trim()}\n\n${NAVIGATOR_ADDENDUM}`;
}

export function splitToolsForGraceRole<T extends { name: string }>(
    specs: T[],
    role: "merchandiser" | "navigator",
): T[] {
    const allowed = new Set<string>(
        role === "navigator" ? GRACE_NAVIGATOR_TOOL_NAMES : GRACE_MERCHANDISER_TOOL_NAMES,
    );
    return specs.filter((spec) => allowed.has(spec.name));
}

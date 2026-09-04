import type { GraceCompanionMode } from "./agenticHandoff";

export type GraceSiteCapabilities = {
    canNavigateToOtherProducts: true;
    canSwapCapOnCurrentPdp: boolean;
    canChangeGlassOrApplicatorWithoutNavigation: false;
    kitsPublished: false;
    agenticFollowAlong: boolean;
    canTakePayment: false;
    canLookUpOrders: false;
    notes: string[];
};

export function buildGraceSiteCapabilities(args: {
    pageType?: string | null;
    companionMode?: GraceCompanionMode | null;
}): GraceSiteCapabilities {
    const onPdp = args.pageType === "pdp";
    const agentic = args.companionMode === "agentic";
    const notes = [
        "You can move the customer to another verified product or catalog page.",
        onPdp
            ? "On THIS product page only, configureCurrentProduct can swap the visible cap, roller, or cap on/off plate."
            : "Cap and roller plate swaps only work while the customer is on a product page.",
        "Glass color and applicator (roller vs fine mist vs pump) are different product URLs — navigate, do not plate-swap.",
        "Published product kits are not live. Never advertise a catalog-wide bottle builder.",
        agentic
            ? "Agentic follow-along is on: the chat may be hidden and voice stays on. Keep navigating."
            : "Voice follow-along starts after a product-link tap or a voice move to another PDP.",
        "You cannot take payment, look up orders, or export a file.",
    ];
    return {
        canNavigateToOtherProducts: true,
        canSwapCapOnCurrentPdp: onPdp,
        canChangeGlassOrApplicatorWithoutNavigation: false,
        kitsPublished: false,
        agenticFollowAlong: agentic,
        canTakePayment: false,
        canLookUpOrders: false,
        notes,
    };
}

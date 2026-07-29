import type { Appearance } from "@clerk/types";

/**
 * Clerk theme for the embedded portal surfaces (<UserProfile />).
 *
 * The portal uses a denser, neutral application design system (white cards,
 * neutral-200 hairlines, rounded-lg, 13–14px sans) rather than the marketing
 * site's bone/champagne palette — so it gets its own appearance instead of
 * reusing `clerkAppearance`.
 *
 * Passed per-component, which merges over the global provider appearance.
 */
export const clerkPortalAppearance: Appearance = {
    variables: {
        colorPrimary: "#171717",       // neutral-900
        colorText: "#171717",
        colorTextSecondary: "#737373", // neutral-500
        colorBackground: "#FFFFFF",
        colorInputBackground: "#FFFFFF",
        colorInputText: "#171717",
        colorDanger: "#B4453C",
        fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        fontSize: "0.875rem",
        borderRadius: "8px",
    },
    layout: {
        logoPlacement: "none",
        socialButtonsPlacement: "bottom",
        socialButtonsVariant: "blockButton",
        helpPageUrl: "/contact",
        privacyPageUrl: "/privacy",
        termsPageUrl: "/terms",
    },
    elements: {
        rootBox: "w-full",
        // The page already supplies the surrounding card, so the widget itself
        // renders flat and fills the width.
        cardBox: "w-full max-w-none shadow-none border-none",
        card: "w-full shadow-none border-none bg-transparent",
        scrollBox: "rounded-none bg-transparent",

        navbar: "bg-neutral-50 border-r border-neutral-200",
        navbarButton: "text-[13px] text-neutral-600 hover:text-neutral-900",
        navbarButtonIcon: "text-neutral-400",

        headerTitle: "font-sans text-[18px] font-semibold text-neutral-900",
        headerSubtitle: "font-sans text-[13px] text-neutral-500",

        profileSectionTitleText: "font-sans text-[14px] font-semibold text-neutral-900",
        profileSectionPrimaryButton:
            "text-[13px] text-neutral-900 hover:bg-neutral-50 rounded-md",

        formFieldLabel: "font-sans text-[12px] font-medium text-neutral-600",
        formFieldInput:
            "rounded-md border border-neutral-200 bg-white px-3 py-2 text-[14px] text-neutral-900 focus:border-neutral-900",
        formButtonPrimary:
            "rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white shadow-none hover:bg-neutral-700 normal-case",
        formButtonReset:
            "rounded-md text-[13px] text-neutral-600 hover:bg-neutral-100",

        badge: "rounded-md bg-neutral-100 text-neutral-700",
        avatarBox: "border border-neutral-200",
        accordionTriggerButton: "text-[13px] text-neutral-900 hover:bg-neutral-50",
    },
};

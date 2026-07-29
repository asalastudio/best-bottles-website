import type { Appearance } from "@clerk/types";

/**
 * Best Bottles theme for every Clerk surface.
 *
 * Applied once on <ClerkProvider> in AppProviders so SignIn, SignUp,
 * UserButton and UserProfile all inherit it — otherwise Clerk renders its
 * default rounded, drop-shadowed, Inter-blue card that reads as a third-party
 * modal dropped on top of the site.
 *
 * Palette mirrors the `@theme` tokens in src/app/globals.css. Values are
 * literal hex rather than `var(--color-…)` because Clerk's `variables` block
 * is consumed by its own JS theming layer, which cannot resolve Tailwind v4
 * custom properties defined in a different stacking context.
 */
const OBSIDIAN = "#1D1D1F";
const BONE = "#F5F3EF";
const MUTED_GOLD = "#C5A065";
const SLATE = "#637588";
const CHAMPAGNE = "#D4C5A9";
const LINEN = "#FAF8F5";

export const clerkAppearance: Appearance = {
    variables: {
        colorPrimary: OBSIDIAN,
        colorText: OBSIDIAN,
        colorTextSecondary: SLATE,
        colorBackground: LINEN,
        colorInputBackground: "#FFFFFF",
        colorInputText: OBSIDIAN,
        colorDanger: "#B4453C",
        colorSuccess: "#3F7D58",
        colorWarning: MUTED_GOLD,
        fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        fontFamilyButtons: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        fontSize: "0.9375rem",
        // Square-ish to match the site's `rounded-sm` language.
        borderRadius: "2px",
        spacingUnit: "1rem",
    },
    layout: {
        // The page supplies its own wordmark and context line, so Clerk's
        // duplicate logo/header is suppressed.
        logoPlacement: "none",
        socialButtonsPlacement: "bottom",
        socialButtonsVariant: "blockButton",
        showOptionalFields: true,
        helpPageUrl: "/contact",
        privacyPageUrl: "/privacy",
        termsPageUrl: "/terms",
    },
    elements: {
        // Merge the card into the page instead of floating it.
        rootBox: "w-full",
        cardBox: "w-full shadow-none border-none",
        card: "bg-transparent shadow-none border-none p-0 gap-6",
        header: "hidden",
        headerTitle: "hidden",
        headerSubtitle: "hidden",

        // Fields
        formFieldLabel:
            "font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-slate mb-2",
        formFieldInput:
            "rounded-sm border border-champagne/70 bg-white px-4 py-3 text-[15px] text-obsidian shadow-none transition-colors focus:border-muted-gold focus:ring-1 focus:ring-muted-gold/40",
        formFieldInputShowPasswordButton: "text-slate hover:text-obsidian",
        formFieldAction: "text-obsidian underline underline-offset-4 hover:text-muted-gold",
        formFieldHintText: "text-xs text-slate",
        formFieldErrorText: "text-xs text-red-700",

        // Primary CTA — matches the site's obsidian → gold button language.
        formButtonPrimary:
            "rounded-none bg-obsidian px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-bone shadow-none transition-colors hover:bg-muted-gold focus:ring-2 focus:ring-muted-gold/40 normal-case",
        formButtonReset:
            "text-sm font-semibold text-obsidian underline underline-offset-4 hover:text-muted-gold",

        // Social / alternate methods
        socialButtonsBlockButton:
            "rounded-sm border border-champagne/70 bg-white py-3 text-sm font-semibold text-obsidian transition-colors hover:border-muted-gold hover:bg-bone",
        socialButtonsBlockButtonText: "font-sans text-sm font-semibold text-obsidian",
        alternativeMethodsBlockButton:
            "rounded-sm border border-champagne/70 bg-white py-3 text-sm text-obsidian hover:border-muted-gold hover:bg-bone",

        dividerLine: "bg-champagne/60",
        dividerText:
            "font-sans text-[10px] uppercase tracking-[0.22em] text-slate",

        // Footer / links
        footer: "bg-transparent",
        footerAction: "bg-transparent",
        footerActionText: "text-sm text-slate",
        footerActionLink:
            "text-sm font-semibold text-obsidian underline underline-offset-4 hover:text-muted-gold",
        footerPages: "text-xs text-slate",
        footerPagesLink: "text-xs text-slate hover:text-obsidian",
        identityPreviewText: "text-sm text-obsidian",
        identityPreviewEditButton: "text-obsidian hover:text-muted-gold",

        // OTP / verification
        otpCodeFieldInput:
            "rounded-sm border border-champagne/70 bg-white text-obsidian focus:border-muted-gold",

        // UserButton / UserProfile popovers
        userButtonAvatarBox: "h-9 w-9 border border-champagne/60",
        userButtonPopoverCard:
            "rounded-sm border border-champagne/60 bg-linen shadow-lg",
        userButtonPopoverActionButton: "text-sm text-obsidian hover:bg-bone",
        userButtonPopoverActionButtonText: "text-sm text-obsidian",
        userButtonPopoverFooter: "hidden",
        avatarBox: "border border-champagne/60",

        badge: "rounded-sm bg-travertine text-obsidian",
        spinner: "text-muted-gold",
    },
};

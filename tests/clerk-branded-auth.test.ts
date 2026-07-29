import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Clerk must render inside the Best Bottles design, not as a default
 * third-party card floating on a blank page.
 */
describe("branded Clerk auth", () => {
    const signIn = readFileSync("src/app/sign-in/[[...sign-in]]/page.tsx", "utf8");
    const signUp = readFileSync("src/app/sign-up/[[...sign-up]]/page.tsx", "utf8");
    const shell = readFileSync("src/components/auth/AuthShell.tsx", "utf8");
    const providers = readFileSync("src/components/AppProviders.tsx", "utf8");
    const appearance = readFileSync("src/lib/clerkAppearance.ts", "utf8");
    const css = readFileSync("src/app/globals.css", "utf8");

    it("applies the brand appearance once at the provider so every Clerk surface inherits it", () => {
        expect(providers).toContain("appearance={clerkAppearance}");
        expect(appearance).toContain("formButtonPrimary");
        expect(appearance).toContain("userButtonAvatarBox");
    });

    it("wraps both auth pages in the site chrome", () => {
        for (const page of [signIn, signUp]) {
            expect(page).toContain("AuthShell");
        }
        expect(shell).toContain("import Navbar");
        expect(shell).toContain("import Footer");
    });

    it("keeps the Clerk card visually merged rather than a nested modal", () => {
        expect(css).toContain(".cl-cardBox");
        expect(css).toContain("background: transparent !important");
        expect(css).toContain(".cl-header");
        // Brand focus ring, not Clerk's default blue.
        expect(css).toContain("--color-muted-gold");
    });

    it("cross-links sign-in and sign-up while preserving the redirect target", () => {
        expect(signIn).toContain("signUpUrl={`/sign-up?redirect_url=");
        expect(signUp).toContain("signInUrl={`/sign-in?redirect_url=");
    });

    it("only allows same-origin redirect targets", () => {
        for (const page of [signIn, signUp]) {
            expect(page).toContain('value.startsWith("/") && !value.startsWith("//")');
            expect(page).toContain('return "/portal"');
        }
    });

    it("tailors copy to the hub the visitor was heading for", () => {
        expect(signIn).toContain('if (context === "Team Hub")');
        expect(signIn).toContain('if (context === "Executive Hub")');
        // Internal hubs must not be pitched customer pricing.
        expect(signIn).toContain("Sign in with your Best Bottles team account.");
    });

    it("still degrades gracefully when Clerk is disabled", () => {
        for (const page of [signIn, signUp]) {
            expect(page).toContain("if (!CLERK_ENABLED)");
            expect(page).toContain("NEXT_PUBLIC_CLERK_ENABLED=true");
        }
    });
});

describe("portal route protection", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");

    it("redirects signed-out visitors to sign-in instead of 404ing", () => {
        // Deployed 2026-07-29: bare auth.protect() answered every signed-out
        // /portal request with 404 (no lambda invocation), so customers saw
        // "not found" rather than a login screen.
        expect(proxy).toContain("redirectToSignIn({ returnBackUrl: req.url })");
        expect(proxy).not.toMatch(/await auth\.protect\(\);/);
    });

    it("still leaves public routes untouched", () => {
        expect(proxy).toContain('createRouteMatcher(["/portal(.*)", "/api/portal(.*)"])');
    });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("responsive shell contract", () => {
    it("keeps the compact navigation through 1279px so the expanded header fits at 1440px", () => {
        const navbar = read("src/components/Navbar.tsx");

        expect(navbar).toContain('className="xl:hidden p-2');
        expect(navbar).toContain('className="hidden xl:flex shrink-0');
        expect(navbar).toContain("xl:gap-x-6 2xl:gap-x-12");
        expect(navbar).toContain("xl:min-w-[320px] xl:max-w-[420px]");
    });

    it("uses the typographic wordmark in the mobile menu instead of a missing image asset", () => {
        const navbar = read("src/components/Navbar.tsx");

        expect(navbar).toContain('data-testid="mobile-menu-wordmark"');
        expect(navbar).not.toContain('src="/assets/best-bottles-logo.png"');
    });

    it("uses one safe-area-aware tab-bar clearance for page content and the cart drawer", () => {
        const globals = read("src/app/globals.css");
        const mobileTabs = read("src/components/mobile/MobileTabBar.tsx");
        const cartDrawer = read("src/components/CartDrawer.tsx");
        const footer = read("src/components/Footer.tsx");

        expect(globals).toContain("--mobile-tab-bar-clearance:");
        expect(globals).toContain("--mobile-tab-bar-height: calc(3.5rem + 1px)");
        expect(globals).toContain("padding-bottom: calc(var(--mobile-tab-bar-clearance) + 0.75rem)");
        expect(globals).toContain("@media (max-width: 1279px)");
        expect(mobileTabs).toContain("xl:hidden");
        expect(cartDrawer).toContain("bottom-[var(--mobile-tab-bar-clearance)]");
        expect(cartDrawer).toContain("xl:bottom-0");
        expect(footer).toContain("pb-[calc(2rem+var(--mobile-tab-bar-clearance))] xl:pb-8");
    });

    it("keeps the Grace mobile action centered inside the tab bar", () => {
        const mobileTabs = read("src/components/mobile/MobileTabBar.tsx");
        const launcher = read("src/components/grace/GraceLauncher.tsx");

        expect(mobileTabs).toContain("animate-grace-pulse-subtle");
        expect(mobileTabs).not.toContain("-mt-6");
        expect(mobileTabs).not.toContain("w-12 h-12");
        expect(launcher).toContain("hidden cursor-pointer");
        expect(launcher).toContain("xl:flex");
        expect(launcher).not.toContain("isMobile");
    });
});

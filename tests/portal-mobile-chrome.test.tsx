// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PortalChrome from "@/components/portal/PortalChrome";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
        createElement("a", { href, ...props }, children),
}));
vi.mock("next/navigation", () => ({
    usePathname: () => "/portal",
}));
vi.mock("@clerk/nextjs", () => ({
    UserButton: () => createElement("div", null, "Account"),
    useOrganization: () => ({ organization: { name: "ASALA" } }),
}));
vi.mock("@/components/BrandWordmark", () => ({
    default: () => createElement("span", null, "Best Bottles"),
}));

(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
        root.render(
            createElement(PortalChrome, {
                companyName: "ASALA",
                tierLabel: "Portal access",
                inTransitCount: 0,
                children: createElement("h1", null, "Welcome back, ASALA"),
            }),
        ),
    );
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

it("keeps overview full width and opens a drawer instead of a persistent rail", () => {
    expect(host.querySelector("[data-portal-shell]")).toBeTruthy();
    expect(host.textContent).toContain("Welcome back, ASALA");
    expect(host.textContent).toContain("Overview");
    expect(host.querySelector('[aria-label="Open portal menu"]')).toBeTruthy();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    act(() => (host.querySelector('[aria-label="Open portal menu"]') as HTMLButtonElement).click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Catalog");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Order history");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("ASALA");
});

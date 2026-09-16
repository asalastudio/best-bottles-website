// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeamHubChrome from "@/components/team/TeamHubChrome";
import { buildTeamHubTools } from "@/lib/teamHub";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
        createElement("a", { href, ...props }, children),
}));
vi.mock("next/navigation", () => ({
    usePathname: () => "/team",
}));
vi.mock("@/components/BrandWordmark", () => ({
    default: () => createElement("span", null, "Best Bottles"),
}));

(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const tools = buildTeamHubTools({
    shopifyAdminHref: "https://admin.shopify.com/store/best-bottles",
    madisonStudioHref: "https://app.madisonstudio.io",
});

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
        root.render(
            <TeamHubChrome tools={tools} counts={{}} previewMode>
                <h1>Today</h1>
            </TeamHubChrome>,
        ),
    );
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

it("keeps Today full width and opens a full-screen drawer instead of a persistent phone rail", () => {
    expect(host.querySelector("[data-team-hub-shell]")).toBeTruthy();
    expect(host.textContent).toContain("Today");
    expect(host.textContent).toContain("Team Hub");
    expect(host.querySelector('[aria-label="Best Bottles home"]')).toBeTruthy();
    expect(host.querySelector('[aria-label="Open Team Hub menu"]')).toBeTruthy();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    act(() => (host.querySelector('[aria-label="Open Team Hub menu"]') as HTMLButtonElement).click());
    const drawer = host.querySelector('[role="dialog"]');
    expect(drawer?.textContent).toContain("Today");
    expect(drawer?.textContent).toContain("Create Products");
    expect(drawer?.textContent).toContain("Best Bottles");
    expect(drawer?.querySelector("a[href='/team?preview=1']")?.textContent).toContain("Today");
});

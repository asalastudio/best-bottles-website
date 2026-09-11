// @vitest-environment jsdom
import React, { act, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; delete p.priority; return React.createElement("img", p);
} }));

import FamilyHeroSlider, { FAMILY_HERO_SLIDE_INTERVAL_MS } from "@/components/catalog/FamilyHeroSlider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const slides = [
    { src: "/assets/family-heroes/cylinder-rollers.webp", alt: "Roll-ons" },
    { src: "/assets/family-heroes/cylinder-sprayers.webp", alt: "Sprayers" },
    { src: "/assets/family-heroes/cylinder-antique.webp", alt: "Antique atomizers" },
];

let root: Root;
let el: HTMLDivElement;
function render(reduced = false) {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root.render(<FamilyHeroSlider family="Cylinder" slides={slides} />));
}
const $ = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
const $$ = (testId: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
const click = (target: Element) => act(() => { target.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const activeIndex = () => $$("family-hero-slide").findIndex((slide) => slide.dataset.active === "true");

afterEach(() => { act(() => root?.unmount()); el?.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("family hero slider", () => {
    it("renders an accessible carousel with one active slide, arrows, and dots", () => {
        render();
        const region = $("family-hero-slider");
        expect(region.getAttribute("role")).toBe("region");
        expect(region.getAttribute("aria-roledescription")).toBe("carousel");
        expect(region.getAttribute("aria-label")).toBe("Cylinder product photography");
        expect($$("family-hero-slide")).toHaveLength(3);
        expect(activeIndex()).toBe(0);
        expect($$("family-hero-slide")[1].getAttribute("aria-hidden")).toBe("true");
        expect($$("family-hero-slide")[0].querySelector("img")?.getAttribute("alt")).toBe("Roll-ons");
        expect($$("family-hero-dot").map((dot) => dot.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
        expect($$("family-hero-dot")[1].getAttribute("aria-controls")).toBe($$("family-hero-slide")[1].id);
        expect(el.textContent).toContain("Slide 1 of 3: Roll-ons");

        click($("family-hero-next"));
        expect(activeIndex()).toBe(1);
        expect(el.textContent).toContain("Slide 2 of 3: Sprayers");
        click($("family-hero-prev")); click($("family-hero-prev"));
        expect(activeIndex()).toBe(2);
        click($$("family-hero-dot")[0]);
        expect(activeIndex()).toBe(0);

        act(() => { $("family-hero-slider").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
        expect(activeIndex()).toBe(1);
        act(() => { $("family-hero-slider").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); });
        expect(activeIndex()).toBe(2);
    });

    it("auto-advances on a timer, pauses on hover, and stays put under reduced motion", () => {
        // jsdom reports the document as prerender/hidden; the slider deliberately idles on hidden tabs.
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
        vi.useFakeTimers();
        render();
        act(() => { vi.advanceTimersByTime(FAMILY_HERO_SLIDE_INTERVAL_MS); });
        expect(activeIndex()).toBe(1);
        // React synthesises onMouseEnter from a bubbling mouseover whose relatedTarget is outside the node.
        act(() => { $("family-hero-slider").dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body })); });
        act(() => { vi.advanceTimersByTime(FAMILY_HERO_SLIDE_INTERVAL_MS * 2); });
        expect(activeIndex()).toBe(1);
        act(() => root.unmount()); el.remove(); vi.unstubAllGlobals();

        render(true);
        act(() => { vi.advanceTimersByTime(FAMILY_HERO_SLIDE_INTERVAL_MS * 3); });
        expect(activeIndex()).toBe(0);
    });
});

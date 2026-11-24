// @vitest-environment jsdom
import { act, useState, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: () => undefined }));
// eslint-disable-next-line @next/next/no-img-element -- next/image stand-in
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} /> }));
import CatalogCapDots from "@/components/catalog/CatalogCapDots";

const caps = Array.from({ length: 9 }, (_, index) => ({ id: `cap-${index}`, label: `Finish ${index}`, websiteSku: `SKU${index}`, optionType: "capColor" as const }));

/** jsdom has no layout: give the strip a 120 px window onto 9 swatches 29 px apart. */
const SWATCH = 29, WINDOW = 120;
function layOut(container: HTMLElement) {
    const strip = container.querySelector<HTMLElement>("[data-testid=catalog-card-cap-strip] > div.overflow-x-auto")!;
    let scrollLeft = 0;
    Object.defineProperties(strip, {
        clientWidth: { configurable: true, get: () => WINDOW },
        scrollWidth: { configurable: true, get: () => caps.length * SWATCH },
        offsetLeft: { configurable: true, get: () => 0 },
        scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = Math.max(0, Math.min(value, caps.length * SWATCH - WINDOW)); } },
    });
    strip.scrollBy = ((options: ScrollToOptions) => { strip.scrollLeft = scrollLeft + (options.left ?? 0); strip.dispatchEvent(new Event("scroll")); }) as typeof strip.scrollBy;
    container.querySelectorAll<HTMLElement>("[data-testid=catalog-card-cap-dot]").forEach((dot, index) => {
        Object.defineProperties(dot, { offsetLeft: { configurable: true, get: () => index * SWATCH }, offsetWidth: { configurable: true, get: () => 24 } });
    });
    return strip;
}

let root: Root, container: HTMLDivElement, observers: Array<() => void>;
function Harness({ start = "cap-0" }: { start?: string }) {
    const [selected, setSelected] = useState(start);
    return <CatalogCapDots title="5 ml Cylinder" variants={caps} selectedId={selected} onSelect={(variant) => setSelected(variant.id)} photo={() => undefined} />;
}
async function mount(start?: string) {
    await act(async () => root.render(<Harness start={start} />));
    const strip = layOut(container);
    await act(async () => observers.forEach((callback) => callback()));
    return strip;
}
const arrow = (side: "back" | "forward") => container.querySelector<HTMLButtonElement>(`[data-testid=catalog-card-cap-${side}]`);

beforeEach(() => {
    observers = [];
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { observers.push(callback); } observe() {} disconnect() {} });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("catalog card cap strip", () => {
    it("keeps every finish in one strip: no +N chip, no folding", async () => {
        await mount();
        expect(container.querySelectorAll("[role=radio]")).toHaveLength(9);
        expect(container.querySelector("[data-testid=catalog-card-cap-more]")).toBeNull();
        expect(container.textContent).not.toMatch(/\+\d/);
    });

    it("shows the forward chevron only while caps are hidden ahead, and the back one once scrolled", async () => {
        const strip = await mount();
        expect(arrow("back")?.disabled).toBe(true);
        expect(arrow("forward")?.disabled).toBe(false);
        expect(arrow("forward")?.getAttribute("aria-label")).toBe("More caps");
        await act(async () => arrow("forward")!.click());
        expect(strip.scrollLeft).toBeGreaterThan(0);
        expect(arrow("back")?.disabled).toBe(false);
        await act(async () => { arrow("forward")!.click(); arrow("forward")!.click(); });
        expect(strip.scrollLeft).toBe(caps.length * SWATCH - WINDOW);
        expect(arrow("forward")?.disabled).toBe(true);
        expect(arrow("forward")?.className).toContain("opacity-0");
    });

    it("draws thin chevrons, not filled triangles, and keeps them out of the tab order", async () => {
        await mount();
        const forward = arrow("forward")!;
        expect(forward.tabIndex).toBe(-1);
        expect(forward.querySelector("path")?.getAttribute("fill")).toBeNull();
        expect(forward.querySelector("svg")?.getAttribute("stroke")).toBe("currentColor");
    });

    it("selects with the arrow keys across the whole row and scrolls the picked cap into view", async () => {
        const strip = await mount("cap-3");
        const group = container.querySelector<HTMLElement>("[role=radiogroup]")!;
        for (let i = 0; i < 4; i += 1) await act(async () => group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
        const picked = container.querySelector("[aria-checked=true]")!;
        expect(picked.getAttribute("aria-label")).toBe("Finish 7");
        expect(container.querySelector("[data-testid=catalog-card-cap-name]")?.textContent).toBe("Finish 7");
        expect(strip.scrollLeft + WINDOW).toBeGreaterThanOrEqual(7 * SWATCH + 24);
        await act(async () => group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
        await act(async () => group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
        expect(container.querySelector("[aria-checked=true]")?.getAttribute("aria-label")).toBe("Finish 0");
        expect(strip.scrollLeft).toBe(0);
    });

    it("scrolls by touch: the strip itself overflows sideways with its scrollbar hidden", async () => {
        const strip = await mount();
        expect(strip.className).toContain("overflow-x-auto");
        expect(strip.className).toContain("[scrollbar-width:none]");
        strip.scrollLeft = 60;
        await act(async () => strip.dispatchEvent(new Event("scroll")));
        expect(arrow("back")?.disabled).toBe(false);
    });
});

// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@react-three/drei", () => ({ useGLTF: () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLDivElement[] = [];
const originalImage = globalThis.Image;

/**
 * jsdom has no layout engine, so derive scroll extent from the actual mounted
 * focused-shell tree. Width utilities inherit the containing width; a rail
 * with its own horizontal scroll clips its children from page extent. This is
 * intentionally sensitive to an explicit overflowing shell/child width.
 */
function measuredScrollWidth(node: HTMLElement, containingWidth: number): number {
    const explicitWidth = Number.parseFloat(node.style.width);
    const ownWidth = Number.isFinite(explicitWidth)
        ? explicitWidth
        : node.classList.contains("w-full") ? containingWidth : containingWidth;
    if (node.classList.contains("overflow-x-auto")) return ownWidth;
    return [...node.children].reduce((widest, child) => (
        Math.max(widest, measuredScrollWidth(child as HTMLElement, ownWidth))
    ), ownWidth);
}

const kitFor = (sku: string, imageUrl: string) => ({
    sku,
    parts: [{
        slot: "body", variantKey: null, zOrder: 2, explodeIndex: 1,
        bounds: { left: 0, top: 0, right: 100, bottom: 100 },
        assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -24 },
        image: { url: imageUrl, width: 1000, height: 1100 }, image2x: null, mask: null,
        derivation: "madison",
    }],
}) as never;

function installInstantImageDecode() {
    class InstantImage {
        decoding = "async";
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) { queueMicrotask(() => this.onload?.()); }
        decode() { return Promise.resolve(); }
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: InstantImage });
}

afterEach(() => {
    for (const container of containers.splice(0)) container.remove();
    Object.defineProperty(globalThis, "Image", { configurable: true, value: originalImage });
});

describe("focused PDP mobile purchase surface", () => {
    it("contains option overflow at the real closure rail rather than the 390px page", async () => {
        const { default: ConfiguratorPdp } = await import("../src/components/products/ConfiguratorPdp");
        const container = document.createElement("div");
        containers.push(container);
        container.style.width = "390px";
        document.body.append(container);

        await act(async () => {
            createRoot(container).render(createElement(ConfiguratorPdp, {
                currentSlug: "cylinder-9ml-clear-17-415-rollon", groupTitle: "Cylinder 9 mL", capacityLabel: "Clear glass",
                displayName: "9 mL Clear Cylinder", priceEach: 0.72, inStock: true, checkoutReady: true,
                qty: 1, plateImage: "https://example.test/plate.png", neckSize: "17-415", capacityText: "9 mL",
                capOptions: ["Black", "Gold", "Silver", "White", "Pink", "Copper"], activeCapOption: "Black",
            }));
        });

        const rail = container.querySelector<HTMLElement>('[data-testid="pdp-closure-rail"]');
        expect(rail).not.toBeNull();
        Object.defineProperties(rail!, {
            clientWidth: { configurable: true, value: 358 },
            scrollWidth: { configurable: true, value: 492 },
        });

        expect(rail!.scrollWidth).toBeGreaterThan(rail!.clientWidth);
        expect(rail!.className).toContain("overflow-x-auto");
        const shell = container.querySelector<HTMLElement>(".focused-pdp-shell");
        expect(shell).not.toBeNull();
        expect(measuredScrollWidth(shell!, 390)).toBeLessThanOrEqual(390);
        expect(measuredScrollWidth(container, 390)).toBeLessThanOrEqual(390);
        expect(measuredScrollWidth(document.documentElement, 390)).toBeLessThanOrEqual(390);
        shell!.style.width = "420px";
        expect(measuredScrollWidth(shell!, 390)).toBeGreaterThan(390);
        expect(container.querySelector('[data-pdp-stage-plate="10:11"]')).not.toBeNull();
        expect(container.querySelector('[aria-label="Quantity"]')).not.toBeNull();
        expect(container.textContent).toContain("Add to cart");
        expect(rail!.querySelectorAll("button")).toHaveLength(6);
        expect(rail!.querySelector("button")?.className).toContain("min-h-11");
    });

    it("synchronously gates A kit layers while B is pending or has no kit, then restores only B's exact kit", async () => {
        const { default: ConfiguratorPdp } = await import("../src/components/products/ConfiguratorPdp");
        installInstantImageDecode();
        sessionStorage.setItem("bb:pdp-stage", "exploded");
        const container = document.createElement("div");
        containers.push(container);
        document.body.append(container);
        const root = createRoot(container);
        const common = {
            currentSlug: "cylinder-9ml-clear-17-415-rollon", groupTitle: "Cylinder 9 mL", capacityLabel: "Clear glass",
            displayName: "9 mL Clear Cylinder", priceEach: 0.72, inStock: true, checkoutReady: true,
            qty: 1, neckSize: "17-415", capacityText: "9 mL",
        };

        await act(async () => {
            root.render(createElement(ConfiguratorPdp, { ...common, websiteSku: "WEB-A", selectedGraceSku: "GRACE-A", plateImage: "https://example.test/A-plate.png", kitQuery: kitFor("WEB-A", "https://example.test/A-part.png") }));
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(container.querySelector('img[src="https://example.test/A-part.png"]')).not.toBeNull();

        await act(async () => {
            root.render(createElement(ConfiguratorPdp, { ...common, websiteSku: "WEB-B", selectedGraceSku: "GRACE-B", plateImage: "https://example.test/B-plate.png", kitQuery: undefined }));
        });
        expect(container.querySelector('img[src="https://example.test/A-part.png"]')).toBeNull();
        expect(container.querySelector('img[src="https://example.test/B-plate.png"]')).not.toBeNull();
        expect(container.textContent).not.toContain("Exploded");

        await act(async () => {
            root.render(createElement(ConfiguratorPdp, { ...common, websiteSku: "WEB-B", selectedGraceSku: "GRACE-B", plateImage: "https://example.test/B-plate.png", kitQuery: kitFor("WEB-B", "https://example.test/B-part.png") }));
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(container.querySelector('img[src="https://example.test/B-part.png"]')).not.toBeNull();
        expect(container.textContent).toContain("Exploded");

        await act(async () => {
            root.render(createElement(ConfiguratorPdp, { ...common, websiteSku: "WEB-B", selectedGraceSku: "GRACE-B", plateImage: "https://example.test/B-plate.png", kitQuery: null }));
        });
        expect(container.querySelector('img[src="https://example.test/B-part.png"]')).toBeNull();
        expect(container.querySelector('img[src="https://example.test/B-plate.png"]')).not.toBeNull();
        expect(container.textContent).not.toContain("Exploded");
    });
});

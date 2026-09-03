// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@react-three/drei", () => ({ useGLTF: () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLDivElement[] = [];

afterEach(() => {
    for (const container of containers.splice(0)) container.remove();
});

describe("focused PDP mobile purchase surface", () => {
    it("contains option overflow at the real closure rail rather than the 390px page", async () => {
        const { default: ConfiguratorPdp } = await import("../src/components/products/ConfiguratorPdp");
        const container = document.createElement("div");
        containers.push(container);
        Object.defineProperty(container, "clientWidth", { configurable: true, value: 390 });
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
        expect(container.clientWidth).toBe(390);
        expect(container.querySelector('[data-pdp-stage-plate="10:11"]')).not.toBeNull();
        expect(container.querySelector('[aria-label="Quantity"]')).not.toBeNull();
        expect(container.textContent).toContain("Add to cart");
        expect(rail!.querySelectorAll("button")).toHaveLength(6);
        expect(rail!.querySelector("button")?.className).toContain("min-h-11");
    });
});

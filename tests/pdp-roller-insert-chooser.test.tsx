// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import PdpBuyBox from "@/components/pdp/PdpBuyBox";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("product-page roller insert choice", () => {
    it("shows the exact metal and plastic insert images and preserves selection", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        const onRoller = vi.fn();
        await act(async () => { root.render(createElement(PdpBuyBox, {
            swatchStyle: {}, selectionName: "Clear glass · Shiny Silver cap",
            rollers: [
                { id: "metal", label: "Metal roller ball", shortLabel: "Metal", applicator: "Metal Roller Ball" },
                { id: "plastic", label: "Plastic roller ball", shortLabel: "Plastic", applicator: "Plastic Roller Ball" },
            ],
            activeRoller: "metal",
            rollerImages: { metal: "https://example.test/metal-insert.png", plastic: "https://example.test/plastic-insert.png" },
            rollerUnitPrice: () => 1.5, onRoller, tiers: [], qty: 1, onQty: vi.fn(), unitPrice: 1.5,
            lineTotal: 1.5, addState: "add", onAdd: vi.fn(), addedQty: null, caseQuantity: null,
            formatPrice: (value: number) => `$${value.toFixed(2)}`,
        })); });
        const images = [...host.querySelectorAll<HTMLImageElement>("[data-testid='pdp-roller-toggle'] img")];
        expect(images.map((image) => new URL(image.src).searchParams.get("url"))).toEqual([
            "https://example.test/metal-insert.png", "https://example.test/plastic-insert.png",
        ]);
        expect(host.textContent).toContain("insert fitted inside this bottle");
        expect(host.querySelector("[data-roller='metal']")?.getAttribute("aria-pressed")).toBe("true");
        await act(async () => { host.querySelector<HTMLButtonElement>("[data-roller='plastic']")!.click(); });
        expect(onRoller).toHaveBeenCalledWith("plastic");
        await act(async () => { root.unmount(); });
        host.remove();
    });
});

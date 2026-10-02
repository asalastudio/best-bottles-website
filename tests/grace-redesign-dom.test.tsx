// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GraceChatDrawer from "@/components/grace/GraceChatDrawer";
import { PRIVATE_CAPTURE_SELECTOR } from "@/lib/analytics/capturePrivacy";
import GraceCtaRow from "@/components/grace/cards/GraceCtaRow";
import GraceOrderList from "@/components/grace/GraceOrderList";

const mocks = vi.hoisted(() => ({ draft: "", activeVoice: false, currentProduct: undefined as { name: string } | undefined, push: vi.fn(), close: vi.fn(), reset: vi.fn(), voice: vi.fn(), append: vi.fn(), send: vi.fn(), addItems: vi.fn() }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ items: [], addItems: mocks.addItems }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/" }));
vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ panelMode: "open", surface: { mode: "overlay", viewportWidth: 390 }, closePanel: mocks.close, messages: [], streamingText: "", isAwaitingReply: false, input: mocks.draft, setInput: vi.fn(), send: mocks.send, resetConversation: mocks.reset, errorMessage: "", toggleVoice: mocks.voice, voiceEnabled: mocks.activeVoice, pageContext: { pageType: "home", currentProduct: mocks.currentProduct }, ownerKey: "test", appendInlineMessage: mocks.append }) }));
vi.mock("@/lib/useGraceImageUpload", () => ({ useGraceImageUpload: () => ({ uploadAndAnalyze: vi.fn(), status: "idle" }) }));
vi.mock("@/i18n/useCopy", () => ({ useAppLocale: () => "en", useCopy: () => (key: string) => key }));
vi.mock("@/components/LocaleLink", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/grace/GraceCartSummary", () => ({ default: () => null }));
vi.mock("@/components/grace/GraceChatMessage", () => ({ default: () => null, StreamingMessage: () => null, ThinkingIndicator: () => null }));

let root: Root; let container: HTMLDivElement;
function button(label: string) { return [...container.querySelectorAll("button")].find(el => el.getAttribute("aria-label") === label || el.textContent?.trim() === label)!; }
beforeEach(() => {
    vi.clearAllMocks();
    mocks.draft = ""; mocks.activeVoice = false; mocks.currentProduct = undefined;
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("Grace redesign interactions", () => {
    it("adds the displayed 144 quantity at the checkout price", async () => {
        await act(async () => root.render(<GraceCtaRow product={{ graceSku: "G-1", websiteSku: "WEB-1", itemName: "Bottle", webPrice1pc: 2, webPrice12pc: 1, shopifyVariantId: "123", stockStatus: "In Stock" }} quantity={144} stacked />));
        await act(async () => button("Add 144").click());
        expect(mocks.addItems).toHaveBeenCalledWith([expect.objectContaining({ quantity: 144, unitPrice: 2, graceSku: "G-1", stockStatus: "In Stock" })]);
    });
    it("offers a quote for sold-out or checkout-blocked cards", async () => {
        await act(async () => root.render(<GraceCtaRow product={{ graceSku: "G-1", itemName: "Bottle", webPrice1pc: 2, shopifyVariantId: "123", checkoutEligible: false, stockStatus: "Out of Stock" }} quantity={144} stacked />));
        expect(container.querySelector('a[href="/request-quote"]')).not.toBeNull();
        expect(container.querySelector("button")).toBeNull();
        expect(mocks.addItems).not.toHaveBeenCalled();
    });
    it("keeps expansion available to guests and never resets the existing thread", async () => {
        await act(async () => root.render(<GraceChatDrawer />));
        await act(async () => button("Expand to full-screen chat").click());
        expect(mocks.push).toHaveBeenCalledWith("/grace-workspace"); expect(mocks.close).toHaveBeenCalled(); expect(mocks.reset).not.toHaveBeenCalled();
    });
    it("offers voice, real order/sample destinations and the order-list review", async () => {
        await act(async () => root.render(<GraceChatDrawer />));
        expect(container.querySelectorAll('svg[data-motion]')).toHaveLength(1);
        await act(async () => button("talkWith").click()); expect(mocks.voice).toHaveBeenCalledOnce();
        await act(async () => button("Grace menu").click());
        expect(container.querySelector('a[href="/portal/orders"]')).not.toBeNull();
        expect(container.querySelector('a[href="/request-sample"]')).not.toBeNull();
        expect(container.querySelector('a[href="/privacy"]')).not.toBeNull();
        expect(container.querySelector('a[href="/terms"]')).not.toBeNull();
        await act(async () => button("Upload an order list").click());
        expect(container.querySelector('textarea[id="grace-order-list"]')).not.toBeNull();
        expect(container.querySelector('textarea[id="grace-order-list"]')?.closest(PRIVATE_CAPTURE_SELECTOR)).not.toBeNull();
        expect(container.querySelector('[role="dialog"]')?.classList.contains("ph-no-capture")).toBe(true);
    });
    it("closes the menu before closing Grace on Escape", async () => {
        await act(async () => root.render(<GraceChatDrawer />));
        await act(async () => button("Grace menu").click());
        const panel = container.querySelector('[role="dialog"]')!;
        await act(async () => panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
        expect(mocks.close).not.toHaveBeenCalled();
        await act(async () => panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
        expect(mocks.close).toHaveBeenCalledOnce();
    });
    it("keeps shopping suggestions actionable while moving reset into the menu", async () => {
        await act(async () => root.render(<GraceChatDrawer />));
        expect(button("New conversation")).toBeUndefined();
        await act(async () => button("Find a bottle").click());
        expect(mocks.send).toHaveBeenCalledWith("Help me find a bottle for my product.");
        await act(async () => button("Grace menu").click());
        await act(async () => button("＋ New conversation").click());
        expect(mocks.reset).toHaveBeenCalledOnce();
    });
    it("uses Send for a typed draft but keeps an active voice session stoppable", async () => {
        mocks.draft = "Find a 9 ml bottle";
        await act(async () => root.render(<GraceChatDrawer />));
        expect(button("talkWith")).toBeUndefined();
        expect(button("Send message")).toBeDefined();
        mocks.activeVoice = true;
        await act(async () => root.render(<GraceChatDrawer />));
        await act(async () => button("endVoiceAria").click());
        expect(mocks.voice).toHaveBeenCalledOnce();
    });
    it("shows useful product context without repeating a generic homepage label", async () => {
        await act(async () => root.render(<GraceChatDrawer />));
        expect(container.textContent).not.toContain("Best Bottles homepage");
        mocks.currentProduct = { name: "9 ml Cobalt Cylinder" };
        await act(async () => root.render(<GraceChatDrawer />));
        expect(container.textContent).toContain("Grace can see: 9 ml Cobalt Cylinder");
    });
    it("only proposes exact, available imported lines and requires confirmation", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ result: { graceSku: "G-1", websiteSku: "WEB-1", itemName: "Bottle", shopifyVariantId: "123", webPrice1pc: 2 } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) }));
        await act(async () => root.render(<GraceOrderList onClose={vi.fn()} />));
        const file = { name: "test.csv", size: 40, text: async () => "SKU,Quantity\nWEB-1,12\nMISSING,1" };
        const input = container.querySelector('input[type="file"]')!;
        Object.defineProperty(input, "files", { value: [file] });
        await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
        await act(async () => button("Review items").click());
        expect(mocks.append).toHaveBeenCalledTimes(2);
        const reply = mocks.append.mock.calls[1][0];
        expect(reply.content).toContain("MISSING");
        expect(reply.action).toMatchObject({ type: "proposeCartAdd", awaitingConfirmation: true, products: [{ graceSku: "G-1", quantity: 12, unitPrice: 2 }] });
    });
});

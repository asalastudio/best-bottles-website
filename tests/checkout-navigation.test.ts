import { describe, expect, it, vi } from "vitest";
import * as checkout from "../src/lib/checkout";

type RedirectToCheckout = (options: {
    checkoutUrl: string;
    navigationTarget: {
        addEventListener: (type: string, listener: () => void, options?: { once?: boolean }) => void;
        removeEventListener: (type: string, listener: () => void) => void;
        location: { assign: (url: string) => void };
    };
    onNavigationConfirmed: () => void;
}) => void;

function getRedirectToCheckout(): RedirectToCheckout | undefined {
    return (checkout as typeof checkout & { redirectToCheckout?: RedirectToCheckout }).redirectToCheckout;
}

describe("Shopify checkout navigation", () => {
    it("preserves the cart until the browser confirms page departure", () => {
        const redirectToCheckout = getRedirectToCheckout();
        expect(redirectToCheckout).toBeTypeOf("function");
        if (!redirectToCheckout) return;

        const listeners = new Map<string, () => void>();
        const assign = vi.fn();
        const onNavigationConfirmed = vi.fn();

        redirectToCheckout({
            checkoutUrl: "https://example.myshopify.com/cart/123:1",
            navigationTarget: {
                addEventListener: (type, listener) => listeners.set(type, listener),
                removeEventListener: (type) => listeners.delete(type),
                location: { assign },
            },
            onNavigationConfirmed,
        });

        expect(assign).toHaveBeenCalledWith("https://example.myshopify.com/cart/123:1");
        expect(onNavigationConfirmed).not.toHaveBeenCalled();

        listeners.get("pagehide")?.();
        listeners.get("pagehide")?.();
        expect(onNavigationConfirmed).toHaveBeenCalledTimes(1);
    });

    it("removes pending cleanup and preserves the cart when navigation throws", () => {
        const redirectToCheckout = getRedirectToCheckout();
        expect(redirectToCheckout).toBeTypeOf("function");
        if (!redirectToCheckout) return;

        const listeners = new Map<string, () => void>();
        const onNavigationConfirmed = vi.fn();

        expect(() => redirectToCheckout({
            checkoutUrl: "invalid checkout URL",
            navigationTarget: {
                addEventListener: (type, listener) => listeners.set(type, listener),
                removeEventListener: (type) => listeners.delete(type),
                location: {
                    assign: () => {
                        throw new Error("navigation failed");
                    },
                },
            },
            onNavigationConfirmed,
        })).toThrow("navigation failed");

        expect(listeners.has("pagehide")).toBe(false);
        expect(onNavigationConfirmed).not.toHaveBeenCalled();
    });
});

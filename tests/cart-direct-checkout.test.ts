import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cartState } = vi.hoisted(() => ({
    cartState: {
        items: [{
            graceSku: "TEST-SKU",
            itemName: "Test Bottle",
            quantity: 1,
            unitPrice: 2.5,
            checkoutEligible: true,
            shopifyVariantId: "gid://shopify/ProductVariant/123",
        }],
        itemCount: 1,
        isCartHydrated: true,
        removeItem: vi.fn(),
        updateQuantity: vi.fn(),
        checkout: vi.fn(),
        isCheckingOut: false,
        checkoutError: "",
    },
}));

vi.mock("@/components/CartProvider", () => ({
    useCart: () => cartState,
}));

vi.mock("@/components/useGrace", () => ({
    useGrace: () => ({ openPanel: vi.fn() }),
}));

vi.mock("@/components/Navbar", () => ({
    default: () => null,
}));

vi.mock("@/components/Footer", () => ({
    default: () => null,
}));

import CartDrawer from "../src/components/CartDrawer";
import CartPage from "../src/app/cart/page";

describe("standard cart checkout actions", () => {
    beforeEach(() => {
        cartState.items[0].quantity = 20;
        cartState.isCheckingOut = false;
        cartState.checkoutError = "";
    });

    it("renders Shopify checkout without a cart-level quote path", () => {
        const cartDrawer = renderToStaticMarkup(
            React.createElement(CartDrawer, { isOpen: true, onClose: vi.fn() }),
        );
        const cartPage = renderToStaticMarkup(React.createElement(CartPage));

        for (const markup of [cartDrawer, cartPage]) {
            expect(markup).toContain("Proceed to Checkout");
            expect(markup).not.toContain("/request-quote");
            expect(markup).not.toContain("Request Quote for This");
        }
    });

    it("blocks checkout below the combined minimum and offers another build", () => {
        cartState.items[0].quantity = 1;
        for (const markup of [renderToStaticMarkup(React.createElement(CartDrawer, { isOpen: true, onClose: vi.fn() })), renderToStaticMarkup(React.createElement(CartPage))]) {
            expect(markup).toContain("Add $47.50 more to check out.");
            expect(markup).toContain("Continue building");
            expect(markup).toMatch(/disabled=""[^>]*data-testid="(?:checkout-start-button|cart-page-checkout-button)"/);
        }
    });

    it("keeps cart contents visible while redirecting to secure checkout", () => {
        cartState.isCheckingOut = true;

        const cartDrawer = renderToStaticMarkup(
            React.createElement(CartDrawer, { isOpen: true, onClose: vi.fn() }),
        );
        const cartPage = renderToStaticMarkup(React.createElement(CartPage));

        for (const markup of [cartDrawer, cartPage]) {
            expect(markup).toContain("Redirecting to secure checkout");
            expect(markup).toContain("Test Bottle");
            expect(markup).not.toContain("Your cart is empty");
        }
    });
});

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

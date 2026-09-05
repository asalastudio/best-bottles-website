"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
} from "react";
import { analytics } from "@/lib/analytics";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";
import {
    checkoutUnavailableMessage,
    quoteOnlyCartMessage,
    redirectToCheckout,
    splitCheckoutItems,
    unavailableCheckoutMessage,
    unmatchedCheckoutMessage,
} from "@/lib/checkout";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
    graceSku: string;
    itemName: string;
    quantity: number;
    unitPrice: number | null;
    checkoutEligible?: boolean;
    shopifyVariantId?: string | null;
    /** False when Shopify will refuse the sale (DRAFT/unpublished product). */
    shopifySellable?: boolean | null;
    websiteSku?: string | null;
    variantId?: string | null;
    productGroupSlug?: string | null;
    family?: string;
    capacity?: string;
    color?: string;
    applicator?: string | null;
    capColor?: string | null;
    category?: string | null;
    neckThreadSize?: string | null;
    compatibleCount?: number;
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
    /** real 5-step ladder (site-truth); drives the cart's tier nudge */
    priceTiers?: Array<{ minQty: number; unitPrice: number }> | null;
}

/**
 * Cart unit price. Delegates to the volume-pricing policy so the cart
 * subtotal always equals what Shopify will actually charge — see
 * `src/lib/volumePricing.ts` for why tiers are display-only by default.
 */
export function resolveUnitPrice(
    quantity: number,
    prices: {
        webPrice1pc?: number | null;
        webPrice10pc?: number | null;
        webPrice12pc?: number | null;
        priceTiers?: Array<{ minQty: number; unitPrice: number }> | null;
    }
): number | null {
    return resolveChargedUnitPrice(quantity, prices);
}

interface CartContextValue {
    items: CartItem[];
    itemCount: number;
    /** False until client has read localStorage — use to avoid SSR/client cart count mismatches (hydration). */
    isCartHydrated: boolean;
    addItems: (newItems: CartItem[]) => void;
    removeItem: (graceSku: string) => void;
    updateQuantity: (graceSku: string, quantity: number) => void;
    clearCart: () => void;
    checkout: () => Promise<void>;
    isCheckingOut: boolean;
    checkoutError: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
    const ctx = useContext(CartContext);
    if (!ctx) {
        throw new Error("useCart must be used within CartProvider");
    }
    return ctx;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "bb-grace-cart";

function loadCartFromStorage(): CartItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCartToStorage(items: CartItem[]) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* quota exceeded — ignore */ }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const loaded = loadCartFromStorage();
        setItems(loaded);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) saveCartToStorage(items);
    }, [items, hydrated]);

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const addItems = useCallback((newItems: CartItem[]) => {
        setItems((prev) => {
            const updated = [...prev];
            for (const item of newItems) {
                const existing = updated.find((i) => i.graceSku === item.graceSku);
                if (existing) {
                    const combinedQty = existing.quantity + item.quantity;
                    const webPrice1pc = item.webPrice1pc ?? existing.webPrice1pc ?? existing.unitPrice;
                    const webPrice10pc = item.webPrice10pc ?? existing.webPrice10pc ?? null;
                    const webPrice12pc = item.webPrice12pc ?? existing.webPrice12pc ?? null;
                    const priceTiers = item.priceTiers ?? existing.priceTiers ?? null;
                    const shopifyVariantId = item.shopifyVariantId ?? existing.shopifyVariantId ?? null;
                    const websiteSku = item.websiteSku ?? existing.websiteSku ?? null;
                    // A synced `false` is authoritative — a DRAFT Shopify
                    // product 410s at checkout regardless of variant ID.
                    const shopifySellable = item.shopifySellable ?? existing.shopifySellable ?? undefined;
                    const checkoutEligible = shopifySellable === false
                        ? false
                        : Boolean(shopifyVariantId) || item.checkoutEligible === true || existing.checkoutEligible === true;

                    const activePrice = resolveUnitPrice(combinedQty, {
                        webPrice1pc,
                        webPrice10pc,
                        webPrice12pc,
                        priceTiers,
                    });

                    Object.assign(existing, {
                        ...existing,
                        ...item,
                        quantity: combinedQty,
                        unitPrice: activePrice,
                        checkoutEligible,
                        shopifySellable,
                        shopifyVariantId,
                        websiteSku,
                        webPrice1pc,
                        webPrice10pc,
                        webPrice12pc,
                        priceTiers,
                    });
                } else {
                    const shopifyVariantId = item.shopifyVariantId ?? null;
                    const checkoutEligible = item.shopifySellable === false
                        ? false
                        : Boolean(shopifyVariantId) || item.checkoutEligible === true;
                    const activePrice = resolveUnitPrice(item.quantity, {
                        webPrice1pc: item.webPrice1pc ?? item.unitPrice,
                        webPrice10pc: item.webPrice10pc ?? null,
                        webPrice12pc: item.webPrice12pc ?? null,
                        priceTiers: item.priceTiers ?? null,
                    });
                    updated.push({
                        ...item,
                        checkoutEligible,
                        shopifyVariantId,
                        unitPrice: activePrice,
                    });
                }
            }
            return updated;
        });
    }, []);

    const removeItem = useCallback((graceSku: string) => {
        setItems((prev) => {
            const removed = prev.find((i) => i.graceSku === graceSku);
            if (removed) analytics.cartItemRemoved({ sku: removed.graceSku, name: removed.itemName });
            return prev.filter((i) => i.graceSku !== graceSku);
        });
    }, []);

    const updateQuantity = useCallback((graceSku: string, quantity: number) => {
        if (quantity <= 0) {
            setItems((prev) => prev.filter((i) => i.graceSku !== graceSku));
        } else {
            setItems((prev) =>
                prev.map((i) => {
                    if (i.graceSku === graceSku) {
                        const activePrice = resolveUnitPrice(quantity, {
                            webPrice1pc: i.webPrice1pc ?? i.unitPrice,
                            webPrice10pc: i.webPrice10pc ?? null,
                            webPrice12pc: i.webPrice12pc ?? null,
                            priceTiers: i.priceTiers ?? null,
                        });
                        return { ...i, quantity, unitPrice: activePrice };
                    }
                    return i;
                })
            );
        }
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const checkout = useCallback(async () => {
        if (items.length === 0) return;
        let redirectStarted = false;
        setIsCheckingOut(true);
        setCheckoutError("");

        const cartTotal = items.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);
        const { checkoutReadyItems, quoteOnlyItems } = splitCheckoutItems(items);
        analytics.checkoutStarted({
            itemCount: items.length,
            cartTotal,
            skus: items.map((i) => i.graceSku).join(", "),
        });

        try {
            if (checkoutReadyItems.length === 0) {
                setCheckoutError(quoteOnlyCartMessage(quoteOnlyItems.map((i) => i.graceSku)));
                return;
            }

            const res = await fetch("/api/shopify/resolve-variants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: checkoutReadyItems.map((i) => ({
                        sku: i.graceSku,
                        websiteSku: i.websiteSku,
                        shopifyVariantId: i.shopifyVariantId,
                        quantity: i.quantity,
                    })),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error ?? "Checkout failed");
            }

            if (data.checkoutUrl) {
                const unmatched: string[] = data.unmatchedSkus ?? [];
                const unavailable: string[] = data.unavailableSkus ?? [];
                const quoteOnly = quoteOnlyItems.map((i) => i.graceSku);
                const checkoutUrl = String(data.checkoutUrl);
                let checkoutHost: string | undefined;
                try {
                    checkoutHost = new URL(checkoutUrl).host;
                } catch {
                    checkoutHost = undefined;
                }

                analytics.checkoutRedirected({
                    itemCount: items.length,
                    cartTotal,
                    skus: items.map((i) => i.graceSku).join(", "),
                    matchedItemCount: Math.max(0, checkoutReadyItems.length - unmatched.length - unavailable.length),
                    unmatchedCount: unmatched.length + unavailable.length + quoteOnly.length,
                    checkoutProvider: "shopify",
                    checkoutHost,
                });
                const warnings = [
                    unmatched.length > 0 ? unmatchedCheckoutMessage(unmatched) : "",
                    unavailable.length > 0 ? unavailableCheckoutMessage(unavailable) : "",
                    quoteOnly.length > 0 ? quoteOnlyCartMessage(quoteOnly) : "",
                ].filter(Boolean);
                if (warnings.length > 0) {
                    setCheckoutError(`${warnings.join(" ")} Removed those SKUs from this checkout and opened Shopify for the verified items.`);
                }
                redirectToCheckout({
                    checkoutUrl,
                    navigationTarget: window,
                    onNavigationConfirmed: () => saveCartToStorage([]),
                });
                redirectStarted = true;
            } else if (data.unmatchedSkus?.length) {
                setCheckoutError(unmatchedCheckoutMessage(data.unmatchedSkus));
            } else if (data.unavailableSkus?.length) {
                setCheckoutError(unavailableCheckoutMessage(data.unavailableSkus));
            } else {
                setCheckoutError(checkoutUnavailableMessage());
            }
        } catch (err) {
            console.error("[Cart] Checkout error:", err);
            const message = err instanceof Error ? err.message : "";
            analytics.checkoutFailed({ error: message || "unknown", itemCount: items.length });
            if (
                message.includes("not configured") ||
                message.includes("503") ||
                message.includes("Access denied") ||
                message.includes("502")
            ) {
                setCheckoutError(checkoutUnavailableMessage());
            } else {
                setCheckoutError(
                    message || "Checkout failed. Please try again or contact sales@bestbottles.com."
                );
            }
        } finally {
            if (!redirectStarted) setIsCheckingOut(false);
        }
    }, [items]);

    return (
        <CartContext.Provider
            value={{
                items,
                itemCount,
                isCartHydrated: hydrated,
                addItems,
                removeItem,
                updateQuantity,
                clearCart,
                checkout,
                isCheckingOut,
                checkoutError,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

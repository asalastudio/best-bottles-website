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
import {
    checkoutUnavailableMessage,
    quoteOnlyCartMessage,
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
    family?: string;
    capacity?: string;
    color?: string;
    applicator?: string | null;
    capColor?: string | null;
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
                    Object.assign(existing, {
                        ...existing,
                        ...item,
                        quantity: existing.quantity + item.quantity,
                    });
                } else {
                    updated.push({ ...item });
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
                prev.map((i) => (i.graceSku === graceSku ? { ...i, quantity } : i))
            );
        }
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const checkout = useCallback(async () => {
        if (items.length === 0) return;
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
                    setCheckoutError(`${warnings.join(" ")} Checkout opened for the verified items.`);
                } else {
                    clearCart();
                }
                window.location.assign(checkoutUrl);
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
            setIsCheckingOut(false);
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

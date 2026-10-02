"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppLocale } from "@/i18n/useCopy";
import { localizeHref } from "@/i18n/paths";
import { CART_SHOPPING_RETURN_KEY, validateShoppingReturn } from "@/lib/cartShoppingReturn";

const CHANGE_EVENT = "bb-cart-shopping-return-change";

function readReturnPath() {
    try {
        return validateShoppingReturn(window.sessionStorage.getItem(CART_SHOPPING_RETURN_KEY));
    } catch {
        return null;
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Records browsing within this tab; cart, account, auth and external routes never overwrite it. */
export function CartShoppingTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    useEffect(() => {
        try {
            const stored = window.sessionStorage.getItem(CART_SHOPPING_RETURN_KEY);
            // Hash-only changes intentionally have no effect: fragments are never
            // recorded, and legacy stored queries/fragments are sanitized here.
            const path = validateShoppingReturn(`${pathname}${searchParams.size ? `?${searchParams}` : ""}`)
                ?? validateShoppingReturn(stored);
            if (path === stored) return;
            if (path) window.sessionStorage.setItem(CART_SHOPPING_RETURN_KEY, path);
            else window.sessionStorage.removeItem(CART_SHOPPING_RETURN_KEY);
            window.dispatchEvent(new Event(CHANGE_EVENT));
        } catch {
            // Storage may be unavailable; the cart still offers the catalog fallback.
        }
    }, [pathname, searchParams]);
    return null;
}

export function useCartShoppingReturn() {
    const locale = useAppLocale();
    const path = useSyncExternalStore(subscribe, readReturnPath, () => null);
    return path ?? localizeHref(locale, "/catalog");
}

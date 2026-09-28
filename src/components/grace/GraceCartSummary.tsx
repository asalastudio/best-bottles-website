"use client";
import LocaleLink from "@/components/LocaleLink";
import { useCart } from "@/components/CartProvider";
import { checkoutMinimum, ORDER_MINIMUM, splitCheckoutItems } from "@/lib/checkout";
import { useGraceRedesignCopy } from "./redesignCopy";
import styles from "./GraceShop.module.css";

export default function GraceCartSummary({ onNavigate }: { onNavigate: () => void }) {
    const { items, itemCount, checkout, isCheckingOut, checkoutError } = useCart();
    const c = useGraceRedesignCopy();
    if (!items.length) return null;
    const progress = checkoutMinimum(items);
    const { quoteOnlyItems } = splitCheckoutItems(items);
    return <div className={styles.cartSummary}>
        <div><strong>{c.cart}</strong> · {items.length} {c.lines} · {itemCount} {c.pieces} · ${progress.subtotal.toFixed(2)}</div>
        <progress aria-label={progress.met ? c.minimumMet : `$${progress.remaining.toFixed(2)} ${c.minimumMore}`} value={Math.min(progress.subtotal, ORDER_MINIMUM)} max={ORDER_MINIMUM} />
        <p>{progress.met ? c.minimumMet : `$${progress.remaining.toFixed(2)} ${c.minimumMore}`}</p>
        {quoteOnlyItems.length > 0 && <p>{c.quoteOnly}</p>}
        <div className={styles.cartActions}>
            <LocaleLink href="/cart" onClick={onNavigate}>{c.viewCart}</LocaleLink>
            <button type="button" onClick={() => void checkout()} disabled={!progress.met || !!quoteOnlyItems.length || isCheckingOut}>{isCheckingOut ? c.checkingOut : c.checkout}</button>
        </div>
        {checkoutError && <p role="alert">{checkoutError}</p>}
    </div>;
}

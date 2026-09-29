"use client";

import { useId, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Check, LockSimple, Minus, Plus, ShoppingBag, X } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCart, type CartItem } from "@/components/CartProvider";
import { useRegion } from "@/components/RegionProvider";
import { checkoutMinimum, isCheckoutReady, ORDER_MINIMUM } from "@/lib/checkout";
import { getProductHero } from "@/lib/products/catalog-heroes";
import styles from "./WorkspaceCart.module.css";

function needsReview(item: CartItem) {
    return !isCheckoutReady(item) || item.unitPrice == null || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0
        || !Number.isSafeInteger(item.quantity) || item.quantity < 1;
}

function CartProduct({ item, busy, onRemove }: { item: CartItem; busy: boolean; onRemove: () => void }) {
    const { formatPrice } = useRegion();
    const { updateQuantity } = useCart();
    const lookup = useQuery(api.products.lookupSku, { sku: item.websiteSku || item.graceSku });
    // The displayed photo and link must identify the actual assembly in this cart.
    const exact = lookup?.product.graceSku === item.graceSku
        && (!item.websiteSku || lookup.product.websiteSku === item.websiteSku) ? lookup : null;
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const hero = getProductHero(item.websiteSku || exact?.product.websiteSku);
    const image = [exact?.product.imageUrl, hero?.url].find(url => url && !failedImages.includes(url));
    const href = exact?.slug
        ? `/products/${encodeURIComponent(exact.slug)}?sku=${encodeURIComponent(exact.product.websiteSku)}`
        : `/catalog?search=${encodeURIComponent(item.websiteSku || item.graceSku)}`;
    const [draft, setDraft] = useState<string | null>(null);
    const [quantityError, setQuantityError] = useState("");
    const quantityId = useId();
    const commitQuantity = () => {
        if (draft === null) return;
        const quantity = Number(draft);
        if (!/^\d+$/.test(draft) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
            setQuantityError("Use a whole number from 1 to 100,000. Your quantity hasn’t changed.");
        } else {
            updateQuantity(item.graceSku, quantity);
            setQuantityError("");
        }
        setDraft(null);
    };
    const blocked = needsReview(item);
    return <article className={styles.product} aria-label={item.itemName}>
        <div className={styles.productTop}>
            <Link href={href} className={styles.thumbnail} aria-label={`View ${item.itemName}`} tabIndex={busy ? -1 : undefined}>
                {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- exact-SKU sources with an explicit fallback
                    <img src={image} alt={item.itemName} width={88} height={100} onError={() => setFailedImages(previous => [...previous, image])} />
                ) : <span>Image unavailable</span>}
            </Link>
            <div className={styles.productDetails}>
                <Link href={href} className={styles.productName}>{item.itemName}</Link>
                <p className={styles.options}>{[item.capColor, item.neckThreadSize && `${item.neckThreadSize} neck`].filter(Boolean).join(" · ")}</p>
                <p className={styles.sku}>SKU {item.websiteSku || item.graceSku}</p>
                {blocked && <p className={styles.reviewLabel}>Needs review before checkout</p>}
                <button type="button" className={styles.remove} disabled={busy} onClick={onRemove} aria-label={`Remove ${item.itemName}`}>Remove</button>
            </div>
        </div>
        <div className={styles.lineBottom}>
            <div>
                <label className={styles.quantityLabel} htmlFor={quantityId}>Quantity <span>(pieces)</span></label>
                <div className={styles.quantity}>
                    <button type="button" disabled={busy || item.quantity <= 1} onClick={() => updateQuantity(item.graceSku, item.quantity - 1)} aria-label={`Decrease quantity for ${item.itemName}`}><Minus size={15} /></button>
                    <input id={quantityId} aria-label={`Quantity for ${item.itemName}`} aria-describedby={quantityError ? `${quantityId}-error` : undefined} inputMode="numeric" pattern="[0-9]*" value={draft ?? String(item.quantity)} disabled={busy}
                        onChange={event => setDraft(event.target.value)} onBlur={commitQuantity}
                        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
                    <button type="button" disabled={busy || item.quantity >= 100000} onClick={() => updateQuantity(item.graceSku, item.quantity + 1)} aria-label={`Increase quantity for ${item.itemName}`}><Plus size={15} /></button>
                </div>
            </div>
            <div className={styles.linePrice}>
                <span>{item.unitPrice != null ? `${formatPrice(item.unitPrice)} / piece` : "Price pending"}</span>
                <strong>{item.unitPrice != null ? formatPrice(Math.round(item.unitPrice * 100) * item.quantity / 100) : "—"}</strong>
            </div>
        </div>
        {quantityError && <p id={`${quantityId}-error`} className={styles.error} role="alert">{quantityError}</p>}
    </article>;
}

export default function WorkspaceCart({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { items, itemCount, isCartHydrated, removeItem, addItems, checkout, isCheckingOut, checkoutError } = useCart();
    const { formatPrice, estimate } = useRegion();
    const [removed, setRemoved] = useState<CartItem | null>(null);
    const minimum = checkoutMinimum(items);
    const blocked = items.filter(needsReview);
    const canCheckout = isCartHydrated && items.length > 0 && minimum.met && blocked.length === 0 && !isCheckingOut;
    return <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Trigger asChild>
            <button type="button" className={styles.trigger} aria-label={`Open cart, ${items.length} ${items.length === 1 ? "product" : "products"}, ${itemCount} pieces`}>
                <ShoppingBag size={18} /><span>Cart</span><span className={styles.count}>{items.length}</span>
                {items.length > 0 && <span className={styles.triggerTotal}>{formatPrice(minimum.subtotal)}</span>}
            </button>
        </Dialog.Trigger>
        <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content className={styles.panel} aria-describedby="workspace-cart-description">
                <header className={styles.header}>
                    <Dialog.Close asChild><button type="button" className={styles.back}><ArrowLeft size={17} /> Back to Grace</button></Dialog.Close>
                    <Dialog.Close asChild><button type="button" className={styles.close} aria-label="Close cart"><X size={20} /></button></Dialog.Close>
                    <div className={styles.headingRow}><Dialog.Title className={styles.title}>Your cart</Dialog.Title><span>{items.length} {items.length === 1 ? "product" : "products"} · {itemCount} pieces</span></div>
                    <Dialog.Description id="workspace-cart-description" className={styles.description}>Review your selections. Your conversation stays right here.</Dialog.Description>
                </header>
                {removed && <div className={styles.undo} role="status"><span>Removed {removed.itemName}.</span><button type="button" disabled={isCheckingOut} onClick={() => { addItems([removed]); setRemoved(null); }}>Undo</button></div>}
                <div className={styles.body}>
                    {!isCartHydrated ? <p className={styles.empty}>Loading your cart…</p> : items.length === 0 ? (
                        <div className={styles.empty}>
                            <ShoppingBag size={42} weight="light" />
                            <h3>Start with a bottle.</h3>
                            <p>Ask Grace for a recommendation or browse the catalog. Your selections will appear here.</p>
                            <Dialog.Close asChild><button type="button" className={styles.primary}>Keep chatting with Grace <ArrowRight size={17} /></button></Dialog.Close>
                            <Link href="/catalog?scope=all" className={styles.browse}>Browse all products</Link>
                        </div>
                    ) : items.map(item => <CartProduct key={item.graceSku} item={item} busy={isCheckingOut} onRemove={() => { setRemoved({ ...item }); removeItem(item.graceSku); }} />)}
                </div>
                {items.length > 0 && <footer className={styles.footer}>
                    <div className={styles.subtotal}><span>{blocked.length ? "Checkout-ready subtotal" : "Subtotal"}</span><strong>{formatPrice(minimum.subtotal)}</strong></div>
                    <div className={styles.minimum}>
                        <p role="status">{minimum.met ? <><Check size={15} /> Order minimum reached</> : <>Add <strong>{formatPrice(minimum.remaining)}</strong> to reach the {estimate ? "$50 USD" : formatPrice(ORDER_MINIMUM)} minimum</>}</p>
                        <progress aria-label="Progress toward the $50 order minimum" value={Math.min(minimum.subtotal, ORDER_MINIMUM)} max={ORDER_MINIMUM} />
                    </div>
                    {blocked.length > 0 && <p className={styles.reviewNotice} role="status">{blocked.length} {blocked.length === 1 ? "product needs" : "products need"} review. Remove {blocked.length === 1 ? "it" : "them"} to continue, or <Link href="/contact">contact us</Link> for help.</p>}
                    {checkoutError && <p className={styles.error} role="alert">{checkoutError}</p>}
                    <p className={styles.finePrint}>{estimate ? "Converted estimates. Checkout is in USD. " : ""}Shipping and tax calculated at checkout.</p>
                    <button type="button" className={styles.primary} disabled={!canCheckout} onClick={() => void checkout()}><LockSimple size={17} />{isCheckingOut ? "Opening secure checkout…" : "Continue to checkout"}<ArrowRight size={17} /></button>
                    <Dialog.Close asChild><button type="button" className={styles.keepShopping}>Keep shopping with Grace</button></Dialog.Close>
                </footer>}
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}

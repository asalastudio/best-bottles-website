"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/components/CartProvider";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash, WarningCircle } from "@/components/icons";
import { isCheckoutReady, splitCheckoutItems } from "@/lib/checkout";

export default function CartPage() {
    const {
        items,
        itemCount,
        isCartHydrated,
        removeItem,
        updateQuantity,
        checkout,
        isCheckingOut,
        checkoutError,
    } = useCart();

    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
    const { checkoutReadyItems, quoteOnlyItems } = splitCheckoutItems(items);
    const quoteProducts = items.map((i) => `${i.itemName} (SKU: ${i.graceSku}, x${i.quantity})`).join(", ");
    const quoteQuantities = items.map((i) => `${i.graceSku}: ${i.quantity}`).join(", ");

    return (
        <main className="min-h-screen bg-bone">
            <Navbar hideMobileSearch />
            <section className="mx-auto max-w-[1180px] px-4 pb-16 pt-[116px] sm:px-6 sm:pt-[160px] lg:pt-[136px]">
                <div className="mb-8 flex flex-col gap-3 border-b border-champagne/50 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-gold">Order Review</p>
                        <h1 className="font-serif text-4xl font-medium text-obsidian">Your Cart</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
                            Review SKUs, quantities, and pricing before checkout. Shopify verifies checkout availability and final pricing when you proceed.
                        </p>
                    </div>
                    <Link href="/catalog" className="text-sm font-semibold text-obsidian underline underline-offset-4 hover:text-muted-gold">
                        Continue browsing
                    </Link>
                </div>

                {!isCartHydrated ? (
                    <div className="rounded-sm border border-champagne/50 bg-white px-6 py-16 text-center">
                        <ShoppingBag className="mx-auto mb-4 text-champagne" size={42} />
                        <p className="font-serif text-xl text-obsidian">Loading your cart</p>
                        <p className="mt-2 text-sm text-slate">Checking saved cart items on this device.</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-sm border border-champagne/50 bg-white px-6 py-16 text-center">
                        <ShoppingBag className="mx-auto mb-4 text-champagne" size={42} />
                        <p className="font-serif text-2xl text-obsidian">Your cart is empty</p>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate">
                            Browse the catalog or ask Grace to help you find a bottle, cap, or complete packaging set.
                        </p>
                        <Link href="/catalog" className="mt-6 inline-flex items-center justify-center bg-obsidian px-6 py-3 text-xs font-bold uppercase tracking-widest text-bone hover:bg-muted-gold">
                            Browse Catalog
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
                        <div className="space-y-3">
                            {items.map((item) => (
                                <article key={item.graceSku} className="rounded-sm border border-champagne/50 bg-white p-4 sm:p-5">
                                    <div className="flex gap-4">
                                        <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-sm border border-champagne/40 bg-bone sm:flex">
                                            <ShoppingBag className="text-champagne" size={28} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h2 className="font-serif text-xl font-medium leading-snug text-obsidian">{item.itemName}</h2>
                                                    <p className="mt-1 text-xs uppercase tracking-wider text-slate">SKU {item.graceSku}</p>
                                                    <p className="mt-2 text-sm text-slate">
                                                        {[item.family, item.capacity, item.color, item.applicator, item.capColor].filter(Boolean).join(" · ") || "Product details pending"}
                                                    </p>
                                                    {!isCheckoutReady(item) && (
                                                        <p className="mt-2 inline-flex rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                                            Quote required before checkout
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeItem(item.graceSku)}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate hover:bg-red-50 hover:text-red-600"
                                                    aria-label={`Remove ${item.itemName}`}
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex w-fit items-center overflow-hidden rounded-sm border border-champagne/60 bg-bone/40">
                                                    <button
                                                        onClick={() => updateQuantity(item.graceSku, item.quantity - 1)}
                                                        className="flex h-11 w-11 items-center justify-center text-obsidian hover:bg-white"
                                                        aria-label={`Decrease quantity for ${item.itemName}`}
                                                    >
                                                        <Minus size={13} />
                                                    </button>
                                                    <span className="min-w-10 text-center text-sm font-semibold text-obsidian">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.graceSku, item.quantity + 1)}
                                                        className="flex h-11 w-11 items-center justify-center text-obsidian hover:bg-white"
                                                        aria-label={`Increase quantity for ${item.itemName}`}
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                </div>
                                                <div className="text-left sm:text-right">
                                                    {item.unitPrice != null ? (
                                                        <>
                                                            <p className="text-xs text-slate">${item.unitPrice.toFixed(2)} ea</p>
                                                            <p className="font-serif text-2xl font-medium text-obsidian">
                                                                ${(item.unitPrice * item.quantity).toFixed(2)}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <p className="text-sm font-semibold text-slate">Quote pricing</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <aside className="h-fit rounded-sm border border-champagne/50 bg-white p-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">Summary</p>
                            <div className="mt-4 flex items-center justify-between border-b border-champagne/40 pb-4">
                                <span className="text-sm text-slate">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
                                <span className="font-serif text-3xl font-medium text-obsidian">${subtotal.toFixed(2)}</span>
                            </div>
                            <p className="mt-4 text-xs leading-relaxed text-slate">
                                {quoteOnlyItems.length > 0
                                    ? checkoutReadyItems.length > 0
                                        ? `Shopify checkout will use ${checkoutReadyItems.length} verified item${checkoutReadyItems.length === 1 ? "" : "s"} and remove ${quoteOnlyItems.length} quote-only item${quoteOnlyItems.length === 1 ? "" : "s"} from this checkout.`
                                        : "This cart needs a quote before Shopify checkout."
                                    : "Online checkout verifies Shopify variants before redirecting."}
                            </p>
                            {checkoutError && (
                                <div className="mt-4 flex gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
                                    <WarningCircle className="mt-0.5 shrink-0" size={14} />
                                    <p>{checkoutError}</p>
                                </div>
                            )}
                            <button
                                onClick={checkout}
                                disabled={isCheckingOut}
                                data-testid="cart-page-checkout-button"
                                className="mt-5 flex w-full items-center justify-center gap-2 bg-obsidian px-5 py-4 text-sm font-semibold text-bone hover:bg-muted-gold disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <span>{isCheckingOut ? "Preparing Checkout..." : "Proceed to Checkout"}</span>
                                <ArrowRight size={16} />
                            </button>
                            <Link
                                href={`/request-quote?products=${encodeURIComponent(quoteProducts)}&quantities=${encodeURIComponent(quoteQuantities)}`}
                                className="mt-3 flex w-full items-center justify-center border border-obsidian px-5 py-3 text-sm font-semibold text-obsidian hover:bg-obsidian hover:text-bone"
                            >
                                Request Quote for This Cart
                            </Link>
                        </aside>
                    </div>
                )}
            </section>
            <Footer />
        </main>
    );
}

"use client";

import { useRegion } from "@/components/RegionProvider";
import { ORDER_MINIMUM, type checkoutMinimum } from "@/lib/checkout";

export default function CartMinimumNotice({ id, minimum, hasQuoteItems }: {
    id: string;
    minimum: ReturnType<typeof checkoutMinimum>;
    hasQuoteItems: boolean;
}) {
    const { formatPrice, estimate } = useRegion();
    return (
        <div id={id} role="status" aria-atomic="true" className="mb-3 rounded-sm border border-champagne/50 bg-bone/60 px-3 py-3 text-sm leading-relaxed text-obsidian">
            <p className="font-semibold">
                {minimum.met
                    ? `${formatPrice(ORDER_MINIMUM)} order minimum met.`
                    : `Add ${formatPrice(minimum.remaining)} more to check out.`}
            </p>
            <p className="mt-1 text-xs text-slate">
                {minimum.met ? "Checkout-ready subtotal: " : `Checkout requires a ${formatPrice(ORDER_MINIMUM)} minimum. Checkout-ready subtotal: `}
                {formatPrice(minimum.subtotal)}.
                {hasQuoteItems && " Quote-only items do not count toward the minimum."}
                {estimate && ` Displayed amounts are estimates; the minimum is $${ORDER_MINIMUM} USD and checkout is in USD.`}
            </p>
        </div>
    );
}

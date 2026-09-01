import "server-only";

import type { CheckoutLineItem } from "@/lib/shopify";
import { createWholesaleDraftOrder } from "@/lib/shopify-draft-orders";
import { api } from "../../../convex/_generated/api";
import { getPortalConvex } from "./convexClient";
import { ensurePortalShopifyCustomer, getPortalViewer } from "./server";

/**
 * Wholesale checkout: a Shopify draft order carrying the account's customer.
 *
 * Returns null whenever a wholesale checkout is not possible — signed out, no
 * portal account, missing scope, Shopify down. The caller then falls back to the
 * anonymous cart permalink, so the worst outcome is a buyer paying tax they
 * could have avoided. NOTHING here may block a purchase; that is the rule the
 * whole feature is built on.
 */
export async function resolveWholesaleCheckoutUrl(
    items: CheckoutLineItem[],
): Promise<{ checkoutUrl: string; draftOrderId: string; totalTax: string } | null> {
    try {
        const viewer = await getPortalViewer();
        if (!viewer.clerkOrgId) return null;

        const identity = await ensurePortalShopifyCustomer();
        if (identity.status !== "linked") return null;

        const account = await getPortalConvex().query(api.portal.getAccountByOrg, {
            clerkOrgId: viewer.clerkOrgId,
        });

        const draft = await createWholesaleDraftOrder({
            customerId: identity.shopifyCustomerId,
            // Prices are deliberately omitted: `priceOverride` is what the buyer
            // is charged, and the only prices available here came from the
            // browser. Tier pricing must be resolved server-side from Convex
            // before it can be passed.
            lines: items.map((item) => ({
                variantId: item.variantId,
                quantity: item.quantity,
            })),
            accountNumber: account?.accountNumber,
            companyName: account?.companyName,
        });

        return {
            checkoutUrl: draft.invoiceUrl,
            draftOrderId: draft.draftOrderId,
            totalTax: draft.totalTax,
        };
    } catch (err) {
        console.error("[wholesaleCheckout] falling back to anonymous checkout:", err);
        return null;
    }
}

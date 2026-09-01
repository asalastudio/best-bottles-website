/**
 * Wholesale checkout via Shopify draft orders.
 *
 * A cart permalink is anonymous, and Shopify applies tax exemption to a CUSTOMER
 * RECORD — so an approved resale certificate can only take effect if the order
 * carries the customer. A draft order is the one checkout path that attaches one
 * without requiring the buyer to hold a Shopify login.
 *
 * `purchasingEntity` also accepts a `purchasingCompany`, so moving to Shopify B2B
 * later changes this field's contents rather than this whole approach.
 */

import { adminGraphQL } from "./shopify";

export interface DraftOrderLine {
    /** Numeric Shopify variant ID. */
    variantId: string;
    quantity: number;
    /**
     * Server-derived unit price, in shop currency. NEVER pass a price supplied
     * by the browser: `priceOverride` is what the customer is charged, so a
     * client-controlled value is a way to buy at any price.
     */
    unitPrice?: number;
}

export interface WholesaleDraftOrder {
    draftOrderId: string;
    name: string;
    invoiceUrl: string;
    totalPrice: string;
    totalTax: string;
    currencyCode: string;
}

export class DraftOrderScopeError extends Error {
    readonly requiredScope = "write_draft_orders";
    constructor() {
        super(
            "Shopify Admin token lacks 'write_draft_orders' (needed for draftOrderCreate). " +
                "Widen the Custom App's scopes in the Shopify admin and reinstall.",
        );
        this.name = "DraftOrderScopeError";
    }
}

function isScopeDenial(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /access denied|write_draft_orders|403/i.test(message);
}

export interface CreateDraftOrderInput {
    /** Numeric Shopify customer ID from the identity bridge. */
    customerId: string;
    lines: DraftOrderLine[];
    /** Best Bottles account number, for finding the order in the Shopify admin. */
    accountNumber?: string;
    companyName?: string;
    currencyCode?: string;
}

export async function createWholesaleDraftOrder(
    input: CreateDraftOrderInput,
): Promise<WholesaleDraftOrder> {
    if (input.lines.length === 0) throw new Error("draft_order_requires_line_items");

    const tags = ["best-bottles-portal"];
    if (input.accountNumber) tags.push(`account:${input.accountNumber}`);

    const lineItems = input.lines.map((line) => ({
        variantId: `gid://shopify/ProductVariant/${line.variantId}`,
        quantity: line.quantity,
        ...(typeof line.unitPrice === "number"
            ? {
                  priceOverride: {
                      amount: line.unitPrice.toFixed(2),
                      currencyCode: input.currencyCode ?? "USD",
                  },
              }
            : {}),
    }));

    let data: {
        draftOrderCreate: {
            draftOrder: {
                id: string;
                name: string;
                invoiceUrl: string | null;
                totalPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null;
                totalTaxSet: { shopMoney: { amount: string } } | null;
            } | null;
            userErrors: Array<{ field: string[] | null; message: string }>;
        };
    };

    try {
        data = await adminGraphQL(
            `mutation CreateWholesaleDraftOrder($input: DraftOrderInput!) {
                draftOrderCreate(input: $input) {
                    draftOrder {
                        id
                        name
                        invoiceUrl
                        totalPriceSet { shopMoney { amount currencyCode } }
                        totalTaxSet { shopMoney { amount } }
                    }
                    userErrors { field message }
                }
            }`,
            {
                input: {
                    purchasingEntity: {
                        customerId: `gid://shopify/Customer/${input.customerId}`,
                    },
                    lineItems,
                    tags,
                    note: input.companyName
                        ? `Best Bottles wholesale portal — ${input.companyName}`
                        : "Best Bottles wholesale portal",
                    // False defers to the CUSTOMER's tax settings, which is where
                    // an approved resale certificate lives. Forcing true here
                    // would exempt every portal order, approved or not.
                    taxExempt: false,
                    useCustomerDefaultAddress: true,
                },
            },
        );
    } catch (err) {
        if (isScopeDenial(err)) throw new DraftOrderScopeError();
        throw err;
    }

    const { draftOrder, userErrors } = data.draftOrderCreate;
    if (userErrors.length) {
        throw new Error(
            `Shopify draftOrderCreate rejected: ${userErrors
                .map((e) => `${(e.field ?? []).join(".") || "input"}: ${e.message}`)
                .join("; ")}`,
        );
    }
    if (!draftOrder) throw new Error("Shopify draftOrderCreate returned no draft order.");
    if (!draftOrder.invoiceUrl) {
        // Without this the buyer has nothing to pay against; treat it as a
        // failure so the caller can fall back rather than redirect nowhere.
        throw new Error("Shopify draft order has no invoice URL.");
    }

    return {
        draftOrderId: draftOrder.id,
        name: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl,
        totalPrice: draftOrder.totalPriceSet?.shopMoney.amount ?? "0.00",
        totalTax: draftOrder.totalTaxSet?.shopMoney.amount ?? "0.00",
        currencyCode: draftOrder.totalPriceSet?.shopMoney.currencyCode ?? "USD",
    };
}

/**
 * Orders placed while a resale certificate was awaiting review.
 *
 * Matched by EMAIL, not customer id: today's checkout builds an anonymous cart
 * permalink, so an order placed before the identity bridge ran carries no
 * customer record at all. The email the buyer typed at checkout is the only
 * thing linking those orders to an account.
 */

import { adminGraphQL } from "./shopify";
import { normalizeCustomerEmail, buildEmailSearchQuery } from "./shopify-customers";

export interface TaxedOrder {
    orderId: string;
    name: string;
    createdAt: string;
    /** Sales tax charged, in shop currency. */
    tax: number;
    total: number;
    alreadyRefunded: number;
    currencyCode: string;
}

export interface PendingWindowOrders {
    orders: TaxedOrder[];
    /** Total sales tax charged across the window. */
    taxTotal: number;
    currencyCode: string;
}

const EMPTY: PendingWindowOrders = { orders: [], taxTotal: 0, currencyCode: "USD" };

function money(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Orders for `email` placed on or after `since`, that actually carried tax.
 *
 * Untaxed orders are dropped — they are noise on a screen whose only question is
 * "how much tax did this customer pay while we were reviewing?".
 */
export async function listTaxedOrdersForEmailSince(
    email: string | null | undefined,
    since: number,
): Promise<PendingWindowOrders> {
    const normalized = normalizeCustomerEmail(email);
    if (!normalized) return EMPTY;

    // Shopify's order search takes an ISO date; the window opens the day the
    // certificate was submitted.
    const sinceDate = new Date(since).toISOString().slice(0, 10);
    const query = `${buildEmailSearchQuery(normalized)} AND created_at:>=${sinceDate}`;

    const data = await adminGraphQL<{
        orders: {
            edges: Array<{
                node: {
                    id: string;
                    name: string;
                    createdAt: string;
                    totalTaxSet: { shopMoney: { amount: string; currencyCode: string } } | null;
                    totalPriceSet: { shopMoney: { amount: string } } | null;
                    totalRefundedSet: { shopMoney: { amount: string } } | null;
                };
            }>;
        };
    }>(
        `query PendingWindowOrders($query: String!) {
            orders(first: 50, query: $query, sortKey: CREATED_AT) {
                edges {
                    node {
                        id
                        name
                        createdAt
                        totalTaxSet { shopMoney { amount currencyCode } }
                        totalPriceSet { shopMoney { amount } }
                        totalRefundedSet { shopMoney { amount } }
                    }
                }
            }
        }`,
        { query },
    );

    const orders: TaxedOrder[] = [];
    let currencyCode = "USD";

    for (const { node } of data.orders.edges) {
        const tax = money(node.totalTaxSet?.shopMoney.amount);
        if (tax <= 0) continue;

        currencyCode = node.totalTaxSet?.shopMoney.currencyCode ?? currencyCode;
        orders.push({
            orderId: node.id,
            name: node.name,
            createdAt: node.createdAt,
            tax,
            total: money(node.totalPriceSet?.shopMoney.amount),
            alreadyRefunded: money(node.totalRefundedSet?.shopMoney.amount),
            currencyCode,
        });
    }

    return {
        orders,
        taxTotal: orders.reduce((sum, order) => sum + order.tax, 0),
        currencyCode,
    };
}

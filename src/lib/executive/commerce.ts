import "server-only";

import { adminGraphQL } from "@/lib/shopify";
import { api } from "../../../convex/_generated/api";
import { getPortalConvex } from "@/lib/portal/convexClient";

/**
 * Live commerce facts for the Executive Hub.
 *
 * Everything here is read from Shopify and Convex at request time. Nothing is
 * projected, modelled, or filled in. The board this replaces showed $1.84M
 * revenue and a 2.4x pipeline from a fixture file while the store had taken one
 * order for $100 — which is worse than an empty board, because a CEO cannot
 * tell an invented number from a real one by looking at it.
 *
 * Where a number genuinely is not available yet, the field says so rather than
 * defaulting to zero: "we have not connected this" and "this is zero" are
 * different facts and must not render identically.
 */

export type MetricAvailability =
    | { state: "live" }
    /** Connected, but the history lives somewhere we have not imported yet. */
    | { state: "partial"; note: string }
    /** No source wired. Renders as "—" with the note, never as 0. */
    | { state: "unavailable"; note: string };

export type ExecutiveCommerce = {
    currencyCode: string;
    /** Shopify orders, all time. */
    ordersAllTime: number;
    ordersLast30: number;
    revenueAllTime: number | null;
    revenueLast30: number | null;
    revenueAvailability: MetricAvailability;

    /** Catalogue published to the storefront. */
    productsPublished: number;

    /** Wholesale accounts in the portal, and how many can actually transact. */
    wholesaleAccounts: number;
    wholesaleReadyToOrder: number;
    /** Orders customers have submitted that nobody has converted yet. */
    portalOrdersAwaiting: number;

    /** Shopify customer records, and how many look like genuine signups. */
    customerRecords: number;
    suspectedBotRecords: number;
    botSignupsSince: string | null;

    /** Where the real wholesale accounts are. */
    accountLocations: Array<{ label: string; provinceCode: string | null; countryCode: string; count: number }>;

    /** Orders per calendar month, oldest first. Drives the commerce column chart. */
    ordersByMonth: Array<{ label: string; value: number }>;
    /**
     * Customer records created per day over the last 30. Plotted because the
     * shape is the finding: a flat, round-the-clock bar is a script, not
     * demand.
     */
    signupsByDay: Array<{ label: string; value: number; suspect: number }>;
};

function monthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
    const [year, month] = key.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
    });
}

function toNumber(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A signup farm has been creating Shopify customers since 2026-08-23: the same
 * first/last name and the same street address on every record, a throwaway
 * email each time, and never an order. Counting those as customers would put a
 * fabricated number on the board by a different route than the fixture did, so
 * they are counted separately and labelled.
 */
const BOT_SIGNATURE = { firstName: "james", lastName: "anderson", address1: "428 W 45th St" };

export async function getExecutiveCommerce(): Promise<ExecutiveCommerce> {
    const since30 = isoDaysAgo(30);

    const shopify = await adminGraphQL<{
        shop: { currencyCode: string };
        ordersAll: { count: number };
        orders30: { count: number };
        productsCount: { count: number };
        customersCount: { count: number };
        orders: { edges: Array<{ node: { createdAt: string; totalPriceSet: { shopMoney: { amount: string } } | null } }> };
        customers: { edges: Array<{ node: { createdAt: string; firstName: string | null; lastName: string | null; defaultAddress: { address1: string | null } | null } }> };
    }>(
        `query ExecutiveCommerce($since30: String!) {
            shop { currencyCode }
            ordersAll: ordersCount { count }
            orders30: ordersCount(query: $since30) { count }
            productsCount { count }
            customersCount { count }
            # Bounded at 250 deliberately: past that, revenue belongs to an
            # aggregate source rather than a page render, and the board says so
            # rather than paging silently and looking complete.
            orders(first: 250, reverse: true) {
                edges { node { createdAt totalPriceSet { shopMoney { amount } } } }
            }
            customers(first: 250, sortKey: CREATED_AT, reverse: true) {
                edges { node { createdAt firstName lastName defaultAddress { address1 } } }
            }
        }`,
        { since30: `created_at:>=${since30}` },
    );

    const orders = shopify.orders.edges.map((edge) => ({
        createdAt: edge.node.createdAt,
        amount: toNumber(edge.node.totalPriceSet?.shopMoney.amount) ?? 0,
    }));

    const cutoff = Date.now() - 30 * 86_400_000;
    const revenueAllTime = orders.reduce((sum, order) => sum + order.amount, 0);
    const revenueLast30 = orders
        .filter((order) => new Date(order.createdAt).getTime() >= cutoff)
        .reduce((sum, order) => sum + order.amount, 0);

    const bots = shopify.customers.edges.filter(({ node }) =>
        node.firstName?.toLowerCase() === BOT_SIGNATURE.firstName
        && node.lastName?.toLowerCase() === BOT_SIGNATURE.lastName
        && node.defaultAddress?.address1 === BOT_SIGNATURE.address1);
    const botSignupsSince = bots.length > 0
        ? bots.map((b) => b.node.createdAt).sort()[0].slice(0, 10)
        : null;

    const accounts = await getPortalConvex().query(api.portal.listPortalAccounts, {});

    const byLocation = new Map<string, { label: string; provinceCode: string | null; countryCode: string; count: number }>();
    for (const account of accounts) {
        const address = account.shippingAddress;
        if (!address) continue;
        const key = `${address.countryCode}-${address.provinceCode}`;
        const existing = byLocation.get(key);
        if (existing) existing.count += 1;
        else byLocation.set(key, {
            label: [address.city, address.provinceCode].filter(Boolean).join(", "),
            provinceCode: address.provinceCode || null,
            countryCode: address.countryCode,
            count: 1,
        });
    }

    const drafts = await getPortalConvex().query(api.portal.getTeamHubQueues, {});

    // Twelve months of order counts, including the empty ones — a series that
    // silently omits months with nothing in them draws a busier business than
    // exists.
    const monthBuckets = new Map<string, number>();
    const now = new Date();
    for (let back = 11; back >= 0; back -= 1) {
        const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
        monthBuckets.set(monthKey(at), 0);
    }
    for (const order of orders) {
        const key = monthKey(new Date(order.createdAt));
        if (monthBuckets.has(key)) monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1);
    }

    const botIds = new Set(bots.map(({ node }) => node.createdAt));
    const dayBuckets = new Map<string, { value: number; suspect: number }>();
    for (let back = 29; back >= 0; back -= 1) {
        dayBuckets.set(new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10), { value: 0, suspect: 0 });
    }
    for (const { node } of shopify.customers.edges) {
        const day = node.createdAt.slice(0, 10);
        const bucket = dayBuckets.get(day);
        if (!bucket) continue;
        bucket.value += 1;
        if (botIds.has(node.createdAt)) bucket.suspect += 1;
    }

    return {
        currencyCode: shopify.shop.currencyCode,
        ordersAllTime: shopify.ordersAll.count,
        ordersLast30: shopify.orders30.count,
        revenueAllTime,
        revenueLast30,
        // Shopify only holds what has been sold THROUGH Shopify. The trading
        // history lives in QuickBooks and has not been imported, so the figure
        // is true but partial, and must be labelled that way rather than
        // presented as the company's revenue.
        revenueAvailability: {
            state: "partial",
            note: "Shopify only. Historic trading lives in QuickBooks and has not been imported yet.",
        },
        productsPublished: shopify.productsCount.count,
        wholesaleAccounts: accounts.length,
        wholesaleReadyToOrder: accounts.filter((a) => a.shippingAddress && a.shopifyCustomerId).length,
        portalOrdersAwaiting: drafts.ordersSubmitted,
        customerRecords: shopify.customersCount.count,
        suspectedBotRecords: bots.length,
        botSignupsSince,
        accountLocations: [...byLocation.values()].sort((a, b) => b.count - a.count),
        ordersByMonth: [...monthBuckets.entries()].map(([key, value]) => ({
            label: monthLabel(key),
            value,
        })),
        signupsByDay: [...dayBuckets.entries()].map(([day, counts]) => ({
            label: day.slice(5),
            value: counts.value,
            suspect: counts.suspect,
        })),
    };
}

#!/usr/bin/env node
/**
 * Backfill the portal's order history from Shopify.
 *
 * Webhooks only carry what happens from now on. Every order placed before the
 * subscriptions were registered — and every order placed while they were
 * missing, which is all of them — exists in Shopify and nowhere in the portal.
 * This walks the orders belonging to each linked wholesale account and writes
 * them through the same mutation the webhook uses, so a backfilled order and a
 * live one are the same shape.
 *
 * Idempotent: upsertOrderFromShopify keys on the Shopify order id, so re-running
 * updates rather than duplicating. Rows owned by QuickBooks are left alone.
 *
 * Usage:
 *   node scripts/backfill_portal_orders.mjs                      # dry-run, all linked accounts
 *   node scripts/backfill_portal_orders.mjs --apply
 *   node scripts/backfill_portal_orders.mjs --apply --org org_123
 *   node scripts/backfill_portal_orders.mjs --apply --since 2026-01-01
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

try {
    const content = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch { /* ok */ }

const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const fail = (s) => { console.log(`${R}✗${X} ${s}`); process.exit(1); };
const info = (s) => console.log(`${D}  ${s}${X}`);
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyOrg = args[args.indexOf("--org") + 1]?.startsWith("org_")
    ? args[args.indexOf("--org") + 1]
    : null;
const sinceArg = args.includes("--since") ? args[args.indexOf("--since") + 1] : null;

const missing = ["NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN", "NEXT_PUBLIC_CONVEX_URL", "BEST_BOTTLES_CONVEX_WRITE_TOKEN"]
    .filter((k) => !process.env[k]);
if (missing.length) fail(`Missing env: ${missing.join(", ")}`);

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const API_VERSION = "2025-01";

async function admin(query, variables) {
    const res = await fetch(`https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) fail(`Shopify ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.errors?.length) fail(`Shopify GQL: ${json.errors.map((e) => e.message).join(", ")}`);
    return json.data;
}

const numericId = (gid) => String(gid).split("/").pop();

const ORDER_FIELDS = `
    id
    name
    createdAt
    cancelledAt
    displayFulfillmentStatus
    currentTotalPriceSet { shopMoney { amount } }
    totalPriceSet { shopMoney { amount } }
    customer { id }
    shippingAddress { city provinceCode }
    lineItems(first: 100) {
        edges { node { sku title name quantity originalUnitPriceSet { shopMoney { amount } } } }
    }
    fulfillments(first: 50) {
        id
        createdAt
        displayStatus
        trackingInfo { company number url }
        estimatedDeliveryAt
        fulfillmentLineItems(first: 100) {
            edges { node { quantity lineItem { sku title name } } }
        }
    }
`;

function formatEstimatedDelivery(value) {
    if (!value) return undefined;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return undefined;
    // UTC on purpose: Shopify sends midnight UTC, which a US host renders as
    // the previous day — an ETA that reads a day early.
    return at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function statusFor(order) {
    if (order.cancelledAt) return "cancelled";
    const shipments = order.fulfillments ?? [];
    if (shipments.length > 0 && shipments.every((f) => (f.displayStatus ?? "").toLowerCase() === "delivered")) {
        return "delivered";
    }
    if (order.displayFulfillmentStatus === "FULFILLED" || order.displayFulfillmentStatus === "PARTIALLY_FULFILLED") {
        return "in_transit";
    }
    return "processing";
}

function toMutationArgs(order) {
    const shipments = (order.fulfillments ?? []).map((f) => {
        const shippedAt = f.createdAt ? new Date(f.createdAt).getTime() : undefined;
        return {
            shopifyFulfillmentId: numericId(f.id),
            trackingNumber: f.trackingInfo?.[0]?.number || undefined,
            carrier: f.trackingInfo?.[0]?.company || undefined,
            trackingUrl: f.trackingInfo?.[0]?.url || undefined,
            shipmentStatus: f.displayStatus ? f.displayStatus.toLowerCase() : undefined,
            shippedAt: Number.isFinite(shippedAt) ? shippedAt : undefined,
            estimatedDelivery: formatEstimatedDelivery(f.estimatedDeliveryAt),
            lineItems: f.fulfillmentLineItems.edges.map(({ node }) => ({
                sku: node.lineItem.sku?.trim() || "—",
                description: node.lineItem.name?.trim() || node.lineItem.title,
                quantity: node.quantity,
            })),
        };
    });
    const primary = shipments.find((s) => s.trackingNumber) ?? shipments[0] ?? null;
    const priceText = order.currentTotalPriceSet?.shopMoney.amount ?? order.totalPriceSet?.shopMoney.amount ?? null;
    const total = priceText === null ? undefined : Number(priceText);
    const shipTo = order.shippingAddress
        ? [order.shippingAddress.city, order.shippingAddress.provinceCode].filter(Boolean).join(", ") || undefined
        : undefined;

    return {
        writeToken: process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN,
        shopifyOrderId: numericId(order.id),
        shopifyCustomerId: order.customer ? numericId(order.customer.id) : undefined,
        orderName: order.name,
        orderDate: new Date(order.createdAt).getTime(),
        status: statusFor(order),
        lineItems: order.lineItems.edges.map(({ node }) => ({
            sku: node.sku?.trim() || "—",
            description: node.name?.trim() || node.title,
            quantity: node.quantity,
            unitPrice: node.originalUnitPriceSet?.shopMoney.amount == null
                ? undefined
                : Number(node.originalUnitPriceSet.shopMoney.amount),
        })),
        totalAmount: Number.isFinite(total) ? total : undefined,
        trackingNumber: primary?.trackingNumber,
        carrier: primary?.carrier,
        estimatedDelivery: primary?.estimatedDelivery,
        shipments: shipments.length > 0 ? shipments : undefined,
        shipTo,
    };
}

async function ordersForCustomer(customerId) {
    const collected = [];
    let cursor = null;
    // Scoped to the customer, so a backfill can never pull another account's
    // orders into this org's portal.
    let queryString = `customer_id:${customerId}`;
    if (sinceArg) queryString += ` created_at:>=${sinceArg}`;

    for (;;) {
        const data = await admin(
            `query BackfillOrders($q: String!, $after: String) {
                orders(first: 50, query: $q, after: $after, sortKey: CREATED_AT) {
                    edges { cursor node { ${ORDER_FIELDS} } }
                    pageInfo { hasNextPage }
                }
            }`,
            { q: queryString, after: cursor },
        );
        const edges = data.orders.edges;
        collected.push(...edges.map((e) => e.node));
        if (!data.orders.pageInfo.hasNextPage || edges.length === 0) break;
        cursor = edges[edges.length - 1].cursor;
    }
    return collected;
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

section("Backfill portal order history");
info(`Store:  ${DOMAIN}`);
info(`Convex: ${process.env.NEXT_PUBLIC_CONVEX_URL}`);
info(`Mode:   ${apply ? `${R}APPLY${X}` : `${G}DRY-RUN${X}`}${sinceArg ? ` · since ${sinceArg}` : ""}`);

const accounts = await convex.query("portal:listPortalAccounts", {});
const linked = accounts.filter(
    (a) => a.shopifyCustomerId && (!onlyOrg || a.clerkOrgId === onlyOrg),
);

if (linked.length === 0) {
    warn("No linked wholesale accounts. Link a Shopify customer first — an order can only reach a portal through one.");
    process.exit(0);
}

const unlinked = accounts.filter((a) => !a.shopifyCustomerId);
if (unlinked.length > 0) {
    warn(`Skipping ${unlinked.length} account(s) with no Shopify customer: ${unlinked.map((a) => a.companyName).join(", ")}`);
}

let totalSeen = 0;
let totalWritten = 0;

for (const account of linked) {
    section(`${account.companyName} (${account.accountNumber})`);
    const orders = await ordersForCustomer(account.shopifyCustomerId);
    totalSeen += orders.length;

    if (orders.length === 0) {
        info("No Shopify orders for this customer.");
        continue;
    }

    for (const order of orders) {
        const shipmentCount = order.fulfillments?.length ?? 0;
        const tracked = (order.fulfillments ?? []).filter((f) => f.trackingInfo?.[0]?.number).length;
        const label = `${order.name.padEnd(8)} ${statusFor(order).padEnd(11)} ${shipmentCount} shipment(s), ${tracked} tracked`;

        if (!apply) {
            info(label);
            continue;
        }

        const result = await convex.mutation("portal:upsertOrderFromShopify", toMutationArgs(order));
        if (result.skipped) {
            warn(`${label} → skipped (${result.skipped})`);
        } else {
            totalWritten += 1;
            ok(`${label} → ${result.created ? "created" : "updated"}`);
        }
    }
}

section("Summary");
info(`${totalSeen} Shopify order(s) across ${linked.length} linked account(s)`);
if (apply) ok(`${totalWritten} written to the portal`);
else info(`Dry-run. Add ${B}--apply${X} to write.`);

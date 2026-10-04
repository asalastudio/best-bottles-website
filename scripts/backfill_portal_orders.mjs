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
import { require as requireTs } from "tsx/cjs/api";
const { fetchOrderForSync } = requireTs("../src/lib/shopify-order-fetch.ts", import.meta.url);
const { orderSyncArgs } = requireTs("../src/lib/shopify-order-sync.ts", import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

try {
    const content = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        // Values set on the command line win, so a production run cannot be silently pointed back at .env.local's dev deployment.
        if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
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
                    edges { cursor node { id } }
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

const accounts = await convex.query("portal:listPortalAccounts", { writeToken: process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN });
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

    for (const orderRef of orders) {
        const order = await fetchOrderForSync(orderRef.id.split("/").pop());
        if (!order) throw new Error("shopify_order_not_found");
        const normalized = orderSyncArgs(order);
        const shipmentCount = order.fulfillments?.length ?? 0;
        const tracked = (order.fulfillments ?? []).filter((f) => f.tracking_info?.some((t) => t.number)).length;
        const label = `${order.name.padEnd(8)} ${normalized.status.padEnd(11)} ${shipmentCount} shipment(s), ${tracked} tracked`;

        if (!apply) {
            info(label);
            continue;
        }

        const result = await convex.mutation("portal:upsertOrderFromShopify", { writeToken: process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN, ...normalized });
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

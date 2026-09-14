#!/usr/bin/env node
/**
 * Print the real shape of a Faire orders response.
 *
 * `src/lib/faire/client.ts` maps field names taken from Faire's public docs,
 * not from a live response, because this codebase had no token when it was
 * written. Run this once a token exists and correct that mapping against what
 * actually comes back — the defensive parsing will otherwise silently read
 * zeros for fields that are named something else.
 *
 *   FAIRE_ACCESS_TOKEN=... node scripts/faire-probe.mjs
 *
 * Reads only. Prints field names and types, not customer data.
 */
const token = process.env.FAIRE_ACCESS_TOKEN?.trim();
if (!token) {
    console.error("FAIRE_ACCESS_TOKEN is not set.");
    process.exit(1);
}

const response = await fetch("https://www.faire.com/external-api/v2/orders?limit=1", {
    headers: { "X-FAIRE-ACCESS-TOKEN": token, Accept: "application/json" },
});
if (!response.ok) {
    console.error(`Faire returned ${response.status} ${response.statusText}`);
    process.exit(1);
}

const body = await response.json();
console.log("top-level keys:", Object.keys(body).join(", "));

const orders = Array.isArray(body.orders) ? body.orders : [];
console.log(`orders in page: ${orders.length}`);
if (orders.length === 0) process.exit(0);

const describe = (value) =>
    Array.isArray(value) ? `array[${value.length}]`
    : value === null ? "null"
    : typeof value === "object" ? `object{${Object.keys(value).join(",")}}`
    : typeof value;

const order = orders[0];
console.log("\norder fields:");
for (const [key, value] of Object.entries(order)) {
    console.log(`  ${key.padEnd(28)} ${describe(value)}`);
}

for (const key of ["payout_costs", "total", "order_total"]) {
    if (order[key] && typeof order[key] === "object") {
        console.log(`\n${key}:`);
        for (const [k, v] of Object.entries(order[key])) console.log(`  ${k.padEnd(24)} ${describe(v)}`);
    }
}
if (Array.isArray(order.items) && order.items[0]) {
    console.log("\nitem fields:");
    for (const [k, v] of Object.entries(order.items[0])) console.log(`  ${k.padEnd(24)} ${describe(v)}`);
}

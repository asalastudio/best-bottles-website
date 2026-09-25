#!/usr/bin/env tsx
/**
 * Load data/register/ into the Convex register tables (docs/COMPONENT_REGISTER_PHASE_2_SCHEMA.md).
 *
 *   npx tsx scripts/register/push-register.ts                 # dry run against dev: shape, validate, diff
 *   npx tsx scripts/register/push-register.ts --apply         # write the rows that changed
 *   npx tsx scripts/register/push-register.ts --deployment prod [--apply]
 *
 * Dry run by default. Additive only: rows are inserted or updated, never deleted;
 * a row Convex has and the register no longer does is reported as stale.
 * Dev reads NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN from .env.local.
 * Prod needs REGISTER_PROD_WRITE_TOKEN in the environment and is never the default.
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { stableJson } from "../../convex/register";
import { readRegister, shapeRegister, type ShapedRegister } from "./registerRows";

const ROOT = resolve(__dirname, "..", "..");
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const BATCH = 100;
const KIT_LOOKUP = 50;

config({ path: resolve(ROOT, ".env.local"), quiet: true });
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const value = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };

type Table = "bodies" | "components" | "assemblies";
type Diff = { inserted: string[]; updated: { key: string; fields: string[] }[]; unchanged: number; stale: string[] };

function target() {
    const deployment = value("--deployment") ?? "dev";
    if (deployment === "prod") {
        const token = process.env.REGISTER_PROD_WRITE_TOKEN;
        if (!token) throw new Error("--deployment prod needs REGISTER_PROD_WRITE_TOKEN in the environment");
        return { deployment, url: PROD_URL, token };
    }
    if (deployment !== "dev") throw new Error(`--deployment must be dev or prod, not ${deployment}`);
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    const token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url || !token) throw new Error("dev needs NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN in .env.local");
    if (url === PROD_URL) throw new Error(".env.local points NEXT_PUBLIC_CONVEX_URL at prod; refusing to treat it as dev");
    return { deployment, url, token };
}

async function kitPlates(client: ConvexHttpClient, assemblies: { graceSku: string; websiteSku: string }[]) {
    const plates = new Map<string, string>();
    for (let i = 0; i < assemblies.length; i += KIT_LOOKUP) {
        const pairs = assemblies.slice(i, i + KIT_LOOKUP).map(a => ({ graceSku: a.graceSku || null, websiteSku: a.websiteSku || null }));
        const kits = await client.query(api.productKits.forSkus, { pairs });
        for (const [sku, kit] of Object.entries(kits)) if (kit) plates.set(sku, kit.plateSha256);
    }
    return plates;
}

async function deployed(client: ConvexHttpClient, token: string, table: Table): Promise<Map<string, Record<string, unknown>> | null> {
    const rows = new Map<string, Record<string, unknown>>();
    const keyOf = (row: Record<string, unknown>) =>
        String(table === "bodies" ? row.bodyId : table === "components" ? row.componentId : row.graceSku);
    let cursor: string | null = null;
    try {
        for (;;) {
            const page: { page: Record<string, unknown>[]; isDone: boolean; continueCursor: string } =
                await client.query(api.register.listPage, { writeToken: token, table, cursor, numItems: 500 });
            for (const row of page.page) rows.set(keyOf(row), row);
            if (page.isDone) return rows;
            cursor = page.continueCursor;
        }
    } catch (error) {
        if (String(error).includes("Could not find public function")) return null;
        throw error;
    }
}

function diff(local: Record<string, unknown>[], keyOf: (row: Record<string, unknown>) => string, remote: Map<string, Record<string, unknown>> | null): Diff {
    const result: Diff = { inserted: [], updated: [], unchanged: 0, stale: [] };
    const seen = new Set<string>();
    for (const row of local) {
        const key = keyOf(row);
        seen.add(key);
        const current = remote?.get(key);
        if (!current) { result.inserted.push(key); continue; }
        const fields = Object.keys(row).filter(field => stableJson(row[field]) !== stableJson(current[field]));
        if (fields.length) result.updated.push({ key, fields });
        else result.unchanged++;
    }
    for (const key of remote?.keys() ?? []) if (!seen.has(key)) result.stale.push(key);
    return result;
}

async function main() {
    const { deployment, url, token } = target();
    const apply = flag("--apply");
    const client = new ConvexHttpClient(url);
    const files = readRegister(resolve(ROOT, "data", "register"));
    console.log(`register → ${deployment} (${url}) ${apply ? "APPLY" : "dry run"}; snapshot ${files.stamp.snapshot}`);

    const plates = await kitPlates(client, files.assemblies.map(a => ({ graceSku: a.graceSku, websiteSku: a.websiteSku })));
    const { rows, problems } = shapeRegister(files, plates);
    console.log(`shaped ${rows.bodies.length} bodies, ${rows.components.length} components, ${rows.assemblies.length} assemblies; ${plates.size} assemblies have a published kit on ${deployment}`);
    if (problems.length) {
        console.error(`${problems.length} integrity problem(s); nothing sent:\n  ${problems.slice(0, 20).join("\n  ")}`);
        process.exit(1);
    }

    const plan: { table: Table; rows: Record<string, unknown>[]; keyOf: (row: Record<string, unknown>) => string }[] = [
        { table: "bodies", rows: rows.bodies, keyOf: row => String(row.bodyId) },
        { table: "components", rows: rows.components, keyOf: row => String(row.componentId) },
        { table: "assemblies", rows: rows.assemblies, keyOf: row => String(row.graceSku) },
    ];
    let failed = 0;
    for (const step of plan) {
        const remote = await deployed(client, token, step.table);
        const d = diff(step.rows, step.keyOf, remote);
        const fieldTally = new Map<string, number>();
        for (const u of d.updated) for (const f of u.fields) fieldTally.set(f, (fieldTally.get(f) ?? 0) + 1);
        console.log(`\n${step.table}: ${remote === null ? "register functions not deployed yet; " : ""}insert ${d.inserted.length}, update ${d.updated.length}, unchanged ${d.unchanged}, stale ${d.stale.length}`);
        if (fieldTally.size) console.log(`  changed fields: ${[...fieldTally].map(([f, n]) => `${f} ×${n}`).join(", ")}`);
        if (d.stale.length) console.log(`  stale (in Convex, not in the register; left in place): ${d.stale.slice(0, 10).join(", ")}${d.stale.length > 10 ? " …" : ""}`);
        if (!apply) continue;
        if (remote === null) throw new Error("deploy the register functions (npx convex dev --once) before --apply");
        const changed = new Set([...d.inserted, ...d.updated.map(u => u.key)]);
        const send = step.rows.filter(row => changed.has(step.keyOf(row)));
        const tally: Record<string, number> = {};
        for (let i = 0; i < send.length; i += BATCH) {
            const batch = send.slice(i, i + BATCH);
            const results =
                step.table === "bodies" ? await client.mutation(api.register.upsertBodies, { writeToken: token, rows: batch as ShapedRegister["bodies"] })
                : step.table === "components" ? await client.mutation(api.register.upsertComponents, { writeToken: token, rows: batch as ShapedRegister["components"] })
                : await client.mutation(api.register.upsertAssemblies, { writeToken: token, rows: batch as ShapedRegister["assemblies"] });
            for (const r of results) {
                tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
                if (r.outcome === "error") { failed++; console.error(`  ${r.key}: ${r.error}`); }
            }
        }
        console.log(`  applied: ${JSON.stringify(tally)}`);
    }
    if (apply) console.log(`\ncounts on ${deployment}: ${JSON.stringify(await client.query(api.register.counts, {}))}`);
    if (failed) process.exit(1);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

#!/usr/bin/env node
/**
 * Grace AI Diagnostic — environment, the OpenAI Realtime routes, the tool
 * gateway, and the Convex catalog tool chain.
 *
 * Run:
 *   npm run diag:grace
 *   BASE_URL=http://localhost:3000 npm run diag:grace
 *   BASE_URL=https://best-bottles-website.vercel.app npm run diag:grace   # staging / production
 *   npm run diag:grace -- --chat        # also sends one GPT-5 text turn (costs a model call)
 *
 * Section 2 needs the Next app reachable at BASE_URL. Section 3 needs
 * NEXT_PUBLIC_CONVEX_URL and hits Convex directly, the same path Grace's tools use.
 *
 * Rewritten 2026-09-25: the previous version probed the ElevenLabs routes that
 * were removed in August, so every run reported failures that meant nothing.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// Load .env.local if present (Node doesn't load it by default)
try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch {
    /* ignore */
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
const BASE_ORIGIN = new URL(BASE).origin;
const RUN_CHAT = process.argv.includes("--chat");
const JSON_HEADERS = {
    "Content-Type": "application/json",
    Origin: BASE_ORIGIN,
};

async function check(name, fn) {
    const startedAt = Date.now();
    try {
        const result = await fn();
        return { name, ok: true, detail: result, ms: Date.now() - startedAt };
    } catch (e) {
        return { name, ok: false, detail: String(e?.message ?? e), ms: Date.now() - startedAt };
    }
}

function report(label, outcome) {
    console.log(`   ${label}: ${outcome.ok ? outcome.detail : "FAIL — " + outcome.detail} (${outcome.ms} ms)`);
}

async function postTool(tool_name, parameters) {
    const r = await fetch(BASE + "/api/grace/tools", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ tool_name, parameters }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
    if (body.error) throw new Error(String(body.error));
    return body.result;
}

/**
 * Validates the Convex grace.* queries the tool gateway and askGrace call.
 */
async function runCatalogToolDiagnostics() {
    console.log("\n3. Grace catalog tools (Convex — grace.searchCatalog, etc.):");
    if (!CONVEX_URL) {
        console.log("   Skipped: NEXT_PUBLIC_CONVEX_URL / CONVEX_URL not set.");
        return { ok: true, skipped: true };
    }

    const client = new ConvexHttpClient(CONVEX_URL);
    let failed = false;

    const run = async (label, fn) => {
        const startedAt = Date.now();
        try {
            const msg = await fn();
            console.log(`   [OK] ${label}: ${msg} (${Date.now() - startedAt} ms)`);
        } catch (e) {
            failed = true;
            console.log(`   [FAIL] ${label}: ${e?.message ?? e}`);
        }
    };

    await run("getCatalogStats", async () => {
        const s = await client.query(api.grace.getCatalogStats, {});
        const v = s?.totalVariants ?? 0;
        const g = s?.totalGroups ?? 0;
        if (typeof v !== "number" || v < 100) throw new Error(`unexpected totalVariants: ${v}`);
        if (typeof g !== "number" || g < 50) throw new Error(`unexpected totalGroups: ${g}`);
        return `${v} variants, ${g} groups`;
    });

    await run('searchCatalog("9ml cylinder", family Cylinder)', async () => {
        const rows = await client.query(api.grace.searchCatalog, {
            searchTerm: "9ml cylinder",
            familyLimit: "Cylinder",
        });
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error("expected at least one product");
        }
        const first = rows[0];
        const sku = first.graceSku ?? "";
        const name = (first.itemName ?? "").slice(0, 50);
        return `${rows.length} rows; first SKU ${sku || "?"} — ${name}`;
    });

    await run('searchCatalog("10 ml roll-on bottle")', async () => {
        const rows = await client.query(api.grace.searchCatalog, { searchTerm: "10 ml roll-on bottle" });
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("expected 10 ml roll-on rows");
        return `${rows.length} rows`;
    });

    await run("getFamilyOverview(Cylinder)", async () => {
        const o = await client.query(api.grace.getFamilyOverview, { family: "Cylinder" });
        if (!o || typeof o !== "object") throw new Error("missing overview object");
        const sizes = o.sizes;
        if (!Array.isArray(sizes) || sizes.length === 0) {
            throw new Error("expected sizes[] on overview");
        }
        return `${sizes.length} size entries`;
    });

    await run("getBottleComponents (from first 9ml hit)", async () => {
        const rows = await client.query(api.grace.searchCatalog, {
            searchTerm: "9ml cylinder glass",
            familyLimit: "Cylinder",
        });
        const sku = rows?.[0]?.graceSku;
        if (!sku) throw new Error("no SKU to test getBottleComponents");
        const comp = await client.query(api.grace.getBottleComponents, { bottleSku: sku });
        if (!comp?.bottle) throw new Error("getBottleComponents returned no bottle");
        return `SKU ${sku} → bottle + ${comp.components ? Object.keys(comp.components).length : 0} component groups`;
    });

    await run('checkCompatibility("17-415")', async () => {
        const fit = await client.query(api.grace.checkCompatibility, { threadSize: "17-415" });
        if (!Array.isArray(fit) || fit.length === 0) {
            throw new Error("expected fitment rows for 17-415");
        }
        return `${fit.length} compatible bottle references`;
    });

    return { ok: !failed, skipped: false };
}

async function main() {
    console.log("Grace AI Diagnostic\n");
    console.log("─".repeat(50));

    // 1. Env vars (names only; values are never printed)
    console.log("\n1. Environment (this process):");
    for (const [name, note] of [
        ["NEXT_PUBLIC_CONVEX_URL", "Convex deployment the tools read"],
        ["OPENAI_API_KEY", "mints the Realtime client secret (/api/openai/realtime-token)"],
        ["TYPESAFE_API_KEY", "Jev intent enrichment for searchCatalog (optional; Grace works without it)"],
        ["GRACE_TOOLS_WEBHOOK_SECRET", "cross-origin secret for /api/grace/tools (optional; same-origin calls pass)"],
    ]) {
        console.log(`   ${name.padEnd(28)} ${process.env[name] ? "set" : "MISSING"} — ${note}`);
    }

    let exitCode = 0;

    // 2. API routes (requires the Next app)
    console.log("\n2. API routes (requires app reachable at " + BASE + "):");
    const token = await check("realtime-token", async () => {
        const r = await fetch(BASE + "/api/openai/realtime-token");
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
        if (typeof body.clientSecret !== "string" || !body.clientSecret) throw new Error("No clientSecret in response");
        return `OK (model ${body.model ?? "?"}, voice ${body.voice ?? "?"})`;
    });
    report("/api/openai/realtime-token", token);
    if (!token.ok) exitCode = 1;

    const stats = await check("tools getCatalogStats", async () => {
        const result = await postTool("getCatalogStats", {});
        const v = result?.totalVariants;
        if (typeof v !== "number") throw new Error("result.totalVariants missing");
        return `OK (${v} variants)`;
    });
    report("/api/grace/tools (getCatalogStats)", stats);
    if (!stats.ok) exitCode = 1;

    const search = await check("tools searchCatalog", async () => {
        // The 2026-09-25 regression: this plain request came back "no verified
        // matches" whenever the page carried a Refine state.
        const result = await postTool("searchCatalog", {
            searchTerm: "10 ml roll-on bottle",
            refineState: {
                filters: {
                    applicators: [], rollerMaterials: [], families: [], colors: [], capacities: [], neckThreadSizes: [],
                    category: null, collection: null, componentType: null, search: "10 ml roll-on bottle",
                    priceMin: null, priceMax: null,
                },
                sort: "capacity-asc",
                view: "visual",
            },
        });
        if (result && typeof result === "object" && result.status === "no_match") throw new Error(`no_match: ${result.message}`);
        if (Array.isArray(result) && result.length > 0) return `OK (${result.length} products)`;
        if (typeof result === "string" && result.length > 20) return `OK (text result, ${result.length} chars)`;
        throw new Error(`unexpected result shape: ${typeof result}`);
    });
    report("/api/grace/tools (searchCatalog, with a Refine state)", search);
    if (!search.ok) exitCode = 1;

    if (RUN_CHAT) {
        const chat = await check("chat", async () => {
            const r = await fetch(BASE + "/api/grace/chat", {
                method: "POST",
                headers: JSON_HEADERS,
                body: JSON.stringify({ messages: [{ role: "user", content: "Which 10 ml roll-on bottles do you carry?" }] }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
            const text = typeof body.message === "string" ? body.message : JSON.stringify(body.message ?? "");
            if (!text) throw new Error("empty reply");
            return `OK (${text.length} chars)`;
        });
        report("/api/grace/chat (one GPT-5 turn)", chat);
        if (!chat.ok) exitCode = 1;
    } else {
        console.log("   /api/grace/chat: skipped (pass --chat to send one text turn)");
    }

    const catalogDiag = await runCatalogToolDiagnostics();
    if (!catalogDiag.skipped && !catalogDiag.ok) exitCode = 1;

    console.log("\n4. Common fixes:");
    if (!token.ok) {
        console.log("   • Voice/text sessions: OPENAI_API_KEY must be set for the Next app (Vercel env or .env.local).");
        console.log("   • If you see HTTP 404 or 'fetch failed': start the app (`npm run dev`) or set BASE_URL to a deployed origin.");
        console.log("   • HTTP 429: the per-IP rate limit (30 tokens/min) tripped; wait a minute.");
    }
    if (!stats.ok || !search.ok) {
        console.log("   • Tools: NEXT_PUBLIC_CONVEX_URL must point at a reachable Convex deployment.");
        console.log("   • A no_match on the plain roll-on search means the gateway is routing Grace's sentence through the storefront's strict search again.");
    }
    if (catalogDiag.skipped) {
        console.log("   • Catalog section: set NEXT_PUBLIC_CONVEX_URL in .env.local to validate grace.* queries.");
    }
    console.log("   • Text fallback (askGrace) runs inside Convex and needs OPENAI_API_KEY there: npx convex env set OPENAI_API_KEY ...");
    console.log("\n   More catalog coverage: npm run test:grace:matrix");
    console.log("\n" + "─".repeat(50));
    console.log(exitCode === 0 ? "Done — all checks passed." : "Done — some checks failed (see above).");
    process.exit(exitCode);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

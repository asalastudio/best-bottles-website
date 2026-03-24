#!/usr/bin/env node
/**
 * Grace AI Diagnostic — checks key dependencies and endpoints.
 * Run: node scripts/diagnose_grace.mjs
 * Requires: dev server running (npm run dev) for API checks.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local if present (Node doesn't load it by default)
try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch {
    /* ignore */
}

const DEFAULT_BASES = process.env.BASE_URL
    ? [process.env.BASE_URL]
    : ["http://localhost:3000", "http://localhost:3001"];

async function pickBaseUrl() {
    for (const base of DEFAULT_BASES) {
        try {
            const response = await fetch(base, { method: "HEAD" });
            if (response.ok || response.status < 500) {
                return base;
            }
        } catch {
            /* try next base */
        }
    }
    return DEFAULT_BASES[0];
}

async function check(name, fn) {
    try {
        const result = await fn();
        return { name, ok: true, detail: result };
    } catch (e) {
        return { name, ok: false, detail: String(e?.message ?? e) };
    }
}

async function main() {
    const BASE = await pickBaseUrl();

    console.log("Grace AI Diagnostic\n");
    console.log("─".repeat(50));

    // 1. Env vars (from process — only what's available in Node)
    const hasConvex = !!process.env.NEXT_PUBLIC_CONVEX_URL;
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
    const hasElevenLabsAgent = !!process.env.ELEVENLABS_AGENT_ID;
    console.log("\n1. Environment (this process):");
    console.log(`   NEXT_PUBLIC_CONVEX_URL: ${hasConvex ? "set" : "MISSING"}`);
    console.log(`   ELEVENLABS_API_KEY:     ${hasElevenLabsKey ? "set" : "MISSING"}`);
    console.log(`   ELEVENLABS_AGENT_ID:    ${hasElevenLabsAgent ? "set" : "MISSING"}`);
    console.log("   ANTHROPIC_API_KEY:      (Convex env — set via `npx convex env set ANTHROPIC_API_KEY xxx`)");

    // 2. API routes (requires dev server)
    console.log("\n2. API routes (requires dev server at " + BASE + "):");
    const signedUrl = await check("signed-url", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/signed-url");
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return `HTTP ${r.status}: ${body.error ?? "Unknown"}`;
        if (!body.signedUrl) return "No signedUrl in response";
        return `OK (${body.signedUrl?.slice?.(0, 50) ?? "unknown"}...)`;
    });
    console.log(`   /api/elevenlabs/signed-url: ${signedUrl.ok ? signedUrl.detail : "FAIL — " + signedUrl.detail}`);

    const serverTools = await check("server-tools", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/server-tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool_name: "getCatalogStats", parameters: {} }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return `HTTP ${r.status}: ${body.error ?? "Unknown"}`;
        if (body.error) return body.error;
        return "OK";
    });
    console.log(`   /api/elevenlabs/server-tools: ${serverTools.ok ? serverTools.detail : "FAIL — " + serverTools.detail}`);

    const conversationToken = await check("conversation-token", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/conversation-token");
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return `HTTP ${r.status}: ${body.error ?? "Unknown"}`;
        if (!body.token) return "No token in response";
        return "OK";
    });
    console.log(`   /api/elevenlabs/conversation-token: ${conversationToken.ok ? conversationToken.detail : "FAIL — " + conversationToken.detail}`);

    console.log("\n3. Common fixes:");
    if (!signedUrl.ok) {
        console.log("   • Voice: Ensure ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env.local.");
        console.log("   • Restart dev server after changing env vars.");
    }
    if (!serverTools.ok) {
        console.log("   • Server tools: Ensure NEXT_PUBLIC_CONVEX_URL is set.");
        console.log("   • Convex deployment must be running.");
    }
    console.log("   • Text mode: Ensure ANTHROPIC_API_KEY is set in Convex:");
    console.log("     npx convex env set ANTHROPIC_API_KEY sk-ant-...");
    console.log("   • If voice drops immediately: Known issue — text mode works as fallback.");
    console.log("\n" + "─".repeat(50));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

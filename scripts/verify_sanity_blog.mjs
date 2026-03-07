#!/usr/bin/env node
/**
 * Verify Sanity blog setup: env vars, dataset, and published journal count.
 * Run: node scripts/verify_sanity_blog.mjs
 */
import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
    const envPath = resolve(ROOT, ".env.local");
    try {
        const raw = readFileSync(envPath, "utf-8");
        for (const line of raw.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx < 0) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (val.includes("#")) val = val.slice(0, val.indexOf("#")).trim();
            if (!process.env[key]) process.env[key] = val;
        }
    } catch {}
}

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_STUDIO_DATASET || "production";

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  Sanity Blog Verification                            ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

if (!projectId) {
    console.error("❌ NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_STUDIO_PROJECT_ID is not set.");
    console.error("   Add it to .env.local and Vercel Environment Variables.\n");
    process.exit(1);
}

console.log(`  Project ID:  ${projectId}`);
console.log(`  Dataset:     ${dataset}`);
console.log("");

const client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: false,
});

const query = `*[_type == "journal" && defined(slug.current) && defined(publishedAt)] | order(publishedAt desc) { _id, title, "slug": slug.current, publishedAt }`;

try {
    const posts = await client.fetch(query);
    console.log(`  Published journal posts: ${posts.length}`);
    if (posts.length > 0) {
        console.log("\n  Latest posts:");
        posts.slice(0, 5).forEach((p, i) => {
            const date = p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—";
            console.log(`    ${i + 1}. ${p.title} (${p.slug}) — ${date}`);
        });
    }
    console.log("\n  ✅ Sanity is configured. Blog should display at /blog if env vars match in production.\n");
} catch (err) {
    console.error("  ❌ Failed to fetch from Sanity:", err.message);
    console.error("\n  Check:");
    console.error("  - CORS: Add your production URL to manage.sanity.io → API → CORS origins");
    console.error("  - Dataset: Ensure content exists in the", dataset, "dataset");
    console.error("");
    process.exit(1);
}

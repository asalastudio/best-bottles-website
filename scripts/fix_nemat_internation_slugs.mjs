#!/usr/bin/env node
/**
 * Fix "nemat-internation" slug anomaly in both Convex and Sanity.
 *
 * Root cause: Source data had "Size: 13-415 Nemat Internation" (truncated).
 * Fix: Replace with clean thread (e.g. -13-415).
 *
 * Usage:
 *   1. npx convex run migrations:fixNematInternationSlugs   (fixes Convex)
 *   2. node scripts/fix_nemat_internation_slugs.mjs         (fixes Sanity)
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
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN;

/** Known correct Convex slugs for docs with bad slugs (title → slug) */
const TITLE_TO_SLUG = {
    "9 ml Clear Pillar Bottle with Cap": "pillar-9ml-clear-13-415",
};

function fixSlug(slug, title) {
    // Known mapping
    if (TITLE_TO_SLUG[title]) return TITLE_TO_SLUG[title];
    // nemat-internation pattern: -size-13-415-nemat-internation → -13-415
    const m1 = slug.match(/^(.+)-size-\d+-\d+-nemat-internation$/);
    if (m1) return m1[1] + "-" + slug.match(/-size-(\d+-\d+)-nemat-internation$/)[1];
    // nemat-in or other truncated: -size-*-nemat-in → derive from prefix (e.g. pillar-9ml-clear → pillar-9ml-clear-13-415)
    const m2 = slug.match(/^(.+)-size-[^-]+-nemat-in$/);
    if (m2) {
        const prefix = m2[1];
        if (prefix === "pillar-9ml-clear") return "pillar-9ml-clear-13-415";
        // fallback: try to extract thread from slug if present
        const thread = slug.match(/(\d+-\d+)/);
        return thread ? `${prefix}-${thread[1]}` : slug;
    }
    return slug;
}

async function main() {
    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║  Fix nemat-internation slugs in Sanity               ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    if (!projectId || !token) {
        console.error("Need NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN in .env.local");
        process.exit(1);
    }

    const client = createClient({
        projectId,
        dataset,
        apiVersion: "2024-01-01",
        useCdn: false,
        token,
    });

    const query = `*[_type == "productGroupContent" && defined(slug.current) && (slug.current match "*nemat*" || slug.current match "*internation*")] { _id, "slug": slug.current, title }`;
    const docs = await client.fetch(query);

    if (docs.length === 0) {
        console.log("  No Sanity productGroupContent docs with nemat/internation slugs found.");
        console.log("  If Convex was already fixed, you're done.\n");
        return;
    }

    console.log(`  Found ${docs.length} Sanity docs with bad slugs:\n`);

    for (const doc of docs) {
        const oldSlug = doc.slug;
        const newSlug = fixSlug(oldSlug, doc.title);
        if (newSlug === oldSlug) {
            console.log(`  ⏭️  ${doc.title} — slug unchanged: ${oldSlug}`);
            continue;
        }
        console.log(`  📝 ${doc.title}`);
        console.log(`     ${oldSlug}`);
        console.log(`     → ${newSlug}`);

        await client
            .patch(doc._id)
            .set({ "slug.current": newSlug })
            .commit();
        console.log(`     ✅ Updated\n`);
    }

    console.log("  Done. Product URLs will now use the clean slugs (e.g. /products/elegant-15ml-frosted-13-415).\n");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

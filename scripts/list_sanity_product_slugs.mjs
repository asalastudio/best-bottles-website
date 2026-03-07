#!/usr/bin/env node
/** List all Sanity productGroupContent slugs to find nemat-internation anomalies */
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

const client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: false,
});

const docs = await client.fetch(`*[_type == "productGroupContent"] { "slug": slug.current, title }`);
const bad = docs.filter((d) => d.slug && (d.slug.includes("nemat") || d.slug.includes("internation")));

console.log("\nSlugs containing 'nemat' or 'internation':", bad.length);
bad.forEach((d) => console.log(" ", d.slug, "—", d.title));
console.log("\nAll slugs (sample):");
docs.slice(0, 20).forEach((d) => console.log(" ", d.slug));

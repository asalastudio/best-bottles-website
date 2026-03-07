#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvLocal() {
  const envPath = resolve(__dirname, "..", "..", ".env.local");
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
  } catch {
    // Optional when env vars are already loaded.
  }
}

loadEnvLocal();

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in environment or .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
const result = await client.action(api.products.auditDataQuality, {});

console.log("GI-0005 verification");
console.log(JSON.stringify({
  totalProducts: result.totalProducts,
  issueCount: result.issueCount,
  highSeverity: result.highSeverity,
  mediumSeverity: result.mediumSeverity,
  lowSeverity: result.lowSeverity,
  sampleIssues: result.issues.slice(0, 5),
}, null, 2));

if (typeof result.totalProducts !== "number" || result.totalProducts <= 0) {
  console.error("\nGI-0005 verification failed: audit did not scan any products.");
  process.exit(1);
}

console.log("\nGI-0005 verification passed.");

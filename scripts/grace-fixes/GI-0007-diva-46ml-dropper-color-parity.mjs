#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
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

const patches = [
  {
    websiteSku: "GBDiva46DrpCu",
    set: { color: "Clear" },
    reason: "GI-0007: live Best Bottles PDP identifies this Diva 46ml dropper bottle as clear glass",
  },
  {
    websiteSku: "GBDiva46DrpGl",
    set: { color: "Clear" },
    reason: "GI-0007: live Best Bottles PDP identifies this Diva 46ml dropper bottle as clear glass",
  },
];

console.log("Applying GI-0007 safe websiteSku patches...");
const patchResult = await client.mutation(api.migrations.applySafeWebsiteSkuPatches, {
  patches,
});

console.log(
  `Patched products: ${patchResult.updatedCount ?? 0} | ` +
    `Missing SKUs: ${patchResult.missingSkus?.length ?? 0} | ` +
    `Skipped: ${patchResult.skippedCount ?? 0}`
);

if (patchResult.missingSkus?.length) {
  console.error("Missing SKUs:", patchResult.missingSkus.join(", "));
  process.exit(1);
}

console.log("Rebuilding grouped catalog state...");
const buildResult = await client.action(api.migrations.buildProductGroups, {});
console.log(buildResult.message);

const linkResult = await client.action(api.migrations.linkProductsToGroups, {});
console.log(linkResult.message);

const applicatorResult = await client.action(api.migrations.populateApplicatorTypes, {});
console.log(applicatorResult.message);

console.log("GI-0007 fix complete.");

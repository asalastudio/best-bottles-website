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

const bottleSku = process.argv[2] || "GB-CIR-FRS-100ML-RDC-WHT";
const fitmentBottleName = "Circle 100ml Frosted";

const client = new ConvexHttpClient(convexUrl);

const [graceResult, uiResult, fitmentRule] = await Promise.all([
  client.query(api.grace.getBottleComponents, { bottleSku }),
  client.query(api.products.getCompatibleFitments, { bottleSku }),
  client.query(api.fitments.getByBottleName, { bottleName: fitmentBottleName }),
]);

if (!graceResult) {
  console.error(`Bottle not found for ${bottleSku}`);
  process.exit(1);
}

if (!fitmentRule) {
  console.error(`Fitment rule not found for ${fitmentBottleName}`);
  process.exit(1);
}

const graceTypes = Object.keys(graceResult.components || {}).sort();
const uiTypes = Object.keys(uiResult?.components || {}).sort();
const dropperAllowed = fitmentRule.components?.Dropper === "✓";
const graceHasDropper = Boolean(graceResult.components?.Dropper?.length);
const uiHasDropper = Boolean(uiResult?.components?.Dropper?.length);

console.log("GI-0006 verification");
console.log(JSON.stringify({
  bottleSku,
  fitmentBottleName,
  graceTypes,
  uiTypes,
  fitmentRule: fitmentRule.components,
  dropperAllowed,
  graceHasDropper,
  uiHasDropper,
}, null, 2));

const failures = [];

if (JSON.stringify(graceTypes) !== JSON.stringify(uiTypes)) {
  failures.push("Grace component groups and PDP fitment drawer groups diverge");
}

if (!dropperAllowed && graceHasDropper) {
  failures.push("Grace still exposes Dropper for a bottle whose fitment rule forbids Dropper");
}

if (!dropperAllowed && uiHasDropper) {
  failures.push("PDP fitment drawer still exposes Dropper for a bottle whose fitment rule forbids Dropper");
}

if (failures.length) {
  console.error("\nGI-0006 verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nGI-0006 verification passed.");

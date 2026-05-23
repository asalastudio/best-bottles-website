#!/usr/bin/env node
/**
 * Reconcile image truth between Convex environments.
 *
 * Source of truth defaults to production Convex; target defaults to the local
 * NEXT_PUBLIC_CONVEX_URL from .env.local. Dry-run by default. The apply path
 * uses a Convex internal mutation via `npx convex run --push`, so image writes
 * stay out of the public client API.
 *
 * Examples:
 *   npm run reconcile:convex-images
 *   npm run reconcile:convex-images -- --family Empire
 *   npm run reconcile:convex-images -- --family Empire --apply
 *   npm run reconcile:convex-images -- --family Empire --apply --overwrite
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const PRODUCTION_URL = "https://precise-raccoon-123.convex.cloud";

function loadEnvLocal() {
    try {
        const raw = readFileSync(resolve(".env.local"), "utf8");
        for (const line of raw.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx < 0) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            const commentIdx = val.indexOf(" #");
            if (commentIdx >= 0) val = val.slice(0, commentIdx).trim();
            if (!process.env[key]) process.env[key] = val;
        }
    } catch {
        /* optional */
    }
}

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (name, fallback = null) => {
        const idx = args.indexOf(name);
        return idx >= 0 ? args[idx + 1] ?? fallback : fallback;
    };
    return {
        sourceUrl: get("--source-url", process.env.CONVEX_IMAGE_SOURCE_URL || PRODUCTION_URL),
        targetUrl: get("--target-url", process.env.CONVEX_IMAGE_TARGET_URL || process.env.NEXT_PUBLIC_CONVEX_URL),
        family: get("--family", null),
        apply: args.includes("--apply"),
        overwrite: args.includes("--overwrite"),
        includeVariants: args.includes("--include-variants"),
        json: args.includes("--json"),
    };
}

function imageValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function getGroups(client, family) {
    if (family) return await client.query(api.products.getProductGroupsByFamily, { family });
    return await client.query(api.products.getAllCatalogGroups, {});
}

async function getGroupWithVariants(client, slug) {
    return await client.query(api.products.getProductGroup, { slug });
}

function variantKey(variant) {
    return imageValue(variant.websiteSku) || imageValue(variant.graceSku);
}

async function buildPlan({ sourceUrl, targetUrl, family, includeVariants }) {
    const source = new ConvexHttpClient(sourceUrl);
    const target = new ConvexHttpClient(targetUrl);
    const sourceGroups = await getGroups(source, family);
    const targetGroups = await getGroups(target, family);
    const targetBySlug = new Map(targetGroups.map((group) => [group.slug, group]));

    const groupHeroPatches = [];
    const groupDiffs = [];
    const missingTargetGroups = [];
    const variantImagePatches = [];
    const variantDiffs = [];

    for (const sourceGroup of sourceGroups) {
        const targetGroup = targetBySlug.get(sourceGroup.slug);
        if (!targetGroup) {
            missingTargetGroups.push(sourceGroup.slug);
            continue;
        }

        const sourceHero = imageValue(sourceGroup.heroImageUrl);
        const targetHero = imageValue(targetGroup.heroImageUrl);
        if (sourceHero && sourceHero !== targetHero) {
            groupDiffs.push({
                slug: sourceGroup.slug,
                sourceHeroImageUrl: sourceHero,
                targetHeroImageUrl: targetHero,
                targetMissing: !targetHero,
            });
            if (!targetHero || sourceHero !== targetHero) {
                groupHeroPatches.push({
                    slug: sourceGroup.slug,
                    heroImageUrl: sourceHero,
                });
            }
        }

        if (!includeVariants) continue;

        const [sourceData, targetData] = await Promise.all([
            getGroupWithVariants(source, sourceGroup.slug),
            getGroupWithVariants(target, sourceGroup.slug),
        ]);
        const targetVariants = new Map((targetData?.variants ?? []).map((variant) => [variantKey(variant), variant]));

        for (const sourceVariant of sourceData?.variants ?? []) {
            const key = variantKey(sourceVariant);
            if (!key) continue;
            const targetVariant = targetVariants.get(key);
            if (!targetVariant) {
                variantDiffs.push({ websiteSku: key, issue: "missing_target_variant", groupSlug: sourceGroup.slug });
                continue;
            }
            const sourceImageUrl = imageValue(sourceVariant.imageUrl);
            const sourceImageUrlCapOff = imageValue(sourceVariant.imageUrlCapOff);
            const targetImageUrl = imageValue(targetVariant.imageUrl);
            const targetImageUrlCapOff = imageValue(targetVariant.imageUrlCapOff);

            if (
                (sourceImageUrl && sourceImageUrl !== targetImageUrl) ||
                (sourceImageUrlCapOff && sourceImageUrlCapOff !== targetImageUrlCapOff)
            ) {
                variantDiffs.push({
                    websiteSku: key,
                    groupSlug: sourceGroup.slug,
                    sourceImageUrl,
                    targetImageUrl,
                    sourceImageUrlCapOff,
                    targetImageUrlCapOff,
                    targetMissing: !targetImageUrl || !targetImageUrlCapOff,
                });
                variantImagePatches.push({
                    websiteSku: key,
                    ...(sourceImageUrl ? { imageUrl: sourceImageUrl } : {}),
                    ...(sourceImageUrlCapOff ? { imageUrlCapOff: sourceImageUrlCapOff } : {}),
                });
            }
        }
    }

    return {
        sourceUrl,
        targetUrl,
        family: family ?? "ALL",
        includeVariants,
        groupCounts: {
            source: sourceGroups.length,
            target: targetGroups.length,
            missingTargetGroups: missingTargetGroups.length,
            differingHeroImages: groupDiffs.length,
            heroPatches: groupHeroPatches.length,
        },
        variantCounts: {
            differingImages: variantDiffs.length,
            variantPatches: variantImagePatches.length,
        },
        missingTargetGroups,
        groupDiffs,
        variantDiffs,
        patch: {
            sourceLabel: `convex-image-truth:${sourceUrl}`,
            onlyIfMissing: true,
            groupHeroPatches,
            variantImagePatches: includeVariants ? variantImagePatches : [],
        },
    };
}

function printPlan(plan, json) {
    if (json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
    }
    console.log("Convex Image Truth Reconciliation");
    console.log("────────────────────────────────");
    console.log(`Source: ${plan.sourceUrl}`);
    console.log(`Target: ${plan.targetUrl}`);
    console.log(`Family: ${plan.family}`);
    console.log(`Source groups: ${plan.groupCounts.source}`);
    console.log(`Target groups: ${plan.groupCounts.target}`);
    console.log(`Missing target groups: ${plan.groupCounts.missingTargetGroups}`);
    console.log(`Differing group hero images: ${plan.groupCounts.differingHeroImages}`);
    console.log(`Group hero patches ready: ${plan.groupCounts.heroPatches}`);
    console.log(`Variant comparison: ${plan.includeVariants ? "enabled" : "skipped"}`);
    if (plan.includeVariants) {
        console.log(`Differing variant images: ${plan.variantCounts.differingImages}`);
        console.log(`Variant patches ready: ${plan.variantCounts.variantPatches}`);
    }
    if (plan.groupDiffs.length) {
        console.log("\nSample group hero diffs:");
        for (const diff of plan.groupDiffs.slice(0, 10)) {
            console.log(`  ${diff.slug}: ${diff.targetHeroImageUrl ? "different" : "missing"} → ${diff.sourceHeroImageUrl}`);
        }
        if (plan.groupDiffs.length > 10) console.log(`  ... and ${plan.groupDiffs.length - 10} more`);
    }
}

function applyPlan(plan, overwrite) {
    const tmp = mkdtempSync(join(tmpdir(), "convex-image-truth-"));
    const patchPath = join(tmp, "patch.json");
    const patch = {
        ...plan.patch,
        onlyIfMissing: !overwrite,
    };
    writeFileSync(patchPath, JSON.stringify(patch), "utf8");

    const run = spawnSync(
        "npx",
        [
            "convex",
            "run",
            "imageReconciliation:applyImageTruthPatch",
            readFileSync(patchPath, "utf8"),
            "--push",
            "--typecheck",
            "try",
        ],
        {
            cwd: process.cwd(),
            stdio: "inherit",
            env: process.env,
        },
    );

    if (run.status !== 0) process.exit(run.status ?? 1);
}

async function main() {
    loadEnvLocal();
    const options = parseArgs();
    if (!options.targetUrl) {
        console.error("Missing target Convex URL. Set NEXT_PUBLIC_CONVEX_URL or pass --target-url.");
        process.exit(1);
    }
    if (options.sourceUrl === options.targetUrl) {
        console.error("Source and target Convex URLs are identical; refusing to reconcile.");
        process.exit(1);
    }

    const plan = await buildPlan(options);
    printPlan(plan, options.json);

    if (!options.apply) {
        if (!options.json) console.log("\nDry-run only. Re-run with --apply to patch the target deployment.");
        return;
    }

    if (plan.groupCounts.heroPatches === 0 && plan.variantCounts.variantPatches === 0) {
        console.log("\nNothing to apply.");
        return;
    }

    applyPlan(plan, options.overwrite);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

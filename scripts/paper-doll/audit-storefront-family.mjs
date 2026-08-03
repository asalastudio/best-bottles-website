#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import { createClient } from "@sanity/client";

function argument(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : fallback;
}

const familyKey = argument("family", "CYL-9ML");
const capacityMl = Number(argument("capacity", "9"));
const neckThreadSize = argument("neck", "17-415");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

if (!convexUrl || !projectId) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL or NEXT_PUBLIC_SANITY_PROJECT_ID.");
    process.exit(2);
}

const convex = new ConvexHttpClient(convexUrl);
const sanity = createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: false });

async function readCohort() {
    try {
        return await convex.query("products:getProductCohort", {
            family: "Cylinder",
            capacityMl,
            neckThreadSize,
            paperDollFamilyKey: familyKey,
        });
    } catch {
        const groups = (await convex.query("products:getGroupsByFamily", { family: "Cylinder" }))
            .filter((group) => group.capacityMl === capacityMl
                && group.neckThreadSize === neckThreadSize
                && group.paperDollFamilyKey === familyKey);
        const payloads = await Promise.all(groups.map((group) => convex.query("products:getProductGroup", { slug: group.slug })));
        return { groups, variants: payloads.flatMap((payload) => payload?.variants ?? []) };
    }
}

async function inspectLayer(layer) {
    const invalid = [];
    if (layer.imageWidth !== 2080 || layer.imageHeight !== 2288) invalid.push("dimensions");
    if (!layer.imageUrl) return { ...layer, invalid: [...invalid, "missing-url"] };
    try {
        const response = await fetch(`${layer.imageUrl}?fm=png`);
        if (!response.ok) invalid.push(`http-${response.status}`);
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("png")) invalid.push("not-png");
    } catch {
        invalid.push("unreachable");
    }
    return { ...layer, invalid };
}

const [cohort, paperDoll, editorial] = await Promise.all([
    readCohort(),
    sanity.fetch(`*[_type == "paperDollFamily" && familyKey == $familyKey][0] {
      familyKey, canvasWidth, canvasHeight, storefrontReady, assetRevision,
      layerAssets[] { slot, variantKey, "imageUrl": image.asset->url,
        "imageWidth": image.asset->metadata.dimensions.width,
        "imageHeight": image.asset->metadata.dimensions.height }
    }`, { familyKey }),
    sanity.fetch(`*[_type == "productFamilyContent" && family == "Cylinder"][0] {
      featuredCohortSlug, "heroUrl": familyHeroImage.asset->url
    }`),
]);

const inspectedLayers = await Promise.all((paperDoll?.layerAssets ?? []).map(inspectLayer));
const configurationSkus = cohort.variants.map((variant) => variant.graceSku).filter(Boolean);
const uniqueSkus = new Set(configurationSkus);
const layerCounts = { body: 0, cap: 0, roller: 0, sprayer: 0, pump: 0 };
for (const layer of inspectedLayers) {
    if (layer.slot in layerCounts) layerCounts[layer.slot] += 1;
}

const issues = [];
if (cohort.groups.length !== 15) issues.push(`Expected 15 product groups; received ${cohort.groups.length}`);
if (uniqueSkus.size !== 145) issues.push(`Expected 145 unique configurations; received ${uniqueSkus.size}`);
for (const sku of ["GB-CYL-WHT-9ML-MRL-WHT", "GB-CYL-WHT-9ML-ROL-WHT"]) {
    if (!uniqueSkus.has(sku)) issues.push(`Missing required Swirl white-cap SKU ${sku}`);
}
if (!paperDoll?.storefrontReady) issues.push("Sanity Paper Doll family is not storefront-ready");
if (paperDoll?.canvasWidth !== 2080 || paperDoll?.canvasHeight !== 2288) {
    issues.push(`Expected 2080×2288 canvas; received ${paperDoll?.canvasWidth ?? "?"}×${paperDoll?.canvasHeight ?? "?"}`);
}
for (const [slot, expected] of Object.entries({ body: 5, cap: 10, roller: 2, sprayer: 6, pump: 3 })) {
    if (layerCounts[slot] !== expected) issues.push(`Expected ${expected} ${slot} layers; received ${layerCounts[slot]}`);
}
const invalidLayers = inspectedLayers.filter((layer) => layer.invalid.length > 0);
if (invalidLayers.length > 0) issues.push(`${invalidLayers.length} layer assets failed image validation`);
if (!editorial?.heroUrl) issues.push("Cylinder editorial hero is missing");
if (editorial?.featuredCohortSlug && editorial.featuredCohortSlug !== "cylinder-9ml-17-415") {
    issues.push(`Cylinder editorial points to ${editorial.featuredCohortSlug}`);
}

const report = {
    ok: issues.length === 0,
    auditedAt: new Date().toISOString(),
    cohort: { familyKey, capacityMl, neckThreadSize, groups: cohort.groups.length, configurations: uniqueSkus.size },
    paperDoll: {
        revision: paperDoll?.assetRevision ?? null,
        storefrontReady: paperDoll?.storefrontReady === true,
        canvas: `${paperDoll?.canvasWidth ?? "?"}×${paperDoll?.canvasHeight ?? "?"}`,
        layerCounts,
        invalidLayers: invalidLayers.map((layer) => `${layer.slot}:${layer.variantKey}`),
    },
    editorialHero: Boolean(editorial?.heroUrl),
    issues,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;

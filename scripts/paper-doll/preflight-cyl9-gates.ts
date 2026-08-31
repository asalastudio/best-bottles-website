/**
 * READ-ONLY preflight: simulates the storefront gate exactly as it will run
 * once `paperDollFamily d5291f24…` is published, using the real validator.
 */
import { createClient } from "@sanity/client";
import {
    validateStorefrontPaperDollFamily,
    validatePreviewPaperDollFamily,
} from "../../src/lib/paper-doll/sanity";

const FAMILY_KEY = "CYL-9ML";

const LAYER_PROJECTION = `
  _key, slot, variantKey, sourceFilename,
  "imageUrl": image.asset->url,
  "imageWidth": image.asset->metadata.dimensions.width,
  "imageHeight": image.asset->metadata.dimensions.height,
  offsetX, offsetY
`;

const FAMILY_PROJECTION = `
  _id, familyKey, displayName, canvasPreset, canvasWidth, canvasHeight,
  pipelineVersion, assetRevision, storefrontReady,
  layerOrderRollon, layerOrderSpray, layerOrderShortcap, layerOrderLotion,
  anchorsJson,
  "currentReleaseReference": currentRelease._ref,
  currentRelease->{
    _id, familyKey, displayName, canvasPreset, canvasWidth, canvasHeight,
    pipelineVersion, assetRevision, storefrontReady,
    layerOrderRollon, layerOrderSpray, layerOrderShortcap, layerOrderLotion,
    anchorsJson,
    layerAssets[] { ${LAYER_PROJECTION} }
  },
  layerAssets[] { ${LAYER_PROJECTION} }
`;

// Mirrors selectStorefrontPaperDollReleaseCandidate
function selectCandidate(value: any): any {
    if (!value || typeof value !== "object") return value;
    const ref = typeof value.currentReleaseReference === "string" ? value.currentReleaseReference.trim() : "";
    if (ref.length > 0) return value.currentRelease;
    return value.currentRelease && typeof value.currentRelease === "object" ? value.currentRelease : value;
}

function report(label: string, family: any) {
    console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
    if (!family) {
        console.log("  ✗ query returned null — no document at this perspective");
        return;
    }
    const ref = family.currentReleaseReference ?? null;
    console.log(`  family._id            : ${family._id}`);
    console.log(`  family.storefrontReady: ${family.storefrontReady}`);
    console.log(`  currentRelease ref    : ${ref ?? "(none)"}`);

    const candidate = selectCandidate(family);
    console.log(`  gate reads            : ${candidate?._id ?? "(null candidate)"}`);
    console.log(`  candidate.storefrontReady: ${candidate?.storefrontReady}`);
    console.log(`  candidate.layerAssets : ${candidate?.layerAssets?.length ?? 0}`);
    console.log(`  canvasPreset          : ${candidate?.canvasPreset}  ${candidate?.canvasWidth}x${candidate?.canvasHeight}`);
    console.log(`  pipelineVersion       : ${candidate?.pipelineVersion ?? "(MISSING)"}`);
    console.log(`  assetRevision         : ${candidate?.assetRevision ?? "(MISSING)"}`);
    for (const f of ["layerOrderRollon", "layerOrderSpray", "layerOrderShortcap", "layerOrderLotion"]) {
        const v = candidate?.[f];
        console.log(`  ${f.padEnd(22)}: ${Array.isArray(v) && v.length ? v.join(" > ") : "(empty)"}`);
    }
    if (candidate?.layerAssets?.length) {
        const slots = new Map<string, number>();
        for (const l of candidate.layerAssets) slots.set(l.slot, (slots.get(l.slot) ?? 0) + 1);
        console.log(`  slots present         : ${[...slots].map(([s, n]) => `${s}×${n}`).join(", ")}`);
        const badDims = candidate.layerAssets.filter(
            (l: any) => l.imageWidth !== 2080 || l.imageHeight !== 2288,
        );
        const noUrl = candidate.layerAssets.filter((l: any) => !l.imageUrl);
        console.log(`  wrong-dimension layers: ${badDims.length}`);
        console.log(`  missing image URLs    : ${noUrl.length}`);
    }

    const storefront = validateStorefrontPaperDollFamily(candidate);
    const preview = validatePreviewPaperDollFamily(candidate);
    console.log(`\n  PREVIEW  gate : ${preview.ok ? "✅ PASS" : "❌ FAIL"}`);
    if (!preview.ok) preview.issues.forEach((i) => console.log(`      - ${i}`));
    console.log(`  STOREFRONT gate: ${storefront.ok ? "✅ PASS" : "❌ FAIL"}`);
    if (!storefront.ok) storefront.issues.forEach((i) => console.log(`      - ${i}`));
}

async function main() {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
    const token = process.env.SANITY_API_READ_TOKEN;

    const published = createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: false, perspective: "published" });
    const drafted = createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: false, token, perspective: "drafts" });

    const q = `*[_type == "paperDollFamily" && familyKey == $familyKey][0]{ ${FAMILY_PROJECTION} }`;

    report(
        "A. TODAY — published perspective (what real visitors get right now)",
        await published.fetch(q, { familyKey: FAMILY_KEY }),
    );
    report(
        "B. AFTER PUBLISHING THE FAMILY DRAFT — drafts perspective (simulated live state)",
        await drafted.fetch(q, { familyKey: FAMILY_KEY }),
    );
}

main().catch((e) => {
    console.error("preflight failed:", e.message);
    process.exit(1);
});

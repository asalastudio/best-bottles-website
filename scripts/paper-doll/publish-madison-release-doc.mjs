#!/usr/bin/env node

/**
 * Publish a Madison paper-doll RELEASE document (never the family document).
 *
 * After `import-madison-release.ts --write-draft` creates
 * `drafts.paperDollRelease.<family>.<version>`, this script marks it
 * storefront-ready and publishes it to its public id — mirroring the shipped
 * 1.3.0-complete-family.1 state. The paperDollFamily draft remains unpublished:
 * publishing the family is the storefront go-live gate and stays a separate,
 * explicit human action.
 */

import { createClient } from "@sanity/client";

function readOption(args, name) {
    const index = args.indexOf(name);
    if (index === -1) return null;
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    return value;
}

async function main() {
    const args = process.argv.slice(2);
    const familyKey = readOption(args, "--family-key") ?? "CYL-9ML";
    const releaseVersion = readOption(args, "--release-version");
    const execute = args.includes("--publish");
    if (!releaseVersion) throw new Error("--release-version is required");

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const token = process.env.SANITY_API_TOKEN;
    if (!projectId || !token) throw new Error("SANITY_API_TOKEN and a Sanity project id are required");
    const client = createClient({ projectId, dataset, token, apiVersion: "2026-08-03", useCdn: false });

    const publicId = `paperDollRelease.${familyKey}.${releaseVersion.replace(/[^a-zA-Z0-9]+/g, "-")}`;
    const draftId = `drafts.${publicId}`;
    const docs = await client.fetch(
        `*[_id in [$draftId, $publicId]]{_id, _type, releaseVersion, storefrontReady, manifestSha256, "layers": count(layerAssets)}`,
        { draftId, publicId },
        { perspective: "raw" },
    );
    const draft = docs.find((doc) => doc._id === draftId);
    const existingPublic = docs.find((doc) => doc._id === publicId);

    if (existingPublic && !draft) {
        console.log(JSON.stringify({ mode: "noop", reason: "already published", publicId, existingPublic }, null, 2));
        return;
    }
    if (!draft) throw new Error(`No draft release found at ${draftId}`);
    if (draft._type !== "paperDollRelease" || draft.releaseVersion !== releaseVersion) {
        throw new Error(`Draft ${draftId} does not match release ${releaseVersion}`);
    }
    if (existingPublic && existingPublic.manifestSha256 !== draft.manifestSha256) {
        throw new Error(`Published release ${publicId} carries a different manifest; releases are immutable.`);
    }

    if (!execute) {
        console.log(JSON.stringify({ mode: "dry-run", draftId, publicId, draft, wouldSetStorefrontReady: true, wouldPublish: true, familyPublicationPerformed: false }, null, 2));
        return;
    }

    const full = await client.getDocument(draftId);
    const { _id, _rev, _createdAt, _updatedAt, ...content } = full;
    const publicDoc = { ...content, _id: publicId, storefrontReady: true };
    await client.transaction()
        .createOrReplace(publicDoc)
        .delete(draftId)
        .commit();

    const verified = await client.fetch(
        `*[_id == $publicId][0]{_id, releaseVersion, storefrontReady, manifestSha256, "layers": count(layerAssets)}`,
        { publicId },
        { perspective: "raw" },
    );
    console.log(JSON.stringify({ mode: "published", publicId, verified, familyPublicationPerformed: false }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

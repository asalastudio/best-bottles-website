#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createClient } from "@sanity/client";
import sharp from "sharp";

import {
    assertSanityReleaseIsImmutable,
    buildMadisonSanityDraftDocuments,
    resolveMadisonReleaseAssetPath,
    validateMadisonReleaseManifest,
    type MadisonPaperDollReleaseManifest,
} from "../../src/lib/paper-doll/madison-sanity-adapter";

type CliOptions = {
    manifestPath: string;
    assetsRoot: string;
    displayName: string;
    familyDocumentId: string | null;
    writeDraft: boolean;
};

function readOption(args: string[], name: string): string | null {
    const index = args.indexOf(name);
    if (index === -1) return null;
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    return value;
}

function parseOptions(args: string[]): CliOptions {
    const manifestValue = readOption(args, "--manifest");
    if (!manifestValue) throw new Error("--manifest is required");
    const manifestPath = resolve(manifestValue);
    return {
        manifestPath,
        assetsRoot: resolve(readOption(args, "--assets-root") ?? dirname(manifestPath)),
        displayName: readOption(args, "--display-name") ?? "Cylinder 9 mL — 17-415",
        familyDocumentId: readOption(args, "--family-document-id"),
        writeDraft: args.includes("--write-draft"),
    };
}

function sha256Buffer(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
}

async function verifyReleaseFiles(manifest: MadisonPaperDollReleaseManifest, assetsRoot: string) {
    const verified = [] as Array<{
        asset: MadisonPaperDollReleaseManifest["assets"][number];
        absolutePath: string;
    }>;
    for (const asset of manifest.assets) {
        const absolutePath = resolveMadisonReleaseAssetPath(assetsRoot, asset.imagePath);
        const bytes = await readFile(absolutePath);
        const actualSha = sha256Buffer(bytes);
        if (actualSha !== asset.imageSha256) {
            throw new Error(`${asset.slot}:${asset.variantKey} SHA-256 mismatch; release=${asset.imageSha256}, file=${actualSha}`);
        }
        const metadata = await sharp(bytes).metadata();
        if (
            metadata.width !== 2080
            || metadata.height !== 2288
            || metadata.hasAlpha !== true
            || metadata.channels !== 4
        ) {
            throw new Error(`${asset.slot}:${asset.variantKey} must be a 2080×2288 RGBA PNG`);
        }
        verified.push({ asset, absolutePath });
    }
    return verified;
}

function withoutSystemFields(value: Record<string, unknown> | null): Record<string, unknown> {
    if (!value) return {};
    return Object.fromEntries(
        Object.entries(value).filter(([key]) => !["_rev", "_createdAt", "_updatedAt"].includes(key)),
    );
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    const manifest = JSON.parse(await readFile(options.manifestPath, "utf8")) as MadisonPaperDollReleaseManifest;
    const issues = validateMadisonReleaseManifest(manifest);
    if (issues.length > 0) {
        throw new Error(`Madison release is not eligible for Sanity draft import:\n- ${issues.join("\n- ")}`);
    }
    const verifiedFiles = await verifyReleaseFiles(manifest, options.assetsRoot);

    if (!options.writeDraft) {
        const dryRunRefs = Object.fromEntries(manifest.assets.map((asset) => [
            asset.imageSha256,
            `image-dry-run-${asset.imageSha256.slice(0, 24)}-2080x2288-png`,
        ]));
        const documents = await buildMadisonSanityDraftDocuments({
            manifest,
            displayName: options.displayName,
            existingFamilyDocumentId: options.familyDocumentId,
            sanityAssetRefsBySha256: dryRunRefs,
        });
        console.log(JSON.stringify({
            mode: "dry-run",
            familyKey: manifest.familyKey,
            releaseVersion: manifest.releaseVersion,
            manifestSha256: documents.manifestSha256,
            verifiedAssets: verifiedFiles.length,
            catalogMappings: manifest.assemblyMappings.length,
            releaseDraftId: documents.releaseDocument._id,
            familyDraftId: documents.familyDocument._id,
            writeCount: 0,
            storefrontReady: false,
        }, null, 2));
        return;
    }

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const token = process.env.SANITY_API_TOKEN;
    if (!projectId || !token) {
        throw new Error("--write-draft requires SANITY_API_TOKEN and NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_STUDIO_PROJECT_ID");
    }
    const client = createClient({ projectId, dataset, token, apiVersion: "2026-08-03", useCdn: false });
    const hashes = [...new Set(manifest.assets.map((asset) => asset.imageSha256))];
    const placeholderRefs = Object.fromEntries(hashes.map((hash) => [
        hash,
        `image-preflight-${hash.slice(0, 24)}-2080x2288-png`,
    ]));
    const preflightDocuments = await buildMadisonSanityDraftDocuments({
        manifest,
        displayName: options.displayName,
        existingFamilyDocumentId: options.familyDocumentId,
        sanityAssetRefsBySha256: placeholderRefs,
    });
    const releasePublicId = preflightDocuments.releaseDocument._id.replace(/^drafts\./, "");
    const existingReleases = await client.fetch<Array<{ _id: string; manifestSha256?: string | null }>>(
        `*[_id in [$draftId, $publicId]]{_id, manifestSha256}`,
        { draftId: preflightDocuments.releaseDocument._id, publicId: releasePublicId },
        { perspective: "raw" },
    );
    assertSanityReleaseIsImmutable(existingReleases, preflightDocuments.manifestSha256);

    const reused = await client.fetch<Array<{ imageSha256: string; assetRef: string }>>(
        `*[_type in ["paperDollRelease", "paperDollFamily"] && defined(layerAssets)]{
          "matches": layerAssets[imageSha256 in $hashes]{imageSha256, "assetRef": image.asset._ref}
        }.matches[]`,
        { hashes },
    );
    const assetRefsBySha256 = Object.fromEntries(
        reused.filter((row) => row.imageSha256 && row.assetRef).map((row) => [row.imageSha256, row.assetRef]),
    );
    let uploadCount = 0;
    for (const { asset, absolutePath } of verifiedFiles) {
        if (assetRefsBySha256[asset.imageSha256]) continue;
        const uploaded = await client.assets.upload("image", createReadStream(absolutePath), {
            filename: `${asset.slot}-${asset.variantKey}-${basename(absolutePath)}`,
            contentType: "image/png",
        });
        assetRefsBySha256[asset.imageSha256] = uploaded._id;
        uploadCount += 1;
    }

    const existingFamily = await client.fetch<Record<string, unknown> | null>(
        `*[_type == "paperDollFamily" && familyKey == $familyKey][0]`,
        { familyKey: manifest.familyKey },
    );
    const existingFamilyId = options.familyDocumentId
        ?? (typeof existingFamily?._id === "string" ? existingFamily._id : null);
    const documents = await buildMadisonSanityDraftDocuments({
        manifest,
        displayName: options.displayName,
        existingFamilyDocumentId: existingFamilyId,
        sanityAssetRefsBySha256: assetRefsBySha256,
    });
    const familyDocument = {
        ...withoutSystemFields(existingFamily),
        ...documents.familyDocument,
    };
    await client.transaction()
        .createOrReplace(documents.releaseDocument)
        .createOrReplace(familyDocument)
        .commit();

    console.log(JSON.stringify({
        mode: "draft-write",
        familyKey: manifest.familyKey,
        releaseVersion: manifest.releaseVersion,
        manifestSha256: documents.manifestSha256,
        verifiedAssets: verifiedFiles.length,
        reusedAssets: verifiedFiles.length - uploadCount,
        uploadedAssets: uploadCount,
        catalogMappings: manifest.assemblyMappings.length,
        releaseDraftId: documents.releaseDocument._id,
        familyDraftId: documents.familyDocument._id,
        writeCount: 2,
        storefrontReady: false,
        publicPublicationPerformed: false,
    }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

import { isAbsolute, relative, resolve } from "node:path";

import { PAPER_DOLL_CANVAS, PAPER_DOLL_CANVAS_PRESET } from "./contract";

export type MadisonPaperDollSlot = "body" | "cap" | "roller" | "sprayer" | "overcap" | "pump";

export type MadisonPaperDollReleaseAsset = {
    componentVersionId: string;
    componentKey: string;
    geometryFamilyId: string;
    slot: MadisonPaperDollSlot;
    variantKey: string;
    materialVariant: string;
    imagePath: string;
    imageSha256: string;
    geometryMaskPath: string | null;
    geometryMaskSha256: string | null;
    widthPx: number;
    heightPx: number;
    alphaBounds: { left: number; top: number; right: number; bottom: number };
    mountAxisXPx: number;
    seatYPx: number;
    approvalStatus: "candidate" | "blocked" | "approved" | "rejected";
    candidateId?: string;
    placementVersionId?: string;
};

export type MadisonPaperDollReleaseManifest = {
    schemaVersion: number;
    familyKey: string;
    releaseVersion: string;
    status: "draft" | "validating" | "blocked" | "ready" | "published" | "superseded";
    canvas: { widthPx: number; heightPx: number; backgroundHex: string };
    assets: MadisonPaperDollReleaseAsset[];
    assemblyRecipes: Array<{
        recipeKey: string;
        mode: "rollon" | "spray" | "lotion" | "closure";
        layerOrder: MadisonPaperDollSlot[];
    }>;
    assemblyMappings: Array<{
        mappingKey: string;
        websiteSku: string;
        graceSku: string;
        recipeKey: string;
        bodyVariantKey: string;
        fitmentVariantKey: string | null;
        closureVariantKey: string | null;
        overcapVariantKey: string | null;
    }>;
    qaEvidence: Array<{
        evidenceId: string;
        subjectId: string;
        gateKey: string;
        gateVersion: string;
        status: "passed" | "failed" | "advisory" | "blocked";
        blocking: boolean;
        calibratedWith: string[];
        measurements: Record<string, unknown>;
        issues: string[];
    }>;
    blockers: string[];
    provenance: { sourceGitCommit: string; rendererVersion: string };
};

type SanityAssetReferenceMap = Record<string, string>;

type SanityLayerAsset = {
    _type: "paperDollLayerAsset";
    _key: string;
    slot: MadisonPaperDollSlot;
    variantKey: string;
    sourceFilename: string;
    image: { _type: "image"; asset: { _type: "reference"; _ref: string } };
    componentVersionId: string;
    componentKey: string;
    geometryFamilyId: string;
    materialVariant: string;
    imageSha256: string;
    widthPx: number;
    heightPx: number;
    alphaBounds: MadisonPaperDollReleaseAsset["alphaBounds"];
    mountAxisXPx: number;
    seatYPx: number;
    approvalStatus: "approved";
    candidateId?: string;
    placementVersionId?: string;
};

function clean(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function canonicalize(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function keyPart(value: string): string {
    const normalized = value
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    if (!normalized) throw new Error(`Cannot create a Sanity key from '${value}'`);
    return normalized;
}

function publicDocumentId(value: string): string {
    return value.replace(/^drafts\./, "").trim();
}

function draftDocumentId(value: string): string {
    const publicId = publicDocumentId(value);
    if (!publicId) throw new Error("Sanity document ID is required");
    return `drafts.${publicId}`;
}

export function resolveMadisonReleaseAssetPath(releaseRoot: string, imagePath: string): string {
    const root = resolve(releaseRoot);
    if (isAbsolute(imagePath)) throw new Error(`Madison release asset path must be relative: ${imagePath}`);
    const candidate = resolve(root, imagePath);
    const fromRoot = relative(root, candidate);
    if (fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(fromRoot)) {
        throw new Error(`Madison release asset path escapes the release root: ${imagePath}`);
    }
    return candidate;
}

export function assertSanityReleaseIsImmutable(
    existingReleases: Array<{ _id: string; manifestSha256?: string | null }>,
    expectedManifestSha256: string,
): void {
    for (const release of existingReleases) {
        const existingHash = clean(release.manifestSha256);
        if (!existingHash) {
            throw new Error(`Existing Sanity release ${release._id} is missing its immutable manifest hash`);
        }
        if (existingHash !== expectedManifestSha256) {
            throw new Error(`Sanity release ${release._id} already belongs to a different manifest`);
        }
    }
}

function bestLayerOrder(
    manifest: MadisonPaperDollReleaseManifest,
    mode: MadisonPaperDollReleaseManifest["assemblyRecipes"][number]["mode"],
): string[] {
    return manifest.assemblyRecipes
        .filter((recipe) => recipe.mode === mode)
        .map((recipe) => recipe.layerOrder)
        .sort((left, right) => right.length - left.length || left.join(":").localeCompare(right.join(":")))[0] ?? [];
}

export function validateMadisonReleaseManifest(
    manifest: MadisonPaperDollReleaseManifest,
    options: { target?: "draft" | "public" } = {},
): string[] {
    const issues: string[] = [];
    const target = options.target ?? "public";
    if (manifest.schemaVersion !== 1) issues.push("release schemaVersion must be 1");
    if (!clean(manifest.familyKey)) issues.push("release familyKey is required");
    if (!clean(manifest.releaseVersion)) issues.push("releaseVersion is required");
    if (target === "public" && manifest.status !== "ready" && manifest.status !== "published") {
        issues.push("release status must be ready or published");
    }
    if (manifest.canvas?.widthPx !== PAPER_DOLL_CANVAS.width || manifest.canvas?.heightPx !== PAPER_DOLL_CANVAS.height) {
        issues.push(`release canvas must be ${PAPER_DOLL_CANVAS.width}×${PAPER_DOLL_CANVAS.height}`);
    }
    if (target === "public" && manifest.blockers.length > 0) issues.push("release blockers must be empty");
    if (manifest.assets.length === 0) issues.push("release assets must not be empty");

    const layerIdentities = new Set<string>();
    for (const asset of manifest.assets) {
        const identity = `${asset.slot}:${asset.variantKey}`;
        if (layerIdentities.has(identity)) issues.push(`duplicate layer ${identity}`);
        layerIdentities.add(identity);
        if (asset.approvalStatus !== "approved") issues.push(`${identity} must be approved`);
        if (asset.widthPx !== PAPER_DOLL_CANVAS.width || asset.heightPx !== PAPER_DOLL_CANVAS.height) {
            issues.push(`${identity} must be ${PAPER_DOLL_CANVAS.width}×${PAPER_DOLL_CANVAS.height}`);
        }
        if (!/^[a-f0-9]{64}$/.test(asset.imageSha256)) issues.push(`${identity} imageSha256 must be a lowercase SHA-256`);
    }

    const recipeKeys = new Set(manifest.assemblyRecipes.map((recipe) => recipe.recipeKey));
    const mappingKeys = new Set<string>();
    for (const mapping of manifest.assemblyMappings) {
        if (mappingKeys.has(mapping.mappingKey)) issues.push(`duplicate assembly mapping ${mapping.mappingKey}`);
        mappingKeys.add(mapping.mappingKey);
        if (!recipeKeys.has(mapping.recipeKey)) issues.push(`${mapping.mappingKey} references missing recipe ${mapping.recipeKey}`);
    }
    if (manifest.assemblyMappings.length === 0) issues.push("release assemblyMappings must not be empty");

    for (const evidence of manifest.qaEvidence) {
        if (evidence.blocking && evidence.status !== "passed") {
            issues.push(`blocking QA evidence ${evidence.evidenceId} must pass`);
        }
    }

    if (manifest.familyKey === "CYL-9ML") {
        if (manifest.assemblyMappings.length !== 145) {
            issues.push(`CYL-9ML must contain exactly 145 catalog mappings; received ${manifest.assemblyMappings.length}`);
        }
        const graceSkus = new Set(manifest.assemblyMappings.map((mapping) => mapping.graceSku));
        if (!graceSkus.has("GB-CYL-WHT-9ML-MRL-WHT")) {
            issues.push("CYL-9ML is missing metal roller with white cap GB-CYL-WHT-9ML-MRL-WHT");
        }
        if (!graceSkus.has("GB-CYL-WHT-9ML-ROL-WHT")) {
            issues.push("CYL-9ML is missing plastic roller with white cap GB-CYL-WHT-9ML-ROL-WHT");
        }
        if (canonicalize(manifest).includes("13-415")) {
            issues.push("CYL-9ML release must not contain 13-415 identities");
        }
    }
    return [...new Set(issues)];
}

function buildLayerAssets(
    manifest: MadisonPaperDollReleaseManifest,
    sanityAssetRefsBySha256: SanityAssetReferenceMap,
): SanityLayerAsset[] {
    return manifest.assets.map((asset) => {
        const assetRef = clean(sanityAssetRefsBySha256[asset.imageSha256]);
        if (!assetRef) throw new Error(`Missing Sanity image reference for ${asset.slot}:${asset.variantKey} (${asset.imageSha256})`);
        return {
            _type: "paperDollLayerAsset",
            _key: `layer-${keyPart(asset.slot)}-${keyPart(asset.variantKey)}-${asset.imageSha256.slice(0, 12)}`,
            slot: asset.slot,
            variantKey: asset.variantKey,
            sourceFilename: `${asset.slot}-${asset.variantKey}.png`,
            image: { _type: "image", asset: { _type: "reference", _ref: assetRef } },
            componentVersionId: asset.componentVersionId,
            componentKey: asset.componentKey,
            geometryFamilyId: asset.geometryFamilyId,
            materialVariant: asset.materialVariant,
            imageSha256: asset.imageSha256,
            widthPx: asset.widthPx,
            heightPx: asset.heightPx,
            alphaBounds: asset.alphaBounds,
            mountAxisXPx: asset.mountAxisXPx,
            seatYPx: asset.seatYPx,
            approvalStatus: "approved",
            ...(asset.candidateId ? { candidateId: asset.candidateId } : {}),
            ...(asset.placementVersionId ? { placementVersionId: asset.placementVersionId } : {}),
        };
    });
}

export async function buildMadisonSanityDraftDocuments(input: {
    manifest: MadisonPaperDollReleaseManifest;
    displayName: string;
    sanityAssetRefsBySha256: SanityAssetReferenceMap;
    existingFamilyDocumentId?: string | null;
}) {
    const issues = validateMadisonReleaseManifest(input.manifest, { target: "draft" });
    if (issues.length > 0) throw new Error(`Madison release failed the Sanity import gate:\n- ${issues.join("\n- ")}`);
    const displayName = clean(input.displayName);
    if (!displayName) throw new Error("Paper Doll family displayName is required");

    const manifestSha256 = await sha256(canonicalize(input.manifest));
    const layerAssets = buildLayerAssets(input.manifest, input.sanityAssetRefsBySha256);
    const releasePublicId = `paperDollRelease.${keyPart(input.manifest.familyKey).toUpperCase()}.${keyPart(input.manifest.releaseVersion)}`;
    const familyPublicId = publicDocumentId(input.existingFamilyDocumentId ?? `paperDollFamily.${input.manifest.familyKey}`);
    const releaseFields = {
        familyKey: input.manifest.familyKey,
        displayName,
        schemaVersion: input.manifest.schemaVersion,
        releaseVersion: input.manifest.releaseVersion,
        releaseStatus: input.manifest.status,
        manifestSha256,
        canvasPreset: PAPER_DOLL_CANVAS_PRESET,
        canvasWidth: PAPER_DOLL_CANVAS.width,
        canvasHeight: PAPER_DOLL_CANVAS.height,
        pipelineVersion: input.manifest.provenance.rendererVersion,
        assetRevision: input.manifest.releaseVersion,
        storefrontReady: false as const,
        layerOrderRollon: bestLayerOrder(input.manifest, "rollon"),
        layerOrderSpray: bestLayerOrder(input.manifest, "spray"),
        layerOrderLotion: bestLayerOrder(input.manifest, "lotion"),
        layerOrderShortcap: bestLayerOrder(input.manifest, "closure"),
        layerAssets,
        assemblyRecipes: input.manifest.assemblyRecipes.map((recipe) => ({
            _type: "paperDollAssemblyRecipe",
            _key: `recipe-${keyPart(recipe.recipeKey)}`,
            ...recipe,
        })),
        assemblyMappings: input.manifest.assemblyMappings.map((mapping) => ({
            _type: "paperDollAssemblyMapping",
            _key: `mapping-${keyPart(mapping.mappingKey)}`,
            ...mapping,
        })),
        qaEvidence: input.manifest.qaEvidence.map((evidence) => {
            const { measurements, ...evidenceFields } = evidence;
            return {
                _type: "paperDollQaEvidence",
                _key: `evidence-${keyPart(evidence.evidenceId)}`,
                ...evidenceFields,
                measurementsJson: JSON.stringify(measurements),
            };
        }),
        releaseBlockers: [...input.manifest.blockers],
        provenance: {
            _type: "paperDollReleaseProvenance",
            sourceGitCommit: input.manifest.provenance.sourceGitCommit,
            rendererVersion: input.manifest.provenance.rendererVersion,
        },
    };

    return {
        manifestSha256,
        releaseDocument: {
            _id: draftDocumentId(releasePublicId),
            _type: "paperDollRelease" as const,
            ...releaseFields,
        },
        familyDocument: {
            _id: draftDocumentId(familyPublicId),
            _type: "paperDollFamily" as const,
            ...releaseFields,
            // The versioned release exists only as a draft at this stage. Keep
            // the stable public ID as a weak reference so Sanity accepts the
            // paired draft transaction without fabricating a public release.
            // Storefront activation replaces this with a strong reference
            // after the release document is published separately.
            currentRelease: { _type: "reference" as const, _ref: releasePublicId, _weak: true as const },
        },
    };
}

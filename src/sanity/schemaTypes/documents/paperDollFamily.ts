import { defineType, defineField, defineArrayMember } from "sanity";
import { ComponentIcon } from "@sanity/icons";

/**
 * Paper Doll family: one document per configurable bottle family (e.g. CYL-9ML).
 * References all normalized layer PNGs and stores canvas + layer order metadata.
 */
export const paperDollFamily = defineType({
    name: "paperDollFamily",
    title: "Paper Doll Family",
    type: "document",
    icon: ComponentIcon,
    fields: [
        defineField({
            name: "familyKey",
            title: "Family key",
            type: "string",
            description: "Stable key, e.g. CYL-9ML — used by API and Convex sync",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "displayName",
            title: "Display name",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "currentRelease",
            title: "Current Paper Doll release",
            type: "reference",
            to: [{ type: "paperDollRelease" }],
            description: "Versioned release selected for this family. Publishing the release and this family remain separate reviewed actions.",
        }),
        defineField({ name: "schemaVersion", title: "Release schema version", type: "number", readOnly: true }),
        defineField({ name: "releaseVersion", title: "Release version", type: "string", readOnly: true }),
        defineField({ name: "releaseStatus", title: "Madison release status", type: "string", readOnly: true }),
        defineField({
            name: "manifestSha256",
            title: "Manifest SHA-256",
            type: "string",
            readOnly: true,
            validation: (Rule) => Rule.regex(/^[a-f0-9]{64}$/),
        }),
        defineField({
            name: "canvasPreset",
            title: "Canvas preset",
            type: "string",
            options: {
                list: [
                    { title: "PDP — 2080 × 2288", value: "pdp-2080x2288" },
                    { title: "Legacy — migration only", value: "legacy" },
                ],
                layout: "radio",
            },
            initialValue: "pdp-2080x2288",
            validation: (Rule) => Rule.required(),
            description: "Only PDP — 2080 × 2288 assets can be marked storefront ready. Legacy preserves existing families during migration.",
        }),
        defineField({
            name: "canvasWidth",
            title: "Canvas width (px)",
            type: "number",
            initialValue: 2080,
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "canvasHeight",
            title: "Canvas height (px)",
            type: "number",
            initialValue: 2288,
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "pipelineVersion",
            title: "Pipeline version",
            type: "string",
            validation: (Rule) => Rule.required(),
            description: "Deterministic transform used to produce every layer, e.g. recanvas-v1.",
        }),
        defineField({
            name: "assetRevision",
            title: "Asset revision",
            type: "string",
            validation: (Rule) => Rule.required(),
            description: "Immutable release identifier shared by this family layer set.",
        }),
        defineField({
            name: "storefrontReady",
            title: "Storefront ready",
            type: "boolean",
            initialValue: false,
            description: "Release gate. Enable only after the 2080 × 2288 dimension audit, transparent-edge audit, contact sheet, and configuration coverage checks pass.",
        }),
        defineField({
            name: "layerOrderRollon",
            title: "Layer order — Roll-on",
            type: "array",
            of: [{ type: "string" }],
            description: "Bottom to top, e.g. body → roller → cap",
        }),
        defineField({
            name: "layerOrderSpray",
            title: "Layer order — Spray",
            type: "array",
            of: [{ type: "string" }],
        }),
        defineField({
            name: "layerOrderShortcap",
            title: "Layer order — Short Cap",
            type: "array",
            of: [{ type: "string" }],
        }),
        defineField({
            name: "layerOrderLotion",
            title: "Layer order — Lotion",
            type: "array",
            of: [{ type: "string" }],
        }),
        defineField({
            name: "anchorsJson",
            title: "Anchors (JSON)",
            type: "text",
            rows: 8,
            description: "Paste family-model.json anchors / contentBounds as JSON for renderer alignment",
        }),
        defineField({
            name: "layerAssets",
            title: "Layer assets",
            type: "array",
            of: [defineArrayMember({ type: "paperDollLayerAsset" })],
        }),
        defineField({ name: "assemblyRecipes", title: "Assembly recipes", type: "array", of: [defineArrayMember({ type: "paperDollAssemblyRecipe" })], readOnly: true }),
        defineField({ name: "assemblyMappings", title: "Catalog mappings", type: "array", of: [defineArrayMember({ type: "paperDollAssemblyMapping" })], readOnly: true }),
        defineField({ name: "qaEvidence", title: "QA evidence", type: "array", of: [defineArrayMember({ type: "paperDollQaEvidence" })], readOnly: true }),
        defineField({ name: "releaseBlockers", title: "Release blockers", type: "array", of: [defineArrayMember({ type: "string" })], readOnly: true }),
        defineField({ name: "provenance", title: "Release provenance", type: "paperDollReleaseProvenance", readOnly: true }),
    ],
    preview: {
        select: { title: "displayName", subtitle: "familyKey" },
    },
});

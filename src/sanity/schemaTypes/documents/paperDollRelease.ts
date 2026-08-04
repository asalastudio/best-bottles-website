import { ComponentIcon } from "@sanity/icons";
import { defineArrayMember, defineField, defineType } from "sanity";

export const paperDollRelease = defineType({
    name: "paperDollRelease",
    title: "Paper Doll Release",
    type: "document",
    icon: ComponentIcon,
    fields: [
        defineField({ name: "familyKey", title: "Family key", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "displayName", title: "Display name", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "schemaVersion", title: "Release schema version", type: "number", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "releaseVersion", title: "Release version", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "releaseStatus", title: "Madison release status", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "manifestSha256", title: "Manifest SHA-256", type: "string", readOnly: true, validation: (Rule) => Rule.required().regex(/^[a-f0-9]{64}$/) }),
        defineField({ name: "canvasPreset", title: "Canvas preset", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "canvasWidth", title: "Canvas width", type: "number", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "canvasHeight", title: "Canvas height", type: "number", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "pipelineVersion", title: "Pipeline version", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({ name: "assetRevision", title: "Asset revision", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
        defineField({
            name: "storefrontReady",
            title: "Storefront ready",
            type: "boolean",
            initialValue: false,
            description: "Separate storefront approval gate. Madison imports always create this release as false.",
        }),
        defineField({ name: "layerOrderRollon", title: "Roll-on layer order", type: "array", of: [defineArrayMember({ type: "string" })], readOnly: true }),
        defineField({ name: "layerOrderSpray", title: "Spray layer order", type: "array", of: [defineArrayMember({ type: "string" })], readOnly: true }),
        defineField({ name: "layerOrderLotion", title: "Lotion layer order", type: "array", of: [defineArrayMember({ type: "string" })], readOnly: true }),
        defineField({ name: "layerOrderShortcap", title: "Closure layer order", type: "array", of: [defineArrayMember({ type: "string" })], readOnly: true }),
        defineField({ name: "layerAssets", title: "Release layer assets", type: "array", of: [defineArrayMember({ type: "paperDollLayerAsset" })], readOnly: true, validation: (Rule) => Rule.required().min(1) }),
        defineField({ name: "assemblyRecipes", title: "Assembly recipes", type: "array", of: [defineArrayMember({ type: "paperDollAssemblyRecipe" })], readOnly: true }),
        defineField({ name: "assemblyMappings", title: "Catalog mappings", type: "array", of: [defineArrayMember({ type: "paperDollAssemblyMapping" })], readOnly: true }),
        defineField({ name: "qaEvidence", title: "QA evidence", type: "array", of: [defineArrayMember({ type: "paperDollQaEvidence" })], readOnly: true }),
        defineField({ name: "releaseBlockers", title: "Release blockers", type: "array", of: [defineArrayMember({ type: "string" })], readOnly: true }),
        defineField({ name: "provenance", title: "Provenance", type: "paperDollReleaseProvenance", readOnly: true }),
    ],
    preview: {
        select: { familyKey: "familyKey", releaseVersion: "releaseVersion", ready: "storefrontReady" },
        prepare({ familyKey, releaseVersion, ready }) {
            return {
                title: `${familyKey ?? "Paper Doll"} · ${releaseVersion ?? "unversioned"}`,
                subtitle: ready ? "Storefront ready" : "Awaiting storefront approval",
            };
        },
    },
});

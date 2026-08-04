import { defineType, defineField } from "sanity";
import { ImageIcon } from "@sanity/icons";

/**
 * One layer PNG for the Paper Doll compositor.
 * Slots: body, cap, roller, sprayer, overcap, shortcap, or pump.
 */
export const paperDollLayerAsset = defineType({
    name: "paperDollLayerAsset",
    title: "Paper Doll Layer Asset",
    type: "object",
    icon: ImageIcon,
    fields: [
        defineField({
            name: "slot",
            title: "Slot",
            type: "string",
            options: {
                list: [
                    { title: "Body (glass)", value: "body" },
                    { title: "Cap", value: "cap" },
                    { title: "Roller fitment", value: "roller" },
                    { title: "Sprayer mechanism", value: "sprayer" },
                    { title: "Sprayer overcap", value: "overcap" },
                    { title: "Short cap", value: "shortcap" },
                    { title: "Lotion pump", value: "pump" },
                ],
                layout: "dropdown",
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "variantKey",
            title: "Variant key",
            type: "string",
            description: "Short code matching filenames, e.g. CLR, BLK-DOT, MTL-ROLL",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "sourceFilename",
            title: "Source filename",
            type: "string",
            description: "Original PNG basename for traceability",
        }),
        defineField({
            name: "componentVersionId",
            title: "Madison component version",
            type: "string",
            readOnly: true,
        }),
        defineField({
            name: "componentKey",
            title: "Madison component key",
            type: "string",
            readOnly: true,
        }),
        defineField({
            name: "geometryFamilyId",
            title: "Geometry family",
            type: "string",
            readOnly: true,
        }),
        defineField({
            name: "materialVariant",
            title: "Material variant",
            type: "string",
            readOnly: true,
        }),
        defineField({
            name: "imageSha256",
            title: "Image SHA-256",
            type: "string",
            readOnly: true,
            validation: (Rule) => Rule.regex(/^[a-f0-9]{64}$/),
        }),
        defineField({ name: "widthPx", title: "Release width", type: "number", readOnly: true }),
        defineField({ name: "heightPx", title: "Release height", type: "number", readOnly: true }),
        defineField({
            name: "alphaBounds",
            title: "Alpha bounds",
            type: "object",
            readOnly: true,
            fields: [
                defineField({ name: "left", type: "number" }),
                defineField({ name: "top", type: "number" }),
                defineField({ name: "right", type: "number" }),
                defineField({ name: "bottom", type: "number" }),
            ],
        }),
        defineField({ name: "mountAxisXPx", title: "Mount axis X", type: "number", readOnly: true }),
        defineField({ name: "seatYPx", title: "Seat Y", type: "number", readOnly: true }),
        defineField({
            name: "approvalStatus",
            title: "Madison approval",
            type: "string",
            readOnly: true,
            options: { list: [{ title: "Approved", value: "approved" }] },
        }),
        defineField({ name: "candidateId", title: "Candidate ID", type: "string", readOnly: true }),
        defineField({ name: "placementVersionId", title: "Placement version", type: "string", readOnly: true }),
        defineField({
            name: "image",
            title: "Layer PNG",
            type: "image",
            options: { hotspot: false },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "offsetX",
            title: "Offset X (px)",
            type: "number",
            initialValue: 0,
            description: "Horizontal nudge — positive = right, negative = left",
        }),
        defineField({
            name: "offsetY",
            title: "Offset Y (px)",
            type: "number",
            initialValue: 0,
            description: "Vertical nudge — positive = down, negative = up",
        }),
    ],
    preview: {
        select: { slot: "slot", variantKey: "variantKey", media: "image" },
        prepare({ slot, variantKey, media }) {
            return {
                title: `${slot ?? "?"} — ${variantKey ?? ""}`,
                media,
            };
        },
    },
});

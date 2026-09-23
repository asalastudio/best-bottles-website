import { defineType, defineField } from "sanity";

/**
 * One hotspot on the homepage hero scene. Placed in the Studio by clicking on the hero reference
 * still (sanity-plugin-hotspot-array); x/y are percentages from the top-left of that image and are
 * mapped onto the live hero stage, so the still must be the current hero frame at its full extent.
 */
export const heroHotspot = defineType({
    name: "heroHotspot",
    title: "Hero hotspot",
    type: "object",
    fieldsets: [{ name: "position", title: "Position (set by clicking the image)", options: { columns: 2 } }],
    fields: [
        defineField({ name: "label", title: "Label", type: "string", validation: (rule) => rule.required().max(60),
            description: "Short name shown beside the dot, e.g. Empire 50 mL." }),
        defineField({ name: "detail", title: "Detail", type: "text", rows: 2,
            description: "Optional one-liner shown with the label on hover or tap." }),
        defineField({ name: "href", title: "Link", type: "string",
            description: "Where the hotspot goes when clicked, e.g. /products/empire-50ml-clear-18-415. Leave empty for an information-only dot.",
            validation: (rule) => rule.custom((value) => !value || value.startsWith("/") || value.startsWith("https://") || "Use a site path starting with / or an https:// URL.") }),
        defineField({ name: "follows", title: "Follows", type: "string", initialValue: "fixed",
            options: { list: [{ title: "Fixed point on the scene", value: "fixed" }, { title: "The closure currently on the bottle", value: "closure" }], layout: "radio" },
            description: "\"The closure\" makes the label read the name of whichever closure is on the bottle at that moment." }),
        defineField({ name: "x", title: "X %", type: "number", readOnly: true, fieldset: "position", initialValue: 50, validation: (rule) => rule.required().min(0).max(100) }),
        defineField({ name: "y", title: "Y %", type: "number", readOnly: true, fieldset: "position", initialValue: 50, validation: (rule) => rule.required().min(0).max(100) }),
    ],
    preview: {
        select: { title: "label", x: "x", y: "y", follows: "follows" },
        prepare({ title, x, y, follows }) {
            return { title: title || "Hotspot", subtitle: `${x != null && y != null ? `${Math.round(x)}% × ${Math.round(y)}%` : "No position set"}${follows === "closure" ? " · follows the closure" : ""}` };
        },
    },
});

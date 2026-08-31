import { defineField, defineType } from "sanity";

export const paperDollAssemblyMapping = defineType({
    name: "paperDollAssemblyMapping",
    title: "Paper Doll catalog mapping",
    type: "object",
    fields: [
        defineField({ name: "mappingKey", title: "Mapping key", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "websiteSku", title: "Website SKU", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "graceSku", title: "Grace SKU", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "recipeKey", title: "Recipe key", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "bodyVariantKey", title: "Body variant", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "fitmentVariantKey", title: "Fitment variant", type: "string" }),
        defineField({ name: "closureVariantKey", title: "Closure variant", type: "string" }),
        defineField({ name: "overcapVariantKey", title: "Overcap variant", type: "string" }),
    ],
});

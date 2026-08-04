import { defineArrayMember, defineField, defineType } from "sanity";

export const paperDollAssemblyRecipe = defineType({
    name: "paperDollAssemblyRecipe",
    title: "Paper Doll assembly recipe",
    type: "object",
    fields: [
        defineField({ name: "recipeKey", title: "Recipe key", type: "string", validation: (Rule) => Rule.required() }),
        defineField({
            name: "mode",
            title: "Mode",
            type: "string",
            options: { list: ["rollon", "spray", "lotion", "closure"] },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "layerOrder",
            title: "Layer order",
            type: "array",
            of: [defineArrayMember({ type: "string" })],
            validation: (Rule) => Rule.required().min(1),
        }),
    ],
});

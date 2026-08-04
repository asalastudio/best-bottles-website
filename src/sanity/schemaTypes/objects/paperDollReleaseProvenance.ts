import { defineField, defineType } from "sanity";

export const paperDollReleaseProvenance = defineType({
    name: "paperDollReleaseProvenance",
    title: "Paper Doll release provenance",
    type: "object",
    fields: [
        defineField({ name: "sourceGitCommit", title: "Madison Git commit", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "rendererVersion", title: "Renderer version", type: "string", validation: (Rule) => Rule.required() }),
    ],
});

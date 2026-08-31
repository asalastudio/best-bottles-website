import { defineArrayMember, defineField, defineType } from "sanity";

export const paperDollQaEvidence = defineType({
    name: "paperDollQaEvidence",
    title: "Paper Doll QA evidence",
    type: "object",
    fields: [
        defineField({ name: "evidenceId", title: "Evidence ID", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "subjectId", title: "Subject ID", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "gateKey", title: "Gate", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "gateVersion", title: "Gate version", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "status", title: "Status", type: "string", validation: (Rule) => Rule.required() }),
        defineField({ name: "blocking", title: "Blocking", type: "boolean", validation: (Rule) => Rule.required() }),
        defineField({ name: "calibratedWith", title: "Calibrated with", type: "array", of: [defineArrayMember({ type: "string" })] }),
        defineField({ name: "measurementsJson", title: "Measurements", type: "text", rows: 5, readOnly: true }),
        defineField({ name: "issues", title: "Issues", type: "array", of: [defineArrayMember({ type: "string" })] }),
    ],
});

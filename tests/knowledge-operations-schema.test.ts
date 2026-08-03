import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("knowledge operations schema", () => {
    it("persists minimized traces and review-only corrections", () => {
        const schema = readFileSync("convex/schema.ts", "utf8");
        expect(schema).toContain("knowledgeTraces");
        expect(schema).toContain("knowledgeCorrections");
        expect(schema).toContain("rateCardVersion");
        expect(schema).toContain("rawContentStored: v.literal(false)");
        expect(schema).toContain('.index("by_completedAt"');
        expect(schema).toContain('.index("by_status"');
    });
});

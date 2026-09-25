import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSearchLogPayload, scrubSearchQuery, SEARCH_LOG_MAX_QUERY_LENGTH } from "@/lib/catalog/searchLog";

describe("search log query scrubbing", () => {
    it("lowercases, trims and collapses whitespace", () => {
        expect(scrubSearchQuery("  Amber   Dropper 1oz ")).toBe("amber dropper 1oz");
    });

    it("removes email addresses and phone or account numbers", () => {
        expect(scrubSearchQuery("send quote to jane.doe@example.com")).toBe("send quote to [email]");
        expect(scrubSearchQuery("call me 415-555-0199 about droppers")).toBe("call me [number] about droppers");
        expect(scrubSearchQuery("+1 (800) 936 3628")).toBe("[number]");
    });

    it("keeps sizes, neck finishes and SKUs searchable", () => {
        expect(scrubSearchQuery("sprayer that fits 13-415")).toBe("sprayer that fits 13-415");
        expect(scrubSearchQuery("100 ml clear 18/415")).toBe("100 ml clear 18/415");
        expect(scrubSearchQuery("GBCyl9SpryGl")).toBe("gbcyl9sprygl");
    });

    it("caps the stored length", () => {
        expect(scrubSearchQuery("roll on ".repeat(40)).length).toBeLessThanOrEqual(SEARCH_LOG_MAX_QUERY_LENGTH);
    });
});

describe("search log payload parsing", () => {
    it("accepts the three event kinds and nothing else", () => {
        expect(parseSearchLogPayload({ query: "attar", locale: "en", event: { kind: "search", resultCount: 0 } }))
            .toEqual({ query: "attar", locale: "en", event: { kind: "search", resultCount: 0 } });
        expect(parseSearchLogPayload({ query: "attar", locale: "en", event: { kind: "suggestions_shown", labels: ["Roll-on", 4, "Reducer", "Dropper", "Extra"] } }))
            .toEqual({ query: "attar", locale: "en", event: { kind: "suggestions_shown", labels: ["Roll-on", "Reducer", "Dropper"] } });
        expect(parseSearchLogPayload({ query: "attar", locale: "fr", event: { kind: "suggestion_click", label: "Roll-on" } })?.locale).toBe("en");
        expect(parseSearchLogPayload({ query: "attar", locale: "en", event: { kind: "search", resultCount: Number.NaN } })).toBeNull();
        expect(parseSearchLogPayload({ query: "attar", locale: "en", event: { kind: "delete_everything" } })).toBeNull();
        expect(parseSearchLogPayload("nope")).toBeNull();
    });
});

describe("search log storage contract", () => {
    it("stores no user, session or IP fields", () => {
        const schema = readFileSync("convex/schema.ts", "utf8");
        const table = schema.slice(schema.indexOf("catalogSearchDaily: defineTable"), schema.indexOf("errorIssueEvents: defineTable"));
        expect(table).not.toMatch(/userId|sessionId|email|\bip\b|identifier/i);
    });

    it("keeps rows for a bounded period", () => {
        const source = readFileSync("convex/catalogSearchLog.ts", "utf8");
        const crons = readFileSync("convex/crons.ts", "utf8");
        expect(source).toContain("RETENTION_DAYS = 90");
        expect(crons).toContain("internal.catalogSearchLog.deleteExpired");
    });
});

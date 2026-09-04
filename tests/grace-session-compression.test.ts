import { describe, expect, it } from "vitest";
import {
    CATALOG_HINT_PROMPT,
    buildCatalogSessionNote,
    compressCatalogPayload,
    compressRealtimeHistory,
    mergeSessionContextBlocks,
    shouldCompressAfterCatalogResult,
} from "../src/lib/grace/sessionCompression";

describe("Grace session compression", () => {
    it("compresses after a fat catalog payload or every second catalog call", () => {
        expect(shouldCompressAfterCatalogResult({ resultChars: 80, catalogCallsSinceCompress: 1 })).toBe(false);
        expect(shouldCompressAfterCatalogResult({ resultChars: 80, catalogCallsSinceCompress: 2 })).toBe(true);
        expect(shouldCompressAfterCatalogResult({ resultChars: 2000, catalogCallsSinceCompress: 1 })).toBe(true);
    });

    it("keeps a compact catalog note and the hint prompt", () => {
        const note = buildCatalogSessionNote({
            toolName: "searchCatalog",
            summary: "Found 12 amber roll-ons",
            resultCount: 12,
        });
        expect(note).toContain("LAST CATALOG RESULT: searchCatalog (12 rows)");
        expect(note).toContain(CATALOG_HINT_PROMPT);
        expect(compressCatalogPayload("x".repeat(20))).toHaveLength(20);
        expect(compressCatalogPayload("x".repeat(800)).endsWith("chars]")).toBe(true);
    });

    it("prunes old function outputs and replaces a prior catalog note", () => {
        const history = Array.from({ length: 20 }, (_, index) => ({
            type: index % 2 === 0 ? "function_call" : "message",
            output: "y".repeat(900),
            name: "searchCatalog",
        }));
        const compressed = compressRealtimeHistory(history);
        expect(compressed).toHaveLength(16);
        expect(compressed[0]?.output?.includes("[compressed")).toBe(true);

        const merged = mergeSessionContextBlocks(
            "URL: /products/fine-mist\nLAST CATALOG RESULT: old\nstale json\nCATALOG HINT: old",
            "LAST CATALOG RESULT: searchCatalog\namber roller\nCATALOG HINT: navigate",
        );
        expect(merged).toContain("URL: /products/fine-mist");
        expect(merged).toContain("amber roller");
        expect(merged).not.toContain("stale json");
    });
});

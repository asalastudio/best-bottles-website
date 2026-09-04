/**
 * Session compression for Grace Realtime.
 *
 * Fat catalog JSON stays in conversation history and crowds out page context.
 * After catalog tools we keep a compact summary and push a session.update
 * (via updateAgent) so gpt-realtime-2.1 is not re-reading the full payload.
 */

export const CATALOG_HINT_PROMPT =
    "CATALOG HINT: Do not re-read the JSON aloud. Quote only fields present in the last catalog result. If they want a different glass color or applicator, navigate to that product page. If they want a cap, roller, or cap on/off on THIS page, call configureCurrentProduct.";

export const FAT_CATALOG_TOOLS = [
    "searchCatalog",
    "getFamilyOverview",
    "getProductBySku",
    "getBottleComponents",
    "compareProducts",
    "showProductPresentation",
    "getProductMeasurements",
] as const;

export type FatCatalogTool = (typeof FAT_CATALOG_TOOLS)[number];

const FAT_RESULT_CHARS = 1_200;
const COMPRESS_EVERY_N_CATALOG_CALLS = 2;
const HISTORY_KEEP = 16;
const TOOL_OUTPUT_KEEP = 480;

export function isFatCatalogTool(name: string): name is FatCatalogTool {
    return (FAT_CATALOG_TOOLS as readonly string[]).includes(name);
}

export function shouldCompressAfterCatalogResult(args: {
    resultChars: number;
    catalogCallsSinceCompress: number;
}): boolean {
    if (args.resultChars >= FAT_RESULT_CHARS) return true;
    return args.catalogCallsSinceCompress >= COMPRESS_EVERY_N_CATALOG_CALLS;
}

export function compressCatalogPayload(payload: string): string {
    const trimmed = payload.trim();
    if (trimmed.length <= TOOL_OUTPUT_KEEP) return trimmed;
    return `${trimmed.slice(0, TOOL_OUTPUT_KEEP)}… [compressed ${trimmed.length - TOOL_OUTPUT_KEEP} chars]`;
}

export function buildCatalogSessionNote(args: {
    toolName: string;
    summary: string;
    resultCount?: number;
}): string {
    const count = typeof args.resultCount === "number" ? ` (${args.resultCount} rows)` : "";
    return [
        `LAST CATALOG RESULT: ${args.toolName}${count}`,
        compressCatalogPayload(args.summary),
        CATALOG_HINT_PROMPT,
    ].join("\n");
}

export type CompressibleHistoryItem = {
    type?: string;
    output?: string | null;
    name?: string;
};

export function compressRealtimeHistory<T extends CompressibleHistoryItem>(history: T[]): T[] {
    return history.slice(-HISTORY_KEEP).map((item) => {
        if (item.type === "function_call" && typeof item.output === "string" && item.output.length > TOOL_OUTPUT_KEEP) {
            return { ...item, output: compressCatalogPayload(item.output) };
        }
        return item;
    });
}

export function mergeSessionContextBlocks(base: string, catalogNote: string | null): string {
    const withoutPrior = base
        .replace(/\nLAST CATALOG RESULT:[\s\S]*?(?=\n[A-Z][A-Z ]+:|\s*$)/, "")
        .replace(/\nCATALOG HINT:[\s\S]*?(?=\n[A-Z][A-Z ]+:|\s*$)/, "")
        .trim();
    if (!catalogNote?.trim()) return withoutPrior;
    return `${withoutPrior}\n\n${catalogNote.trim()}`.trim();
}

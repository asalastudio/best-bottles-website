import { describe, expect, it } from "vitest";
import {
    executeGraceServerTool,
    normalizeGraceServerToolCall,
} from "../src/lib/grace/toolGatewayServer";
import { POST as graceToolsPost } from "../src/app/api/grace/tools/route";

describe("provider-neutral Grace tool executor", () => {
    it("exports an injectable server executor", () => {
        expect(typeof executeGraceServerTool).toBe("function");
        expect(typeof graceToolsPost).toBe("function");
    });

    it("rejects a missing tool before accessing Convex", async () => {
        await expect(executeGraceServerTool({
            toolName: "" as never,
            parameters: {},
        })).rejects.toThrow("Missing tool_name");
    });

    it("maps shared presentation tools onto the same Convex-backed reads", () => {
        expect(normalizeGraceServerToolCall("displayCompatibility", { bottleSku: "GB9ML17" })).toEqual({
            toolName: "getBottleComponents",
            parameters: { bottleSku: "GB9ML17" },
        });
        expect(normalizeGraceServerToolCall("compareProducts", { query: "amber 9ml", family: "Cylinder" })).toEqual({
            toolName: "searchCatalog",
            parameters: { searchTerm: "amber 9ml", familyLimit: "Cylinder" },
        });
    });
});

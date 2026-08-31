import { describe, expect, it } from "vitest";
import {
    executeGraceServerTool,
    normalizeGraceServerToolCall,
} from "../src/lib/grace/toolGatewayServer";
import { POST as graceToolsPost } from "../src/app/api/grace/tools/route";
import {
    executePublicGraceToolCall,
    parsePublicGraceToolCall,
} from "../src/lib/grace/publicToolCallServer";

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

    it("rejects undeclared public registry arguments before executing a tool", () => {
        expect(() => parsePublicGraceToolCall({
            tool_name: "getFamilyOverview",
            parameters: { family: "Cylinder", bypass: true },
        })).toThrow("Invalid parameters");
    });

    it("strictly bounds retained public compatibility aliases", () => {
        expect(() => parsePublicGraceToolCall({
            tool_name: "getProductsForComparison",
            parameters: { graceSkus: Array.from({ length: 50 }, (_, index) => `SKU-${index}`) },
        })).toThrow("too many items");
    });

    it("applies the shared public authorization policy to browser tool calls", async () => {
        const execute = async () => ({ shouldNotRun: true });
        await expect(executePublicGraceToolCall({
            tool_name: "listGraceProjects",
            parameters: {},
        }, "request-test", execute)).rejects.toThrow("missing_scope:customer_project.read.self");
    });
});

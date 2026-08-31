import { describe, expect, it } from "vitest";
import {
    authorizeKnowledgeTool,
    resolveKnowledgeScopes,
} from "../src/lib/knowledge/authorization";
import type { KnowledgeRequestContext } from "../src/lib/knowledge/contracts";

const context = (
    role: KnowledgeRequestContext["role"],
    surface: KnowledgeRequestContext["surface"],
): KnowledgeRequestContext => ({
    surface,
    role,
    actorId: role === "public" ? null : "user_123",
    organizationId: role === "public" ? null : "org_123",
    conversationId: "conversation_123",
    projectId: null,
    refineState: null,
    requestId: "request_123",
});

describe("knowledge authorization", () => {
    it("gives public Grace only public product and proposal scopes", () => {
        expect(resolveKnowledgeScopes("public")).toEqual(new Set([
            "catalog.read",
            "compatibility.read",
            "public_knowledge.read",
            "cart.propose",
            "navigation.propose",
        ]));
    });

    it("allows employees to read internal knowledge and submit corrections", () => {
        expect(authorizeKnowledgeTool(
            context("employee", "employee_workspace"),
            ["internal_knowledge.read", "correction.submit"],
            ["employee_workspace"],
        )).toEqual({ allowed: true });
    });

    it("denies a public caller that requests internal knowledge", () => {
        expect(authorizeKnowledgeTool(
            context("public", "storefront"),
            ["internal_knowledge.read"],
            ["storefront", "employee_workspace"],
        )).toEqual({ allowed: false, reason: "missing_scope:internal_knowledge.read" });
    });

    it("denies a tool on an unapproved surface even when the role has its scope", () => {
        expect(authorizeKnowledgeTool(
            context("executive", "storefront"),
            ["executive_metrics.read"],
            ["executive_hub"],
        )).toEqual({ allowed: false, reason: "surface_not_allowed:storefront" });
    });

    it("keeps support outside executive-only scopes", () => {
        expect(resolveKnowledgeScopes("support")).not.toContain("executive_metrics.read");
        expect(resolveKnowledgeScopes("support")).not.toContain("trace.read");
    });
});

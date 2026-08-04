import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KnowledgeMessage from "../src/components/grace-workspace/KnowledgeMessage";

describe("employee knowledge workspace", () => {
    it("labels internal answers and renders source citations", () => {
        const html = renderToStaticMarkup(createElement(KnowledgeMessage, {
            message: {
                id: "message_1",
                role: "assistant",
                content: "The 17-415 Cylinder supports a lotion pump.",
                citations: [{ sourceId: "convex:fitment:17-415", title: "Live Convex fitment", kind: "product_truth" as const }],
                requestId: "request_1",
            },
            onCorrect: () => undefined,
        }));
        expect(html).toContain("Internal answer");
        expect(html).toContain("Grace · Internal knowledge");
        expect(html).not.toContain("Grace · Marin");
        expect(html).toContain("Live Convex fitment");
        expect(html).toContain("Suggest a correction");
    });

    it("selects employee mode only after a server-side team access check", () => {
        const source = readFileSync("src/app/grace-workspace/WorkspaceModeServer.tsx", "utf8");
        expect(source).toContain("hasTeamHubAccess");
        expect(source).toContain("EmployeeKnowledgeWorkspace");
        expect(source.indexOf("hasTeamHubAccess")).toBeLessThan(source.lastIndexOf("<EmployeeKnowledgeWorkspace"));
        expect(source).not.toContain("publicMetadata=");
    });

    it("does not label an anonymous workspace visitor as signed in", () => {
        const source = readFileSync("src/components/grace-workspace/WorkspaceShell.tsx", "utf8");
        expect(source).toContain('user ? "Signed in" : "Sign in required"');
        expect(source).toContain(': "Guest";');
    });
});

/**
 * The workspace shell, after the employee/customer fork was removed.
 *
 * `tests/employee-knowledge-workspace.test.ts` used to live here. Every
 * assertion in it described the fork — a KnowledgeMessage component, a
 * WorkspaceModeServer that branched on team access — so it went with the
 * feature. The one invariant worth carrying forward is this: the workspace is
 * public, and a visitor who is not signed in must not be presented as though
 * they were.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync("src/components/grace-workspace/WorkspaceShell.tsx", "utf8");
const page = readFileSync("src/app/grace-workspace/page.tsx", "utf8");

describe("grace workspace shell", () => {
    it("does not present an anonymous visitor as signed in", () => {
        expect(shell).toContain('"Guest"');
        expect(shell).not.toContain('"Signed in" : "Sign in required"');
    });

    it("offers a guest a way in rather than a wall", () => {
        expect(shell).toContain("/sign-in?redirect_url=/grace-workspace");
        expect(shell).toContain("Save sessions and projects");
    });

    it("serves one workspace to everyone", () => {
        // The page renders the client workspace directly. A reintroduced fork
        // would show up here as a branch on team access.
        expect(page).toContain("GraceWorkspaceClient");
        expect(page).not.toContain("hasTeamHubAccess");
        expect(page).not.toContain("EmployeeKnowledgeWorkspace");
    });
});

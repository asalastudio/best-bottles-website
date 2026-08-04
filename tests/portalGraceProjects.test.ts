import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Grace authenticated project writes", () => {
    it("checks organization ownership in Convex and writes through a server-held token", () => {
        const convex = read("convex/portal.ts");
        const server = read("src/lib/portal/server.ts");
        expect(convex).toContain("saveBottleToGraceProject");
        expect(convex).toContain("project.clerkOrgId !== args.clerkOrgId");
        expect(convex).toContain("verifyWriteToken(args.writeToken)");
        expect(server).toContain("saveProductToGraceProjectForViewer");
        expect(server).toContain("getConvexWriteToken()");
    });

    it("only calls the project write endpoint from the confirmation handler", () => {
        const provider = read("src/components/grace/GraceProvider.tsx");
        const proposalStart = provider.indexOf("proposeProjectSave:");
        const proposalEnd = provider.indexOf("displayAnatomy:", proposalStart);
        const proposalBlock = provider.slice(proposalStart, proposalEnd);
        expect(proposalBlock).toContain('type: "proposeProjectSave"');
        expect(proposalBlock).not.toContain('fetch("/api/portal/grace/projects"');
        expect(provider).toContain("confirmProjectSave");
        expect(provider).toContain('"/api/portal/grace/projects"');
    });
});

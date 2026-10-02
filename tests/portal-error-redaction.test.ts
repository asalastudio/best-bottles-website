import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ workspace: vi.fn(), save: vi.fn(), mutation: vi.fn(), auth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/portal/server", () => ({
    getPortalGraceWorkspace: mocks.workspace,
    saveProductToGraceProjectForViewer: mocks.save,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/clerk", () => ({ CLERK_ENABLED: true }));
vi.mock("@/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ mutation: mocks.mutation }),
    getPortalConvexWriteToken: () => "synthetic-server-token-do-not-expose",
}));
import { GET, POST } from "../src/app/api/portal/grace/projects/route";
import { POST as recordSession } from "../src/app/api/grace/sessions/route";

const SYNTHETIC_TOKEN = "synthetic-server-token-do-not-expose";
const backendError = () => new Error(`ArgumentValidationError: Object contains extra field writeToken that is not in the validator. Object: {clerkOrgId: "org_fixture", writeToken: "${SYNTHETIC_TOKEN}"}`);
const request = (path: string, body: unknown) => new NextRequest(`https://example.test${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const projectRequest = () => request("/api/portal/grace/projects", { bottle: { description: "Synthetic bottle" } });
const sessionRequest = () => request("/api/grace/sessions", {
    sessionId: "synthetic-session", messages: [{ role: "user", text: "Synthetic question" }],
});

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_fixture", orgId: "org_fixture" });
});

describe("credential-bearing backend errors stay out of HTTP responses", () => {
    it("redacts old-backend extra-argument validation errors from project GET", async () => {
        mocks.workspace.mockRejectedValue(backendError());
        const response = await GET();
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Unable to load Grace projects." });
    });
    it("redacts backend arguments from project POST", async () => {
        mocks.save.mockRejectedValue(backendError());
        const response = await POST(projectRequest());
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Unable to save the Grace project." });
    });
    it.each([
        ["Unauthenticated", 401], ["No active organization selected.", 403], ["Portal auth is disabled.", 503],
    ])("preserves the project authorization status for %s without echoing details", async (message, status) => {
        mocks.workspace.mockRejectedValue(new Error(String(message)));
        mocks.save.mockRejectedValue(new Error(String(message)));
        for (const response of [await GET(), await POST(projectRequest())]) {
            expect(response.status).toBe(status);
            expect(await response.text()).not.toContain(String(message));
        }
    });
    it("redacts token-bearing errors from session sync", async () => {
        mocks.mutation.mockRejectedValue(backendError());
        const response = await recordSession(sessionRequest());
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Unable to record the session." });
    });
    it("preserves session ownership denial without exposing a wrapped backend error", async () => {
        mocks.mutation.mockRejectedValue(new Error(`session_owned_by_other_user; writeToken: ${SYNTHETIC_TOKEN}`));
        const response = await recordSession(sessionRequest());
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "This session belongs to another user." });
    });
    it("preserves successful project and session responses", async () => {
        mocks.workspace.mockResolvedValue({ projects: [] });
        mocks.save.mockResolvedValue({ projectId: "fixture-project" });
        mocks.mutation.mockResolvedValue("fixture-session");
        expect(await (await GET()).json()).toEqual({ projects: [] });
        expect(await (await POST(projectRequest())).json()).toEqual({ projectId: "fixture-project" });
        expect(await (await recordSession(sessionRequest())).json()).toEqual({ ok: true, id: "fixture-session" });
    });
});

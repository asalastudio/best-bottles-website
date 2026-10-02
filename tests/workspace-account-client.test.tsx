// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceAccount } from "../src/components/grace-workspace/useWorkspaceAccount";

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();
const data = (orgId: string) => ({ userId: "user_a", orgId, account: { companyName: orgId, tier: "Wholesale" }, projects: [] });
function Harness({ userId, orgId }: { userId: string | null; orgId: string | null }) {
    const account = useWorkspaceAccount(userId, orgId);
    return <span>{account?.account?.companyName ?? "empty"}</span>;
}
async function render(userId: string | null, orgId: string | null) {
    await act(async () => root.render(<Harness userId={userId} orgId={orgId} />));
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("workspace account client isolation", () => {
    it("fetches without transmitting IDs or backend credentials and clears on sign-out", async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => data("org_a") });
        await render("user_a", "org_a");
        expect(container.textContent).toBe("org_a");
        expect(fetchMock).toHaveBeenCalledWith("/api/grace/workspace-account", { cache: "no-store", signal: expect.any(AbortSignal) });
        await render(null, null);
        expect(container.textContent).toBe("empty");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("hides old organization data immediately and ignores a late previous response", async () => {
        let finish: (value: unknown) => void = () => {};
        fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
            .mockResolvedValueOnce({ ok: true, json: async () => data("org_b") });
        await render("user_a", "org_a");
        await render("user_a", "org_b");
        expect(container.textContent).toBe("org_b");
        await act(async () => { finish({ ok: true, json: async () => data("org_a") }); });
        expect(container.textContent).toBe("org_b");
        await render("user_other", "org_b");
        expect(container.textContent).toBe("empty");
    });

    it("rejects data from a server session that switched before the client caught up", async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => data("org_b") });
        await render("user_a", "org_a");
        expect(container.textContent).toBe("empty");
    });
});

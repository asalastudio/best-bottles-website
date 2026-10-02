import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/portal/server", () => ({ savePortalAddressesForViewer: mocks.save }));
import { saveAddressAction } from "../src/app/(portal)/portal/actions";
const previous = { ok: false, errors: {}, message: null };
beforeEach(() => { vi.resetAllMocks(); });
describe("address action preconditions", () => {
    it("forwards the rendered preconditions and surfaces conflicts without retry or revalidation", async () => {
        const form = new FormData(); form.set("expectedOrgId", "org_rendered"); form.set("expectedVersion", "7"); form.set("requestId", "request_rendered_0001");
        mocks.save.mockResolvedValue({ ok: false, errors: {}, shopifyWarning: null, message: "Reload and review before saving." });
        expect(await saveAddressAction(previous, form)).toEqual({ ok: false, errors: {}, message: "Reload and review before saving." });
        expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ expectedOrgId: "org_rendered", expectedVersion: 7, requestId: "request_rendered_0001" }));
        expect(mocks.save).toHaveBeenCalledTimes(1); expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it("does not coerce a missing address version into an initial revision", async () => {
        mocks.save.mockResolvedValue({ ok: false, errors: {}, shopifyWarning: null, message: "Reload." });
        await saveAddressAction(previous, new FormData());
        expect(mocks.save.mock.calls[0][0].expectedVersion).toBeNaN();
    });
});

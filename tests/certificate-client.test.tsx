// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResaleCertificateForm from "../src/components/portal/ResaleCertificateForm";
import CertificateStatusRefresh from "../src/components/portal/CertificateStatusRefresh";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
let root: Root, container: HTMLDivElement;
const fetchMock = vi.fn(), validateUpload = vi.fn(), createUploadUrl = vi.fn();
beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    fetchMock.mockResolvedValue({ ok: true }); validateUpload.mockResolvedValue({ storageId: "verified-storage", error: null });
    createUploadUrl.mockResolvedValue({ url: "https://synthetic.convex.site/certificate-upload", ticket: "synthetic-ticket", documentId: "doc" });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render() {
    await act(async () => root.render(<ResaleCertificateForm createUploadUrl={createUploadUrl} validateUpload={validateUpload} submitAction={async () => ({ ok: true, error: null })} />));
}
async function choose(file: File) {
    const input = container.querySelector('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
const storageValue = () => (container.querySelector('input[name="documentStorageId"]') as HTMLInputElement).value;
describe("certificate browser flow", () => {
    it("clears an earlier valid attachment when its replacement is oversized", async () => {
        await render(); await choose(new File(["fixture"], "test.pdf", { type: "application/pdf" }));
        expect(storageValue()).toBe("verified-storage");
        const large = new File(["x"], "large.pdf", { type: "application/pdf" }); Object.defineProperty(large, "size", { value: 16 * 1024 * 1024 });
        await choose(large);
        expect(storageValue()).toBe("");
        expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
        expect(createUploadUrl).toHaveBeenCalledTimes(1);
    });
    it("ignores late validation of an older upload", async () => {
        let finish: (value: unknown) => void = () => {};
        validateUpload.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ storageId: "new-storage" });
        await render(); await choose(new File(["a"], "first.pdf", { type: "application/pdf" }));
        await choose(new File(["b"], "second.pdf", { type: "application/pdf" }));
        expect(storageValue()).toBe("new-storage");
        await act(async () => finish({ storageId: "old-storage" }));
        expect(storageValue()).toBe("new-storage");
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer synthetic-ticket");
    });
    it("refreshes visible status but does not interrupt an active form", async () => {
        vi.useFakeTimers();
        await act(async () => root.render(<><CertificateStatusRefresh /><form><input /></form></>));
        await act(async () => { vi.advanceTimersByTime(30_000); });
        expect(refresh).toHaveBeenCalledTimes(1);
        container.querySelector("input")!.focus();
        await act(async () => { vi.advanceTimersByTime(30_000); window.dispatchEvent(new Event("focus")); });
        expect(refresh).toHaveBeenCalledTimes(1);
    });
});

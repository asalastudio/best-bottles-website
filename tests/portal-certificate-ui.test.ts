/**
 * Certificate submission action + the two new surfaces.
 *
 * The action tests cover what a customer sees when they get something wrong —
 * a wholesale buyer should never be shown a raw error key. The contract
 * assertions cover the two places where a page could quietly lie about tax
 * status or let the wrong person approve a permit.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const submitResaleCertificateForViewer = vi.fn();
vi.mock("@/lib/portal/certificates", () => ({
    submitResaleCertificateForViewer: (...a: unknown[]) => submitResaleCertificateForViewer(...a),
    generateCertificateUploadUrlForViewer: vi.fn(),
    approveCertificateAsStaff: vi.fn(),
    rejectCertificateAsStaff: vi.fn(),
}));
vi.mock("@/lib/portal/server", () => ({
    createGraceProjectForViewer: vi.fn(),
    createPortalDraftForViewer: vi.fn(),
    createPortalDraftFromOrderForViewer: vi.fn(),
}));

const { submitCertificateAction } = await import("../src/app/(portal)/portal/actions");

const EMPTY = { ok: false, error: null };

function form(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
}

const VALID = {
    legalBusinessName: "Lumière Atelier LLC",
    issuingState: "CA",
    permitNumber: "123-456789",
};

beforeEach(() => {
    vi.clearAllMocks();
    submitResaleCertificateForViewer.mockResolvedValue({ certificateId: "cert_1" });
});

describe("submitCertificateAction", () => {
    it("accepts a complete submission", async () => {
        const result = await submitCertificateAction(EMPTY, form(VALID));
        expect(result).toEqual({ ok: true, error: null });
    });

    it("names the missing field rather than failing generically", async () => {
        const noName = await submitCertificateAction(EMPTY, form({ ...VALID, legalBusinessName: "  " }));
        expect(noName.error).toMatch(/legal business name/i);

        const noState = await submitCertificateAction(EMPTY, form({ ...VALID, issuingState: "" }));
        expect(noState.error).toMatch(/state/i);

        const noPermit = await submitCertificateAction(EMPTY, form({ ...VALID, permitNumber: "" }));
        expect(noPermit.error).toMatch(/permit number/i);

        expect(submitResaleCertificateForViewer).not.toHaveBeenCalled();
    });

    it("treats the document as optional", async () => {
        await submitCertificateAction(EMPTY, form(VALID));
        expect(submitResaleCertificateForViewer).toHaveBeenCalledWith(
            expect.objectContaining({ documentStorageId: undefined }),
        );
    });

    it("passes an uploaded document through", async () => {
        await submitCertificateAction(EMPTY, form({ ...VALID, documentStorageId: "kg2abc" }));
        expect(submitResaleCertificateForViewer).toHaveBeenCalledWith(
            expect.objectContaining({ documentStorageId: "kg2abc" }),
        );
    });

    it("never shows a raw error key to a customer", async () => {
        submitResaleCertificateForViewer.mockRejectedValue(new Error("unsupported_issuing_state"));
        const result = await submitCertificateAction(EMPTY, form({ ...VALID, issuingState: "XX" }));

        expect(result.ok).toBe(false);
        expect(result.error).not.toMatch(/unsupported_issuing_state/);
        expect(result.error).toMatch(/account manager/i);
    });

    it("degrades to a readable message on an unexpected failure", async () => {
        submitResaleCertificateForViewer.mockRejectedValue(new Error("ECONNRESET"));
        const result = await submitCertificateAction(EMPTY, form(VALID));

        expect(result.ok).toBe(false);
        expect(result.error).not.toMatch(/ECONNRESET/);
    });
});

// ─── Surface contracts ──────────────────────────────────────────────────────

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("tax exemption page", () => {
    const page = read("src/app/(portal)/portal/tax-exemption/page.tsx");

    it("warns when an approval has not reached Shopify", () => {
        // Approved in Convex but unsynced means checkout still charges tax.
        expect(page).toContain("shopifySyncedAt");
        expect(page).toMatch(/may still be taxed/i);
    });

    it("does not offer the form while a submission is under review", () => {
        expect(page).toContain("{!pending && !active && (");
    });
});

describe("staff review queue", () => {
    const page = read("src/app/team/resale-certificates/page.tsx");

    it("goes through the staff-gated data function", () => {
        expect(page).toContain("listAllCertificatesForStaff");
        expect(page).toContain("isStaffAccessError");
    });

    it("separates the two states that cost money from the rest of the table", () => {
        // Approved-but-unsynced means the account is still charged tax; lapsed
        // means Shopify may still be exempting it. Both need to be visible
        // without scanning a long table.
        expect(page).toContain("awaitingShopifySync");
        expect(page).toContain("lapsed");
        expect(page).toMatch(/Needs attention/);
    });

    it("warns before approving an account that cannot receive the exemption", () => {
        expect(page).toMatch(/no billing email/i);
    });

    it("flags a row with no document to verify against", () => {
        expect(page).toMatch(/No document attached/i);
    });

    it("requires a rejection reason", () => {
        expect(page).toMatch(/name="reviewNote"[\s\S]{0,120}required/);
    });
});

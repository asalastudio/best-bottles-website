// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Purchase-order drafts.
 *
 * `unitPrice` on a draft line becomes the Shopify price override — literally
 * what the customer is charged — so the risks worth guarding are a draft being
 * read or written by the wrong organization, a submitted order being edited
 * after the fact, and a quantity that makes no sense reaching Shopify.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

const WRITE_TOKEN = "test-write-token";
const ORG = "org_lumiere";
const OTHER_ORG = "org_rival";
const USER = "user_buyer";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

async function seed(t: ReturnType<typeof convexTest>) {
    await t.mutation(api.portal.upsertPortalAccount, {
        writeToken: WRITE_TOKEN,
        clerkOrgId: ORG,
        companyName: "Lumière Atelier",
        accountNumber: "BB-1001",
        tier: "The Scaler",
        accountManager: "Aamir Nemat",
        netTerms: "",
        taxExempt: false,
        memberSince: "January 2026",
    });
    const { draftId } = await t.mutation(api.portal.createDraft, {
        writeToken: WRITE_TOKEN,
        clerkOrgId: ORG,
    });
    return draftId;
}

const LINE = {
    sku: "GBCyl9SpryGl",
    description: "Cylinder 9ml clear, fine mist sprayer",
    quantity: 500,
    unitPrice: 0.79,
    shopifyVariantId: "53343623217444",
};

function setLines(
    t: ReturnType<typeof convexTest>,
    draftId: string,
    overrides: Record<string, unknown> = {},
) {
    return t.mutation(api.portal.setDraftLineItems, {
        writeToken: WRITE_TOKEN,
        clerkOrgId: ORG,
        draftId: draftId as never,
        lineItems: [LINE],
        ...overrides,
    });
}

describe("setDraftLineItems", () => {
    it("totals the order from the server-resolved unit price", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        expect(await setLines(t, draftId)).toMatchObject({ lineCount: 1, totalAmount: 395 });
    });

    it("refuses a quantity below one", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        await expect(setLines(t, draftId, { lineItems: [{ ...LINE, quantity: 0 }] }))
            .rejects.toThrow(/quantity_must_be_at_least_one/);
    });

    it("refuses a write from another organization", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        await expect(setLines(t, draftId, { clerkOrgId: OTHER_ORG }))
            .rejects.toThrow(/draft_not_found/);
    });

    it("refuses a mutation without the shared token", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        await expect(setLines(t, draftId, { writeToken: "wrong" }))
            .rejects.toThrow(/unauthorized_convex_write/);
    });
});

describe("getDraftById", () => {
    it("reads another organization's draft as absent, not as an error", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        const seen = await t.query(api.portal.getDraftById, {
            clerkOrgId: OTHER_ORG,
            draftId: draftId as never,
        });
        expect(seen).toBeNull();
    });
});

describe("markDraftSubmitted", () => {
    async function submit(t: ReturnType<typeof convexTest>, draftId: string) {
        return t.mutation(api.portal.markDraftSubmitted, {
            writeToken: WRITE_TOKEN,
            clerkOrgId: ORG,
            draftId: draftId as never,
            shopifyDraftOrderId: "gid://shopify/DraftOrder/1",
            shopifyDraftOrderName: "#D12",
            clerkUserId: USER,
        });
    }

    it("records the Shopify reference and freezes the draft", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        await setLines(t, draftId);
        await submit(t, draftId);

        const draft = await t.query(api.portal.getDraftById, {
            clerkOrgId: ORG,
            draftId: draftId as never,
        });
        expect(draft).toMatchObject({ status: "submitted", shopifyDraftOrderName: "#D12" });
        expect(draft?.submittedAt).toEqual(expect.any(Number));
    });

    it("will not edit a draft that already reached Shopify", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        await setLines(t, draftId);
        await submit(t, draftId);

        await expect(setLines(t, draftId)).rejects.toThrow(/draft_already_submitted/);
    });

    it("will not submit the same draft twice", async () => {
        const t = convexTest(schema, modules);
        const draftId = await seed(t);
        await setLines(t, draftId);
        await submit(t, draftId);
        await expect(submit(t, draftId)).rejects.toThrow(/draft_already_submitted/);
    });
});

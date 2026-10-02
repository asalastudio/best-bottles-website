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
import { describe, expect, it, beforeEach, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { portalCatalogPrice } from "../src/lib/portal/catalog-pricing";
import { resolveCatalogCardPurchaseVariant } from "../src/lib/products/catalog-card-purchase";

// Draft/authorization tests do not run the separate analytics component.
vi.mock("../convex/posthog", async (importOriginal) => ({
    ...await importOriginal<typeof import("../convex/posthog")>(),
    captureServerEvent: vi.fn(),
}));

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
    const precisionVariant = resolveCatalogCardPurchaseVariant([{
        id: "fractional", graceSku: "FRACTIONAL", websiteSku: "FRACTIONAL", webPrice1pc: .845,
        priceTiers: [{ minQty: 1, unitPrice: .845 }, { minQty: 144, unitPrice: .795 }],
    }], { productTitle: "Fractional unit fixture" })!;

    it.each([[1, .845], [11, 9.295], [12, 10.14], [60, 50.70], [143, 120.835], [144, 114.48], [145, 115.275]])(
        "preserves fractional precision through displayed and saved totals at quantity %i", async (quantity, expectedTotal) => {
            const t = convexTest(schema, modules), draftId = await seed(t);
            const display = portalCatalogPrice(precisionVariant, String(quantity));
            const unitPrice = quantity < 144 ? .845 : .795;
            const result = await setLines(t, draftId, { lineItems: [{ ...LINE, quantity, unitPrice }] });
            const saved = await t.query(api.portal.getDraftById, { writeToken: WRITE_TOKEN, clerkOrgId: ORG, draftId });
            expect(saved!.lineItems[0].unitPrice).toBe(unitPrice);
            expect(saved!.lineItems[0].quantity).toBe(quantity);
            expect(saved!.lineItems[0].unitPrice! * saved!.lineItems[0].quantity).toBeCloseTo(expectedTotal, 10);
            expect(saved!.totalAmount).toBeCloseTo(expectedTotal, 10);
            expect(result.totalAmount).toBe(saved!.totalAmount);
            expect(display.total).toBe(saved!.totalAmount);
            if (quantity === 60) expect(display.total?.toFixed(2)).toBe("50.70");
        },
    );

    it("sums multiple saved lines before currency presentation without rounding each unit or line", async () => {
        const t = convexTest(schema, modules), draftId = await seed(t);
        const lines = [{ ...LINE, sku: "FRACTIONAL-A", unitPrice: .845, quantity: 60 },
            { ...LINE, sku: "FRACTIONAL-B", unitPrice: .3333, quantity: 3 }];
        const result = await setLines(t, draftId, { lineItems: lines });
        const saved = await t.query(api.portal.getDraftById, { writeToken: WRITE_TOKEN, clerkOrgId: ORG, draftId });
        expect(saved!.lineItems.map(line => line.unitPrice! * line.quantity)[0]).toBeCloseTo(50.70, 10);
        expect(saved!.lineItems.map(line => line.unitPrice! * line.quantity)[1]).toBeCloseTo(.9999, 10);
        expect(saved!.totalAmount).toBeCloseTo(51.6999, 10);
        expect(result.totalAmount).toBe(saved!.totalAmount);
        expect(result.totalAmount.toFixed(2)).toBe("51.70");
    });

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
            writeToken: WRITE_TOKEN,
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
            writeToken: WRITE_TOKEN,
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

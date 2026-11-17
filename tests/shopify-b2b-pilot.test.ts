import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createNativeB2bPilotHandler } from "../src/lib/shopify-b2b-pilot";
import type { B2bAccess } from "../src/lib/shopify-b2b";

const pilot = { enabled: true, origin: "https://pilot.example.com", clerkUserId: "user_pilot", clerkOrgId: "org_pilot",
    companyId: "gid://shopify/Company/1", companyContactId: "gid://shopify/CompanyContact/2", companyLocationId: "gid://shopify/CompanyLocation/3" };
const variantId = "gid://shopify/ProductVariant/53343615680804";
const enrollment = [{ variantId, sku: "GB-ELG-CLR-15ML-MRL-SSLV", tiers: [
    { minimumQuantity: 1, unitCents: 88 }, { minimumQuantity: 12, unitCents: 84 }, { minimumQuantity: 144, unitCents: 79 },
    { minimumQuantity: 288, unitCents: 75 }, { minimumQuantity: 1440, unitCents: 69 },
] }];
const money = (amount: string) => ({ amount, currencyCode: "USD" });
const prices = { nodes: [{ id: variantId, sku: enrollment[0].sku, availableForSale: true, price: money("0.88"),
    quantityRule: { minimum: 1, maximum: null, increment: 1 }, quantityPriceBreaks: {
        nodes: enrollment[0].tiers.slice(1).map(tier => ({ minimumQuantity: tier.minimumQuantity, price: money((tier.unitCents / 100).toFixed(2)) })),
        pageInfo: { hasNextPage: false },
    },
}] };
const cart = { cartCreate: { userErrors: [], cart: {
    id: "pilot-cart", checkoutUrl: "https://shop.example.com/checkouts/pilot", cost: { subtotalAmount: money("50.40") },
    buyerIdentity: { purchasingCompany: { company: { id: pilot.companyId }, contact: { id: pilot.companyContactId }, location: { id: pilot.companyLocationId } } },
    lines: { nodes: [{ id: "line", quantity: 60, merchandise: { id: variantId }, cost: { amountPerQuantity: money("0.84"), totalAmount: money("50.40") } }], pageInfo: { hasNextPage: false } },
} } };
function setup(overrides: Partial<typeof pilot> = {}) {
    const readViewer = vi.fn(async () => ({ clerkUserId: pilot.clerkUserId as string | null, clerkOrgId: pilot.clerkOrgId as string | null }));
    const access: B2bAccess = { ...pilot, status: "approved", customerAccessToken: "private-synthetic-token", tokenExpiresAt: Date.now() + 3600000 };
    const loadAccess = vi.fn(async (): Promise<B2bAccess> => access);
    const assertOrderAllowed = vi.fn(async () => {});
    const request = vi.fn(async (query: string) => query.includes("mutation") ? cart : prices);
    const handle = createNativeB2bPilotHandler({ pilot: { ...pilot, ...overrides }, readViewer, loadAccess, assertOrderAllowed, request, enrollment });
    return { handle, readViewer, loadAccess, assertOrderAllowed, request, access };
}
function req(body: object = {}, headers: Record<string, string> = {}) {
    return new Request(`${pilot.origin}/api/shopify/b2b-pilot`, { method: "POST", headers: { origin: pilot.origin, "content-type": "application/json", ...headers },
        body: JSON.stringify({ action: "prices", companyLocationId: pilot.companyLocationId, lines: [{ variantId, quantity: 60 }], ...body }) });
}

describe("isolated native B2B HTTP integration", () => {
    it("is inert while disabled, even before authentication", async () => {
        const s = setup({ enabled: false });
        expect((await s.handle(req())).status).toBe(404);
        expect(s.readViewer).not.toHaveBeenCalled(); expect(s.request).not.toHaveBeenCalled();
    });
    it("refuses incomplete enrollment configuration", async () => {
        const s = setup({ clerkUserId: "" });
        expect((await s.handle(req())).status).toBe(503); expect(s.loadAccess).not.toHaveBeenCalled();
    });
    it.each([{ origin: "https://foreign.example.com" }, { origin: "" }])("rejects cross-site or missing origin %j", async headers => {
        const s = setup(); expect((await s.handle(req({}, headers))).status).toBe(403); expect(s.request).not.toHaveBeenCalled();
    });
    it("requires JSON", async () => { expect((await setup().handle(req({}, { "content-type": "text/plain" }))).status).toBe(415); });
    it("requires a signed-in pilot viewer and selected organization", async () => {
        const s = setup();
        for (const [clerkUserId, clerkOrgId, status] of [[null, null, 401], ["other", pilot.clerkOrgId, 403], [pilot.clerkUserId, null, 403]] as const) {
            s.readViewer.mockResolvedValue({ clerkUserId, clerkOrgId });
            expect((await s.handle(req())).status).toBe(status);
        }
        expect(s.loadAccess).not.toHaveBeenCalled(); expect(s.request).not.toHaveBeenCalled();
    });
    it.each([
        { customerAccessToken: "forged" }, { approved: true }, { lines: [{ variantId, quantity: 60, unitPrice: 0.01 }] },
        { lines: [{ variantId, quantity: 60.5 }] }, { lines: [{ variantId, quantity: 0 }] }, { lines: [] }, { action: "anonymous" },
    ])("rejects malformed or browser-supplied authority %j", async body => {
        const s = setup(); expect((await s.handle(req(body))).status).toBe(400); expect(s.loadAccess).not.toHaveBeenCalled();
    });
    it.each([{ companyLocationId: "gid://shopify/CompanyLocation/99" }, { lines: [{ variantId: "gid://shopify/ProductVariant/99", quantity: 60 }] }])("restricts pilot scope %j", async body => {
        const s = setup(); expect((await s.handle(req(body))).status).toBe(403); expect(s.request).not.toHaveBeenCalled();
    });
    it.each(["signed_out", "pending", "revoked", "unavailable"] as const)("blocks server access state %s with no fallback", async status => {
        const s = setup(); s.loadAccess.mockResolvedValue({ status });
        expect((await s.handle(req({ action: "checkout" }))).status).toBe(409); expect(s.request).not.toHaveBeenCalled();
    });
    it.each(["clerkUserId", "clerkOrgId", "companyId", "companyContactId", "companyLocationId"] as const)("checks the returned %s against the pilot", async field => {
        const s = setup(); s.loadAccess.mockResolvedValue({ ...s.access, [field]: "different" });
        expect((await s.handle(req())).status).toBe(409); expect(s.request).not.toHaveBeenCalled();
    });
    it("returns the same server price for display and checkout without exposing the token", async () => {
        const s = setup();
        const preview = await s.handle(req()), checkout = await s.handle(req({ action: "checkout" }));
        expect(preview.status).toBe(200); expect(checkout.status).toBe(200);
        const shown = await preview.json(), handedOff = await checkout.json();
        expect(shown.lines).toEqual(handedOff.lines); expect(handedOff.subtotalCents).toBe(5040);
        expect(shown).not.toHaveProperty("checkoutUrl"); expect(JSON.stringify(handedOff)).not.toContain("private-synthetic-token");
        expect(preview.headers.get("cache-control")).toBe("private, no-store");
        expect(checkout.headers.get("cache-control")).toBe("private, no-store");
        expect(s.loadAccess).toHaveBeenCalledWith(pilot.companyLocationId); expect(s.assertOrderAllowed).toHaveBeenCalledTimes(1);
    });
    it("honors order-policy denial without creating a cart or leaking upstream details", async () => {
        const s = setup(); s.assertOrderAllowed.mockRejectedValue(new Error("private-synthetic-token"));
        const result = await s.handle(req({ action: "checkout" }));
        expect(result.status).toBe(409); expect(await result.json()).toEqual({ code: "B2B_VERIFICATION_REQUIRED" });
        expect(s.request).toHaveBeenCalledTimes(1);
    });
    it("rechecks the Clerk organization immediately before creating a cart", async () => {
        const s = setup(); s.assertOrderAllowed.mockImplementation(async () => { s.readViewer.mockResolvedValue({ clerkUserId: pilot.clerkUserId, clerkOrgId: "org_changed" }); });
        expect((await s.handle(req({ action: "checkout" }))).status).toBe(409); expect(s.request).toHaveBeenCalledTimes(1);
    });
});

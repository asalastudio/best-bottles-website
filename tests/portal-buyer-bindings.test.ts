// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { buyerProof, buyerScope } from "./fixtures/buyer-binding";
const modules = import.meta.glob("../convex/**/*.ts");
const token = "fixture-binding-token", staffUserId = "user_fixtureStaff";
beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
type T = ReturnType<typeof convexTest>;
const propose = (t: T, changes = {}) => t.mutation(api.portalBuyerBindings.propose,
    { writeToken: token, proof: buyerProof, checkedAt: Date.now(), staffUserId, ...changes });
const read = (t: T, changes = {}) => t.query(api.portalBuyerBindings.read, { writeToken: token, ...buyerScope, forPurchase: true, ...changes });
async function approve(t: T) {
    const row = await propose(t);
    return t.mutation(api.portalBuyerBindings.review, { writeToken: token, id: row.id, expectedVersion: row.version,
        proof: row.proof, checkedAt: Date.now(), staffUserId });
}
describe("private purchase-only buyer bindings", () => {
    it("proposes idempotently without changing any account, address, certificate or order", async () => {
        const t = convexTest(schema, modules);
        const first = await propose(t);
        expect(await propose(t)).toEqual(first); expect(first.state).toBe("proposed");
        for (const table of ["portalAccounts", "portalAddressReconciliations", "resaleCertificates", "portalOrders"] as const) {
            expect(await t.run(ctx => ctx.db.query(table).collect())).toHaveLength(0);
        }
        const rows = await t.run(ctx => ctx.db.query("portalBuyerBindings").collect());
        expect(rows).toHaveLength(1); expect(JSON.stringify(rows)).not.toMatch(/@|accessToken|billingEmail/);
    });
    it("requires the server credential on every operation", async () => {
        const t = convexTest(schema, modules), row = await propose(t);
        await expect(propose(t, { writeToken: "bad" })).rejects.toThrow("unauthorized_convex_write");
        await expect(read(t, { writeToken: "bad" })).rejects.toThrow("unauthorized_convex_write");
        await expect(t.mutation(api.portalBuyerBindings.review, { writeToken: "bad", id: row.id, expectedVersion: 1, proof: buyerProof, checkedAt: Date.now(), staffUserId })).rejects.toThrow("unauthorized_convex_write");
        await expect(t.mutation(api.portalBuyerBindings.revoke, { writeToken: "bad", id: row.id, expectedVersion: 1, staffUserId })).rejects.toThrow("unauthorized_convex_write");
    });
    it.each(["clerkUserId", "clerkOrgId", "clerkInstanceHost", "shopDomain"] as const)("isolates lookup by %s", async key => {
        const t = convexTest(schema, modules); await approve(t);
        expect(await read(t, { [key]: "different" })).toBeNull();
    });
    it("rejects a changed customer/location, instead of repointing an existing binding", async () => {
        const t = convexTest(schema, modules); await propose(t);
        await expect(propose(t, { proof: { ...buyerProof, companyLocationId: "gid://shopify/CompanyLocation/999" } })).rejects.toThrow("buyer_binding_conflict");
    });
    it.each(["clerkUserId", "clerkOrgId", "clerkInstanceHost"] as const)("reserves the Shopify customer against another %s", async key => {
        const t = convexTest(schema, modules); await propose(t);
        const replacements = { clerkUserId: "user_other", clerkOrgId: "org_other", clerkInstanceHost: "clerk.other.test" };
        await expect(propose(t, { proof: { ...buyerProof, [key]: replacements[key] } })).rejects.toThrow("buyer_customer_already_claimed");
    });
    it.each(["23909292343588", buyerProof.customerId])("detects legacy customer association conflict in %s format", async shopifyCustomerId => {
        const t = convexTest(schema, modules);
        await t.run(ctx => ctx.db.insert("portalAccounts", { clerkOrgId: "org_other", companyName: "Other", taxExempt: false, shopifyCustomerId }));
        await expect(propose(t)).rejects.toThrow("legacy_customer_binding_conflict");
    });
    it("rechecks legacy claims at review AND runtime lookup", async () => {
        const t = convexTest(schema, modules), row = await approve(t);
        await t.run(ctx => ctx.db.insert("portalAccounts", { clerkOrgId: "org_other", companyName: "Other", taxExempt: false, shopifyCustomerId: buyerProof.customerId }));
        await expect(read(t)).rejects.toThrow("legacy_customer_binding_conflict");
        expect(await read(t, { forPurchase: false })).toMatchObject({ id: row.id, state: "approved" });
        // Revocation still works when a conflicting external association appears.
        expect((await t.mutation(api.portalBuyerBindings.revoke, { writeToken: token, id: row.id, expectedVersion: row.version, staffUserId })).state).toBe("revoked");
    });
    it("fresh review checks the exact proof and compare-and-swap version", async () => {
        const t = convexTest(schema, modules), row = await propose(t);
        const args = { writeToken: token, id: row.id, expectedVersion: 1, proof: row.proof, checkedAt: Date.now(), staffUserId };
        await expect(t.mutation(api.portalBuyerBindings.review, { ...args, proof: { ...buyerProof, roleAssignmentId: "gid://shopify/CompanyContactRoleAssignment/999" } })).rejects.toThrow("buyer_proof_changed");
        const results = await Promise.allSettled([t.mutation(api.portalBuyerBindings.review, args), t.mutation(api.portalBuyerBindings.review, args)]);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(await read(t)).toMatchObject({ version: 2, state: "approved" });
    });
    it("revocation is terminal and retains the customer claim", async () => {
        const t = convexTest(schema, modules), row = await approve(t);
        await t.mutation(api.portalBuyerBindings.revoke, { writeToken: token, id: row.id, expectedVersion: row.version, staffUserId });
        await expect(propose(t)).rejects.toThrow("buyer_binding_revoked");
        await expect(propose(t, { proof: { ...buyerProof, clerkUserId: "user_other" } })).rejects.toThrow("buyer_customer_already_claimed");
        expect(await read(t)).toMatchObject({ version: 3, state: "revoked" });
    });
    it("serializes competing claims without double ownership", async () => {
        const t = convexTest(schema, modules);
        const results = await Promise.allSettled([propose(t), propose(t, { proof: { ...buyerProof, clerkUserId: "user_other" } })]);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query("portalBuyerBindings").collect())).toHaveLength(1);
    });
    it.each([-30_001, 1])("rejects stale or future evidence (%i ms)", async delta => {
        const t = convexTest(schema, modules);
        await expect(propose(t, { checkedAt: Date.now() + delta + (delta > 0 ? 60_000 : 0) })).rejects.toThrow("buyer_proof_expired");
    });
    it("refuses development Clerk enrollment and malformed Shopify IDs", async () => {
        const t = convexTest(schema, modules);
        await expect(propose(t, { proof: { ...buyerProof, clerkInstanceHost: "together-lemur-38.clerk.accounts.dev" } })).rejects.toThrow("invalid_buyer_proof");
        await expect(propose(t, { proof: { ...buyerProof, customerId: "23909292343588" } })).rejects.toThrow("invalid_buyer_proof");
    });
});

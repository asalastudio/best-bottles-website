// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const token = "fixture-account-token";
const identity = { writeToken: token, clerkOrgId: "org_a", clerkUserId: "user_a", companyName: "Fixture Company" };
const address = { contactName: "Fixture Buyer", company: "Fixture", phone: "+15555550123", address1: "1 Test St", address2: "", city: "Test", provinceCode: "CA", zip: "90001", countryCode: "US" };
beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
const create = (t: ReturnType<typeof convexTest>) => t.mutation(api.portalAccountFoundation.ensurePendingAccount, identity);
const save = (t: ReturnType<typeof convexTest>, overrides = {}) => t.mutation(api.portal.saveAccountAddress, {
    writeToken: token, clerkOrgId: "org_a", clerkUserId: "user_a", shippingAddress: address,
    expectedVersion: 0, requestId: "request_a_0001", ...overrides,
});
const get = (t: ReturnType<typeof convexTest>, clerkOrgId = "org_a") => t.query(api.portal.getAccountByOrg, { writeToken: token, clerkOrgId });
const intent = (t: ReturnType<typeof convexTest>, clerkOrgId = "org_a") => t.query(api.portalAccountFoundation.getAddressReconciliation, { writeToken: token, clerkOrgId });

describe("verified organization profile foundation", () => {
    it("creates a pending account without inventing business approval or Shopify identity", async () => {
        const t = convexTest(schema, modules);
        await create(t);
        expect(await get(t)).toMatchObject({ clerkOrgId: "org_a", profileStatus: "pending", profileCreatedBy: "user_a", taxExempt: false });
        const row = await get(t);
        for (const field of ["shopifyCustomerId", "billingEmail", "accountNumber", "tier", "accountManager", "memberSince", "netTerms"]) expect(row).not.toHaveProperty(field);
    });
    it("retries return the same row and never replace staff-managed details", async () => {
        const t = convexTest(schema, modules);
        const first = await create(t);
        expect(await create(t)).toEqual({ ...first, created: false });
        await t.mutation(api.portal.upsertPortalAccount, { writeToken: token, clerkOrgId: "org_a", companyName: "Approved Name", accountNumber: "FIXTURE-1", tier: "Fixture Tier", accountManager: "Fixture Staff", memberSince: "Approved date" });
        await create(t);
        expect(await get(t)).toMatchObject({ profileStatus: "complete", companyName: "Approved Name", accountNumber: "FIXTURE-1" });
        expect(await t.run(ctx => ctx.db.query("portalAccounts").collect())).toHaveLength(1);
    });
    it("does not disclose another organization's address intent", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t);
        expect(await get(t, "org_b")).toBeNull();
        expect(await intent(t, "org_b")).toBeNull();
        await expect(save(t, { clerkOrgId: "org_b" })).rejects.toThrow("account_not_found");
    });
    it("refuses unauthenticated provisioning, writes and reconciliation reads", async () => {
        const t = convexTest(schema, modules);
        await expect(t.mutation(api.portalAccountFoundation.ensurePendingAccount, { ...identity, writeToken: "bad" })).rejects.toThrow("unauthorized_convex_write");
        await expect(save(t, { writeToken: "bad" })).rejects.toThrow("unauthorized_convex_write");
        await expect(t.query(api.portalAccountFoundation.getAddressReconciliation, { writeToken: "bad", clerkOrgId: "org_a" })).rejects.toThrow("unauthorized_convex_write");
    });
});

describe("durable address reconciliation", () => {
    it("atomically saves address and pending identity state; identical retries create one revision", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t); await save(t);
        expect(await get(t)).toMatchObject({ shippingAddress: address, addressRevision: 1, addressSyncStatus: "awaiting_identity" });
        expect(await intent(t)).toMatchObject({ revision: 1, state: "awaiting_identity", requestedBy: "user_a" });
        expect(await t.run(ctx => ctx.db.query("portalAddressReconciliations").collect())).toHaveLength(1);
    });
    it("supersedes a stale shipping intent and retains metadata without its address payload", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t);
        await save(t, { expectedVersion: 1, requestId: "request_b_0002", shippingAddress: { ...address, address1: "2 Test St" } });
        const rows = await t.run(ctx => ctx.db.query("portalAddressReconciliations").collect());
        expect(rows).toHaveLength(2);
        expect(rows.find(row => row.revision === 1)).toMatchObject({ state: "superseded" });
        expect(rows.find(row => row.revision === 1)).not.toHaveProperty("shippingAddress");
        expect(await intent(t)).toMatchObject({ revision: 2, state: "awaiting_identity", shippingAddress: { address1: "2 Test St" } });
    });
    it("keeps billing changes local and does not create another shipping intent", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t);
        await save(t, { expectedVersion: 1, requestId: "request_b_0002", billingAddress: { ...address, address1: "Billing St" } });
        expect(await get(t)).toMatchObject({ billingAddress: { address1: "Billing St" }, addressRevision: 1 });
        expect(await t.run(ctx => ctx.db.query("portalAddressReconciliations").collect())).toHaveLength(1);
        await save(t, { expectedVersion: 2, requestId: "request_c_0003" }); expect(await get(t)).not.toHaveProperty("billingAddress");
    });
    it("rejects A → B → delayed retry A without reverting B", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t);
        await save(t, { expectedVersion: 1, requestId: "request_b_0002", shippingAddress: { ...address, address1: "B Street" } });
        await expect(save(t)).rejects.toThrow("address_version_conflict");
        expect(await get(t)).toMatchObject({ addressVersion: 2, addressRevision: 2, shippingAddress: { address1: "B Street" } });
        expect(await t.run(ctx => ctx.db.query("portalAddressReconciliations").collect())).toHaveLength(2);
    });
    it("only one of two concurrent edits of the same version can commit", async () => {
        const t = convexTest(schema, modules); await create(t);
        const results = await Promise.allSettled([
            save(t), save(t, { requestId: "request_b_0002", shippingAddress: { ...address, address1: "B Street" } }),
        ]);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
        expect(await get(t)).toMatchObject({ addressVersion: 1, addressRevision: 1 });
    });
    it("fences billing-only stale forms and reused request IDs", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t);
        await expect(save(t, { billingAddress: { ...address, address1: "Changed payload" } })).rejects.toThrow("address_request_reused");
        await save(t, { expectedVersion: 1, requestId: "request_b_0002", billingAddress: { ...address, address1: "Billing St" } });
        await expect(save(t, { expectedVersion: 1, requestId: "request_c_0003", shippingAddress: { ...address, address1: "Stale shipping" } })).rejects.toThrow("address_version_conflict");
        expect(await get(t)).toMatchObject({ addressRevision: 1, addressVersion: 2, billingAddress: { address1: "Billing St" } });
    });
    it("reconciles a newly linked identity without a duplicate address revision or remote write", async () => {
        const t = convexTest(schema, modules); await create(t); await save(t);
        const link = { writeToken: token, clerkOrgId: "org_a", shopifyCustomerId: "123", billingEmail: "buyer@example.test" };
        await t.mutation(api.portal.linkShopifyCustomer, link);
        await t.mutation(api.portal.linkShopifyCustomer, link);
        await save(t);
        expect(await get(t)).toMatchObject({ addressRevision: 1, addressSyncStatus: "awaiting_review" });
        expect(await intent(t)).toMatchObject({ revision: 1, state: "awaiting_review", shopifyCustomerId: "123" });
        expect(await t.run(ctx => ctx.db.query("portalAddressReconciliations").collect())).toHaveLength(1);
    });
    it("a legacy customer link requires reviewed sync, never a false synced claim", async () => {
        const t = convexTest(schema, modules); await create(t);
        await t.mutation(api.portal.linkShopifyCustomer, { writeToken: token, clerkOrgId: "org_a", shopifyCustomerId: "123", billingEmail: "buyer@example.test" });
        await save(t);
        expect(await get(t)).toMatchObject({ addressSyncStatus: "awaiting_review" });
        expect(await intent(t)).toMatchObject({ state: "awaiting_review", shopifyCustomerId: "123" });
    });
});

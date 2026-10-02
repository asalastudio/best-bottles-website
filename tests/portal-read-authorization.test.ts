// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import * as portal from "../convex/portal";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const TOKEN = "synthetic-server-token";
const ORG = "org_victim";
const OTHER = "org_other";
const endpoints = [
    "getShellData", "getAccountByOrg", "listPortalAccounts", "getAccountByShopifyCustomerId",
    "getDashboardData", "listOrdersByOrg", "getOrderForOrg", "listDraftsByOrg",
    "listGraceProjectsByOrg", "getGraceWorkspaceByOrg", "getDraftById", "getTeamHubQueues",
] as const;
beforeEach(() => vi.stubEnv("BEST_BOTTLES_CONVEX_WRITE_TOKEN", TOKEN));
afterEach(() => vi.unstubAllEnvs());

async function fixture(t: ReturnType<typeof convexTest>) {
    return t.run(async (ctx) => {
        for (const org of [ORG, OTHER]) {
            await ctx.db.insert("portalAccounts", {
                clerkOrgId: org, accountNumber: `fixture-${org}`, companyName: `Fixture ${org}`,
                tier: "Wholesale", accountManager: "Test", taxExempt: false, memberSince: "2026",
                billingEmail: `${org}@example.test`, shopifyCustomerId: `customer-${org}`,
            });
            await ctx.db.insert("portalOrders", {
                clerkOrgId: org, orderId: `order-${org}`, status: "processing", orderDate: 1000,
                lineItems: [{ sku: "FIXTURE", description: "Synthetic bottle", quantity: 12 }],
            });
            await ctx.db.insert("graceProjects", {
                clerkOrgId: org, name: `project-${org}`, savedBottles: [], createdAt: 1000, updatedAt: 1000,
            });
        }
        return ctx.db.insert("portalDrafts", {
            clerkOrgId: ORG, name: "Synthetic private draft", status: "draft",
            createdAt: 1000, updatedAt: 1000, lineItems: [],
        });
    });
}

function queryArgs(endpoint: typeof endpoints[number], draftId: Awaited<ReturnType<typeof fixture>>) {
    if (endpoint === "listPortalAccounts" || endpoint === "getTeamHubQueues") return {};
    if (endpoint === "getAccountByShopifyCustomerId") return { shopifyCustomerId: `customer-${ORG}` };
    if (endpoint === "getDraftById") return { clerkOrgId: ORG, draftId };
    if (endpoint === "getOrderForOrg") return { clerkOrgId: ORG, orderId: `order-${ORG}` };
    return { clerkOrgId: ORG };
}

describe("all portal reads require the trusted server", () => {
    it("covers every exported portal query, including staff-wide reads", () => {
        const queries = Object.entries(portal).filter(([, value]) => "isQuery" in value).map(([name]) => name);
        expect(queries.sort()).toEqual([...endpoints].sort());
    });

    it.each(endpoints)("%s denies anonymous and signed-in forged scope", async (endpoint) => {
        const t = convexTest(schema, modules);
        const args = queryArgs(endpoint, await fixture(t));
        for (const caller of [t, t.withIdentity({ subject: "user_attacker", org_id: OTHER })]) {
            await expect(caller.query(api.portal[endpoint], args as never)).rejects.toThrow();
            await expect(caller.query(api.portal[endpoint], { ...args, writeToken: "wrong" } as never))
                .rejects.toThrow(/unauthorized_convex_write/);
        }
    });

    it.each(endpoints)("%s remains callable by the authenticated server", async (endpoint) => {
        const t = convexTest(schema, modules);
        const args = queryArgs(endpoint, await fixture(t));
        await expect(t.query(api.portal[endpoint], { ...args, writeToken: TOKEN } as never)).resolves.toBeDefined();
    });

    it.each(endpoints)("%s fails closed without a configured credential", async (endpoint) => {
        const t = convexTest(schema, modules);
        const args = queryArgs(endpoint, await fixture(t));
        vi.stubEnv("BEST_BOTTLES_CONVEX_WRITE_TOKEN", "");
        await expect(t.query(api.portal[endpoint], { ...args, writeToken: TOKEN } as never))
            .rejects.toThrow(/convex_write_token_not_configured/);
    });

    it("keeps customer reads inside the server-resolved organization", async () => {
        const t = convexTest(schema, modules);
        const draftId = await fixture(t);
        const scope = { writeToken: TOKEN, clerkOrgId: OTHER };
        expect((await t.query(api.portal.getAccountByOrg, scope))?.clerkOrgId).toBe(OTHER);
        expect((await t.query(api.portal.listOrdersByOrg, scope)).map((o) => o.orderId)).toEqual([`order-${OTHER}`]);
        expect(await t.query(api.portal.getOrderForOrg, { ...scope, orderId: `order-${ORG}` })).toBeNull();
        expect(await t.query(api.portal.getDraftById, { ...scope, draftId })).toBeNull();
        expect(await t.query(api.portal.listDraftsByOrg, scope)).toEqual([]);
        expect((await t.query(api.portal.listGraceProjectsByOrg, scope)).map((p) => p.name)).toEqual([`project-${OTHER}`]);
        const victim = await t.query(api.portal.listGraceProjectsByOrg, { ...scope, clerkOrgId: ORG });
        expect((await t.query(api.portal.getGraceWorkspaceByOrg, { ...scope, projectId: victim[0]._id })).activeProject).toBeNull();
    });
});

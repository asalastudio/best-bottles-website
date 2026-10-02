// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import * as certificates from "../convex/resaleCertificates";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const TOKEN = "synthetic-certificate-token";
const ORG = "org_victim";
const endpoints = ["listCertificatesByOrg", "getActiveCertificateForOrg", "listPendingCertificates", "listAllCertificates"] as const;
beforeEach(() => vi.stubEnv("BEST_BOTTLES_CONVEX_WRITE_TOKEN", TOKEN));
afterEach(() => vi.unstubAllEnvs());
async function fixture(t: ReturnType<typeof convexTest>) {
    await t.run(async ctx => {
        for (const status of ["pending", "approved"] as const) {
            await ctx.db.insert("resaleCertificates", {
                clerkOrgId: ORG, legalBusinessName: "Synthetic permit fixture", issuingState: "CA",
                permitNumber: "TEST-NOT-A-PERMIT", status, submittedAt: 1000, submittedBy: "user_fixture",
            });
        }
    });
}
const argsFor = (name: typeof endpoints[number]) => name.endsWith("ByOrg") || name.endsWith("ForOrg") ? { clerkOrgId: ORG } : {};

describe("certificate read authorization", () => {
    it("covers every public certificate read", () => {
        expect(Object.entries(certificates).filter(([, value]) => "isQuery" in value).map(([name]) => name).sort())
            .toEqual([...endpoints].sort());
    });
    it.each(endpoints)("%s rejects anonymous and forged-member access", async name => {
        const t = convexTest(schema, modules); await fixture(t);
        for (const caller of [t, t.withIdentity({ subject: "user_attacker", org_id: "org_other" })]) {
            await expect(caller.query(api.resaleCertificates[name], argsFor(name) as never)).rejects.toThrow();
            await expect(caller.query(api.resaleCertificates[name], { ...argsFor(name), writeToken: "wrong" } as never))
                .rejects.toThrow(/unauthorized_convex_write/);
        }
    });
    it.each(endpoints)("%s preserves trusted reads and fails closed on missing configuration", async name => {
        const t = convexTest(schema, modules); await fixture(t);
        const args = { ...argsFor(name), writeToken: TOKEN };
        await expect(t.query(api.resaleCertificates[name], args as never)).resolves.toBeDefined();
        vi.stubEnv("BEST_BOTTLES_CONVEX_WRITE_TOKEN", "");
        await expect(t.query(api.resaleCertificates[name], args as never)).rejects.toThrow(/convex_write_token_not_configured/);
    });
    it("does not return another organization's permit records", async () => {
        const t = convexTest(schema, modules); await fixture(t);
        const scope = { writeToken: TOKEN, clerkOrgId: "org_other" };
        expect(await t.query(api.resaleCertificates.listCertificatesByOrg, scope)).toEqual([]);
        expect(await t.query(api.resaleCertificates.getActiveCertificateForOrg, scope)).toBeNull();
        expect((await t.query(api.resaleCertificates.listCertificatesByOrg, { ...scope, clerkOrgId: ORG }))).toHaveLength(2);
    });
});

import "server-only";
import { z } from "zod";
import type { Id } from "../../../convex/_generated/dataModel";
import {
    assertFreshBuyerProof, sameBuyerProof, sameBuyerScope, validateBuyerProof,
    type BuyerProof, type BuyerScope,
} from "../../../convex/lib/buyerBinding";
import type { B2bAccess } from "../shopify-b2b";

export type BindingRecord = { id: Id<"portalBuyerBindings">; version: number;
    state: "proposed" | "approved" | "revoked"; proof: BuyerProof };
export type BindingConfig = { enabled: boolean; writesEnabled: boolean;
    clerkInstanceHost: string; shopDomain: string };
export type BindingTarget = Pick<BuyerProof, "customerId" | "companyId" | "companyContactId" | "companyLocationId">;
export type ClerkBuyerEvidence = { clerkUserId: string; clerkOrgId: string; clerkMembershipId: string;
    clerkEmailId: string; verifiedEmail: string };
export type ShopifyBuyerEvidence = BindingTarget & { shopDomain: string; verifiedEmail: string;
    roleAssignmentId: string; roleId: string; roleName: "Ordering only" };

/** Required auth-owner dependency: read the current user's server-held Customer
 * Account session AND freshly query that API's customer and allowed locations.
 * No browser token, Admin impersonation, cached claim or email match can supply it.
 */
export type BuyerSessionProof = BuyerScope & {
    customerId: string; companyId: string; companyContactId: string; companyLocationId: string;
    customerAccessToken: string; tokenExpiresAt: number; checkedAt: number;
};
export type BindingStore = {
    read: (scope: BuyerScope, forPurchase?: boolean) => Promise<BindingRecord | null>;
    propose: (args: { proof: BuyerProof; checkedAt: number; staffUserId: string }) => Promise<BindingRecord>;
    review: (args: { id: BindingRecord["id"]; expectedVersion: number; proof: BuyerProof; checkedAt: number; staffUserId: string }) => Promise<BindingRecord>;
    revoke: (args: { id: BindingRecord["id"]; expectedVersion: number; staffUserId: string }) => Promise<BindingRecord>;
};
const subjectV = z.object({ clerkUserId: z.string().regex(/^user_[A-Za-z0-9]+$/), clerkOrgId: z.string().regex(/^org_[A-Za-z0-9]+$/) }).strict();
const targetV = z.object({
    customerId: z.string().regex(/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/),
    companyId: z.string().regex(/^gid:\/\/shopify\/Company\/[1-9][0-9]*$/),
    companyContactId: z.string().regex(/^gid:\/\/shopify\/CompanyContact\/[1-9][0-9]*$/),
    companyLocationId: z.string().regex(/^gid:\/\/shopify\/CompanyLocation\/[1-9][0-9]*$/),
}).strict();
function deny(): never { throw new Error("buyer_binding_verification_required"); }

/** Unmounted composition, not a server action. Every dependency is server-owned. */
export function createBuyerBindingService(deps: {
    config: BindingConfig; store: BindingStore;
    readViewer: () => Promise<BuyerScope | null>;
    requireStaff: () => Promise<{ clerkUserId: string }>;
    readClerkEvidence: (scope: BuyerScope) => Promise<ClerkBuyerEvidence>;
    readShopifyEvidence: (target: BindingTarget) => Promise<ShopifyBuyerEvidence>;
    readBuyerSession: (scope: BuyerScope, locationId: string) => Promise<BuyerSessionProof | null>;
}) {
    const config = structuredClone(deps.config);
    function configured(write = false) {
        if (!config.enabled || (write && !config.writesEnabled)
            || !/^[a-z0-9][a-z0-9.-]+$/.test(config.clerkInstanceHost)
            || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shopDomain)
            || config.clerkInstanceHost.endsWith(".clerk.accounts.dev")) deny();
    }
    function scopeFor(subject: unknown): BuyerScope {
        const parsed = subjectV.parse(subject);
        return { ...parsed, clerkInstanceHost: config.clerkInstanceHost, shopDomain: config.shopDomain };
    }
    async function freshProof(scope: BuyerScope, target: BindingTarget) {
        // Start time, not completion time: slow provider reads cannot refresh stale evidence.
        const checkedAt = Date.now();
        const clerk = await deps.readClerkEvidence(scope);
        const shopify = await deps.readShopifyEvidence(target);
        if (clerk.clerkUserId !== scope.clerkUserId || clerk.clerkOrgId !== scope.clerkOrgId
            || shopify.shopDomain !== scope.shopDomain || !clerk.verifiedEmail.trim()
            || clerk.verifiedEmail.trim().toLowerCase() !== shopify.verifiedEmail.trim().toLowerCase()
            || Object.keys(target).some(key => target[key as keyof BindingTarget] !== shopify[key as keyof BindingTarget])) deny();
        // Construct an allowlisted record; no email or token is persisted.
        const proof: BuyerProof = { ...scope, ...target,
            clerkMembershipId: clerk.clerkMembershipId, clerkEmailId: clerk.clerkEmailId,
            roleAssignmentId: shopify.roleAssignmentId, roleId: shopify.roleId, roleName: shopify.roleName };
        validateBuyerProof(proof); assertFreshBuyerProof(checkedAt, Date.now());
        return { proof, checkedAt };
    }
    async function staff() {
        const actor = await deps.requireStaff();
        if (!/^user_[A-Za-z0-9]+$/.test(actor.clerkUserId)) deny();
        return actor.clerkUserId;
    }
    async function sameStaff(actor: string) { if (await staff() !== actor) deny(); }
    return {
        async propose(subject: unknown, requestedTarget: unknown) {
            configured(true);
            const staffUserId = await staff();
            const scope = scopeFor(subject), target = targetV.parse(requestedTarget);
            const evidence = await freshProof(scope, target);
            await sameStaff(staffUserId);
            return deps.store.propose({ ...evidence, staffUserId });
        },
        async review(subject: unknown, expected: BindingRecord) {
            configured(true);
            const staffUserId = await staff();
            const scope = scopeFor(subject), current = await deps.store.read(scope);
            if (!current || current.state !== "proposed" || current.id !== expected.id || current.version !== expected.version
                || !sameBuyerScope(current.proof, scope) || !sameBuyerProof(current.proof, expected.proof)) deny();
            const target = targetV.parse({ customerId: current.proof.customerId, companyId: current.proof.companyId,
                companyContactId: current.proof.companyContactId, companyLocationId: current.proof.companyLocationId });
            const evidence = await freshProof(scope, target);
            if (!sameBuyerProof(current.proof, evidence.proof)) deny();
            await sameStaff(staffUserId);
            return deps.store.review({ ...evidence, id: current.id, expectedVersion: current.version, staffUserId });
        },
        async revoke(subject: unknown, expected: Pick<BindingRecord, "id" | "version">) {
            // Revocation works without healthy Clerk buyer or Shopify APIs.
            configured(true);
            const staffUserId = await staff(), current = await deps.store.read(scopeFor(subject));
            if (!current || current.id !== expected.id || current.version !== expected.version) deny();
            await sameStaff(staffUserId);
            return deps.store.revoke({ id: current.id, expectedVersion: current.version, staffUserId });
        },
        async loadAccess(selectedLocationId: string): Promise<B2bAccess> {
            try {
                configured();
                const viewer = await deps.readViewer();
                if (!viewer) return { status: "signed_out" };
                const scope = scopeFor({ clerkUserId: viewer.clerkUserId, clerkOrgId: viewer.clerkOrgId });
                if (!sameBuyerScope(viewer, scope)) return { status: "revoked" };
                const binding = await deps.store.read(scope, true);
                if (!binding || binding.state === "proposed") return { status: "pending" };
                if (binding.state !== "approved" || !sameBuyerScope(binding.proof, scope)
                    || binding.proof.companyLocationId !== selectedLocationId) return { status: "revoked" };
                const target = targetV.parse({ customerId: binding.proof.customerId, companyId: binding.proof.companyId,
                    companyContactId: binding.proof.companyContactId, companyLocationId: selectedLocationId });
                const evidence = await freshProof(scope, target);
                if (!sameBuyerProof(binding.proof, evidence.proof)) return { status: "revoked" };
                const session = await deps.readBuyerSession(scope, selectedLocationId);
                if (!session || !sameBuyerScope(session, scope) || !session.customerAccessToken.trim()
                    || !Number.isFinite(session.tokenExpiresAt) || session.tokenExpiresAt <= Date.now() + 30_000
                    || Object.keys(target).some(key => session[key as keyof BindingTarget] !== target[key as keyof BindingTarget])) deny();
                assertFreshBuyerProof(session.checkedAt, Date.now());
                const finalViewer = await deps.readViewer(), finalBinding = await deps.store.read(scope, true);
                if (!finalViewer || !sameBuyerScope(finalViewer, scope) || !finalBinding || finalBinding.state !== "approved"
                    || finalBinding.id !== binding.id || finalBinding.version !== binding.version
                    || !sameBuyerProof(finalBinding.proof, binding.proof)) return { status: "revoked" };
                assertFreshBuyerProof(evidence.checkedAt, Date.now());
                return { status: "approved", clerkUserId: scope.clerkUserId, clerkOrgId: scope.clerkOrgId,
                    companyId: target.companyId, companyContactId: target.companyContactId, companyLocationId: target.companyLocationId,
                    customerAccessToken: session.customerAccessToken, tokenExpiresAt: session.tokenExpiresAt };
            } catch { return { status: "unavailable" }; } // No upstream message/token disclosure or fallback.
        },
    };
}

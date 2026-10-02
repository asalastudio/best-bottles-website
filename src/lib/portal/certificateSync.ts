import "server-only";
import { randomUUID } from "node:crypto";
import type { Doc } from "../../../convex/_generated/dataModel";

// Activation is a separate reviewed change. No environment flag silently enables writes.
export const CERTIFICATE_TAX_WRITES_ENABLED = false;
export type SyncResult = { exemptionLive: boolean; syncBlockedReason?: string };
export interface CertificateSyncAdapter {
    begin(id: string, attemptId: string): Promise<{ done: boolean; certificate: Doc<"resaleCertificates"> }>;
    finish(id: string, attemptId: string, result: { exemptionCode?: string; failureCode?: string }): Promise<SyncResult>;
    resolveCustomer(org: string): Promise<{ status: string; shopifyCustomerId?: string; reason?: string }>;
    exemptionFor(state: string): string | null;
    write(customerId: string, code: string): Promise<void>;
}
/** Injection permits synthetic end-to-end tests without enabling a production writer. */
export async function syncCertificate(id: string, adapter: CertificateSyncAdapter, enabled = CERTIFICATE_TAX_WRITES_ENABLED): Promise<SyncResult> {
    if (!enabled) return { exemptionLive: false, syncBlockedReason: "activation_required" };
    const attempt = randomUUID();
    const started = await adapter.begin(id, attempt);
    if (started.done) return { exemptionLive: true };
    let code: string | null = null;
    try {
        code = adapter.exemptionFor(started.certificate.issuingState);
        if (!code) throw new Error("unsupported_issuing_state");
        const identity = await adapter.resolveCustomer(started.certificate.clerkOrgId);
        if (identity.status !== "linked" || !identity.shopifyCustomerId) {
            const reason = identity.reason === "no_billing_email" ? "no_billing_email" : "customer_unavailable";
            await adapter.finish(id, attempt, { failureCode: reason });
            return { exemptionLive: false, syncBlockedReason: reason };
        }
        // Setting the same desired exemption is idempotent. Concurrent attempts are fenced in Convex.
        await adapter.write(identity.shopifyCustomerId, code);
    } catch {
        await adapter.finish(id, attempt, { failureCode: "shopify_write_failed" });
        return { exemptionLive: false, syncBlockedReason: "shopify_write_failed" };
    }
    try {
        return await adapter.finish(id, attempt, { exemptionCode: code });
    } catch {
        // Never mark a second failure after a successful Shopify write with unknown DB receipt.
        // Keep the durable attempt locked; a reviewed reconciliation must resolve it.
        return { exemptionLive: false, syncBlockedReason: "reconciliation_required" };
    }
}

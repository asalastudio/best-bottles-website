import "server-only";
import { randomUUID } from "node:crypto";
import type { Doc } from "../../../convex/_generated/dataModel";

export type NotificationPolicy = { enabled: boolean; from: string | null; staffRecipients: readonly string[]; customerRecipient: "billing" | null; portalOrigin: string | null };
// No provider/configuration is inferred, and no environment switch activates delivery.
export const CERTIFICATE_NOTIFICATION_POLICY: NotificationPolicy = Object.freeze({ enabled: false, from: null, staffRecipients: [], customerRecipient: null, portalOrigin: null });
type Prepared = { event: Doc<"certificateNotifications">; certificate: Doc<"resaleCertificates">; billingEmail: string | null };
export function certificateNotificationMessage(input: Prepared, origin: string) {
    const subject = { submitted: "Certificate received for review", approved: "Certificate review approved", rejected: "Certificate review needs your attention", sync_failed: "Certificate checkout sync needs attention", synced: "Certificate checkout sync completed" }[input.event.event];
    const detail = {
        submitted: "Your document was submitted for staff review. Open the portal for the current review and checkout sync status.",
        approved: "Staff approved the certificate. This review decision does not confirm checkout exemption; check the portal for sync status.",
        rejected: `Staff could not accept this submission. ${input.certificate.reviewNote ?? "Please open your portal for the review details."}`,
        sync_failed: "The review decision is saved, but checkout sync failed. Review the queue before retrying.",
        synced: "Checkout exemption was confirmed when this update was recorded. Open the portal for current status and expiry.",
    }[input.event.event];
    const path = input.event.audience === "staff" ? "/team/resale-certificates" : "/portal/tax-exemption";
    // Text only: never attach certificates or expose bearer document URLs / permit numbers.
    return { subject, text: `${detail}\n\n${new URL(path, origin).href}` };
}
export interface NotificationAdapter {
    prepare(id: string, attempt: string): Promise<Prepared | null>;
    complete(id: string, attempt: string, result: { status: "sent" | "blocked" | "failed"; providerMessageId?: string; failureCode?: string }): Promise<void>;
    // A future provider MUST support this stable idempotency key for ambiguous transport retries.
    send(message: { from: string; to: string[]; subject: string; text: string; idempotencyKey: string }): Promise<{ id: string }>;
}
const email = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
export async function deliverCertificateNotification(id: string, adapter: NotificationAdapter, policy = CERTIFICATE_NOTIFICATION_POLICY) {
    if (!policy.enabled) return { status: "disabled" as const };
    const attempt = randomUUID();
    const input = await adapter.prepare(id, attempt);
    if (!input) return { status: "skipped" as const };
    const to = input.event.audience === "staff" ? [...policy.staffRecipients] : policy.customerRecipient === "billing" && input.billingEmail ? [input.billingEmail] : [];
    let configured = Boolean(policy.from && email(policy.from) && to.length && to.every(email));
    try { configured &&= Boolean(policy.portalOrigin && new URL(policy.portalOrigin).protocol === "https:"); } catch { configured = false; }
    if (!configured) {
        await adapter.complete(id, attempt, { status: "blocked", failureCode: "recipient_or_sender_not_configured" });
        return { status: "blocked" as const };
    }
    let receipt: { id: string };
    try {
        receipt = await adapter.send({ from: policy.from!, to: [...new Set(to)], ...certificateNotificationMessage(input, policy.portalOrigin!), idempotencyKey: input.event.eventKey });
        if (!receipt.id) throw new Error("missing_receipt");
    } catch {
        await adapter.complete(id, attempt, { status: "failed", failureCode: "delivery_failed" });
        return { status: "failed" as const };
    }
    // If persistence fails after acceptance, leave 'sending' for reviewed provider reconciliation.
    await adapter.complete(id, attempt, { status: "sent", providerMessageId: receipt.id });
    return { status: "sent" as const };
}

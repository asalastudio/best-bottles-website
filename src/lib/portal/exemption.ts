/**
 * How an account's tax status reads in the portal.
 *
 * "Taxable" on its own is the least useful thing we could say. A buyer seeing
 * it needs to know which of these is true: nothing filed yet, filed and
 * waiting on us, rejected for a reason they can fix, or — the one that costs
 * them money quietly — a certificate that WAS good and has lapsed. Same word
 * on screen, four different actions.
 */

export type ExemptionLike = {
    exempt: boolean;
    reason:
        | "approved"
        | "no_certificate"
        | "awaiting_review"
        | "rejected"
        | "revoked"
        | "expired";
    expiresOn?: string;
    daysUntilExpiry?: number;
} | null | undefined;

/** Short form for a status chip. */
export function exemptionLabel(e: ExemptionLike): string {
    if (!e) return "Taxable";
    switch (e.reason) {
        case "approved":
            // warn while there is still time to renew; silence otherwise
            return e.daysUntilExpiry !== undefined && e.daysUntilExpiry <= 45
                ? `Tax Exempt · expires in ${e.daysUntilExpiry}d`
                : "Tax Exempt";
        case "awaiting_review": return "Tax status in review";
        case "expired":         return "Exemption expired";
        case "rejected":        return "Certificate not accepted";
        case "revoked":         return "Exemption revoked";
        default:                return "Taxable";
    }
}

/** The sentence under it — what to actually do about it. */
export function exemptionDetail(e: ExemptionLike): string | null {
    if (!e) return null;
    switch (e.reason) {
        case "approved":
            return e.expiresOn
                ? `Resale certificate on file, valid through ${e.expiresOn}.`
                : "Resale certificate on file.";
        case "no_certificate":
            return "Add a resale certificate to buy tax-free. Orders are charged tax until one is approved.";
        case "awaiting_review":
            return "Your certificate is with our team. Orders are charged tax until it is approved.";
        case "expired":
            return `Your certificate expired${e.expiresOn ? ` on ${e.expiresOn}` : ""}. Upload a current one to restore tax-free ordering.`;
        case "rejected":
            return "We could not accept the certificate as filed. Check the details and resubmit.";
        case "revoked":
            return "This exemption has been revoked. Contact your account manager.";
        default:
            return null;
    }
}

/** Chip colour, in PortalTag's existing vocabulary — "gold" is already the
 *  amber style, so this warns without inventing a fifth variant. Amber is
 *  reserved for the states a customer can still fix in time. */
export function exemptionTone(e: ExemptionLike): "green" | "gold" | "muted" {
    if (!e) return "muted";
    if (e.reason === "approved") {
        return e.daysUntilExpiry !== undefined && e.daysUntilExpiry <= 45
            ? "gold" : "green";
    }
    return e.reason === "awaiting_review" || e.reason === "expired"
        ? "gold" : "muted";
}

/** Customer's document declaration only; never use this to authorize tax exemption. */
export type CustomerDeclaredExpiration =
    | { kind: "date"; date: string }
    | { kind: "none" }
    | { kind: "unspecified" };

/** Keep calendar dates as YYYY-MM-DD, without browser/server timezone conversion. */
export function parseCustomerDeclaredExpiration(kind: string | null | undefined, date?: string): CustomerDeclaredExpiration | undefined {
    if (kind === undefined || kind === null || kind === "") return undefined; // Older forms/records.
    if (kind === "none" || kind === "unspecified") return { kind };
    if (kind !== "date" || !date || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid_customer_declared_expiration");
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("invalid_customer_declared_expiration");
    // Past dates are factual declarations for staff review, not a grant of exemption.
    return { kind: "date", date };
}

export function customerDeclaredExpirationLabel(value?: CustomerDeclaredExpiration) {
    if (!value) return "Not provided";
    if (value.kind === "none") return "No expiration on document";
    if (value.kind === "unspecified") return "Not sure / not specified";
    return value.date;
}

export function customerDeclaredExpirationIsPast(value: CustomerDeclaredExpiration | undefined, now: number) {
    return value?.kind === "date" && value.date < new Date(now).toISOString().slice(0, 10);
}

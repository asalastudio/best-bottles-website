/**
 * Shopify customer identity — the Shopify half of the Clerk-org ↔ Shopify bridge.
 *
 * Why this exists: Shopify applies tax exemption to a CUSTOMER RECORD. The cart
 * permalink `buildCheckoutUrl` produces is anonymous, so an approved resale
 * certificate has nowhere to land. Before any approval flow can matter, a portal
 * account needs a Shopify customer to be approved *onto*.
 *
 * One Shopify customer per Clerk ORGANIZATION, not per user: the resale
 * certificate belongs to the business, and `shopifyCustomerId` already lives on
 * `portalAccounts`, which is org-scoped.
 *
 * Scopes: reads need `read_customers` (granted in shopify.app.toml); writes need
 * `write_customers` (NOT granted yet — `ShopifyCustomerScopeError` names it).
 */

import { adminGraphQL, numericId } from "./shopify";

// ─── US reseller exemptions ─────────────────────────────────────────────────

/**
 * US states and DC, each of which Shopify models as its own reseller exemption.
 * Verified against the live `TaxExemption` enum (Admin API) — a buyer presents a
 * certificate from THEIR state, so this is a per-state code, never one flag.
 */
const US_RESELLER_EXEMPTION_STATES = new Set([
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY", "DC",
]);

/**
 * Map a two-letter US state code to its Shopify reseller-exemption code, e.g.
 * `CA` → `US_CA_RESELLER_EXEMPTION`. Returns null for anything unrecognized so an
 * unknown jurisdiction fails closed (taxed) rather than silently exempt.
 */
export function usResellerExemptionFor(stateCode: string): string | null {
    const code = stateCode?.trim().toUpperCase();
    return US_RESELLER_EXEMPTION_STATES.has(code)
        ? `US_${code}_RESELLER_EXEMPTION`
        : null;
}

export interface ShopifyCustomerRef {
    /** Numeric Shopify customer ID, matching `portalAccounts.shopifyCustomerId`. */
    customerId: string;
    /** Full GID, e.g. `gid://shopify/Customer/123`. */
    customerGid: string;
    email: string;
    /** Store-level exemption boolean. */
    taxExempt: boolean;
    /** Per-jurisdiction exemption codes, e.g. `US_CA_RESELLER_EXEMPTION`. */
    taxExemptions: string[];
}

/**
 * Thrown when the Admin token cannot perform a customer write. This is a
 * configuration failure, not a customer-data failure, so callers must not treat
 * it as "no customer exists" and retry.
 */
export class ShopifyCustomerScopeError extends Error {
    readonly requiredScope = "write_customers";
    constructor(operation: string) {
        super(
            `Shopify Admin token lacks '${"write_customers"}' (needed for ${operation}). ` +
                `Add it to shopify.app.toml access_scopes and reinstall the app, or widen ` +
                `the custom-app token's scopes in the Shopify admin.`,
        );
        this.name = "ShopifyCustomerScopeError";
    }
}

export function normalizeCustomerEmail(value: string | null | undefined): string | null {
    const trimmed = value?.trim().toLowerCase();
    return trimmed && trimmed.includes("@") ? trimmed : null;
}

/**
 * Shopify's search syntax is not GraphQL — a quote or backslash inside the term
 * escapes the term and silently changes which records match, so an address like
 * `o'brien@x.com` must not be interpolated raw.
 */
export function buildEmailSearchQuery(email: string): string {
    const escaped = email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `email:"${escaped}"`;
}

interface RawCustomer {
    id: string;
    email: string | null;
    taxExempt: boolean;
    taxExemptions: string[] | null;
}

function toRef(raw: RawCustomer): ShopifyCustomerRef {
    return {
        customerId: numericId(raw.id),
        customerGid: raw.id,
        email: raw.email ?? "",
        taxExempt: Boolean(raw.taxExempt),
        taxExemptions: raw.taxExemptions ?? [],
    };
}

function isScopeDenial(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /access denied|write_customers|403/i.test(message);
}

const CUSTOMER_FIELDS = "id email taxExempt taxExemptions";

/**
 * Look up a customer by exact email. Returns null when Shopify has no match.
 *
 * Shopify's `email:` search is a prefix/token match, not an equality test, so
 * the result is re-checked against the normalized address before it is trusted —
 * otherwise `amir@x.com` could adopt `amira@x.com`'s customer record and, with
 * it, that record's tax exemption.
 */
export async function findShopifyCustomerByEmail(
    email: string,
): Promise<ShopifyCustomerRef | null> {
    const normalized = normalizeCustomerEmail(email);
    if (!normalized) return null;

    const data = await adminGraphQL<{
        customers: { edges: Array<{ node: RawCustomer }> };
    }>(
        `query FindCustomerByEmail($query: String!) {
            customers(first: 2, query: $query) {
                edges { node { ${CUSTOMER_FIELDS} } }
            }
        }`,
        { query: buildEmailSearchQuery(normalized) },
    );

    const exact = data.customers.edges
        .map((edge) => edge.node)
        .find((node) => normalizeCustomerEmail(node.email) === normalized);

    return exact ? toRef(exact) : null;
}

export interface CreateShopifyCustomerInput {
    email: string;
    /** Recorded in the customer note so staff can see which account owns it. */
    companyName: string;
    /** Best Bottles account number, tagged for filtering in the Shopify admin. */
    accountNumber?: string;
}

export async function createShopifyCustomer(
    input: CreateShopifyCustomerInput,
): Promise<ShopifyCustomerRef> {
    const normalized = normalizeCustomerEmail(input.email);
    if (!normalized) throw new Error(`Invalid customer email: ${input.email}`);

    const tags = ["best-bottles-portal"];
    if (input.accountNumber) tags.push(`account:${input.accountNumber}`);

    let data: { customerCreate: { customer: RawCustomer | null; userErrors: Array<{ field: string[] | null; message: string }> } };
    try {
        data = await adminGraphQL(
            `mutation CreateWholesaleCustomer($input: CustomerInput!) {
                customerCreate(input: $input) {
                    customer { ${CUSTOMER_FIELDS} }
                    userErrors { field message }
                }
            }`,
            {
                input: {
                    email: normalized,
                    note: `Best Bottles wholesale portal — ${input.companyName}`,
                    tags,
                },
            },
        );
    } catch (err) {
        if (isScopeDenial(err)) throw new ShopifyCustomerScopeError("customerCreate");
        throw err;
    }

    const userErrors = data.customerCreate.userErrors;
    if (userErrors.length) {
        throw new Error(
            `Shopify customerCreate rejected: ${userErrors
                .map((e) => `${(e.field ?? []).join(".") || "input"}: ${e.message}`)
                .join("; ")}`,
        );
    }

    const customer = data.customerCreate.customer;
    if (!customer) throw new Error("Shopify customerCreate returned no customer.");
    return toRef(customer);
}

export interface EnsureShopifyCustomerResult {
    customer: ShopifyCustomerRef;
    /** False when an existing Shopify customer was adopted rather than created. */
    created: boolean;
}

/**
 * Find-or-create, idempotent: a pre-existing Shopify customer on that address is
 * adopted rather than duplicated. Shopify enforces email uniqueness, so creating
 * blindly would fail for every account that has ever placed a retail order.
 */
export async function ensureShopifyCustomer(
    input: CreateShopifyCustomerInput,
): Promise<EnsureShopifyCustomerResult> {
    const existing = await findShopifyCustomerByEmail(input.email);
    if (existing) return { customer: existing, created: false };
    return { customer: await createShopifyCustomer(input), created: true };
}

/**
 * Write an approved (or revoked) exemption onto the customer record.
 *
 * Not wired to anything yet — this is the far end of the bridge that the
 * certificate-approval flow will call. `taxExemptions` carries per-jurisdiction
 * codes (e.g. `US_CA_RESELLER_EXEMPTION`); `taxExempt` is the blunt store-level
 * boolean. Certificates expire, so revocation is the same call with `false`.
 */
export async function setShopifyCustomerTaxExempt(
    customerGid: string,
    exempt: boolean,
    taxExemptions?: string[],
): Promise<ShopifyCustomerRef> {
    let data: { customerUpdate: { customer: RawCustomer | null; userErrors: Array<{ field: string[] | null; message: string }> } };
    try {
        data = await adminGraphQL(
            `mutation SetCustomerTaxExempt($input: CustomerInput!) {
                customerUpdate(input: $input) {
                    customer { ${CUSTOMER_FIELDS} }
                    userErrors { field message }
                }
            }`,
            {
                input: {
                    id: customerGid,
                    taxExempt: exempt,
                    ...(taxExemptions ? { taxExemptions } : {}),
                },
            },
        );
    } catch (err) {
        if (isScopeDenial(err)) throw new ShopifyCustomerScopeError("customerUpdate");
        throw err;
    }

    const userErrors = data.customerUpdate.userErrors;
    if (userErrors.length) {
        throw new Error(
            `Shopify customerUpdate rejected: ${userErrors
                .map((e) => `${(e.field ?? []).join(".") || "input"}: ${e.message}`)
                .join("; ")}`,
        );
    }

    const customer = data.customerUpdate.customer;
    if (!customer) throw new Error("Shopify customerUpdate returned no customer.");
    return toRef(customer);
}

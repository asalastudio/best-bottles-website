/**
 * Shopify customer identity — the Clerk-org ↔ Shopify-customer bridge.
 *
 * These tests guard the two ways the bridge can silently do the wrong thing:
 * adopting the WRONG customer record (which would hand one business another's
 * tax exemption), and mistaking a missing OAuth scope for "no customer exists".
 */

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import {
    buildEmailSearchQuery,
    createShopifyCustomer,
    ensureShopifyCustomer,
    findShopifyCustomerByEmail,
    normalizeCustomerEmail,
    setShopifyCustomerTaxExempt,
    ShopifyCustomerScopeError,
    usResellerExemptionFor,
} from "../src/lib/shopify-customers";

const originalFetch = global.fetch;
const originalEnv = process.env;

beforeEach(() => {
    process.env = {
        ...originalEnv,
        NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: "bestbottles-1580.myshopify.com",
        SHOPIFY_ADMIN_TOKEN: "test-token",
    };
});

afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
});

function mockGraphQL(...payloads: unknown[]) {
    const fetchMock = vi.fn();
    for (const payload of payloads) {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ data: payload }), { status: 200 }),
        );
    }
    global.fetch = fetchMock;
    return fetchMock;
}

function customerNode(id: string, email: string, taxExempt = false) {
    return { id, email, taxExempt, taxExemptions: [] };
}

// ─── Email normalization ────────────────────────────────────────────────────

describe("normalizeCustomerEmail", () => {
    it("lowercases and trims", () => {
        expect(normalizeCustomerEmail("  Aamir@Nematinternational.COM ")).toBe(
            "aamir@nematinternational.com",
        );
    });

    it("rejects values that are not addresses", () => {
        expect(normalizeCustomerEmail("not-an-email")).toBeNull();
        expect(normalizeCustomerEmail("")).toBeNull();
        expect(normalizeCustomerEmail(null)).toBeNull();
        expect(normalizeCustomerEmail(undefined)).toBeNull();
    });
});

// ─── Search-query escaping ──────────────────────────────────────────────────

describe("buildEmailSearchQuery", () => {
    it("quotes the address", () => {
        expect(buildEmailSearchQuery("buyer@x.com")).toBe('email:"buyer@x.com"');
    });

    it("escapes quotes and backslashes so the term cannot be broken out of", () => {
        // An unescaped quote would terminate the term early and change which
        // records Shopify returns.
        expect(buildEmailSearchQuery('o"brien@x.com')).toBe('email:"o\\"brien@x.com"');
        expect(buildEmailSearchQuery("a\\b@x.com")).toBe('email:"a\\\\b@x.com"');
    });
});

// ─── findShopifyCustomerByEmail ─────────────────────────────────────────────

describe("findShopifyCustomerByEmail", () => {
    it("returns the matching customer", async () => {
        mockGraphQL({
            customers: { edges: [{ node: customerNode("gid://shopify/Customer/99", "buyer@x.com") }] },
        });

        const found = await findShopifyCustomerByEmail("buyer@x.com");
        expect(found).toMatchObject({
            customerId: "99",
            customerGid: "gid://shopify/Customer/99",
            email: "buyer@x.com",
        });
    });

    it("rejects a near-miss from Shopify's prefix search", async () => {
        // Shopify's `email:` search is a token match, not equality. Adopting
        // amira@x.com for amir@x.com would give one business another's exemption.
        mockGraphQL({
            customers: { edges: [{ node: customerNode("gid://shopify/Customer/1", "amira@x.com") }] },
        });

        expect(await findShopifyCustomerByEmail("amir@x.com")).toBeNull();
    });

    it("matches case-insensitively", async () => {
        mockGraphQL({
            customers: { edges: [{ node: customerNode("gid://shopify/Customer/7", "Buyer@X.com") }] },
        });

        expect(await findShopifyCustomerByEmail("buyer@x.com")).toMatchObject({ customerId: "7" });
    });

    it("returns null without calling Shopify for an invalid address", async () => {
        const fetchMock = mockGraphQL();
        expect(await findShopifyCustomerByEmail("nope")).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

// ─── createShopifyCustomer ──────────────────────────────────────────────────

describe("createShopifyCustomer", () => {
    it("tags the customer with the portal and account number", async () => {
        const fetchMock = mockGraphQL({
            customerCreate: {
                customer: customerNode("gid://shopify/Customer/42", "buyer@x.com"),
                userErrors: [],
            },
        });

        const created = await createShopifyCustomer({
            email: "Buyer@X.com",
            companyName: "Lumière Atelier LLC",
            accountNumber: "BB-1021",
        });

        expect(created.customerId).toBe("42");

        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
        expect(body.variables.input.email).toBe("buyer@x.com");
        expect(body.variables.input.tags).toEqual(["best-bottles-portal", "account:BB-1021"]);
        expect(body.variables.input.note).toContain("Lumière Atelier LLC");
    });

    it("surfaces userErrors rather than returning a half-made link", async () => {
        mockGraphQL({
            customerCreate: {
                customer: null,
                userErrors: [{ field: ["email"], message: "Email has already been taken" }],
            },
        });

        await expect(
            createShopifyCustomer({ email: "buyer@x.com", companyName: "Acme" }),
        ).rejects.toThrow(/email: Email has already been taken/);
    });

    it("maps a scope denial to ShopifyCustomerScopeError", async () => {
        global.fetch = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    errors: [{ message: "Access denied for customerCreate field. Required access: write_customers" }],
                }),
                { status: 200 },
            ),
        );

        await expect(
            createShopifyCustomer({ email: "buyer@x.com", companyName: "Acme" }),
        ).rejects.toBeInstanceOf(ShopifyCustomerScopeError);
    });
});

// ─── ensureShopifyCustomer ──────────────────────────────────────────────────

describe("ensureShopifyCustomer", () => {
    it("adopts an existing customer instead of duplicating", async () => {
        const fetchMock = mockGraphQL({
            customers: { edges: [{ node: customerNode("gid://shopify/Customer/5", "buyer@x.com", true) }] },
        });

        const result = await ensureShopifyCustomer({ email: "buyer@x.com", companyName: "Acme" });

        expect(result.created).toBe(false);
        expect(result.customer.customerId).toBe("5");
        expect(result.customer.taxExempt).toBe(true);
        // One call: the lookup. No create attempted.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("creates when Shopify has no such customer", async () => {
        const fetchMock = mockGraphQL(
            { customers: { edges: [] } },
            {
                customerCreate: {
                    customer: customerNode("gid://shopify/Customer/6", "new@x.com"),
                    userErrors: [],
                },
            },
        );

        const result = await ensureShopifyCustomer({ email: "new@x.com", companyName: "Acme" });

        expect(result.created).toBe(true);
        expect(result.customer.customerId).toBe("6");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

// ─── setShopifyCustomerTaxExempt ────────────────────────────────────────────

describe("setShopifyCustomerTaxExempt", () => {
    it("writes the exemption flag and jurisdiction codes", async () => {
        const fetchMock = mockGraphQL({
            customerUpdate: {
                customer: { ...customerNode("gid://shopify/Customer/8", "buyer@x.com", true), taxExemptions: ["US_CA_RESELLER_EXEMPTION"] },
                userErrors: [],
            },
        });

        const updated = await setShopifyCustomerTaxExempt(
            "gid://shopify/Customer/8",
            true,
            ["US_CA_RESELLER_EXEMPTION"],
        );

        expect(updated.taxExempt).toBe(true);
        expect(updated.taxExemptions).toEqual(["US_CA_RESELLER_EXEMPTION"]);

        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
        expect(body.variables.input).toMatchObject({
            id: "gid://shopify/Customer/8",
            taxExempt: true,
            taxExemptions: ["US_CA_RESELLER_EXEMPTION"],
        });
    });

    it("revokes without forcing the caller to pass codes", async () => {
        const fetchMock = mockGraphQL({
            customerUpdate: {
                customer: customerNode("gid://shopify/Customer/8", "buyer@x.com", false),
                userErrors: [],
            },
        });

        const updated = await setShopifyCustomerTaxExempt("gid://shopify/Customer/8", false);

        expect(updated.taxExempt).toBe(false);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
        expect(body.variables.input).not.toHaveProperty("taxExemptions");
    });

    it("maps a scope denial to ShopifyCustomerScopeError", async () => {
        global.fetch = vi.fn().mockResolvedValue(
            new Response("Access denied", { status: 403 }),
        );

        await expect(
            setShopifyCustomerTaxExempt("gid://shopify/Customer/8", true),
        ).rejects.toBeInstanceOf(ShopifyCustomerScopeError);
    });
});

// ─── usResellerExemptionFor ─────────────────────────────────────────────────

describe("usResellerExemptionFor", () => {
    it("maps a state code to its Shopify exemption enum", () => {
        // Verified against the live Admin API TaxExemption enum.
        expect(usResellerExemptionFor("CA")).toBe("US_CA_RESELLER_EXEMPTION");
        expect(usResellerExemptionFor("tx")).toBe("US_TX_RESELLER_EXEMPTION");
        expect(usResellerExemptionFor(" nv ")).toBe("US_NV_RESELLER_EXEMPTION");
        expect(usResellerExemptionFor("DC")).toBe("US_DC_RESELLER_EXEMPTION");
    });

    it("fails closed on anything unrecognized", () => {
        // An unknown jurisdiction must be taxed, never silently exempt.
        expect(usResellerExemptionFor("XX")).toBeNull();
        expect(usResellerExemptionFor("California")).toBeNull();
        expect(usResellerExemptionFor("")).toBeNull();
    });
});

/**
 * The shipping address a wholesale order carries.
 *
 * The failure this guards against is quiet and expensive: a draft order with
 * no address reaches Shopify looking fine, and is discovered to be unshippable
 * only when someone in the warehouse tries to pick it. Every portal draft
 * created before this existed had exactly that shape, because the code asked
 * Shopify to "use the customer's default address" and no customer had one.
 */

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { createWholesaleDraftOrder } from "../src/lib/shopify-draft-orders";
import {
    validateAddress,
    addressIsUsable,
    normalizeAddress,
    toShopifyMailingAddress,
    formatAddressLine,
    EMPTY_ADDRESS,
} from "../src/lib/portal/address";

const COMPLETE = {
    contactName: "Dana Reyes",
    company: "ASALA",
    phone: "(510) 555-0142",
    address1: "2050 Whipple Rd",
    address2: "Dock 4",
    city: "Union City",
    provinceCode: "CA",
    zip: "94587",
    countryCode: "US",
};

describe("validateAddress", () => {
    it("accepts an address a carrier could actually deliver to", () => {
        expect(validateAddress(COMPLETE)).toEqual({});
        expect(addressIsUsable(COMPLETE)).toBe(true);
    });

    it("rejects an empty address rather than letting it through as blank strings", () => {
        expect(addressIsUsable(EMPTY_ADDRESS)).toBe(false);
        expect(addressIsUsable(null)).toBe(false);
        expect(addressIsUsable(undefined)).toBe(false);
    });

    it("requires a phone, because freight carriers will not book delivery without one", () => {
        const errors = validateAddress({ ...COMPLETE, phone: "" });
        expect(errors.phone).toBeTruthy();
    });

    it("rejects a phone too short to dial", () => {
        expect(validateAddress({ ...COMPLETE, phone: "555-0142" }).phone).toBeTruthy();
    });

    it("rejects a malformed US ZIP but accepts ZIP+4", () => {
        expect(validateAddress({ ...COMPLETE, zip: "945" }).zip).toBeTruthy();
        expect(validateAddress({ ...COMPLETE, zip: "94587-1234" }).zip).toBeUndefined();
    });

    it("rejects a state that is not a two-letter code", () => {
        expect(validateAddress({ ...COMPLETE, provinceCode: "California" }).provinceCode).toBeTruthy();
    });

    it("treats a whitespace-only field as missing", () => {
        expect(validateAddress({ ...COMPLETE, address1: "   " }).address1).toBeTruthy();
    });

    it("does not require the optional fields", () => {
        expect(validateAddress({ ...COMPLETE, company: "", address2: "" })).toEqual({});
    });
});

describe("normalizeAddress", () => {
    it("upper-cases the state and country so comparisons are stable", () => {
        const normalized = normalizeAddress({ ...COMPLETE, provinceCode: "ca", countryCode: "us" });
        expect(normalized.provinceCode).toBe("CA");
        expect(normalized.countryCode).toBe("US");
    });

    it("defaults the country to US rather than leaving it blank", () => {
        expect(normalizeAddress({ ...COMPLETE, countryCode: "" }).countryCode).toBe("US");
    });
});

describe("toShopifyMailingAddress", () => {
    it("splits the contact name into the first and last name Shopify expects", () => {
        const mailing = toShopifyMailingAddress(normalizeAddress(COMPLETE));
        expect(mailing.firstName).toBe("Dana");
        expect(mailing.lastName).toBe("Reyes");
    });

    it("keeps a single-word contact name as the first name rather than dropping it", () => {
        const mailing = toShopifyMailingAddress(normalizeAddress({ ...COMPLETE, contactName: "Reception" }));
        expect(mailing.firstName).toBe("Reception");
        expect(mailing.lastName).toBe("");
    });

    it("omits empty optional fields instead of sending empty strings", () => {
        const mailing = toShopifyMailingAddress(normalizeAddress({ ...COMPLETE, company: "", address2: "" }));
        expect(mailing.company).toBeUndefined();
        expect(mailing.address2).toBeUndefined();
    });
});

describe("formatAddressLine", () => {
    it("reads as one line a human would recognise", () => {
        expect(formatAddressLine(normalizeAddress(COMPLETE))).toBe(
            "2050 Whipple Rd, Dock 4, Union City, CA 94587",
        );
    });
});

// ─── What actually reaches Shopify ──────────────────────────────────────────

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

function mockDraftOrder() {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                data: {
                    draftOrderCreate: {
                        draftOrder: {
                            id: "gid://shopify/DraftOrder/55",
                            name: "#D55",
                            invoiceUrl: "https://bestbottles-1580.myshopify.com/invoice/abc",
                            totalPriceSet: { shopMoney: { amount: "500.00", currencyCode: "USD" } },
                            totalTaxSet: { shopMoney: { amount: "0.00" } },
                        },
                        userErrors: [],
                    },
                },
            }),
            { status: 200 },
        ),
    );
    global.fetch = fetchMock;
    return fetchMock;
}

function sentInput(fetchMock: ReturnType<typeof vi.fn>) {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string).variables.input;
}

const LINES = [{ variantId: "111", quantity: 12 }];

describe("createWholesaleDraftOrder addressing", () => {
    it("sends the portal's address explicitly rather than trusting a default", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({
            customerId: "99",
            lines: LINES,
            shippingAddress: toShopifyMailingAddress(normalizeAddress(COMPLETE)),
        });

        const input = sentInput(fetchMock);
        expect(input.shippingAddress.address1).toBe("2050 Whipple Rd");
        expect(input.shippingAddress.city).toBe("Union City");
        expect(input.shippingAddress.zip).toBe("94587");
        // The old behaviour produced addressless drafts; it must not come back
        // alongside an explicit address.
        expect(input.useCustomerDefaultAddress).toBeUndefined();
    });

    it("bills where it ships unless a separate billing address is given", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({
            customerId: "99",
            lines: LINES,
            shippingAddress: toShopifyMailingAddress(normalizeAddress(COMPLETE)),
        });

        const input = sentInput(fetchMock);
        expect(input.billingAddress).toEqual(input.shippingAddress);
    });

    it("keeps a separate billing address when one is supplied", async () => {
        const fetchMock = mockDraftOrder();
        const billing = normalizeAddress({ ...COMPLETE, address1: "1 Finance Way", city: "Oakland" });
        await createWholesaleDraftOrder({
            customerId: "99",
            lines: LINES,
            shippingAddress: toShopifyMailingAddress(normalizeAddress(COMPLETE)),
            billingAddress: toShopifyMailingAddress(billing),
        });

        const input = sentInput(fetchMock);
        expect(input.billingAddress.address1).toBe("1 Finance Way");
        expect(input.shippingAddress.address1).toBe("2050 Whipple Rd");
    });

    it("still defers to the customer default for storefront checkout, which collects the address at Shopify", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({ customerId: "99", lines: LINES });

        const input = sentInput(fetchMock);
        expect(input.useCustomerDefaultAddress).toBe(true);
        expect(input.shippingAddress).toBeUndefined();
    });
});

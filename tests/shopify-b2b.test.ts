import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { createNativeB2bService, NATIVE_CART_MUTATION, NATIVE_PRICES_QUERY, type B2bAccess } from "../src/lib/shopify-b2b";
import { nativeB2bStorefrontGraphQL } from "../src/lib/shopify";

const id = "gid://shopify/ProductVariant/53343615680804";
const sku = "GB-ELG-CLR-15ML-MRL-SSLV";
const tiers = [{ minimumQuantity: 1, unitCents: 88 }, { minimumQuantity: 12, unitCents: 84 }, { minimumQuantity: 144, unitCents: 79 }, { minimumQuantity: 288, unitCents: 75 }, { minimumQuantity: 1440, unitCents: 69 }];
const usd = (amount: string) => ({ amount, currencyCode: "USD" });
const access = (): B2bAccess => ({ status: "approved", clerkUserId: "user_test", clerkOrgId: "org_test", customerAccessToken: "synthetic-customer-token", tokenExpiresAt: Date.now() + 3600000,
    companyId: "gid://shopify/Company/1", companyContactId: "gid://shopify/CompanyContact/2", companyLocationId: "gid://shopify/CompanyLocation/3" });
const prices = () => ({ nodes: [{ id, sku, availableForSale: true, price: usd("0.88"), quantityRule: { minimum: 1, maximum: null as number | null, increment: 1 },
    quantityPriceBreaks: { nodes: [{ minimumQuantity: 12, price: usd("0.84") }, { minimumQuantity: 144, price: usd("0.79") }, { minimumQuantity: 288, price: usd("0.75") }, { minimumQuantity: 1440, price: usd("0.69") }], pageInfo: { hasNextPage: false, endCursor: null } },
}] });
const cart = (quantity = 60, unit = "0.84", total = "50.40") => ({ cartCreate: { userErrors: [] as { message: string }[], cart: {
    id: "gid://shopify/Cart/test", checkoutUrl: "https://bestbottles-1580.myshopify.com/checkouts/test",
    buyerIdentity: { purchasingCompany: { company: { id: "gid://shopify/Company/1" }, contact: { id: "gid://shopify/CompanyContact/2" }, location: { id: "gid://shopify/CompanyLocation/3" } } },
    cost: { subtotalAmount: usd(total) }, lines: { nodes: [{ id: "line1", quantity, merchandise: { id }, cost: { amountPerQuantity: usd(unit), totalAmount: usd(total) } }], pageInfo: { hasNextPage: false, endCursor: null } },
} } });
function setup() {
    const request = vi.fn<typeof nativeB2bStorefrontGraphQL>();
    const loadAccess = vi.fn(async (): Promise<B2bAccess> => access());
    const assertOrderAllowed = vi.fn(async () => {});
    const service = createNativeB2bService({ request, loadAccess, assertOrderAllowed, enrollment: [{ variantId: id, sku, tiers }] });
    return { request, loadAccess, assertOrderAllowed, service };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("native B2B price and checkout contract", () => {
    it("binds the proposed native pilot to the published exact-SKU ladder", () => {
        const pilot = JSON.parse(readFileSync(new URL("../docs/reviews/native-b2b-pilot-2026-10-02/pilot.json", import.meta.url), "utf8"));
        const source = readFileSync(new URL("../data/audits/legacy-tier-pricing-2026-07-20/tiers.jsonl", import.meta.url), "utf8")
            .split("\n").filter(Boolean).map(line => JSON.parse(line))
            .find(row => row.websiteSku === "GBElg15MtlRollSlSh");
        expect(pilot.variantId).toBe(id);
        expect(pilot.shopifySku).toBe(source.graceSku);
        expect(pilot.tiers).toEqual(source.tiers.map((tier: { minQty: number; unitPrice: number }) => ({ minimumQuantity: tier.minQty, unitCents: Math.round(tier.unitPrice * 100) })));
        expect(pilot.tiers).toEqual(tiers);
    });
    it.each([
        [1, "0.88", "0.88"], [11, "0.88", "9.68"], [12, "0.84", "10.08"], [13, "0.84", "10.92"], [60, "0.84", "50.40"],
        [143, "0.84", "120.12"], [144, "0.79", "113.76"], [145, "0.79", "114.55"], [287, "0.79", "226.73"],
        [288, "0.75", "216.00"], [289, "0.75", "216.75"], [1439, "0.75", "1079.25"], [1440, "0.69", "993.60"], [1441, "0.69", "994.29"],
    ])("agrees on native display/cart/handoff at quantity %i", async (quantity, unit, total) => {
        const { service, request, assertOrderAllowed } = setup();
        request.mockResolvedValueOnce(prices()).mockResolvedValueOnce(prices()).mockResolvedValueOnce(cart(quantity, unit, total));
        const lines = [{ variantId: id, quantity }];
        const display = await service.prices(lines);
        const handoff = await service.checkout(lines);
        expect(handoff.lines).toEqual(display);
        expect(handoff.subtotalCents).toBe(Math.round(Number(total) * 100));
        expect(display[0].unitCents).toBe(Math.round(Number(unit) * 100));
        expect(assertOrderAllowed).toHaveBeenCalledWith(display, expect.objectContaining({ clerkOrgId: "org_test" }));
        expect(request).toHaveBeenLastCalledWith(NATIVE_CART_MUTATION, { input: {
            buyerIdentity: { customerAccessToken: "synthetic-customer-token", companyLocationId: "gid://shopify/CompanyLocation/3" },
            lines: [{ merchandiseId: id, quantity }],
        } });
    });

    it("merges split variant quantities and ignores forged browser prices", async () => {
        const { service, request } = setup();
        request.mockResolvedValueOnce(prices()).mockResolvedValueOnce(cart());
        const result = await service.checkout([{ variantId: id, quantity: 10, unitPrice: 0.01 }, { variantId: id, quantity: 50 }] as { variantId: string; quantity: number }[]);
        expect(result.subtotalCents).toBe(5040);
        expect(request.mock.calls[1][1]).not.toHaveProperty("input.lines.0.unitPrice");
    });

    it("re-reads native prices after quantity falls below a break", async () => {
        const { service, request } = setup();
        request.mockResolvedValueOnce(prices()).mockResolvedValueOnce(cart()).mockResolvedValueOnce(prices()).mockResolvedValueOnce(cart(11, "0.88", "9.68"));
        await service.checkout([{ variantId: id, quantity: 60 }]);
        expect((await service.checkout([{ variantId: id, quantity: 11 }])).subtotalCents).toBe(968);
    });

    it.each(["signed_out", "pending", "revoked", "unavailable"] as const)("blocks %s before Shopify or policy calls", async status => {
        const { service, request, loadAccess, assertOrderAllowed } = setup();
        loadAccess.mockResolvedValue({ status });
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow("B2B_ACCESS_");
        expect(request).not.toHaveBeenCalled(); expect(assertOrderAllowed).not.toHaveBeenCalled();
    });

    it("rechecks approval before cart creation", async () => {
        const { service, request, loadAccess } = setup();
        request.mockResolvedValueOnce(prices());
        loadAccess.mockResolvedValueOnce(access()).mockResolvedValueOnce({ status: "revoked" });
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow();
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("rejects an expired customer token before requesting personalized prices", async () => {
        const { service, request, loadAccess } = setup();
        const buyer = access();
        if (buyer.status === "approved") buyer.tokenExpiresAt = Date.now() - 1;
        loadAccess.mockResolvedValue(buyer);
        await expect(service.prices([{ variantId: id, quantity: 60 }])).rejects.toThrow();
        expect(request).not.toHaveBeenCalled();
    });

    it("requires a fresh quote after company location switches", async () => {
        const { service, request, loadAccess } = setup();
        const switched = access();
        if (switched.status === "approved") switched.companyLocationId = "gid://shopify/CompanyLocation/4";
        loadAccess.mockResolvedValueOnce(access()).mockResolvedValueOnce(switched);
        request.mockResolvedValueOnce(prices());
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow();
        expect(request).toHaveBeenCalledTimes(1);
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])("rejects invalid quantity %s", async quantity => {
        const { service, request } = setup();
        await expect(service.checkout([{ variantId: id, quantity }])).rejects.toThrow();
        expect(request).not.toHaveBeenCalled();
    });

    it("honors the injected order policy without assuming a minimum or approval", async () => {
        const { service, request, assertOrderAllowed } = setup();
        request.mockResolvedValueOnce(prices());
        assertOrderAllowed.mockRejectedValueOnce(new Error("ORDER_REQUIRES_REVIEW"));
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow("ORDER_REQUIRES_REVIEW");
        expect(request).toHaveBeenCalledTimes(1);
    });

    it.each(["missing_breaks", "stale_other_tier", "currency", "quantity_rule", "unpublished", "wrong_sku", "truncated"])("blocks %s native data", async failure => {
        const { service, request } = setup(); const data = prices(); const node = data.nodes[0];
        if (failure === "missing_breaks") node.quantityPriceBreaks.nodes = [];
        if (failure === "stale_other_tier") node.quantityPriceBreaks.nodes[1].price.amount = "0.80";
        if (failure === "currency") node.price.currencyCode = "CAD";
        if (failure === "quantity_rule") node.quantityRule.maximum = 50;
        if (failure === "unpublished") node.availableForSale = false;
        if (failure === "wrong_sku") node.sku = "another-sku";
        if (failure === "truncated") node.quantityPriceBreaks.pageInfo.hasNextPage = true;
        request.mockResolvedValueOnce(data);
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow();
        expect(request).toHaveBeenCalledTimes(1);
    });

    it.each(["base_price", "reduced_stock", "wrong_buyer", "wrong_variant", "missing_line", "truncated", "user_error", "wrong_subtotal"])("withholds checkout URL on %s", async failure => {
        const { service, request } = setup(); const payload = cart(); const result = payload.cartCreate.cart;
        if (failure === "base_price") result.lines.nodes[0].cost.amountPerQuantity.amount = "0.88";
        if (failure === "reduced_stock") result.lines.nodes[0].quantity = 50;
        if (failure === "wrong_buyer") result.buyerIdentity.purchasingCompany.location.id = "gid://shopify/CompanyLocation/999";
        if (failure === "wrong_variant") result.lines.nodes[0].merchandise.id = "gid://shopify/ProductVariant/999";
        if (failure === "missing_line") result.lines.nodes = [];
        if (failure === "truncated") result.lines.pageInfo.hasNextPage = true;
        if (failure === "user_error") payload.cartCreate.userErrors = [{ message: "invalid buyer" }];
        if (failure === "wrong_subtotal") result.cost.subtotalAmount.amount = "52.80";
        request.mockResolvedValueOnce(prices()).mockResolvedValueOnce(payload);
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow();
        expect(request).toHaveBeenCalledTimes(2);
    });

    it("rejects an unenrolled mixed variant instead of giving it the pilot price", async () => {
        const { service, request } = setup();
        await expect(service.checkout([{ variantId: id, quantity: 60 }, { variantId: "gid://shopify/ProductVariant/2", quantity: 60 }])).rejects.toThrow();
        expect(request).not.toHaveBeenCalled();
    });
    it("does not fall back after Shopify fails", async () => {
        const { service, request } = setup(); request.mockRejectedValue(new Error("offline"));
        await expect(service.checkout([{ variantId: id, quantity: 60 }])).rejects.toThrow("offline");
        expect(request).toHaveBeenCalledTimes(1);
    });
});

describe("native B2B transport", () => {
    it("pins API version, disables shared caching, and supplies buyer context", async () => {
        vi.stubEnv("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "bestbottles-1580.myshopify.com");
        vi.stubEnv("SHOPIFY_STOREFRONT_TOKEN", "synthetic-storefront-token");
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: prices() })));
        vi.stubGlobal("fetch", fetchMock);
        await nativeB2bStorefrontGraphQL(NATIVE_PRICES_QUERY, { buyer: { customerAccessToken: "synthetic-customer-token" } });
        expect(fetchMock).toHaveBeenCalledWith("https://bestbottles-1580.myshopify.com/api/2026-04/graphql.json", expect.objectContaining({ cache: "no-store" }));
    });
    it("does not expose upstream token-bearing errors", async () => {
        vi.stubEnv("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "bestbottles-1580.myshopify.com");
        vi.stubEnv("SHOPIFY_STOREFRONT_TOKEN", "synthetic-storefront-token");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "synthetic-customer-token" }] }))));
        await expect(nativeB2bStorefrontGraphQL(NATIVE_PRICES_QUERY, {})).rejects.toThrow("Shopify B2B request rejected");
    });
});

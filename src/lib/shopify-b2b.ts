import "server-only";

import { z } from "zod";
import { nativeB2bStorefrontGraphQL } from "./shopify";

// Preparation only: no route calls this until the Clerk/Customer Account API
// session resolver and the exact pilot catalog assignment have been verified.
export type B2bAccess = {
    status: "approved";
    clerkUserId: string;
    clerkOrgId: string;
    customerAccessToken: string;
    tokenExpiresAt: number;
    companyId: string;
    companyContactId: string;
    companyLocationId: string;
} | { status: "signed_out" | "pending" | "revoked" | "unavailable" };

export type NativeTier = { minimumQuantity: number; unitCents: number };
export type NativeEnrollment = {
    variantId: string;
    sku: string;
    tiers: readonly NativeTier[];
};
export type NativeLine = { variantId: string; quantity: number };
export type NativeQuoteLine = NativeLine & { unitCents: number; totalCents: number };

export const NATIVE_PRICES_QUERY = `query NativeB2bPrices($ids: [ID!]!, $buyer: BuyerInput!)
  @inContext(buyer: $buyer) {
  nodes(ids: $ids) { ... on ProductVariant {
    id sku availableForSale price { amount currencyCode }
    quantityRule { minimum maximum increment }
    quantityPriceBreaks(first: 100) {
      nodes { minimumQuantity price { amount currencyCode } }
      pageInfo { hasNextPage endCursor }
    }
  } }
}`;

export const NATIVE_CART_MUTATION = `mutation NativeB2bCart($input: CartInput!) {
  cartCreate(input: $input) {
    userErrors { field message }
    cart {
      id checkoutUrl
      buyerIdentity { purchasingCompany { company { id } contact { id } location { id } } }
      cost { subtotalAmount { amount currencyCode } }
      lines(first: 250) {
        nodes { id quantity merchandise { ... on ProductVariant { id } }
          cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const money = z.object({ amount: z.string(), currencyCode: z.literal("USD") });
const page = z.object({ hasNextPage: z.literal(false) });
const variant = z.object({
    id: z.string(), sku: z.string(), availableForSale: z.literal(true), price: money,
    quantityRule: z.object({ minimum: z.number().int().positive(), maximum: z.number().int().positive().nullable(), increment: z.number().int().positive() }),
    quantityPriceBreaks: z.object({ nodes: z.array(z.object({ minimumQuantity: z.number().int().positive(), price: money })), pageInfo: page }),
});
const cartPayload = z.object({ cartCreate: z.object({
    userErrors: z.array(z.object({ message: z.string() })).length(0),
    cart: z.object({
        id: z.string().min(1), checkoutUrl: z.string().url(),
        buyerIdentity: z.object({ purchasingCompany: z.object({ company: z.object({ id: z.string() }), contact: z.object({ id: z.string() }), location: z.object({ id: z.string() }) }) }),
        cost: z.object({ subtotalAmount: money }),
        lines: z.object({ nodes: z.array(z.object({
            id: z.string(), quantity: z.number().int().positive(), merchandise: z.object({ id: z.string() }),
            cost: z.object({ amountPerQuantity: money, totalAmount: money }),
        })), pageInfo: page }),
    }),
}) });

function fail(): never { throw new Error("B2B_PRICE_OR_IDENTITY_UNVERIFIED"); }
function safeInt(n: number): number { if (!Number.isSafeInteger(n) || n < 0) fail(); return n; }
function cents(value: z.infer<typeof money>): number {
    if (value.currencyCode !== "USD" || !/^\d+(?:\.\d{1,2})?$/.test(value.amount)) fail();
    const [whole, fraction = ""] = value.amount.split(".");
    return safeInt(Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
}

function approved(access: B2bAccess): Extract<B2bAccess, { status: "approved" }> {
    if (access.status !== "approved") throw new Error(`B2B_ACCESS_${access.status.toUpperCase()}`);
    if (!access.clerkUserId || !access.clerkOrgId || !access.customerAccessToken.trim()
        || !Number.isFinite(access.tokenExpiresAt) || access.tokenExpiresAt <= Date.now() + 30_000
        || !/^gid:\/\/shopify\/Company\/\d+$/.test(access.companyId)
        || !/^gid:\/\/shopify\/CompanyContact\/\d+$/.test(access.companyContactId)
        || !/^gid:\/\/shopify\/CompanyLocation\/\d+$/.test(access.companyLocationId)) fail();
    return access;
}

function mergeLines(lines: readonly NativeLine[]): NativeLine[] {
    if (!lines.length || lines.length > 250) fail();
    const merged = new Map<string, number>();
    for (const line of lines) {
        if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(line.variantId) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) fail();
        merged.set(line.variantId, safeInt((merged.get(line.variantId) ?? 0) + line.quantity));
    }
    return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * loadAccess MUST read the authenticated server session and fresh ordering
 * permissions; never construct it from request JSON, cart attributes, or tax
 * exemption. assertOrderAllowed is the separately verified order policy (no
 * assumed dollar minimum or automatic payment approval in this adapter).
 */
export function createNativeB2bService(deps: {
    loadAccess: () => Promise<B2bAccess>;
    enrollment: readonly NativeEnrollment[];
    assertOrderAllowed: (lines: readonly NativeQuoteLine[], access: Extract<B2bAccess, { status: "approved" }>) => Promise<void>;
    request?: (query: string, variables: Record<string, unknown>) => Promise<unknown>;
}) {
    const request = deps.request ?? nativeB2bStorefrontGraphQL;
    // Capture trusted configuration; callers cannot change enrollment mid-flight.
    const enrollment = structuredClone(deps.enrollment);
    if (new Set(enrollment.map(item => item.variantId)).size !== enrollment.length) fail();
    async function quote(lines: readonly NativeLine[], access: Extract<B2bAccess, { status: "approved" }>) {
        const merged = mergeLines(lines);
        const configurations = merged.map(line => enrollment.find(item => item.variantId === line.variantId) ?? fail());
        const raw = await request(NATIVE_PRICES_QUERY, { ids: merged.map(line => line.variantId), buyer: {
            customerAccessToken: access.customerAccessToken, companyLocationId: access.companyLocationId,
        } });
        const parsed = z.object({ nodes: z.array(variant) }).safeParse(raw);
        if (!parsed.success || parsed.data.nodes.length !== merged.length) fail();
        const variants = new Map(parsed.data.nodes.map(node => [node.id, node]));
        if (variants.size !== merged.length) fail();
        return merged.map((line, index): NativeQuoteLine => {
            const node = variants.get(line.variantId) ?? fail();
            const config = configurations[index];
            const tiers = [{ minimumQuantity: 1, unitCents: cents(node.price) },
                ...node.quantityPriceBreaks.nodes.map(tier => ({ minimumQuantity: tier.minimumQuantity, unitCents: cents(tier.price) }))]
                .sort((a, b) => a.minimumQuantity - b.minimumQuantity);
            if (node.sku !== config.sku || tiers.length !== config.tiers.length) fail();
            for (let i = 0; i < tiers.length; i++) {
                const tier = tiers[i], expected = config.tiers[i], previous = tiers[i - 1];
                if (!Number.isSafeInteger(tier.minimumQuantity) || tier.unitCents <= 0
                    || tier.minimumQuantity !== expected.minimumQuantity || tier.unitCents !== expected.unitCents
                    || (previous && (tier.minimumQuantity <= previous.minimumQuantity || tier.unitCents > previous.unitCents))) fail();
            }
            const rule = node.quantityRule;
            if (line.quantity < rule.minimum || (rule.maximum !== null && line.quantity > rule.maximum) || line.quantity % rule.increment !== 0) fail();
            const unitCents = tiers.filter(tier => line.quantity >= tier.minimumQuantity).at(-1)?.unitCents ?? fail();
            return { ...line, unitCents, totalCents: safeInt(unitCents * line.quantity) };
        });
    }

    return {
        async prices(lines: readonly NativeLine[]) {
            return quote(lines, approved(await deps.loadAccess()));
        },
        async checkout(lines: readonly NativeLine[]) {
            const access = approved(await deps.loadAccess());
            const expected = await quote(lines, access);
            await deps.assertOrderAllowed(expected, access);
            const current = approved(await deps.loadAccess());
            if (current.clerkUserId !== access.clerkUserId || current.clerkOrgId !== access.clerkOrgId
                || current.companyId !== access.companyId || current.companyContactId !== access.companyContactId
                || current.companyLocationId !== access.companyLocationId || current.customerAccessToken !== access.customerAccessToken) fail();
            const raw = await request(NATIVE_CART_MUTATION, { input: {
                buyerIdentity: { customerAccessToken: access.customerAccessToken, companyLocationId: access.companyLocationId },
                lines: expected.map(line => ({ merchandiseId: line.variantId, quantity: line.quantity })),
            } });
            const parsed = cartPayload.safeParse(raw);
            if (!parsed.success) fail();
            const cart = parsed.data.cartCreate.cart;
            const buyer = cart.buyerIdentity.purchasingCompany;
            if (buyer.company.id !== access.companyId || buyer.contact.id !== access.companyContactId || buyer.location.id !== access.companyLocationId) fail();
            if (new URL(cart.checkoutUrl).protocol !== "https:") fail();
            const actualQuantities = new Map<string, number>();
            for (const line of cart.lines.nodes) {
                const wanted = expected.find(item => item.variantId === line.merchandise.id) ?? fail();
                if (cents(line.cost.amountPerQuantity) !== wanted.unitCents || cents(line.cost.totalAmount) !== safeInt(wanted.unitCents * line.quantity)) fail();
                actualQuantities.set(wanted.variantId, safeInt((actualQuantities.get(wanted.variantId) ?? 0) + line.quantity));
            }
            if (expected.some(line => actualQuantities.get(line.variantId) !== line.quantity)) fail();
            const subtotalCents = safeInt(expected.reduce((sum, line) => safeInt(sum + line.totalCents), 0));
            if (cents(cart.cost.subtotalAmount) !== subtotalCents) fail();
            // No anonymous/permalink/draft fallback. A URL is released only
            // after Shopify echoes the approved context, quantities and costs.
            return { cartId: cart.id, checkoutUrl: cart.checkoutUrl, lines: expected, subtotalCents };
        },
    };
}

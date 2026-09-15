import "server-only";

import { adminGraphQL } from "@/lib/shopify";
import { toShopifyMailingAddress, type PortalAddress } from "@/lib/portal/address";

/**
 * Mirror the portal's address onto the Shopify customer record.
 *
 * Shopify is where staff work the order, so an address that exists only in the
 * portal is an address nobody in the warehouse can see. This sets it as the
 * customer's DEFAULT address, which is what pre-fills future orders and what
 * the admin shows on the customer page.
 *
 * A failure here is reported but never fatal to the caller's own write: the
 * portal's copy is the one the submit gate reads and the one attached to the
 * draft order, so a Shopify hiccup must not block a customer from saving their
 * own address.
 */
export async function pushAddressToShopifyCustomer(args: {
    shopifyCustomerId: string;
    address: PortalAddress;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const customerId = `gid://shopify/Customer/${args.shopifyCustomerId}`;
    const mailing = toShopifyMailingAddress(args.address);

    try {
        // Phone lives on the customer, not the address, and freight carriers
        // read it off the customer record.
        if (args.address.phone) {
            const phoneResult = await adminGraphQL<{
                customerUpdate: { userErrors: Array<{ message: string }> };
            }>(
                `mutation SetCustomerPhone($input: CustomerInput!) {
                    customerUpdate(input: $input) { userErrors { message } }
                }`,
                { input: { id: customerId, phone: args.address.phone } },
            );
            // A phone Shopify rejects (already on another customer, or not
            // dialable in its region) must not sink the address itself.
            const phoneError = phoneResult.customerUpdate?.userErrors?.[0]?.message;
            if (phoneError) console.warn("[portal] Shopify rejected customer phone:", phoneError);
        }

        const existing = await adminGraphQL<{
            customer: { defaultAddress: { id: string } | null } | null;
        }>(
            `query CustomerDefaultAddress($id: ID!) {
                customer(id: $id) { defaultAddress { id } }
            }`,
            { id: customerId },
        );

        const defaultAddressId = existing.customer?.defaultAddress?.id ?? null;

        if (defaultAddressId) {
            const updated = await adminGraphQL<{
                customerAddressUpdate: { userErrors: Array<{ message: string }> };
            }>(
                `mutation UpdateCustomerAddress($addressId: ID!, $address: MailingAddressInput!) {
                    customerAddressUpdate(addressId: $addressId, address: $address, setAsDefault: true) {
                        userErrors { message }
                    }
                }`,
                { addressId: defaultAddressId, address: mailing },
            );
            const error = updated.customerAddressUpdate?.userErrors?.[0]?.message;
            if (error) return { ok: false, error };
            return { ok: true };
        }

        const created = await adminGraphQL<{
            customerAddressCreate: { userErrors: Array<{ message: string }> };
        }>(
            `mutation CreateCustomerAddress($customerId: ID!, $address: MailingAddressInput!) {
                customerAddressCreate(customerId: $customerId, address: $address, setAsDefault: true) {
                    userErrors { message }
                }
            }`,
            { customerId, address: mailing },
        );
        const error = created.customerAddressCreate?.userErrors?.[0]?.message;
        if (error) return { ok: false, error };
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

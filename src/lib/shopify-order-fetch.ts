import { adminGraphQL } from "./shopify";
import type { WebhookOrder } from "./shopify-webhooks";

/**
 * Fetch one order in the same shape the order webhooks deliver.
 *
 * Needed because `fulfillments/create` and `fulfillments/update` carry a
 * shipment and an `order_id`, not the order — and the portal keys orders to an
 * account through the CUSTOMER, which the fulfilment payload never includes.
 * Rather than a second, subtly different sync path, the fulfilment handler
 * fetches the order and runs the ordinary one.
 *
 * Also used by the backfill, so history and live updates cannot disagree about
 * what an order looks like.
 */
export async function fetchOrderForSync(numericOrderId: string): Promise<WebhookOrder | null> {
    const data = await adminGraphQL<{
        order: {
            id: string;
            name: string;
            createdAt: string;
            cancelledAt: string | null;
            displayFulfillmentStatus: string | null;
            currentTotalPriceSet: { shopMoney: { amount: string } } | null;
            totalPriceSet: { shopMoney: { amount: string } } | null;
            customer: { id: string } | null;
            shippingAddress: { city: string | null; provinceCode: string | null } | null;
            lineItems: {
                edges: Array<{ node: {
                    sku: string | null;
                    title: string;
                    name: string | null;
                    quantity: number;
                    originalUnitPriceSet: { shopMoney: { amount: string } } | null;
                } }>;
            };
            fulfillments: Array<{
                id: string;
                createdAt: string | null;
                displayStatus: string | null;
                trackingInfo: Array<{ company: string | null; number: string | null; url: string | null }>;
                estimatedDeliveryAt: string | null;
                fulfillmentLineItems: {
                    edges: Array<{ node: {
                        quantity: number;
                        lineItem: { sku: string | null; title: string; name: string | null };
                    } }>;
                };
            }>;
        } | null;
    }>(
        `query OrderForSync($id: ID!) {
            order(id: $id) {
                id
                name
                createdAt
                cancelledAt
                displayFulfillmentStatus
                currentTotalPriceSet { shopMoney { amount } }
                totalPriceSet { shopMoney { amount } }
                customer { id }
                shippingAddress { city provinceCode }
                lineItems(first: 100) {
                    edges { node {
                        sku title name quantity
                        originalUnitPriceSet { shopMoney { amount } }
                    } }
                }
                fulfillments(first: 50) {
                    id
                    createdAt
                    displayStatus
                    trackingInfo { company number url }
                    estimatedDeliveryAt
                    fulfillmentLineItems(first: 100) {
                        edges { node { quantity lineItem { sku title name } } }
                    }
                }
            }
        }`,
        { id: `gid://shopify/Order/${numericOrderId}` },
    );

    const order = data.order;
    if (!order) return null;

    const numericId = (gid: string) => gid.split("/").pop() ?? gid;

    return {
        id: Number(numericId(order.id)),
        name: order.name,
        created_at: order.createdAt,
        cancelled_at: order.cancelledAt,
        // GraphQL reports FULFILLED / PARTIALLY_FULFILLED / UNFULFILLED; the
        // shared status mapper speaks the REST vocabulary the webhooks use.
        fulfillment_status:
            order.displayFulfillmentStatus === "FULFILLED"
                ? "fulfilled"
                : order.displayFulfillmentStatus === "PARTIALLY_FULFILLED"
                  ? "partial"
                  : null,
        current_total_price: order.currentTotalPriceSet?.shopMoney.amount ?? null,
        total_price: order.totalPriceSet?.shopMoney.amount ?? null,
        customer: order.customer ? { id: Number(numericId(order.customer.id)) } : null,
        line_items: order.lineItems.edges.map(({ node }) => ({
            sku: node.sku,
            title: node.title,
            name: node.name,
            quantity: node.quantity,
            price: node.originalUnitPriceSet?.shopMoney.amount ?? null,
        })),
        fulfillments: order.fulfillments.map((f) => ({
            id: Number(numericId(f.id)),
            order_id: Number(numericId(order.id)),
            created_at: f.createdAt,
            // displayStatus is upper-case (IN_TRANSIT); the portal's status
            // mapper compares against Shopify's lower-case shipment_status.
            shipment_status: f.displayStatus ? f.displayStatus.toLowerCase() : null,
            tracking_company: f.trackingInfo[0]?.company ?? null,
            tracking_number: f.trackingInfo[0]?.number ?? null,
            tracking_url: f.trackingInfo[0]?.url ?? null,
            tracking_urls: f.trackingInfo.map((t) => t.url).filter((u): u is string => Boolean(u)),
            tracking_numbers: f.trackingInfo.map((t) => t.number).filter((n): n is string => Boolean(n)),
            estimated_delivery_at: f.estimatedDeliveryAt,
            line_items: f.fulfillmentLineItems.edges.map(({ node }) => ({
                sku: node.lineItem.sku,
                title: node.lineItem.title,
                name: node.lineItem.name,
                quantity: node.quantity,
                price: null,
            })),
        })),
        shipping_address: order.shippingAddress
            ? { city: order.shippingAddress.city, province_code: order.shippingAddress.provinceCode }
            : null,
    };
}

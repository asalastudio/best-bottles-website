import "server-only";

import { api } from "../../../convex/_generated/api";
import { getPortalConvex } from "@/lib/portal/convexClient";
import { requireStaffViewer } from "@/lib/portal/staff";

export type TeamHubQueues = {
    certificatesAwaitingReview: number;
    certificatesLapsed: number;
    certificatesAwaitingShopifySync: number;
    ordersSubmitted: number;
    accountsWithoutShippingAddress: number;
    accountsWithoutShopifyCustomer: number;
    accountTotal: number;
};

/**
 * Work waiting on a person, for the Team Hub.
 *
 * Staff-gated, and read live rather than cached: the point of the band is that
 * a number changes the moment someone clears the queue, and a stale count would
 * send a second person to do work that is already done.
 */
export async function getTeamHubQueues(): Promise<TeamHubQueues> {
    await requireStaffViewer();
    return await getPortalConvex().query(api.portal.getTeamHubQueues, {});
}

export type QueueItem = {
    id: string;
    /** The number, and what it counts. Serif in the UI, so keep the noun short. */
    count: number;
    label: string;
    /** One sentence saying why this number matters. Shown under the figure. */
    meaning: string;
    href: string;
    /**
     * Whether a non-zero count is a problem. "attention" reads warm; "neutral"
     * is just a fact. Nothing is ever styled as an error — a queue with work in
     * it is the normal state of a working business.
     */
    tone: "attention" | "neutral";
};

/**
 * Turn the raw counts into the band the hub renders.
 *
 * Only items that currently mean something are returned: an empty queue is
 * dropped rather than shown as a zero, because a wall of zeroes trains people
 * to stop reading the band. The one exception is when everything is clear, and
 * the caller says so in words instead.
 */
export function buildQueueItems(queues: TeamHubQueues): QueueItem[] {
    const candidates: QueueItem[] = [
        {
            id: "certificates",
            count: queues.certificatesAwaitingReview,
            label: queues.certificatesAwaitingReview === 1 ? "certificate" : "certificates",
            meaning: "Waiting on review. Until one is approved, that account is charged sales tax.",
            href: "/team/resale-certificates",
            tone: "attention",
        },
        {
            id: "orders",
            count: queues.ordersSubmitted,
            label: queues.ordersSubmitted === 1 ? "order" : "orders",
            meaning: "Submitted by customers and sitting in Shopify as drafts. Each needs a person to confirm and invoice.",
            href: "/team/portal-accounts",
            tone: "attention",
        },
        {
            id: "lapsed",
            count: queues.certificatesLapsed,
            label: queues.certificatesLapsed === 1 ? "permit expired" : "permits expired",
            meaning: "Past their expiry date. Shopify may still be exempting these accounts from tax.",
            href: "/team/resale-certificates",
            tone: "attention",
        },
        {
            id: "unsynced",
            count: queues.certificatesAwaitingShopifySync,
            label: "not synced",
            meaning: "Approved here but never written to Shopify, so the account is still being taxed.",
            href: "/team/resale-certificates",
            tone: "attention",
        },
        {
            id: "no-address",
            count: queues.accountsWithoutShippingAddress,
            label: queues.accountsWithoutShippingAddress === 1 ? "account" : "accounts",
            meaning: "No shipping address on file. These customers cannot submit an order at all.",
            href: "/team/portal-accounts",
            tone: "attention",
        },
        {
            id: "unlinked",
            count: queues.accountsWithoutShopifyCustomer,
            label: queues.accountsWithoutShopifyCustomer === 1 ? "account" : "accounts",
            meaning: "Not linked to a Shopify customer, so their orders and tax status have nowhere to go.",
            href: "/team/portal-accounts",
            tone: "attention",
        },
    ];

    return candidates.filter((item) => item.count > 0);
}

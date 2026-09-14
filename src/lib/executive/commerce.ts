import "server-only";

import type { ExecutiveMetric, ExecutiveSource, ExecutiveSourceStatus } from "./contracts";
import { isFaireConfigured, listFaireOrders, type FaireOrder } from "@/lib/faire/client";

/**
 * The commercial half of the executive board, from Faire.
 *
 * Faire is the channel with real orders. Everything here is derived from them
 * and nothing is inferred: if a number cannot be computed from an order, it is
 * not on this list. Gross margin, EBITDA, cash on hand and receivables are
 * deliberately absent — they are accounting facts Faire never sees, and a
 * plausible-looking guess at them is worse than a gap.
 */

export type CommerceSnapshot = {
    source: ExecutiveSource;
    metrics: ExecutiveMetric[];
};

const SOURCE_ID = "faire-orders";

function money(minorTotal: number, currency: string): string {
    const major = minorTotal / 100;
    const compact = major >= 10_000;
    return major.toLocaleString("en-US", {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
    });
}

function buildSource(status: ExecutiveSourceStatus, coverage: string, asOf: string | null): ExecutiveSource {
    return { id: SOURCE_ID, label: "Faire orders", status, asOf, coverage };
}

function unavailable(status: ExecutiveSourceStatus, coverage: string): CommerceSnapshot {
    // No metrics at all rather than zeros. A zero is a claim that nothing sold;
    // absence is a claim that we do not know, and only one of those is true.
    return { source: buildSource(status, coverage, null), metrics: [] };
}

/** Orders that represent real demand. Cancelled ones are counted separately, never as revenue. */
function isLive(order: FaireOrder): boolean {
    return !/CANCELED|CANCELLED/i.test(order.state);
}

export async function getCommerceSnapshot(
    since: Date,
    rangeLabel: string,
): Promise<CommerceSnapshot> {
    if (!isFaireConfigured()) {
        return unavailable("not-connected", "Set FAIRE_ACCESS_TOKEN to connect");
    }

    const result = await listFaireOrders(since);
    if (result.status === "not-connected") {
        return unavailable("not-connected", "Set FAIRE_ACCESS_TOKEN to connect");
    }
    if (result.status === "error") {
        return unavailable("error", result.reason);
    }

    const orders = result.data;
    const live = orders.filter(isLive);
    const cancelled = orders.length - live.length;
    const currency = live.find((o) => o.currency)?.currency ?? "USD";
    const revenueMinor = live.reduce((sum, o) => sum + (o.amountMinor ?? 0), 0);
    const units = live.reduce((sum, o) => sum + o.itemCount, 0);
    const asOf = new Date().toISOString();

    const provenance = {
        sourceId: SOURCE_ID,
        status: "source-backed" as const,
        asOf,
        coverage: `Faire orders, ${rangeLabel}`,
    };

    const metrics: ExecutiveMetric[] = [
        {
            id: "orders-received",
            label: "Orders received",
            value: live.length.toLocaleString("en-US"),
            comparison: rangeLabel,
            tone: "neutral",
            href: "#commercial",
            ...provenance,
        },
        {
            id: "net-revenue",
            label: "Order value",
            value: money(revenueMinor, currency),
            comparison: rangeLabel,
            tone: revenueMinor > 0 ? "positive" : "neutral",
            href: "#commercial",
            ...provenance,
        },
        {
            id: "average-order-value",
            label: "Average order",
            value: live.length > 0 ? money(revenueMinor / live.length, currency) : "—",
            comparison: `${units.toLocaleString("en-US")} units`,
            tone: "neutral",
            href: "#commercial",
            ...provenance,
        },
        {
            id: "cancelled-orders",
            label: "Cancelled",
            value: cancelled.toLocaleString("en-US"),
            comparison: orders.length > 0
                ? `${Math.round((cancelled / orders.length) * 100)}% of orders placed`
                : rangeLabel,
            // Any cancellation is worth a look at this volume; it is not noise.
            tone: cancelled > 0 ? "watch" : "positive",
            href: "#commercial",
            ...provenance,
        },
    ];

    return { source: buildSource("source-backed", `Faire orders, ${rangeLabel}`, asOf), metrics };
}

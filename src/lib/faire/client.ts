import "server-only";

/**
 * Faire brand API client.
 *
 * Faire is where the orders actually are. Shopify has held one order in its
 * lifetime, so it cannot answer "how are we selling" — the executive board's
 * commercial numbers have to come from here.
 *
 * Every call degrades rather than throws. A missing token is the normal state
 * of an unconfigured deployment, not an exception, and a dashboard that 500s
 * because a third party is slow is worse than one that says "not connected".
 */

const BASE_URL = "https://www.faire.com/external-api/v2";
const TIMEOUT_MS = 10_000;

export type FaireResult<T> =
    | { status: "ok"; data: T }
    | { status: "not-connected" }
    | { status: "error"; reason: string };

/**
 * Field names are mapped defensively because they were taken from Faire's
 * public docs rather than from a live response — this codebase has no token
 * yet. `scripts/faire-probe.mjs` prints the real shape once one exists; correct
 * this mapping against that output rather than trusting it.
 */
export type FaireOrder = {
    id: string;
    state: string;
    createdAt: number | null;
    /** Minor units, as Faire returns them. */
    amountMinor: number | null;
    currency: string;
    itemCount: number;
};

function readAmount(source: Record<string, unknown> | undefined): number | null {
    if (!source) return null;
    const amount = source.amount_minor ?? source.amount ?? null;
    return typeof amount === "number" ? amount : null;
}

function normalizeOrder(raw: Record<string, unknown>): FaireOrder {
    const items = Array.isArray(raw.items) ? raw.items : [];
    const total = (raw.payout_costs ?? raw.total ?? raw.order_total) as
        | Record<string, unknown>
        | undefined;
    const createdAt = typeof raw.created_at === "string" ? Date.parse(raw.created_at) : NaN;

    return {
        id: String(raw.id ?? ""),
        state: String(raw.state ?? "UNKNOWN"),
        createdAt: Number.isFinite(createdAt) ? createdAt : null,
        amountMinor: readAmount(total),
        currency: String((total?.currency as string | undefined) ?? "USD"),
        itemCount: items.reduce((n: number, item) => {
            const quantity = (item as Record<string, unknown>)?.quantity;
            return n + (typeof quantity === "number" ? quantity : 0);
        }, 0),
    };
}

async function faireFetch(path: string): Promise<FaireResult<unknown>> {
    const token = process.env.FAIRE_ACCESS_TOKEN?.trim();
    if (!token) return { status: "not-connected" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: { "X-FAIRE-ACCESS-TOKEN": token, Accept: "application/json" },
            signal: controller.signal,
            // The board is a dashboard, not a checkout. A minute-old number is
            // fine; hammering Faire on every page load is not.
            next: { revalidate: 60 },
        });
        if (!response.ok) {
            return { status: "error", reason: `Faire returned ${response.status}` };
        }
        return { status: "ok", data: await response.json() };
    } catch (error) {
        const reason = error instanceof Error && error.name === "AbortError"
            ? "Faire did not respond within 10s"
            : "Could not reach Faire";
        return { status: "error", reason };
    } finally {
        clearTimeout(timer);
    }
}

/** Orders created at or after `since`, newest first, capped so one slow page cannot hang the board. */
export async function listFaireOrders(since: Date, maxPages = 4): Promise<FaireResult<FaireOrder[]>> {
    const orders: FaireOrder[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
        const query = new URLSearchParams({
            limit: "50",
            page: String(page),
            created_at_min: since.toISOString(),
        });
        const result = await faireFetch(`/orders?${query.toString()}`);
        if (result.status !== "ok") return result;

        const body = result.data as Record<string, unknown>;
        const rows = Array.isArray(body.orders) ? body.orders : [];
        for (const row of rows) orders.push(normalizeOrder(row as Record<string, unknown>));
        if (rows.length < 50) break;
    }

    return { status: "ok", data: orders };
}

export function isFaireConfigured(): boolean {
    return Boolean(process.env.FAIRE_ACCESS_TOKEN?.trim());
}

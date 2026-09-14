/**
 * The commercial half of the executive board.
 *
 * The board previously showed 25 invented figures under an "illustrative"
 * banner. The rule replacing that: a number is either derived from a real
 * order or it is absent. A zero claims nothing sold; absence claims we do not
 * know, and only one of those is honest when a source is unreachable.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a Server Component; the project stubs it the
// same way in tests/employee-knowledge-api.test.ts.
vi.mock("server-only", () => ({}));

const listFaireOrders = vi.hoisted(() => vi.fn());
const isFaireConfigured = vi.hoisted(() => vi.fn());

vi.mock("@/lib/faire/client", () => ({ listFaireOrders, isFaireConfigured }));

const { getCommerceSnapshot } = await import("@/lib/executive/commerce");

const SINCE = new Date("2026-09-01T00:00:00Z");

function order(overrides: Record<string, unknown> = {}) {
    return {
        id: "o1", state: "NEW", createdAt: Date.now(),
        amountMinor: 9000, currency: "USD", itemCount: 6,
        ...overrides,
    };
}

afterEach(() => vi.clearAllMocks());

describe("commerce snapshot", () => {
    it("reports no metrics at all when Faire is not connected", async () => {
        isFaireConfigured.mockReturnValue(false);
        const snapshot = await getCommerceSnapshot(SINCE, "this month");

        expect(snapshot.metrics).toEqual([]);
        expect(snapshot.source.status).toBe("not-connected");
    });

    it("reports no metrics when Faire is unreachable, rather than zeros", async () => {
        isFaireConfigured.mockReturnValue(true);
        listFaireOrders.mockResolvedValue({ status: "error", reason: "Faire did not respond within 10s" });
        const snapshot = await getCommerceSnapshot(SINCE, "this month");

        expect(snapshot.metrics).toEqual([]);
        expect(snapshot.source.status).toBe("error");
        expect(snapshot.source.coverage).toContain("did not respond");
    });

    it("derives order count, value and average from live orders", async () => {
        isFaireConfigured.mockReturnValue(true);
        listFaireOrders.mockResolvedValue({
            status: "ok",
            data: [order({ amountMinor: 9000 }), order({ id: "o2", amountMinor: 21000, itemCount: 12 })],
        });
        const snapshot = await getCommerceSnapshot(SINCE, "this month");
        const byId = Object.fromEntries(snapshot.metrics.map((m) => [m.id, m]));

        expect(byId["orders-received"].value).toBe("2");
        expect(byId["net-revenue"].value).toBe("$300");
        expect(byId["average-order-value"].value).toBe("$150");
        expect(byId["average-order-value"].comparison).toBe("18 units");
    });

    it("keeps cancelled orders out of revenue and flags them", async () => {
        isFaireConfigured.mockReturnValue(true);
        listFaireOrders.mockResolvedValue({
            status: "ok",
            data: [order({ amountMinor: 10000 }), order({ id: "o2", state: "CANCELED", amountMinor: 50000 })],
        });
        const snapshot = await getCommerceSnapshot(SINCE, "this month");
        const byId = Object.fromEntries(snapshot.metrics.map((m) => [m.id, m]));

        expect(byId["orders-received"].value).toBe("1");
        expect(byId["net-revenue"].value).toBe("$100");
        expect(byId["cancelled-orders"].value).toBe("1");
        expect(byId["cancelled-orders"].comparison).toBe("50% of orders placed");
        expect(byId["cancelled-orders"].tone).toBe("watch");
    });

    it("never reports margin, EBITDA, cash or receivables — Faire cannot see them", async () => {
        isFaireConfigured.mockReturnValue(true);
        listFaireOrders.mockResolvedValue({ status: "ok", data: [order()] });
        const snapshot = await getCommerceSnapshot(SINCE, "this month");

        const ids = snapshot.metrics.map((m) => m.id);
        for (const forbidden of ["gross-margin", "gross-profit", "ebitda", "cash-on-hand", "overdue-ar"]) {
            expect(ids).not.toContain(forbidden);
        }
    });

    it("marks every metric with the source that produced it", async () => {
        isFaireConfigured.mockReturnValue(true);
        listFaireOrders.mockResolvedValue({ status: "ok", data: [order()] });
        const snapshot = await getCommerceSnapshot(SINCE, "this month");

        expect(snapshot.metrics.length).toBeGreaterThan(0);
        for (const metric of snapshot.metrics) {
            expect(metric.sourceId).toBe("faire-orders");
            expect(metric.status).toBe("source-backed");
            expect(metric.asOf).toEqual(expect.any(String));
        }
    });
});

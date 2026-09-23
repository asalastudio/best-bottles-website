import { describe, it, expect } from "vitest";
import { planCylinderAvailability } from "../convex/repairCylinderAvailability";
import proposal from "../docs/reviews/cylinder-component-coverage-2026-09-22/stock-reconciliation.json";
import type { Doc } from "../convex/_generated/dataModel";

describe("source-reviewed Cylinder stock reconciliation", () => {
    it("changes only the stock label of an exact already-sellable assembly", () => {
        const source = proposal.rows[0];
        const product = { ...source, stockStatus: source.beforeStockStatus, shopifySellable: true,
            shopifyVariantId: "unchanged-variant", webPrice1pc: 2 } as unknown as Doc<"products">;
        expect(planCylinderAvailability(product, source)).toEqual({ stockStatus: "Available to order" });
        expect(planCylinderAvailability({ ...product, stockStatus: "Available to order" }, source)).toBeNull();
        for (const change of [{ stockStatus: "Discontinued" }, { shopifySellable: false }, { shopifyVariantId: null },
            { graceSku: "another-identity" }, { capacityMl: 100 }, { neckThreadSize: "unknown" }])
            expect(() => planCylinderAvailability({ ...product, ...change }, source)).toThrow();
        expect(product.stockStatus).toBe(source.beforeStockStatus);
    });
    it("has exact source evidence for every proposed change and excludes the unresolved 5.5 ml alias", () => {
        expect(proposal.rows).toHaveLength(45);
        expect(new Set(proposal.rows.map(r => r.websiteSku)).size).toBe(45);
        expect(proposal.rows.some(r => r.capacityMl === 5.5)).toBe(false);
        for (const row of proposal.rows) {
            expect(row.sourceUrl).toMatch(/^https:\/\/www.bestbottles.com\/product\//);
            expect(row.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
        }
    });
});

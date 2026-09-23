import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import rows from "../src/lib/products/catalog-hero-boston-diva-release.json";
import approval from "../docs/hero-families/boston-diva-2026-09-23/approval.json";
import { getProductHero, getCatalogHero, resolveLiveCatalogCardHero } from "../src/lib/products/catalog-heroes";

afterEach(() => vi.unstubAllEnvs());

describe("Approved Boston Round and Diva delivery", () => {
  it("preserves all 50 approved images and activates only the 49 mapped SKUs", () => {
    expect(approval.rows).toHaveLength(50);
    expect(rows).toHaveLength(49);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(49);
    expect(rows.filter(row => row.family === "Boston Round")).toHaveLength(29);
    expect(rows.filter(row => row.family === "Diva")).toHaveLength(20);
    for (const lock of approval.rows) {
      const bytes = readFileSync(`public${lock.url}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(lock.sha256);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2080, 2288]);
      expect(lock.baselinePct).toBe(91);
      expect(lock.visualDecision).toBe("approved");
      const row = rows.find(row => row.websiteSku === lock.sku);
      expect(Boolean(row)).toBe(lock.catalogEligible);
      if (row) {
        expect(row.url).toBe(lock.url);
        expect(row.shopifyVariantId).toBe(lock.shopifyVariantId);
        expect(row.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
      }
    }
  });

  it("selects only an exact visible assembly when the family release is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", "families-2026-09-22");
    const old = "https://cdn.shopify.com/old.png";
    for (const row of rows) {
      expect(getProductHero(row.websiteSku)).toEqual(row);
      expect(getCatalogHero(row.groupSlug, [{ websiteSku: row.websiteSku }])).toEqual(row);
      expect(getCatalogHero(row.groupSlug, [{ websiteSku: "unrelated" }])).toBeNull();
      expect(resolveLiveCatalogCardHero({ heroImageUrl: old, staticHero: row, variants: [{ websiteSku: row.websiteSku }] }).imageUrl).toBe(row.url);
      expect(resolveLiveCatalogCardHero({ heroImageUrl: old, staticHero: row, variants: [{ websiteSku: "unrelated" }] }).imageUrl).toBe(old);
    }
  });

  it("preserves the unmapped dropper and flag-off behavior", () => {
    const held = approval.rows.filter(row => !row.catalogEligible);
    expect(held.map(row => row.sku)).toEqual(["GBDivaFrst46DrpGl"]);
    vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", "");
    const previous = approval.rows.map(row => getProductHero(row.sku));
    const previousHeld = getProductHero(held[0].sku);
    vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", "cylinder-2026-09-22");
    expect(approval.rows.map(row => getProductHero(row.sku))).toEqual(previous);
    vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", "families-2026-09-22");
    expect(getProductHero(held[0].sku)).toEqual(previousHeld);
  });
});

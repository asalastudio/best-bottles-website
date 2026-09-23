import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import rows from "../src/lib/products/catalog-hero-sleek-release.json";
import approval from "../docs/hero-families/sleek-2026-09-23/approval.json";
import { getProductHero, getCatalogHero, resolveLiveCatalogCardHero } from "../src/lib/products/catalog-heroes";

afterEach(() => vi.unstubAllEnvs());

describe("Approved Sleek release", () => {
  it("delivers all 21 approved full-resolution images without altering their bytes", () => {
    expect(rows).toHaveLength(21);
    expect(approval.rows).toHaveLength(21);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(21);
    const spans: Record<number, number> = { 5: 30, 8: 43, 30: 47, 50: 56, 100: 60.5 };
    for (const lock of approval.rows) {
      const bytes = readFileSync(`public${lock.url}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(lock.sha256);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2080, 2288]);
      expect(lock.baselinePct).toBe(91);
      expect(lock.spanPct).toBe(spans[lock.capacityMl]);
      expect(lock.visualDecision).toBe("approved");
      const row = rows.find(row => row.websiteSku === lock.sku)!;
      expect(row.url).toBe(lock.url);
      expect(row.shopifyVariantId).toBe(lock.shopifyVariantId);
      expect(row.shopifyVariantId).toMatch(/^gid:\/\/shopify\/ProductVariant\/\d+$/);
      expect(row.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
    expect(approval.rows.find(row => row.sku === "GBSlk100RdcrShnGl")?.sourceRenderSha256)
      .toBe("a20cfb5cae0a3942ef5f4b616d27a3eea4b335fc453317e483f2a68666ed217d");
  });

  it("selects the exact visible SKU and never substitutes another assembly", () => {
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

  it("retains previous images when the family release is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", "");
    const previous = rows.map(row => getProductHero(row.websiteSku));
    for (const row of rows) expect(getProductHero(row.websiteSku)?.url).not.toBe(row.url);
    vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", "cylinder-2026-09-22");
    expect(rows.map(row => getProductHero(row.websiteSku))).toEqual(previous);
  });
});

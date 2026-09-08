import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPdpSkuFallbackImage } from "../src/lib/products/pdp-sku-image-fallback";

const roundSpraySkusWithoutReliableRemoteMedia = [
  "GBRnd78SpryMtGl",
  "GBRnd78SpryMtSl",
  "GBRnd78SpryShnGl",
  "GBRnd78SpryShnBlk",
  "GBRnd78SpryShnSl",
  "GBRndFrst78SpryCu",
  "GBRndFrst78SpryMtGl",
  "GBRndFrst78SpryMtSl",
  "GBRndFrst78SpryShnGl",
  "GBRndFrst78SpryShnBlk",
  "GBRndFrst78SpryShnSl",
  "GBRndFrst128SpryCu",
  "GBRndFrst128SpryMtGl",
  "GBRndFrst128SpryMtSl",
  "GBRndFrst128SpryShnGl",
  "GBRndFrst128SpryShnBlk",
  "GBRndFrst128SpryShnSl",
] as const;

describe("exact-SKU PDP image fallbacks", () => {
  it("provides a shipped local image for every Round spray variant whose remote image is unreliable", () => {
    for (const sku of roundSpraySkusWithoutReliableRemoteMedia) {
      const url = getPdpSkuFallbackImage(sku);
      expect(url, sku).toMatch(/^\/images\/pdp\/round\/[^/]+\.png$/);
      expect(existsSync(`public${url}`), sku).toBe(true);
    }
  });

  it("does not substitute one SKU's hardware for an unknown product", () => {
    expect(getPdpSkuFallbackImage("unknown-sku")).toBeNull();
    expect(getPdpSkuFallbackImage(null)).toBeNull();
  });

  it("uses the exact-SKU fallback in both the mobile preview and desktop stage", () => {
    const parent = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
    const mobile = readFileSync("src/components/products/mobile/MobileProductPdp.tsx", "utf8");

    expect(parent).toContain("getPdpSkuFallbackImage(selectedVariant?.websiteSku)");
    expect(parent).toContain("skuImageFallbacks={pdpSkuImageFallbacks}");
    expect(mobile).toContain("skuImageFallbacks[shownVariant?.websiteSku ?? \"\"]");
  });
});

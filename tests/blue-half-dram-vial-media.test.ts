import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import truth from "../data/media/blue-half-dram-vial-truth-2026-09-27.json";
import { getPdpSkuFallbackImage } from "../src/lib/products/pdp-sku-image-fallback";
import { getCatalogCardVariantPreviews } from "../src/lib/products/product-card-variant-previews";

describe("blue half-dram short-cap vial", () => {
  it("keeps the exact black and white sidecar photographs tied to their own SKUs", () => {
    expect(truth.options.map((option) => option.websiteSku)).toEqual([
      "GBVBlu1o9BlackCapSht",
      "GBVBlu1o9WhtCapSht",
    ]);
    expect(new Set(truth.options.map((option) => option.localSha256)).size).toBe(2);
    for (const option of truth.options) {
      expect(getPdpSkuFallbackImage(option.websiteSku)).toBe(option.localImageUrl);
      const image = readFileSync(`public${option.localImageUrl}`);
      expect(image.subarray(1, 4).toString()).toBe("PNG");
      expect(image.readUInt32BE(16)).toBe(600);
      expect(image.readUInt32BE(20)).toBe(800);
      expect(createHash("sha256").update(image).digest("hex")).toBe(option.localSha256);
    }
  });

  it("offers two distinct cap image previews when both real variant rows exist", () => {
    const previews = getCatalogCardVariantPreviews(truth.options.map((option) => ({
      id: option.websiteSku,
      websiteSku: option.websiteSku,
      itemName: "Blue Vial Bottle with Cap",
      color: "Blue",
      capColor: option.capColor,
      capStyle: "Short",
      imageUrl: option.sourceImageUrl,
    })), { productTitle: "Blue Vial Bottle with Cap", groupColor: "Blue", productHref: "/products/vial-3ml-blue-13-425" });
    expect(previews).toHaveLength(2);
    expect(previews.map((preview) => preview.imageUrl)).toEqual(truth.options.map((option) => option.localImageUrl));
    expect(new Set(previews.map((preview) => preview.label)).size).toBe(2);
  });
});

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../data/media/reconciliation-106.json";
import { getPdpSkuFallbackImage } from "../src/lib/products/pdp-sku-image-fallback";
import {
  getReconciledLocalSkuImage,
  isReconciliationSku,
  reconciledLocalSkuImages,
} from "../src/lib/products/reconciled-sku-images";

describe("reconciled exact-SKU media", () => {
  it("keeps all 106 records distinct and exposes only verified local images", () => {
    expect(manifest).toHaveLength(106);
    expect(new Set(manifest.map((row) => row.websiteSku)).size).toBe(106);

    const locallyExposed = manifest.filter((row) => row.mediaState === "local-source-cutout" || row.mediaState === "local-legacy-assembled");
    expect(locallyExposed.filter((row) => row.mediaState === "local-source-cutout")).toHaveLength(59);
    expect(locallyExposed.filter((row) => row.mediaState === "local-legacy-assembled")).toHaveLength(4);
    expect(Object.keys(reconciledLocalSkuImages)).toHaveLength(locallyExposed.length);

    for (const row of manifest) {
      expect(isReconciliationSku(row.websiteSku)).toBe(true);
      const localUrl = getReconciledLocalSkuImage(row.websiteSku);
      if (row.mediaState !== "local-source-cutout" && row.mediaState !== "local-legacy-assembled") {
        expect(localUrl, row.websiteSku).toBeNull();
        continue;
      }
      expect(localUrl, row.websiteSku).toBe(row.localImageUrl);
      expect(getPdpSkuFallbackImage(row.websiteSku), row.websiteSku).toBe(localUrl);
      expect(localUrl, row.websiteSku).toContain(`/${row.websiteSku}.${row.mediaState === "local-legacy-assembled" ? "png" : "webp"}`);
      const path = `public${localUrl}`;
      expect(existsSync(path), row.websiteSku).toBe(true);
      expect(createHash("sha256").update(readFileSync(path)).digest("hex"), row.websiteSku)
        .toBe(row.localAssetSha256);
    }
    expect(getReconciledLocalSkuImage("missing-sku")).toBeNull();
    expect(isReconciliationSku("missing-sku")).toBe(false);
  });
});

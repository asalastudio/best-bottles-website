import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import reconciliation from "../data/media/reconciliation-106.json";
import { oneMlVialApplicator } from "../src/lib/products/one-ml-vial-applicators";
import { getPdpSkuFallbackImage } from "../src/lib/products/pdp-sku-image-fallback";
import { requiresAssembledClosure } from "../src/lib/products/closure-presentation";

describe("1 ml vial assembled options", () => {
  it("has an exact installed-applicator local image for each glass and color", async () => {
    for (const sku of ["GB1mlAmbVBlk", "GB1mlAmbVialWht", "GB1mlVBlk", "GB1mlVWht"]) {
      const image = oneMlVialApplicator(sku)?.image;
      expect(image).toBe(`/images/pdp/assembled-vials-2026-09-27/${sku}.png`);
      expect(getPdpSkuFallbackImage(sku)).toBe(image);
      expect(requiresAssembledClosure(null, sku)).toBe(true);
      const bytes = readFileSync(`public${image}`);
      const row = reconciliation.find((entry) => entry.websiteSku === sku);
      expect(row?.mediaState).toBe("local-legacy-assembled");
      expect(row?.localImageUrl).toBe(image);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(row?.localAssetSha256);
      const meta = await sharp(bytes).metadata();
      expect(meta.format).toBe("png");
      expect(meta.height).toBeGreaterThanOrEqual(591);
    }
    expect(oneMlVialApplicator("GBVialClr2mlWhtCap")).toBeNull();
  });
});

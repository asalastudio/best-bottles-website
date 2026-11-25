import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import manifest from "../public/images/pdp/one-ml-small-glass-2026-11-25/manifest.json";
import { approvedComponentKit } from "../src/lib/paper-doll/approved-component-kits";
import smallGlass from "../src/lib/paper-doll/small-glass-bodies.generated.json";
import { isAssembledOneMlVialImage, isOneMlVialStill, oneMlVialApplicator } from "../src/lib/products/one-ml-vial-applicators";
import { getPdpSkuFallbackImage } from "../src/lib/products/pdp-sku-image-fallback";
import { isReconciledLocalSkuAssetUrl } from "../src/lib/products/reconciled-sku-images";
import { requiresAssembledClosure } from "../src/lib/products/closure-presentation";
import { catalogTasselViewport, stageLayout } from "../src/lib/products/pdp-redesign/stage";

const SKUS = ["GB1mlAmbVBlk", "GB1mlAmbVialWht", "GB1mlVBlk", "GB1mlVWht"] as const;
const rows = manifest.stills as Record<string, { url: string; sha256: string; width: number; height: number; layers: string[] }>;

describe("1 ml vial assembled options", () => {
  it("has an installed-applicator still for each glass and color, composited from its approved kit (2026-11-25)", async () => {
    for (const sku of SKUS) {
      const image = oneMlVialApplicator(sku)?.image;
      const row = rows[sku];
      expect(image).toBe(row.url);
      expect(image).not.toContain("assembled-vials-2026-09-27");
      expect(getPdpSkuFallbackImage(sku)).toBe(image);
      expect(requiresAssembledClosure(null, sku)).toBe(true);
      // Framed like the catalog master: no multiply or scale treatment.
      expect(isAssembledOneMlVialImage(image)).toBe(false);
      expect(isOneMlVialStill(image)).toBe(true);
      expect(isReconciledLocalSkuAssetUrl(image)).toBe(false);
      const bytes = readFileSync(`public${image}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["png", row.width, row.height, true]);
      // Drawn from the approved kit's own layers, in the card's frame.
      const kit = approvedComponentKit(sku)!;
      const layout = stageLayout(kit, "sidecar", { websiteSku: sku })!;
      expect(row.layers).toEqual(layout.parts.map(part => part.url));
      const viewport = catalogTasselViewport(sku, layout);
      expect(row.height / row.width).toBeCloseTo(viewport.height / viewport.width, 2);
      const body = (smallGlass.bodies as Record<string, { image: { url: string } | null }>)[sku.includes("Amb") ? "vial1-amber" : "vial1-clear"];
      expect(row.layers).toContain(body.image!.url);
    }
    expect(oneMlVialApplicator("GBVialClr2mlWhtCap")).toBeNull();
  });
});

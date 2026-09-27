import { getReconciledLocalSkuImage, reconciledLocalSkuImages } from "./reconciled-sku-images";

// Exact 5/8-dram blue vial photos from the legacy product pages. Both show
// the same uncapped 13-425 bottle, with the selected short cap beside it.
const BLUE_HALF_DRAM_VIAL_IMAGES: Readonly<Record<string, string>> = {
  GBVBlu1o9BlackCapSht: "/images/pdp/blue-half-dram-vial-2026-09-27/GBVBlu1o9BlackCapSht.png",
  GBVBlu1o9WhtCapSht: "/images/pdp/blue-half-dram-vial-2026-09-27/GBVBlu1o9WhtCapSht.png",
};

const PDP_SKU_IMAGE_FALLBACKS: Readonly<Record<string, string>> = {
  ...BLUE_HALF_DRAM_VIAL_IMAGES,
  GBRnd78SpryMtGl: "/images/pdp/round/GBRnd78SpryMtGl.png",
  GBRnd78SpryMtSl: "/images/pdp/round/GBRnd78SpryMtSl.png",
  GBRnd78SpryShnGl: "/images/pdp/round/GBRnd78SpryShnGl.png",
  GBRnd78SpryShnBlk: "/images/pdp/round/GBRnd78SpryShnBlk.png",
  GBRnd78SpryShnSl: "/images/pdp/round/GBRnd78SpryShnSl.png",
  GBRndFrst78SpryCu: "/images/pdp/round/GBRndFrst78SpryCu.png",
  GBRndFrst78SpryMtGl: "/images/pdp/round/GBRndFrst78SpryMtGl.png",
  GBRndFrst78SpryMtSl: "/images/pdp/round/GBRndFrst78SpryMtSl.png",
  GBRndFrst78SpryShnGl: "/images/pdp/round/GBRndFrst78SpryShnGl.png",
  GBRndFrst78SpryShnBlk: "/images/pdp/round/GBRndFrst78SpryShnBlk.png",
  GBRndFrst78SpryShnSl: "/images/pdp/round/GBRndFrst78SpryShnSl.png",
  GBRndFrst128SpryCu: "/images/pdp/round/GBRndFrst128SpryCu.png",
  GBRndFrst128SpryMtGl: "/images/pdp/round/GBRndFrst128SpryMtGl.png",
  GBRndFrst128SpryMtSl: "/images/pdp/round/GBRndFrst128SpryMtSl.png",
  GBRndFrst128SpryShnGl: "/images/pdp/round/GBRndFrst128SpryShnGl.png",
  GBRndFrst128SpryShnBlk: "/images/pdp/round/GBRndFrst128SpryShnBlk.png",
  GBRndFrst128SpryShnSl: "/images/pdp/round/GBRndFrst128SpryShnSl.png",
};

export function getPdpSkuFallbackImage(websiteSku: string | null | undefined): string | null {
  if (!websiteSku) return null;
  return getReconciledLocalSkuImage(websiteSku) ?? PDP_SKU_IMAGE_FALLBACKS[websiteSku] ?? null;
}

export function isBlueHalfDramVialImage(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("/images/pdp/blue-half-dram-vial-2026-09-27/"));
}

export function getBlueHalfDramVialImage(websiteSku: string | null | undefined): string | null {
  return websiteSku ? BLUE_HALF_DRAM_VIAL_IMAGES[websiteSku] ?? null : null;
}

export function getPdpSkuImageFallbacks(): Readonly<Record<string, string>> {
  return { ...PDP_SKU_IMAGE_FALLBACKS, ...reconciledLocalSkuImages };
}

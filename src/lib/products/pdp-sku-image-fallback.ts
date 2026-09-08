const PDP_SKU_IMAGE_FALLBACKS: Readonly<Record<string, string>> = {
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
  return PDP_SKU_IMAGE_FALLBACKS[websiteSku] ?? null;
}

export function getPdpSkuImageFallbacks(): Readonly<Record<string, string>> {
  return PDP_SKU_IMAGE_FALLBACKS;
}

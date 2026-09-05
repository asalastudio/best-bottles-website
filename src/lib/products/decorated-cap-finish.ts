type CapEvidence = {
    websiteSku?: string | null;
    graceSku?: string | null;
    capColor?: string | null;
    itemName?: string | null;
};

/** Dots identify a distinct cap option, not just its underlying color. */
export function decoratedCapFinish(variant: CapEvidence): string | null {
    const colors: Record<string, string> = {
        black: "Black", blck: "Black", blk: "Black", bkdt: "Black",
        silver: "Silver", slv: "Silver", sl: "Silver", sldt: "Silver",
        pink: "Pink", pnk: "Pink", pkdt: "Pink",
    };
    const sku = variant.websiteSku?.match(/(Black|Blck|Blk|Pink|Pnk|Slv|Sl)Dot(?:Rng)?$/i)?.[1];
    const grace = variant.graceSku?.match(/(?:^|-)(BKDT|SLDT|PKDT)(?:-|$)/i)?.[1];
    const words = `${variant.capColor ?? ""} ${variant.itemName ?? ""}`;
    const named = words.match(/\b(black|silver|pink)\s+(?:with\s+)?dots?\b/i)?.[1]
        ?? words.match(/\bdotted\s+(black|silver|pink)\b/i)?.[1];
    const token = sku ?? grace ?? named;
    return token ? `${colors[token.toLowerCase()]} with Dots` : null;
}

/** Distinguish catalogued Boston dropper bulb/trim assemblies. */
export function bostonDropperFinish(variant: { websiteSku?: string | null; applicator?: string | null; capColor?: string | null }): string | null {
    if (!/^GBBstn/i.test(variant.websiteSku ?? "") || variant.applicator !== "Dropper" || !/^(black|white)$/i.test(variant.capColor ?? "")) return null;
    const trim = /(?:shn)?(gl|sl)trim$/i.exec(variant.websiteSku ?? "")?.[1]?.toLowerCase();
    return trim ? `${variant.capColor} Shiny ${trim === "gl" ? "Gold" : "Silver"} Trim` : null;
}

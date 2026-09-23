/** Reviewed 13-415 component identities. This is a classification witness,
 * not permission to offer every part on every bottle. The bottle's own edge,
 * fitment rule, occupancy, and sale status still decide availability.
 *
 * The 2026-09-23 source sheet shows six solid and three dotted roll-on caps,
 * two short ribbed caps, six short LINED caps, two tall lined caps and eight
 * fine-mist sprayers. Jordan clarified that the six short lined caps are not
 * to be labelled "metal caps". The sheet also shows plastic and metal roller
 * inserts, but no independently verified 13-415 insert sales SKUs; complete
 * roll-on assemblies remain the source for those two mechanisms.
 */
export type Component13_415Kind = "roll-on-solid" | "roll-on-dotted" | "short-ribbed" | "short-lined" | "tall-lined" | "fine-mist";

type ComponentIdentity = { websiteSku: string; graceSku: string; kind: Component13_415Kind; legacyGraceSku?: string };

export const COMPONENTS_13_415: readonly ComponentIdentity[] = [
    { websiteSku: "CPRoll13-415BlkSh", graceSku: "CMP-ROC-SBLK-13415", kind: "roll-on-solid" },
    { websiteSku: "CPRoll13-415Cu", graceSku: "CMP-ROC-MCPR-13415", kind: "roll-on-solid" },
    { websiteSku: "CPRoll13-415GlMt", graceSku: "CMP-ROC-MGLD-13415", kind: "roll-on-solid" },
    { websiteSku: "CPRoll13-415GlSh", graceSku: "CMP-ROC-SGLD-13415", kind: "roll-on-solid" },
    { websiteSku: "CPRoll13-415SlMt", graceSku: "CMP-ROC-MSLV-13415", kind: "roll-on-solid" },
    { websiteSku: "CPRoll13-415SlSh", graceSku: "CMP-ROC-SSLV-13415", kind: "roll-on-solid" },
    { websiteSku: "CPRoll13-415PinkDot", graceSku: "CMP-ROC-PNK-13415-DOT", kind: "roll-on-dotted" },
    { websiteSku: "CPRoll13-415BlackDot", graceSku: "CMP-ROC-BLK-13415-DOT", kind: "roll-on-dotted" },
    { websiteSku: "CPRoll13-415SlDot", graceSku: "CMP-ROC-SLV-13415-DOT", kind: "roll-on-dotted" },
    { websiteSku: "CP13-415BlkSht", graceSku: "CMP-CAP-BLK-S-13-415", kind: "short-ribbed" },
    { websiteSku: "CP13-415WhtSht", graceSku: "CMP-CAP-WHT-S-13-415", kind: "short-ribbed" },
    { websiteSku: "CP13-415BlkShShtMtl", graceSku: "CMP-CAP-SBLK-13-415", kind: "short-lined" },
    { websiteSku: "CP13-415CuSht", graceSku: "CMP-CLS-MTCP-S-13-415", kind: "short-lined" },
    { websiteSku: "CP13-415GlMattSht", graceSku: "CMP-CLS-MTGD-S-13-415", kind: "short-lined" },
    { websiteSku: "CP13-415GlSht", graceSku: "CMP-CLS-SHGD-S-13-415", kind: "short-lined" },
    { websiteSku: "CP13-415SlMattSht", graceSku: "CMP-CLS-MTSL-S-13-415", kind: "short-lined" },
    { websiteSku: "CP13-415SlSht", graceSku: "CMP-CLS-SHSL-S-13-415-02", kind: "short-lined" },
    { websiteSku: "CP13-415Gl", graceSku: "CMP-CAP-SGLD-13-415-01", kind: "tall-lined" },
    { websiteSku: "CP13-415Sl", graceSku: "CMP-CAP-SLV-13-415-01", kind: "tall-lined" },
    { websiteSku: "CP13-415SpryBlkMt", graceSku: "CMP-CAP-BLK-13-415-01", legacyGraceSku: "CMP-SPR-MTBK-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SpryBlkSh", graceSku: "CMP-CAP-BLK-13-415-02", legacyGraceSku: "CMP-SPR-SHBK-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SpryBluMt", graceSku: "CMP-CAP-13-415", legacyGraceSku: "CMP-SPR-MTBL-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SpryCuMt", graceSku: "CMP-SPR-MTCP-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SpryGlMt", graceSku: "CMP-CAP-SGLD-13-415-02", legacyGraceSku: "CMP-SPR-MTGD-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SpryGlSh", graceSku: "CMP-CAP-SGLD-13-415-03", legacyGraceSku: "CMP-SPR-SHGD-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SprySlMt", graceSku: "CMP-CAP-SLV-13-415-02", legacyGraceSku: "CMP-SPR-MTSL-13-415-07", kind: "fine-mist" },
    { websiteSku: "CP13-415SprySlSh", graceSku: "CMP-CAP-SLV-13-415-03", legacyGraceSku: "CMP-SPR-SHSL-13-415-07", kind: "fine-mist" },
];

const byGraceSku = new Map(COMPONENTS_13_415.flatMap(identity =>
    [identity.graceSku, identity.legacyGraceSku].filter((sku): sku is string => Boolean(sku)).map(sku => [sku, identity] as const)));

export function reviewed13_415Component(graceSku: string, websiteSku?: string | null): ComponentIdentity | null {
    const identity = byGraceSku.get(graceSku);
    if (!identity) return null;
    // A retired imported alias carries its source SKU before __RETIRED__.
    if (websiteSku && websiteSku !== identity.websiteSku && !websiteSku.startsWith(`${identity.websiteSku}__RETIRED__`)) return null;
    return identity;
}

const finishBySku: Record<string, string> = {
    "CPRoll13-415BlkSh": "Shiny Black", "CPRoll13-415Cu": "Matte Copper",
    "CPRoll13-415GlMt": "Matte Gold", "CPRoll13-415GlSh": "Shiny Gold",
    "CPRoll13-415SlMt": "Matte Silver", "CPRoll13-415SlSh": "Shiny Silver",
    "CPRoll13-415PinkDot": "Pink Dotted", "CPRoll13-415BlackDot": "Black Dotted",
    "CPRoll13-415SlDot": "Silver Dotted",
    "CP13-415BlkSht": "Black", "CP13-415WhtSht": "White",
    "CP13-415BlkShShtMtl": "Shiny Black", "CP13-415CuSht": "Matte Copper",
    "CP13-415GlMattSht": "Matte Gold", "CP13-415GlSht": "Shiny Gold",
    "CP13-415SlMattSht": "Matte Silver", "CP13-415SlSht": "Shiny Silver",
    "CP13-415Gl": "Shiny Gold", "CP13-415Sl": "Shiny Silver",
    "CP13-415SpryBlkMt": "Matte Black", "CP13-415SpryBlkSh": "Shiny Black",
    "CP13-415SpryBluMt": "Matte Blue", "CP13-415SpryCuMt": "Matte Copper",
    "CP13-415SpryGlMt": "Matte Gold", "CP13-415SpryGlSh": "Shiny Gold",
    "CP13-415SprySlMt": "Matte Silver", "CP13-415SprySlSh": "Shiny Silver",
};

/** Customer and Grace wording for an exact SKU, independent of generic import labels. */
export function reviewed13_415Label(identity: ComponentIdentity): { itemName: string; capColor: string } {
    const capColor = finishBySku[identity.websiteSku];
    if (!capColor) throw new Error(`Missing reviewed finish for ${identity.websiteSku}`);
    const mechanism = identity.kind.startsWith("roll-on-") ? "Roll-On Cap"
        : identity.kind === "short-ribbed" ? "Short Ribbed Cap"
            : identity.kind === "short-lined" ? "Short Lined Cap"
                : identity.kind === "tall-lined" ? "Tall Lined Cap" : "Fine Mist Sprayer";
    return { itemName: `${capColor} ${mechanism}, Thread 13-415`, capColor };
}

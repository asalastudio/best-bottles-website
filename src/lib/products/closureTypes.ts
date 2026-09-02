/**
 * One closure vocabulary, shared by the SKU picker and the bottle configurator.
 *
 * THE TWO VIEWS READ DIFFERENT FIELDS, and left alone they disagree:
 *   - the picker types a component by the COMPONENT product's `family`
 *     — Sprayer, Cap/Closure, Roll-On Cap, Dropper, Lotion Pump
 *   - the configurator types a configuration by the BOTTLE SKU's `applicator`
 *     — Fine Mist Sprayer, Perfume Spray Pump, Vintage Bulb Sprayer,
 *       Vintage Bulb Sprayer with Tassel, Atomizer, Metal/Plastic Roller Ball…
 *
 * The applicator vocabulary is the FINER of the two and it is the one a buyer
 * actually shops by: a vintage bulb sprayer with a tassel is not a fine mist
 * sprayer, and collapsing both to "Sprayer" to make the views match would
 * destroy the distinction rather than reconcile it. So the labels stay as the
 * catalogue writes them, and what is shared is the ICON and the ordering — the
 * two views agree on what a thing *is* without pretending it is something
 * coarser.
 *
 * MISSING IS NOT "NONE". 99 bottle SKUs record no applicator at all, and 83 of
 * them name a closure in their own item name — "with short black cap", "with
 * black dropper", "with metal roller ball plug". The field is unfilled, not
 * empty of meaning, so a missing applicator is INFERRED from capStyle and the
 * item name and flagged as inferred. It is never rendered as "bottle only":
 * no bare-glass SKU has been found in this catalogue, and inventing one would
 * sell glass we cannot ship.
 */

/** Icon keys that src/components/matrix/ClosureIcon.tsx actually draws. */
export type ClosureIconKey =
    | "Sprayer" | "Antique Bulb Sprayer" | "Roll-On Cap" | "Metal Roller"
    | "Plastic Roller" | "Lotion Pump" | "Dropper" | "Cap" | "Short Cap"
    | "Reducer";

export type ClosureType = {
    /** what the catalogue calls it, cleaned up — shown to the buyer */
    label: string;
    icon: ClosureIconKey;
    /** true when the catalogue left applicator blank and this was deduced */
    inferred: boolean;
};

const ICONS: Array<[RegExp, ClosureIconKey]> = [
    // most specific first — "bulb"/"vintage"/"antique" before the generic spray
    [/\b(vintage|antique)\b.*\b(bulb|spray)/i, "Antique Bulb Sprayer"],
    [/\bbulb\b/i, "Antique Bulb Sprayer"],
    [/\bmetal\s+roll/i, "Metal Roller"],
    [/\bplastic\s+roll/i, "Plastic Roller"],
    [/\broll[-\s]?on\b|\broller\b/i, "Roll-On Cap"],
    [/\blotion\s+pump\b/i, "Lotion Pump"],
    [/\bdropper\b|\bpipette\b/i, "Dropper"],
    [/\breducer\b|\borifice\b/i, "Reducer"],
    [/\bshort\s+cap\b/i, "Short Cap"],
    [/\b(spray|sprayer|mist|atomi[sz]er|pump)\b/i, "Sprayer"],
    [/\b(cap|closure|lid|stopper|plug)\b/i, "Cap"],
];

function iconFor(label: string): ClosureIconKey {
    for (const [re, key] of ICONS) if (re.test(label)) return key;
    return "Cap";
}

const BLANK = /^(n\/?a|none|null|-|—|tbd|\?)$/i;

/**
 * Normalise whatever the catalogue recorded into a closure type.
 *
 * `raw` is the component family (picker) or the bottle's applicator
 * (configurator). When it is blank, capStyle and the item name are used, in
 * that order, because both are populated on rows where applicator is not.
 */
export function toClosureType(
    raw: string | null | undefined,
    fallback: { capStyle?: string | null; itemName?: string | null } = {},
): ClosureType {
    const direct = (raw ?? "").toString().trim();
    if (direct && !BLANK.test(direct)) {
        const label = tidy(direct);
        return { label, icon: iconFor(label), inferred: false };
    }

    const style = (fallback.capStyle ?? "").toString().trim();
    if (style && !BLANK.test(style)) {
        const label = tidy(style === "Short" || style === "Tall" ? `${style} Cap` : style);
        return { label, icon: iconFor(label), inferred: true };
    }

    // last resort: the closure the item name describes ("with a black dropper")
    const name = (fallback.itemName ?? "").toString();
    const m = /\bwith\s+(?:an?\s+)?([a-z\s-]{3,40}?)\s*(?:\.|,|$)/i.exec(name);
    if (m) {
        const guess = m[1].replace(/\b(glass|bottle|liner|foam)\b/gi, "").trim();
        if (guess) {
            const label = tidy(guess);
            return { label, icon: iconFor(label), inferred: true };
        }
    }
    return { label: "Closure", icon: "Cap", inferred: true };
}

/**
 * House wording, without changing what the thing is.
 *
 * "PERFUME SPRAY PUMP" AND "FINE MIST SPRAYER" ARE ONE PART UNDER TWO NAMES.
 * Measured: both resolve to the same SKU token (SPR); NO bottle base offers
 * both, which a genuine choice between two parts would produce somewhere; and
 * Circle and Cylinder each use both names across different bases, so the split
 * is drift rather than distinction. Only the LABEL is merged — the SKUs stay
 * separate and orderable — and the catalogue should be corrected at source.
 * "Sprayer" is deliberately NOT aliased here: it is the component family and
 * covers bulb sprayers too, so collapsing it would lose a real distinction.
 */
function tidy(s: string): string {
    const t = s.replace(/\s+/g, " ").trim();
    const map: Record<string, string> = {
        "cap/closure": "Cap",
        "cap/component": "Cap",
        "tool": "Accessory",
        "perfume spray pump": "Fine Mist Sprayer",
        "perfume spray": "Fine Mist Sprayer",
        "spray pump": "Fine Mist Sprayer",
        "mist sprayer": "Fine Mist Sprayer",
    };
    const hit = map[t.toLowerCase()];
    if (hit) return hit;
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Plain closures first, decorated ones after, so the eye lands on the simple. */
const ORDER = [
    "Cap", "Short Cap", "Roll-On Cap", "Metal Roller Ball", "Plastic Roller Ball",
    "Reducer", "Dropper", "Fine Mist Sprayer", "Sprayer", "Atomizer",
    "Lotion Pump", "Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel",
    "Glass Stopper", "Accessory",
];
export function closureRank(label: string): number {
    const i = ORDER.indexOf(label);
    return i === -1 ? ORDER.length : i;
}

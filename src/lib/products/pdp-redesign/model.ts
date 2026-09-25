/**
 * Product page model (design handoff `design_handoff_pdp_3a`, option 3a
 * desktop / 4a mobile). One page per shape + size + fitment type; the customer
 * picks glass (a sibling group), roller material (an applicator) and cap (a
 * SKU within the group). The exact SKU is the intersection.
 *
 * Everything here is pure: option derivation, URL parameters, SKU resolution,
 * the exploded callouts, the tech sheet and the collection match. Components
 * render what these functions return and never restate a rule.
 *
 * Data rule for anything measured: render only what the field holds. A blank
 * field drops its line; nothing is derived or guessed.
 */
import type { ProductGroupPayload, ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import { decoratedCapFinish } from "@/lib/products/decorated-cap-finish";
import { normalizeImportedCapColor } from "@/lib/products/cap-finish-evidence";
import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import { catalogFitmentLabel, displayApplicatorName } from "@/lib/catalogFilters";
import { SHOP_COLLECTIONS, matchesShopCollection, shopCollectionHref } from "@/lib/shopCollections";
import { activeVolumeTierIndex, buildDisplayVolumeTiers, type DisplayVolumeTier } from "@/lib/volumePricing";
import { isSoldOutStockStatus } from "@/lib/checkout";

export type PdpGroup = ProductGroupPayload["group"];
export type RollerId = "metal" | "plastic";

export type Picks = {
    roller: RollerId | null;
    /** Cap option id (`slugifyPick(name)`); null when the group has no cap dimension. */
    cap: string | null;
};

export type RollerOption = { id: RollerId; label: string; shortLabel: string; applicator: string };
export type CapOption = { id: string; name: string; swatchName: string; variants: ProductVariant[] };
export type GlassOption = {
    slug: string;
    label: string;
    shortLabel: string;
    active: boolean;
    primaryWebsiteSku: string | null;
    primaryGraceSku: string | null;
};

export type SiblingGlassGroup = {
    slug: string;
    color: string | null;
    displayName: string;
    primaryWebsiteSku?: string | null;
    primaryGraceSku?: string | null;
    /** SKUs whose published kit can lend the bare body layer for the glass lineup. */
    bodyCandidates?: Array<{ websiteSku: string | null; graceSku: string | null }>;
    /** False when none of the sibling's SKUs is in stock and sellable online (the lineup draws it dotted). */
    inStock?: boolean;
};

export function slugifyPick(value: string): string {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// ── caps ──────────────────────────────────────────────────────────────────────

const GENERIC_CAP_WORDS = new Set([
    "", "clear", "standard", "default", "none", "n/a", "spray", "sprayer", "roll-on", "roller", "cap", "cap/closure",
    "pump", "dropper", "reducer", "amber", "frosted", "cobalt blue", "blue", "swirl",
]);

function clean(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length ? trimmed : null;
}

/** The finish a cap is sold as: "Black with Dots", "Matte Copper", "Shiny Silver". */
export function capFinishName(variant: ProductVariant): string {
    const normalised = normalizeImportedCapColor(variant);
    const dotted = decoratedCapFinish(normalised);
    if (dotted) return dotted;
    const stored = clean(normalised.capColor);
    if (stored && !GENERIC_CAP_WORDS.has(stored.toLowerCase())) return stored;
    const token = getFinishFromWebsiteSku(normalised.websiteSku)?.label;
    if (token) return token;
    return stored ?? clean(variant.trimColor) ?? "Standard";
}

function capQualifier(variant: ProductVariant): string | null {
    const height = clean(variant.capHeight);
    if (height && /^(short|tall)$/i.test(height)) return height;
    const style = clean(variant.capStyle);
    if (style && /^(short|tall|faux leather|minaret|leather)$/i.test(style)) return style;
    return null;
}

/** The pills a group offers for one applicator: unique finishes, qualified by cap style only when two finishes collide. */
export function capOptions(variants: readonly ProductVariant[], roller: RollerId | null): CapOption[] {
    const pool = roller ? variants.filter((v) => rollerIdFor(v.applicator) === roller) : [...variants];
    const sorted = [...pool].sort((a, b) => (a.websiteSku ?? "").localeCompare(b.websiteSku ?? ""));
    const byFinish = new Map<string, ProductVariant[]>();
    for (const variant of sorted) {
        const finish = capFinishName(variant);
        byFinish.set(finish, [...(byFinish.get(finish) ?? []), variant]);
    }
    const options: CapOption[] = [];
    for (const [finish, group] of byFinish) {
        const qualifiers = new Set(group.map(capQualifier));
        if (group.length > 1 && qualifiers.size > 1) {
            for (const variant of group) {
                const qualifier = capQualifier(variant);
                const name = qualifier ? `${finish} ${qualifier}` : finish;
                const id = slugifyPick(name);
                const existing = options.find((option) => option.id === id);
                if (existing) existing.variants.push(variant);
                else options.push({ id, name, swatchName: finish, variants: [variant] });
            }
        } else {
            options.push({ id: slugifyPick(finish), name: finish, swatchName: finish, variants: group });
        }
    }
    return options;
}

export function capOptionFor(variant: ProductVariant | null | undefined, options: readonly CapOption[]): CapOption | null {
    if (!variant) return null;
    return options.find((option) => option.variants.some((candidate) => candidate._id === variant._id)) ?? null;
}

// ── rollers ───────────────────────────────────────────────────────────────────

export function rollerIdFor(applicator: string | null | undefined): RollerId | null {
    if (!applicator) return null;
    if (/metal/i.test(applicator)) return "metal";
    if (/plastic/i.test(applicator)) return "plastic";
    return null;
}

/** Two entries only when the group sells both materials; otherwise the toggle is hidden. */
export function rollerOptions(variants: readonly ProductVariant[]): RollerOption[] {
    const found = new Map<RollerId, string>();
    for (const variant of variants) {
        const id = rollerIdFor(variant.applicator);
        if (id && variant.applicator && !found.has(id)) found.set(id, variant.applicator);
    }
    if (found.size < 2) return [];
    const order: RollerId[] = ["metal", "plastic"];
    return order.filter((id) => found.has(id)).map((id) => ({
        id,
        label: id === "metal" ? "Metal roller ball" : "Plastic roller ball",
        shortLabel: id === "metal" ? "Metal" : "Plastic",
        applicator: found.get(id)!,
    }));
}

/** "Metal roller", "Fine mist spray", "Lotion pump"; null when nothing is fitted. */
export function fitmentLabel(variant: ProductVariant | null | undefined): string | null {
    if (!variant) return null;
    return catalogFitmentLabel(variant.applicator, variant.ballMaterial);
}

// ── picks and resolution ──────────────────────────────────────────────────────

export function picksOf(variant: ProductVariant, options: readonly CapOption[]): Picks {
    return { roller: rollerIdFor(variant.applicator), cap: capOptionFor(variant, options)?.id ?? null };
}

/**
 * The SKU for a set of picks. The cap is authoritative; when the same finish
 * is not sold in the other roller material, fall back to that material's
 * first cap (the deterministic rule the guided page has always used).
 */
export function resolveVariant(variants: readonly ProductVariant[], picks: Picks): ProductVariant | null {
    if (variants.length === 0) return null;
    const rollers = rollerOptions(variants);
    const roller = picks.roller && rollers.some((option) => option.id === picks.roller) ? picks.roller : rollers[0]?.id ?? null;
    const options = capOptions(variants, roller);
    const exact = picks.cap ? options.find((option) => option.id === picks.cap) : null;
    const option = exact ?? options[0] ?? null;
    if (option) return option.variants[0] ?? null;
    return [...variants].sort((a, b) => (a.websiteSku ?? "").localeCompare(b.websiteSku ?? ""))[0] ?? null;
}

export type PickParams = { roller?: string | null; cap?: string | null; sku?: string | null };

/** Picks from the URL, then the group's primary SKU, then the first SKU. `?sku=` from catalog cards and Grace wins. */
export function derivePicks(variants: readonly ProductVariant[], group: Pick<PdpGroup, "primaryWebsiteSku" | "primaryGraceSku">, params: PickParams): Picks {
    const rollers = rollerOptions(variants);
    const bySku = params.sku
        ? variants.find((variant) => variant.websiteSku === params.sku || variant.graceSku === params.sku) ?? null
        : null;
    if (bySku) return picksOf(bySku, capOptions(variants, rollerIdFor(bySku.applicator)));
    const primary = variants.find((variant) => variant.websiteSku === group.primaryWebsiteSku)
        ?? variants.find((variant) => variant.graceSku === group.primaryGraceSku)
        ?? null;
    const requestedRoller = params.roller === "metal" || params.roller === "plastic" ? params.roller : null;
    const roller = requestedRoller && rollers.some((option) => option.id === requestedRoller)
        ? requestedRoller
        : rollerIdFor(primary?.applicator) ?? rollers[0]?.id ?? null;
    const options = capOptions(variants, roller);
    const requestedCap = params.cap ? options.find((option) => option.id === params.cap) : null;
    const primaryCap = primary ? capOptionFor(primary, options) : null;
    return { roller, cap: requestedCap?.id ?? primaryCap?.id ?? options[0]?.id ?? null };
}

/** `roller=metal&cap=black-with-dots`, only the dimensions the group offers. */
export function pickQuery(picks: Picks, rollers: readonly RollerOption[]): string {
    const params = new URLSearchParams();
    if (picks.roller && rollers.length > 1) params.set("roller", picks.roller);
    if (picks.cap) params.set("cap", picks.cap);
    return params.toString();
}

// ── glass ─────────────────────────────────────────────────────────────────────

export function glassShortLabel(color: string | null | undefined): string {
    const value = clean(color) ?? "Clear";
    if (/cobalt/i.test(value) || /^blue$/i.test(value)) return "Cobalt";
    return value;
}

export function glassLabel(color: string | null | undefined): string {
    const value = clean(color) ?? "Clear";
    if (/^blue$/i.test(value)) return "Cobalt Blue";
    return value;
}

export function glassOptions(group: Pick<PdpGroup, "slug" | "color" | "primaryWebsiteSku" | "primaryGraceSku">, siblings: readonly SiblingGlassGroup[]): GlassOption[] {
    const seen = new Set<string>();
    const out: GlassOption[] = [];
    const push = (slug: string, color: string | null | undefined, active: boolean, primaryWebsiteSku?: string | null, primaryGraceSku?: string | null) => {
        const label = glassLabel(color);
        const key = label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ slug, label, shortLabel: glassShortLabel(color), active, primaryWebsiteSku: primaryWebsiteSku ?? null, primaryGraceSku: primaryGraceSku ?? null });
    };
    push(group.slug, group.color, true, group.primaryWebsiteSku, group.primaryGraceSku);
    for (const sibling of siblings) push(sibling.slug, sibling.color, false, sibling.primaryWebsiteSku, sibling.primaryGraceSku);
    return out;
}

// ── copy lines ────────────────────────────────────────────────────────────────

/** "COBALT · METAL ROLLER · BLACK WITH DOTS" over the canvas. */
export function pickLine(glass: string, roller: RollerOption | null, fitment: string | null, cap: string | null): string {
    const parts = [glass];
    if (roller) parts.push(`${roller.shortLabel} roller`);
    else if (fitment) parts.push(fitment);
    if (cap) parts.push(cap);
    return parts.map((part) => part.toUpperCase()).join(" · ");
}

/** "Cobalt · Metal · Black with Dots" for order lines and the sticky bar. */
export function lineLabel(glass: string, roller: RollerOption | null, fitment: string | null, cap: string | null): string {
    const parts = [glass];
    if (roller) parts.push(roller.shortLabel);
    else if (fitment) parts.push(fitment);
    if (cap) parts.push(cap);
    return parts.join(" · ");
}

export function capacityEyebrow(group: Pick<PdpGroup, "family" | "capacity" | "capacityMl" | "neckThreadSize">): string {
    const capacity = group.capacityMl != null ? `${group.capacityMl} ml` : clean(group.capacity)?.split(" (")[0] ?? null;
    return [group.family, capacity, clean(group.neckThreadSize)].filter(Boolean).map((part) => String(part).toUpperCase()).join(" · ");
}

export function pageTitle(group: Pick<PdpGroup, "family" | "capacity" | "capacityMl" | "color">, fitment: string | null): string {
    const capacity = group.capacityMl != null ? `${group.capacityMl} ml` : clean(group.capacity)?.split(" (")[0] ?? "";
    const glass = glassLabel(group.color);
    const family = clean(group.family) ?? "Bottle";
    const type = fitment
        ? /roller/i.test(fitment) ? "Roll-On Bottle"
            : /spray/i.test(fitment) ? "Spray Bottle"
                : /pump/i.test(fitment) ? "Pump Bottle"
                    : /dropper/i.test(fitment) ? "Dropper Bottle"
                        : /reducer|splash/i.test(fitment) ? "Splash-On Bottle"
                            : `${fitment} Bottle`
        : "Bottle";
    return `${capacity} ${glass} ${family} ${type}`.replace(/\s+/g, " ").trim();
}

export const SHIPS_IN_COPY = "ships in 1–3 business days";

export function statusLine(variant: ProductVariant | null | undefined): { inStock: boolean; text: string } {
    const status = clean(variant?.stockStatus);
    const inStock = status === "In Stock" || status === "Available to order";
    const parts: string[] = [];
    if (!status) parts.push("Availability on request");
    else if (inStock) parts.push("In stock", SHIPS_IN_COPY);
    else if (isSoldOutStockStatus(status)) parts.push("Out of stock");
    else parts.push(status);
    if (variant?.caseQuantity && variant.caseQuantity > 1) parts.push(`${variant.caseQuantity.toLocaleString("en-US")} per case`);
    return { inStock, text: parts.join(" · ") };
}

// ── pricing ───────────────────────────────────────────────────────────────────

export function tiersFor(variant: ProductVariant | null | undefined): DisplayVolumeTier[] {
    if (!variant?.webPrice1pc) return [];
    return buildDisplayVolumeTiers({
        webPrice1pc: variant.webPrice1pc,
        webPrice10pc: variant.webPrice10pc,
        webPrice12pc: variant.webPrice12pc,
        priceTiers: variant.priceTiers?.map((tier) => ({ minQty: tier.minQty, unitPrice: tier.unitPrice })) ?? null,
    });
}

/** The published rate at a quantity: the active break, else the 1-piece price. */
export function unitPriceAt(variant: ProductVariant | null | undefined, qty: number): number | null {
    if (!variant?.webPrice1pc) return null;
    const tiers = tiersFor(variant);
    if (tiers.length === 0) return variant.webPrice1pc;
    return tiers[activeVolumeTierIndex(tiers, qty)]?.unitPrice ?? variant.webPrice1pc;
}

// ── exploded callouts ─────────────────────────────────────────────────────────

export type CalloutKey = "cap" | "fitment" | "neck" | "body";
export type Callout = { key: CalloutKey; title: string; line1: string; line2: string | null };

function mm(value: string | null | undefined): string | null {
    const raw = clean(value);
    if (!raw) return null;
    const number = raw.match(/(\d+(?:\.\d+)?)/)?.[1];
    return number ? `${number} mm` : null;
}

function threadParts(neck: string | null | undefined): { outer: string; finish: string } | null {
    const raw = clean(neck);
    const match = raw?.match(/^(\d{1,2})-(\d{3})$/);
    return match ? { outer: match[1], finish: match[2] } : null;
}

export function callouts(variant: ProductVariant | null | undefined, capName: string | null): Callout[] {
    if (!variant) return [];
    const out: Callout[] = [];
    const neck = clean(variant.neckThreadSize);
    const thread = threadParts(neck);

    if (capName) {
        const capHeight = clean(variant.capHeight);
        const line2 = [neck ? `Fits ${neck}` : null, capHeight ? `${capHeight} cap` : null].filter(Boolean).join(" · ");
        out.push({ key: "cap", title: "CAP", line1: capName, line2: line2 || null });
    }

    const applicator = clean(variant.applicator);
    if (applicator && applicator !== "N/A" && applicator !== "Cap/Closure") {
        const roller = rollerIdFor(applicator);
        const line1 = roller ? `${displayApplicatorName(applicator)} plug` : displayApplicatorName(applicator);
        const line2 = neck
            ? roller ? `Press-fit into ${neck} neck` : thread ? `Threads onto ${neck} neck` : `Fits ${neck} neck`
            : null;
        out.push({ key: "fitment", title: "FITMENT", line1, line2 });
    }

    if (neck) {
        out.push({
            key: "neck",
            title: "NECK THREAD",
            line1: neck,
            line2: thread ? `${thread.outer} mm outer Ø · ${thread.finish} finish` : null,
        });
    }

    const capacity = variant.capacityMl != null
        ? `${variant.capacityMl} ml${variant.capacityOz != null ? ` (${Math.round(variant.capacityOz * 100) / 100} oz)` : ""}`
        : clean(variant.capacity);
    const glass = clean(variant.color);
    const bodyLine1 = [glass ? `${glassLabel(glass)} glass` : null, capacity].filter(Boolean).join(" · ");
    const bodyLine2 = [
        mm(variant.heightWithoutCap) ? `H ${mm(variant.heightWithoutCap)}` : null,
        mm(variant.diameter) ? `Ø ${mm(variant.diameter)}` : null,
        variant.bottleWeightG ? `${Math.round(variant.bottleWeightG)} g` : null,
    ].filter(Boolean).join(" · ");
    if (bodyLine1) out.push({ key: "body", title: "BODY", line1: bodyLine1, line2: bodyLine2 || null });
    return out;
}

// ── tech sheet ────────────────────────────────────────────────────────────────

export type TechRow = { k: string; v: string };

export function techSheetRows(variant: ProductVariant | null | undefined, group: Pick<PdpGroup, "neckThreadSize" | "color"> | null | undefined): TechRow[] {
    if (!variant) return [];
    const rows: TechRow[] = [];
    const capacity = variant.capacityMl != null
        ? `${variant.capacityMl} ml${variant.capacityOz != null ? ` · ${Math.round(variant.capacityOz * 100) / 100} oz` : ""}`
        : clean(variant.capacity);
    if (capacity) rows.push({ k: "Capacity", v: capacity });
    const neck = clean(variant.neckThreadSize) ?? clean(group?.neckThreadSize);
    if (neck) rows.push({ k: "Neck finish", v: neck });
    const glass = clean(variant.color) ?? clean(group?.color);
    if (glass) rows.push({ k: "Glass", v: glassLabel(glass) });
    const fitment = fitmentLabel(variant);
    if (fitment) rows.push({ k: "Fitment", v: rollerIdFor(variant.applicator) ? `${fitment} ball, pre-fitted` : fitment });
    const withCap = clean(variant.heightWithCap);
    if (withCap) rows.push({ k: "Height with cap", v: withCap });
    const withoutCap = clean(variant.heightWithoutCap);
    if (withoutCap) rows.push({ k: "Height without cap", v: withoutCap });
    const diameter = clean(variant.diameter);
    if (diameter) rows.push({ k: "Diameter", v: diameter });
    if (variant.bottleWeightG) rows.push({ k: "Bottle weight", v: `${Math.round(variant.bottleWeightG * 10) / 10} g` });
    if (variant.caseQuantity) {
        const caseWeight = (variant as ProductVariant & { caseWeightG?: number | null }).caseWeightG;
        const weight = caseWeight ? ` · ${(caseWeight / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} kg` : "";
        rows.push({ k: "Case pack", v: `${variant.caseQuantity.toLocaleString("en-US")} pcs${weight}` });
    }
    return rows;
}

// ── collection band ───────────────────────────────────────────────────────────

export type CollectionBand = { key: string; title: string; subtitle: string; href: string; image: string };

export function collectionFor(group: Pick<PdpGroup, "category" | "family" | "slug" | "applicatorTypes">): CollectionBand | null {
    const match = SHOP_COLLECTIONS.find((collection) => matchesShopCollection(
        { category: group.category ?? "", family: group.family, slug: group.slug, applicatorTypes: group.applicatorTypes ?? [] },
        collection.key,
    ));
    if (!match) return null;
    return {
        key: match.key,
        title: match.title,
        subtitle: match.subtitle,
        href: shopCollectionHref(match.key),
        image: `/assets/homepage/collection-${match.key}-bone-v3.webp`,
    };
}

export type CollectionSummaryGroup = { slug: string; family: string; category: string; capacityMl: number | null; applicatorTypes: string[] };

/** "30 roll-on bottles across Cylinder, Circle, Slim, Diva and more, from 3 ml to 15 ml." from the catalogue's groups. */
export function collectionDescription(band: CollectionBand, groups: readonly CollectionSummaryGroup[]): string {
    const members = groups.filter((group) => matchesShopCollection(group, band.key));
    if (members.length === 0) return band.subtitle;
    const familyCounts = new Map<string, number>();
    for (const group of members) familyCounts.set(group.family, (familyCounts.get(group.family) ?? 0) + 1);
    const families = [...familyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([family]) => family);
    const shown = families.slice(0, 4);
    const familyText = families.length > shown.length ? `${shown.join(", ")} and more` : shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0] ?? "";
    const capacities = members.map((group) => group.capacityMl).filter((value): value is number => typeof value === "number" && value > 0);
    const range = capacities.length ? `, from ${Math.min(...capacities)} ml to ${Math.max(...capacities)} ml` : "";
    const noun = band.title.toLowerCase();
    return `${band.subtitle} ${members.length} ${noun}${familyText ? ` across ${familyText}` : ""}${range}.`;
}

export function buildYourBottleHref(group: Pick<PdpGroup, "family">, collection: CollectionBand | null): string {
    const params = new URLSearchParams();
    if (group.family) params.set("family", group.family);
    if (collection) params.set("shop", collection.key);
    params.set("from", "pdp");
    return `/matrix?${params.toString()}`;
}

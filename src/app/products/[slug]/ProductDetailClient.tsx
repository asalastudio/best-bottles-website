"use client";

import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
    ShoppingBag, ArrowLeft, Package,
    Check, Truck,
} from "@/components/icons";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Breadcrumbs, { type BreadcrumbStep } from "@/components/Breadcrumbs";
import { useCart } from "@/components/CartProvider";
import { useGrace } from "@/components/useGrace";
import { APPLICATOR_BUCKETS, APPLICATOR_NAV, type ApplicatorNavValue } from "@/lib/catalogFilters";
import { buildCapOptionPhotoKeys } from "@/lib/products/closure-swatch-keys";
import {
    PdpInlineBadges,
    PdpInlinePromo,
    PdpEditorialZone,
    type PdpBlock,
} from "@/components/PdpBlocks";
import ProductImageGallery, { type GalleryImage } from "@/components/products/ProductImageGallery";
import ConfiguratorPdp from "@/components/products/ConfiguratorPdp";
import FocusedPdpLayout from "@/components/products/FocusedPdpLayout";
import PdpDiscoverySections, {
    PdpDiscoveryMatrixLink,
    type PdpCompatibilityComponent,
    type PdpCompatibilityPayload,
} from "@/components/products/PdpDiscoverySections";
import { closureTokenFromSlug, familyForSlug, familyForSlugOrDerived, glassFromSlug, colourTokenFromSlug, PRESET_FOR_COLOUR }
  from "@/lib/configurator/families";
import { GLASS_PRESETS } from "@/lib/materials/glassPresets";
import { analytics } from "@/lib/analytics";
import { chooseCanonicalProductDescription } from "@/lib/canonicalProduct";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";
import { filterVariantsForProductGroup, isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { isCheckoutReady } from "@/lib/checkout";
import {
    VOLUME_TIERS_HONORED_AT_CHECKOUT,
    activeVolumeTierIndex,
    buildDisplayVolumeTiers,
    formatVolumeQtyRange,
} from "@/lib/volumePricing";
import type { FocusedPdpRelations } from "@/lib/products/pdp-relations";
import { resolveFocusedPdpCapabilities } from "@/lib/products/focused-pdp-rollout";
import { resolveGuidedVariant, type GuidedVariantDeps } from "@/lib/products/guided-variant-resolver";
import { resolveSelectedSkuKit } from "@/lib/products/pdp-selected-kit";
import MobileProductPdp from "@/components/products/mobile/MobileProductPdp";
import {
    createPendingPdpAnalyticsNavigation,
    resolveAndConsumePdpAnalyticsNavigation,
    type PdpAnalyticsDimension,
    type PendingPdpAnalyticsNavigation,
} from "@/lib/products/pdp-analytics";
import { dispatchPdpContextChange } from "@/lib/grace/pageContextEvents";
import {
    GRACE_PDP_PLATE_EVENT,
    isGracePdpPlateCommand,
    matchListedOption,
    type GracePdpPlateCommand,
} from "@/lib/grace/pdpPlateSwap";

export type { PdpCompatibilityPayload } from "@/components/products/PdpDiscoverySections";

function analyticsApplicationForApplicator(applicator: string | null | undefined): ApplicatorNavValue | null {
    if (!applicator) return null;
    return APPLICATOR_NAV.find((navigation) => navigation.buckets.some((bucket) => {
        const definition = APPLICATOR_BUCKETS.find((candidate) => candidate.value === bucket);
        return (definition?.productValues as readonly string[] | undefined)?.includes(applicator) ?? false;
    }))?.value ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
}

function getFinishFromGraceSku(graceSku: string | null | undefined): { label: string; swatchName: string } | null {
    if (!graceSku) return null;
    const map: Record<string, { label: string; swatchName: string }> = {
        SBLK: { label: "Shiny Black", swatchName: "Shiny Black" },
        MBLK: { label: "Matte Black", swatchName: "Matte Black" },
        BLK: { label: "Black", swatchName: "Black" },
        SSLV: { label: "Shiny Silver", swatchName: "Shiny Silver" },
        MSLV: { label: "Matte Silver", swatchName: "Matte Silver" },
        SLV: { label: "Silver", swatchName: "Shiny Silver" },
        SGLD: { label: "Shiny Gold", swatchName: "Shiny Gold" },
        MGLD: { label: "Matte Gold", swatchName: "Matte Gold" },
        GLD: { label: "Gold", swatchName: "Shiny Gold" },
        MCPR: { label: "Matte Copper", swatchName: "Matte Copper" },
        SCPR: { label: "Shiny Copper", swatchName: "Copper" },
        MBLU: { label: "Matte Blue", swatchName: "Blue" },
        SBLU: { label: "Shiny Blue", swatchName: "Blue" },
        BLU: { label: "Blue", swatchName: "Blue" },
        WHT: { label: "White", swatchName: "White" },
        PNK: { label: "Pink", swatchName: "Pink" },
        GRN: { label: "Green", swatchName: "Green" },
        BKDT: { label: "Black with Dots", swatchName: "Black" },
        SLDT: { label: "Silver with Dots", swatchName: "Shiny Silver" },
        PKDT: { label: "Pink with Dots", swatchName: "Pink" },
        TRQ: { label: "Turquoise", swatchName: "Turquoise" },
        RED: { label: "Red", swatchName: "Red" },
    };
    // Scan all tokens (right to left) — some SKUs have trailing suffixes like "-02"
    const tokens = graceSku.split("-").map((t) => t.toUpperCase());
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (map[tokens[i]]) return map[tokens[i]];
    }
    return null;
}

/** The finish read off the WEBSITE SKU stem. Many rows carry nothing else:
 *  the frosted Diva's lotion pumps are capColor "Clear", graceSku
 *  "LB-DVA-FRS-46ML-02" and itemName "... Clear Lotion Bottle", while the
 *  website SKU says LBDivaFrst46LtnMtGl. The trailing token is the finish;
 *  a "Rng" (decorative ring) suffix is stripped first. Names match the
 *  plate manifests and the clear group's capColor values, so the two
 *  groups dedupe alike. */
// The website-SKU finish table is generated from the reviewed SKU vocabulary
// (data/paper-doll/tokens.json): 38 finishes, 67 spellings, regenerated by
// scripts/paperdoll/emit_tokens_ts.py. It used to be 21 spellings typed here.

function getCapFinishFromItemName(itemName: string | null | undefined): { label: string; swatchName: string } | null {
    const name = (itemName ?? "").toLowerCase();
    if (!name) return null;
    // Antique/vintage sprayer colors (often at start of itemName)
    if (name.startsWith("lavender")) return { label: "Lavender", swatchName: "Lavender" };
    if (name.startsWith("ivory gold")) return { label: "Ivory Gold", swatchName: "Shiny Gold" };
    if (name.startsWith("ivory silver")) return { label: "Ivory Silver", swatchName: "Shiny Silver" };
    if (name.startsWith("white")) return { label: "White", swatchName: "White" };
    if (name.startsWith("pink")) return { label: "Pink", swatchName: "Pink" };
    if (name.startsWith("red")) return { label: "Red", swatchName: "Red" };
    if (name.startsWith("black")) return { label: "Black", swatchName: "Black" };
    // Fine Mist Sprayer & Lotion Pump — "[Finish] Fine Mist Sprayer" or "[Finish] Lotion or treatment pump"
    if (name.startsWith("matte copper")) return { label: "Matte Copper", swatchName: "Matte Copper" };
    if (name.startsWith("shiny black")) return { label: "Shiny Black", swatchName: "Shiny Black" };
    if (name.startsWith("matte blue")) return { label: "Matte Blue", swatchName: "Blue" };
    if (name.startsWith("shiny gold")) return { label: "Shiny Gold", swatchName: "Shiny Gold" };
    if (name.startsWith("matte gold")) return { label: "Matte Gold", swatchName: "Matte Gold" };
    if (name.startsWith("matte silver")) return { label: "Matte Silver", swatchName: "Matte Silver" };
    if (name.startsWith("shiny silver")) return { label: "Shiny Silver", swatchName: "Shiny Silver" };
    if (name.startsWith("matte black")) return { label: "Matte Black", swatchName: "Matte Black" };
    if (name.startsWith("gold")) return { label: "Gold", swatchName: "Shiny Gold" };
    // Lotion pump with clear overcap (e.g. "Matte Silver Lotion or treatment pump with clear overcap")
    if (name.includes("with clear overcap")) {
        if (name.startsWith("matte silver")) return { label: "Matte Silver (Clear Overcap)", swatchName: "Matte Silver" };
        if (name.startsWith("matte gold")) return { label: "Matte Gold (Clear Overcap)", swatchName: "Matte Gold" };
    }
    // Sprayer/pump "with {color} trim" pattern (e.g. "sprayer with black trim and plastic overcap")
    const trimMatch = name.match(/(?:sprayer|pump)\s+with\s+([\w\s]+?)\s+trim/);
    if (trimMatch) {
        const trim = trimMatch[1].trim();
        const trimMap: Record<string, { label: string; swatchName: string }> = {
            "black": { label: "Black", swatchName: "Black" },
            "shiny black": { label: "Shiny Black", swatchName: "Shiny Black" },
            "matte black": { label: "Matte Black", swatchName: "Matte Black" },
            "gold": { label: "Gold", swatchName: "Shiny Gold" },
            "shiny gold": { label: "Shiny Gold", swatchName: "Shiny Gold" },
            "matte gold": { label: "Matte Gold", swatchName: "Matte Gold" },
            "silver": { label: "Silver", swatchName: "Shiny Silver" },
            "shiny silver": { label: "Shiny Silver", swatchName: "Shiny Silver" },
            "matte silver": { label: "Matte Silver", swatchName: "Matte Silver" },
            "matte copper": { label: "Matte Copper", swatchName: "Matte Copper" },
            "red": { label: "Red", swatchName: "Red" },
            "turquoise": { label: "Turquoise", swatchName: "Turquoise" },
            "matte blue": { label: "Matte Blue", swatchName: "Blue" },
            "white": { label: "White", swatchName: "White" },
        };
        if (trimMap[trim]) return trimMap[trim];
    }
    if (name.includes("short black cap")) return { label: "Short Black", swatchName: "Black" };
    if (name.includes("short white cap")) return { label: "Short White", swatchName: "White" };
    if (name.includes("shiny silver cap")) return { label: "Shiny Silver", swatchName: "Shiny Silver" };
    if (name.includes("matte silver cap")) return { label: "Matte Silver", swatchName: "Matte Silver" };
    if (name.includes("shiny gold cap")) return { label: "Shiny Gold", swatchName: "Shiny Gold" };
    if (name.includes("matte gold cap")) return { label: "Matte Gold", swatchName: "Matte Gold" };
    if (name.includes("white cap")) return { label: "White", swatchName: "White" };
    if (name.includes("black cap")) return { label: "Black", swatchName: "Black" };
    if (name.includes("silver cap")) return { label: "Silver", swatchName: "Shiny Silver" };
    if (name.includes("gold cap")) return { label: "Gold", swatchName: "Shiny Gold" };
    return null;
}

function getVariantOptionPrefix(v: ProductVariant): string | null {
    const sku = (v.graceSku ?? "").toUpperCase();
    const websiteSku = v.websiteSku ?? "";
    const applicator = (v.applicator ?? "").toLowerCase();
    const itemName = (v.itemName ?? "").toLowerCase();
    const capStyle = v.capStyle?.trim() || null;

    if (/-AST-/.test(sku) || /ansptsl/i.test(websiteSku) || (applicator.includes("vintage") && itemName.includes("tassel"))) {
        return "Vintage Bulb Sprayer with Tassel";
    }
    if (/-ASP-/.test(sku) || /ansp/i.test(websiteSku) || /(vintage|antique|bulb).*(spray|sprayer)/.test(`${applicator} ${itemName}`)) {
        return "Vintage Bulb Sprayer";
    }
    if (sku.includes("-SPR-") || applicator.includes("spray")) return "Spray";
    if (sku.includes("-LPM-") || applicator.includes("lotion")) return "Lotion Pump";
    if (sku.includes("-DRP-") || applicator.includes("dropper")) return "Dropper";
    if (sku.includes("-ROL-") || sku.includes("-RON-") || applicator.includes("roller") || applicator.includes("roll-on")) {
        return "Roller";
    }
    if (applicator.includes("cap/closure")) return capStyle ?? "Screw Cap";

    return capStyle;
}

function isAntiqueBulbVariant(v: ProductVariant): boolean {
    const sku = (v.graceSku ?? "").toUpperCase();
    const websiteSku = v.websiteSku ?? "";
    const text = `${v.applicator ?? ""} ${v.itemName ?? ""}`.toLowerCase();
    return /-(?:ASP|AST)-/.test(sku) || /ansp/i.test(websiteSku) || /(vintage|antique|bulb).*(spray|sprayer)/.test(text);
}

function getAntiqueBulbVisualIdentity(v: ProductVariant): { label: string; swatchName: string } | null {
    const text = `${v.websiteSku ?? ""} ${v.graceSku ?? ""} ${v.itemName ?? ""}`;
    const tokens: Array<[RegExp, { label: string; swatchName: string }]> = [
        // the collar metal is what tells the two ivory bulbs apart (IVSL /
        // IVGD); one shared swatch name left the second SKU unreachable
        [/IVSL|IVYSL|IVORY.*SILVER/i, { label: "Ivory Bulb Sprayer · Silver collar", swatchName: "Ivory + Silver" }],
        [/IVGD|IVYGL|GDIV|IVGL|IVORY.*GOLD/i, { label: "Ivory Bulb Sprayer · Gold collar", swatchName: "Ivory + Gold" }],
        [/MSLV|MTSL|MATTE SILVER/i, { label: "Matte Silver Bulb Sprayer", swatchName: "Matte Silver" }],
        [/LVN|LAVENDER|LAVENDAR/i, { label: "Lavender Bulb Sprayer", swatchName: "Lavender" }],
        [/PNK|PINK/i, { label: "Pink Bulb Sprayer", swatchName: "Pink" }],
        [/RED/i, { label: "Red Bulb Sprayer", swatchName: "Red" }],
        [/WHT|WHITE/i, { label: "White Bulb Sprayer", swatchName: "White" }],
        [/BLK|BLACK/i, { label: "Black Bulb Sprayer", swatchName: "Black" }],
        [/(?:^|[-_])GLD(?:$|[-_])|ANSPGL\\b|\\bGOLD\\b/i, { label: "Gold Bulb Sprayer", swatchName: "Gold" }],
    ];
    return tokens.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** Resolved cap finish for PDP selectors — must match variantSwatchPreview so sparse capColor rows still appear. */
function resolveVariantCapFinish(v: ProductVariant): { label: string; swatchName: string } {
    if (isAntiqueBulbVariant(v)) {
        const bulbIdentity = getAntiqueBulbVisualIdentity(v);
        if (bulbIdentity) return bulbIdentity;
    }

    const fromCapColor = (() => {
        if (!v.capColor) return null;
        const capColor = v.capColor.trim();
        const normalized = capColor.toLowerCase();
        if (["clear", "standard", "default", "none", "n/a"].includes(normalized)) return null;
        if (isAntiqueBulbVariant(v) && normalized === "clear") return null;
        return { label: v.capColor, swatchName: v.capColor };
    })();
    const finish = fromCapColor ?? getFinishFromWebsiteSku(v.websiteSku) ?? getFinishFromGraceSku(v.graceSku) ?? getCapFinishFromItemName(v.itemName);
    const prefix = getVariantOptionPrefix(v);

    if (finish) {
        const label = prefix && !finish.label.toLowerCase().startsWith(prefix.toLowerCase())
            ? `${prefix} ${finish.label}`
            : finish.label;
        return { label, swatchName: finish.swatchName };
    }

    const fromCapStyle = (() => {
        if (prefix) return { label: prefix, swatchName: prefix };
        return null;
    })();
    return fromCapStyle ?? { label: "Variant Option", swatchName: "Standard" };
}

// Swatch hex values for trim/cap finish names.
// When adding new entries: also update LIGHT_SWATCHES below if the color is
// pale enough that a white check icon would disappear (use dark check instead).
const COLOR_SWATCH: Record<string, string> = {
    // ── Base finishes ───────────────────────────────────────────────
    "Matte Gold": "#C5A065",
    "Shiny Gold": "#D4AF37",
    "Gold": "#D4AF37",
    "Matte Silver": "#ADADAD",
    "Shiny Silver": "#C8C8C8",
    "Silver": "#C8C8C8",
    "Black": "#1D1D1F",
    "Matte Black": "#2D2D2D",
    "Shiny Black": "#0D0D0D",
    "Short Black": "#1D1D1F",
    "Short White": "#F5F5F0",
    "White": "#F5F5F0",
    "Matte Copper": "#B87333",
    "Copper": "#B87333",
    "Rose Gold": "#E8A090",
    "Pink": "#F4A7B9",
    "Blue": "#5B87B5",
    "Matte Blue": "#3D6B9F",
    "Green": "#6B9A6B",
    "Lavender": "#E6E6FA",
    "Red": "#C41E3A",
    "Ivory Gold": "#D4AF37",
    "Ivory Silver": "#C8C8C8",
    // ivory bulb sprayers, told apart by collar (the plates use the same names)
    "Ivory + Gold": "#efe3cb",
    "Ivory + Silver": "#eceae4",
    "Turquoise": "#40C4AA",
    "Standard": "#AAAAAA",
    "Black with Dots": "#1D1D1F",
    "Pink with Dots": "#F4A7B9",
    "Silver with Dots": "#C8C8C8",

    // ── Spray (Vintage Bulb Sprayer / Antique Spray) prefixed labels ─
    "Spray Black": "#1D1D1F",
    "Spray White": "#F5F5F0",
    "Spray Red": "#C41E3A",
    "Spray Pink": "#F4A7B9",
    "Spray Lavender": "#E6E6FA",
    "Spray Gold": "#D4AF37",
    "Spray Shiny Gold": "#D4AF37",
    "Spray Matte Gold": "#C5A065",
    "Spray Silver": "#C8C8C8",
    "Spray Shiny Silver": "#C8C8C8",
    "Spray Matte Silver": "#ADADAD",
    "Spray Ivory Gold": "#D4AF37",
    "Spray Ivory Silver": "#C8C8C8",
    "Spray Copper": "#B87333",

    // ── Screw Cap (Reducer / Cap-Closure) prefixed labels ───────────
    "Screw Cap Black": "#1D1D1F",
    "Screw Cap Shiny Black": "#0D0D0D",
    "Screw Cap Matte Black": "#2D2D2D",
    "Screw Cap White": "#F5F5F0",
    "Screw Cap Gold": "#D4AF37",
    "Screw Cap Shiny Gold": "#D4AF37",
    "Screw Cap Matte Gold": "#C5A065",
    "Screw Cap Silver": "#C8C8C8",
    "Screw Cap Shiny Silver": "#C8C8C8",
    "Screw Cap Matte Silver": "#ADADAD",
    "Screw Cap Ivory Gold": "#D4AF37",
    "Screw Cap Ivory Silver": "#C8C8C8",
    "Screw Cap Copper": "#B87333",

    // ── Reducer leather wraps ───────────────────────────────────────
    "Black Leather": "#2A1F18",
    "Brown Leather": "#7A4A2B",
    "Light Brown Leather": "#B58356",
    "Ivory Leather": "#E8DCC4",
    "Pink Leather": "#D9A6A0",

    // ── Lotion Pump prefixed labels ─────────────────────────────────
    "Lotion Pump Shiny Black": "#0D0D0D",
    "Lotion Pump Matte Black": "#2D2D2D",
    "Lotion Pump Shiny Gold": "#D4AF37",
    "Lotion Pump Matte Gold": "#C5A065",
    "Lotion Pump Shiny Silver": "#C8C8C8",
    "Lotion Pump Matte Silver": "#ADADAD",
    "Lotion Pump Copper": "#B87333",
    "Lotion Pump Clear Overcap": "#E8E8E8",
    "Lotion Pump White Clear Overcap": "#F0EAE0",

    // ── Roller / Roll-on prefixed labels ────────────────────────────
    "Roller Black": "#1D1D1F",
    "Roller Shiny Black": "#0D0D0D",
    "Roller Matte Black": "#2D2D2D",
    "Roller White": "#F5F5F0",
    "Roller Shiny Gold": "#D4AF37",
    "Roller Matte Gold": "#C5A065",
    "Roller Shiny Silver": "#C8C8C8",
    "Roller Matte Silver": "#ADADAD",
    "Roller Copper": "#B87333",

    // ── Dropper prefixed labels ─────────────────────────────────────
    "Dropper Shiny Black": "#0D0D0D",
    "Dropper Shiny Gold": "#D4AF37",
    "Dropper Shiny Silver": "#C8C8C8",
    "Dropper Matte Silver": "#ADADAD",
    "Dropper Copper": "#B87333",
    "Dropper White": "#F5F5F0",
    "Dropper Black": "#1D1D1F",
};

/**
 * Resolve a swatch hex by trying exact match first, then stripping common
 * applicator prefixes ("Spray ", "Screw Cap ", "Lotion Pump ", "Roller ",
 * "Dropper ") and looking up the remainder. Catches new compound labels
 * without needing every permutation in the static table above.
 *
 * Falls back to GLASS_COLOR_SWATCH (since some products use a single field
 * for both glass and cap), then to a neutral gray.
 */
const SWATCH_PREFIX_PATTERNS = [
    /^Spray\s+/i,
    /^Screw\s+Cap\s+/i,
    /^Lotion\s+Pump\s+/i,
    /^Perfume\s+(Spray\s+)?Pump\s+/i,
    /^Roller\s+/i,
    /^Roll[-\s]On\s+/i,
    /^Dropper\s+/i,
    /^Atomizer\s+/i,
    /^Reducer\s+/i,
    /^Vintage\s+Bulb\s+Sprayer(\s+with\s+Tassel)?\s+/i,
    /^Antique\s+Spray(\s+Tassel)?\s+/i,
    /^Cap[/\s]*Closure\s+/i,
    /\s+Tall$/i,
];
function resolveSwatchHex(label: string | null | undefined): string {
    if (!label) return "#AAAAAA";
    if (COLOR_SWATCH[label]) return COLOR_SWATCH[label];
    let trimmed = label;
    for (const pat of SWATCH_PREFIX_PATTERNS) {
        const next = trimmed.replace(pat, "").trim();
        if (next !== trimmed && next.length > 0) {
            if (COLOR_SWATCH[next]) return COLOR_SWATCH[next];
            trimmed = next;
        }
    }
    return GLASS_COLOR_SWATCH[label] ?? GLASS_COLOR_SWATCH[trimmed] ?? "#AAAAAA";
}
function isLightSwatch(label: string | null | undefined): boolean {
    if (!label) return false;
    if (LIGHT_SWATCHES.has(label)) return true;
    let trimmed = label;
    for (const pat of SWATCH_PREFIX_PATTERNS) {
        const next = trimmed.replace(pat, "").trim();
        if (next !== trimmed && next.length > 0) {
            if (LIGHT_SWATCHES.has(next)) return true;
            trimmed = next;
        }
    }
    return false;
}

// Light swatches that need a dark checkmark.
// Compound labels (e.g. "Spray White", "Lotion Pump Shiny Silver") are also
// resolved via isLightSwatch() which strips prefixes and re-checks.
const LIGHT_SWATCHES = new Set([
    "White", "Short White",
    "Silver", "Shiny Silver", "Matte Silver", "Silver with Dots",
    "Standard",
    "Pink", "Pink with Dots", "Rose Gold", "Lavender",
    "Ivory Gold", "Ivory Silver", "Ivory + Gold", "Ivory + Silver",
    "Ivory Leather",
    "Spray White", "Spray Pink", "Spray Lavender",
    "Spray Shiny Silver", "Spray Matte Silver", "Spray Silver",
    "Spray Ivory Silver", "Spray Ivory Gold",
    "Screw Cap White", "Screw Cap Shiny Silver", "Screw Cap Matte Silver",
    "Screw Cap Silver", "Screw Cap Ivory Silver", "Screw Cap Ivory Gold",
    "Lotion Pump Shiny Silver", "Lotion Pump Matte Silver",
    "Lotion Pump Clear Overcap", "Lotion Pump White Clear Overcap",
    "Roller White", "Roller Shiny Silver", "Roller Matte Silver",
    "Dropper White", "Dropper Shiny Silver", "Dropper Matte Silver",
]);

// Glass bottle body color hex map — used for sibling color navigation swatches
const GLASS_COLOR_SWATCH: Record<string, string> = {
    "Clear":   "rgba(200, 235, 245, 0.55)",
    "Amber":   "#C8720A",
    "Frosted": "#D8D8D8",
    "Cobalt Blue": "#5B87B5",
    "Blue":    "#5B87B5",
    "Cobalt":  "#5B87B5",
    "Green":   "#6B9A6B",
    "Black":   "#1D1D1F",
    "Purple":  "#7B5EA7",
    "Pink":    "#F4A7B9",
    "White":   "#F5F5F0",
    "Swirl":   "#B8D4E3",
};
const LIGHT_GLASS = new Set(["Clear", "Frosted", "White", "Pink", "Swirl"]);

function resolveGlassSwatchHex(color: string | null | undefined): string {
    if (!color) return "rgba(200, 235, 245, 0.55)";
    return GLASS_COLOR_SWATCH[color] ?? GLASS_COLOR_SWATCH[color.trim()] ?? "rgba(200, 235, 245, 0.55)";
}


const ATOMIZER_SHELL_MAP: Record<string, { label: string; hex: string; light: boolean }> = {
    black:    { label: "Black",    hex: "#1D1D1F", light: false },
    blue:     { label: "Blue",     hex: "#5B87B5", light: false },
    gold:     { label: "Gold",     hex: "#D4AF37", light: false },
    red:      { label: "Red",      hex: "#CC2936", light: false },
    silver:   { label: "Silver",   hex: "#C8C8C8", light: true },
    pink:     { label: "Pink",     hex: "#F4A7B9", light: true },
    green:    { label: "Green",    hex: "#3A7D44", light: false },
    lavender: { label: "Lavender", hex: "#B57EDC", light: true },
};

function getAtomizerShellInfo(variant: { itemName?: string | null }): { label: string; hex: string; useDarkCheck: boolean } {
    const name = (variant.itemName ?? "").toLowerCase();
    const hasDots = name.includes("with dots") || name.includes("dot pattern");
    const hasStars = name.includes("star pattern") || name.includes("stars");
    const pattern = hasDots ? " · Dots" : hasStars ? " · Stars" : "";
    const shellToken = name.split(/\s+(slim\s+)?atomizer/)[0]?.trim() ?? "";
    const match = ATOMIZER_SHELL_MAP[shellToken];
    if (match) return { label: match.label + pattern, hex: match.hex, useDarkCheck: match.light };
    return { label: "Standard", hex: "#AAAAAA", useDarkCheck: true };
}

const ROLLON_APPLICATORS = new Set([
    "Metal Roller Ball",
    "Plastic Roller Ball",
    "Metal Roller",
    "Plastic Roller",
]);

export interface ProductComponent {
    grace_sku: string;
    item_name: string;
    image_url?: string | null;
    price_1?: number | null;
    price_12?: number | null;
}

export interface ProductVariant {
    _id: string;
    graceSku: string;
    websiteSku: string;
    itemName: string;
    itemDescription: string | null;
    imageUrl: string | null;
    shopifyVariantId?: string | null;
    /** False when Shopify will refuse the sale (DRAFT/unpublished product). */
    shopifySellable?: boolean | null;
    /** Secondary gallery view — applicator/dropper/sprayer with cap removed. */
    imageUrlCapOff?: string | null;
    stockStatus: string | null;
    webPrice1pc: number | null;
    webPrice10pc: number | null;
    webPrice12pc: number | null;
    /** the REAL ladder — 5 case-oriented steps (1/12/144/300/1500) from the
     *  2026-08-06 site-truth sync. webPrice10pc/12pc understate it. */
    priceTiers?: Array<{ minQty: number; unitPrice: number; totalPrice?: number }> | null;
    category: string;
    family: string | null;
    shape: string | null;
    color: string | null;
    capacity: string | null;
    heightWithCap: string | null;
    heightWithoutCap: string | null;
    diameter: string | null;
    bottleWeightG: number | null;
    neckThreadSize: string | null;
    bottleCollection: string | null;
    caseQuantity: number | null;
    applicator: string | null;
    capStyle: string | null;
    capColor: string | null;
    trimColor: string | null;
    capHeight?: string | null;
    ballMaterial?: string | null;
    assemblyType?: string | null;
    componentGroup?: string | null;
    graceDescription?: string | null;
    productUrl?: string | null;
    components?: ProductComponent[] | null;
}

function canonicalSku(variant: ProductVariant | null | undefined): string | null {
    return variant?.graceSku?.trim() || variant?.websiteSku?.trim() || null;
}

/** How the guided resolver reads a variant; shared by the desktop commit and the mobile preview. */
const GUIDED_VARIANT_DEPS: GuidedVariantDeps<ProductVariant> = {
    sku: canonicalSku,
    capFinish: (variant) => resolveVariantCapFinish(variant).swatchName,
    applicator: (variant) => variant.applicator,
};

export function safePdpReturnPath(value: string | null): string | null {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
    try {
        const parsed = new URL(value, "https://bestbottles.invalid");
        return parsed.origin === "https://bestbottles.invalid" ? value : null;
    } catch {
        return null;
    }
}

function supportsSecondaryPdpImage(variant: ProductVariant): boolean {
    const isEmpire =
        variant.family === "Empire" ||
        /^GBEmp/i.test(variant.websiteSku) ||
        /Empire/i.test(variant.itemName);
    const applicatorText = `${variant.applicator ?? ""} ${variant.itemName}`.toLowerCase();
    if (isEmpire && /(vintage|antique).*(bulb|spray)/.test(applicatorText)) return false;
    return true;
}

function isBlockedProductImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    if (isLegacyBestBottlesImageUrl(value)) return true;
    try {
        return new URL(value).hostname === "cdn.sanity.io";
    } catch {
        return value.includes("cdn.sanity.io/") || value.includes("www.bestbottles.com/images/store/");
    }
}

function usableProductImageUrl(value: string | null | undefined): string | null {
    const url = value?.trim();
    if (!url || isBlockedProductImageUrl(url)) return null;
    return url;
}

function isShopifyCdnImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
        return new URL(value).hostname === "cdn.shopify.com";
    } catch {
        return value.includes("cdn.shopify.com/");
    }
}

function hasPreferredProductImage(variant: ProductVariant): boolean {
    return isShopifyCdnImageUrl(variant.imageUrl) || isShopifyCdnImageUrl(variant.imageUrlCapOff);
}

type VariantImageTile = {
    id: string;
    variant: ProductVariant;
    imageUrl: string;
    label: string;
    swatchHex: string;
    websiteSku: string;
    graceSku: string;
    productGroupSlug: string;
    shopifyVariantId?: string | null;
};

function getVariantTileImageUrl(variant: ProductVariant): string | null {
    const primary = usableProductImageUrl(variant.imageUrl);
    if (primary) return primary;
    if (
        variant.imageUrlCapOff &&
        supportsSecondaryPdpImage(variant)
    ) {
        return usableProductImageUrl(variant.imageUrlCapOff);
    }
    return null;
}

function getVariantTileLabel(variant: ProductVariant): string {
    const finish = resolveVariantCapFinish(variant);
    const trim = variant.trimColor && variant.trimColor !== "Standard" && variant.trimColor !== finish.swatchName
        ? variant.trimColor
        : null;
    return trim ? `${finish.label} / ${trim}` : finish.label;
}

function VariantImagePicker({
    tiles,
    selectedVariantId,
    onSelect,
}: {
    tiles: VariantImageTile[];
    selectedVariantId: string | null | undefined;
    onSelect: (variant: ProductVariant) => void;
}) {
    if (tiles.length <= 1) return null;

    const renderTile = (tile: VariantImageTile, mobile = false) => {
        const isSelected = selectedVariantId === tile.id;
        return (
            <button
                key={tile.id}
                type="button"
                onClick={() => onSelect(tile.variant)}
                title={`${tile.label} · ${tile.graceSku}`}
                aria-label={`Select ${tile.label} variant`}
                aria-pressed={isSelected}
                className={`
                    relative shrink-0 overflow-hidden rounded-sm bg-travertine
                    border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-obsidian
                    ${mobile ? "w-16 aspect-[10/11]" : "h-12 w-full"}
                    ${
                        isSelected
                            ? "border-obsidian ring-2 ring-muted-gold/45 shadow-sm"
                            : "border-champagne/60 hover:border-muted-gold"
                    }
                `}
            >
                <Image
                    src={tile.imageUrl}
                    alt=""
                    fill
                    sizes={mobile ? "64px" : "58px"}
                    data-bb-image-audit="pdp-variant-tile"
                    data-bb-family={tile.variant.family ?? undefined}
                    data-bb-product-group-slug={tile.productGroupSlug}
                    data-bb-grace-sku={tile.graceSku}
                    data-bb-website-sku={tile.websiteSku}
                    data-bb-shopify-variant-id={tile.shopifyVariantId ?? undefined}
                    className="object-cover"
                />
                <span
                    className="absolute bottom-1 left-1 h-3 w-3 rounded-full border border-white/90 shadow-sm"
                    style={getMaterialSwatchStyle(tile.label, { fallbackColor: tile.swatchHex })}
                    aria-hidden="true"
                />
                {isSelected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-obsidian/85 shadow-sm">
                        <Check
                            className="h-3 w-3 text-white"
                            strokeWidth={2.5}
                        />
                    </span>
                )}
            </button>
        );
    };

    return (
        <div data-testid="pdp-variant-image-picker">
            <div
                className="hidden lg:flex lg:w-[58px] lg:flex-col lg:gap-1.5 lg:overflow-y-auto lg:pr-1 lg:max-h-[760px]"
                aria-label="Variant image options"
            >
                {tiles.map((tile) => renderTile(tile))}
            </div>
            <div
                className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden"
                aria-label="Variant image options"
            >
                {tiles.map((tile) => renderTile(tile, true))}
            </div>
        </div>
    );
}

function SelectedVariantSummary({
    label,
    sku,
    swatchHex,
}: {
    label: string;
    sku?: string | null;
    swatchHex: string;
}) {
    return (
        <div className="mb-5 rounded-sm border border-champagne/60 bg-white px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-gold mb-2">
                Selected Option
            </p>
            <div className="flex items-start justify-between gap-4 sm:items-center">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <span
                        className="h-7 w-7 shrink-0 rounded-full border border-champagne shadow-sm"
                        style={getMaterialSwatchStyle(label, { fallbackColor: swatchHex })}
                        aria-hidden="true"
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-obsidian">
                            {label}
                        </p>
                        {sku && (
                            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate font-mono sm:hidden">
                                {sku}
                            </p>
                        )}
                    </div>
                </div>
                {sku && (
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-slate font-mono sm:inline">
                        {sku}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Spec Row ──────────────────────────────────────────────────────────────────

function TrustStack({ variant, inStock }: { variant: ProductVariant | null | undefined; inStock: boolean }) {
    const caseQty = variant?.caseQuantity ?? null;
    const stockLabel = inStock ? "Available to order" : "Confirm availability";

    return (
        <div className="mb-4 sm:mb-6">
            {/* Stock badge — intentionally avoids claiming live Shopify inventory until checkout resolves it. */}
            <span className={`inline-flex items-center px-3 py-1 text-[11px] uppercase tracking-wider font-bold rounded-full mb-3 ${inStock
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${inStock ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                {stockLabel}
            </span>

            {/* Trust rows — case pack + shipping. Quiet, scannable. */}
            <div className="space-y-1.5 text-sm">
                {caseQty && caseQty > 1 && (
                    <div className="flex items-center gap-2.5 text-obsidian">
                        <Package className="w-4 h-4 text-slate shrink-0" strokeWidth={1.5} />
                        <span>Case of <span className="font-semibold">{caseQty}</span> · order any quantity</span>
                    </div>
                )}
                {!caseQty && (
                    <div className="flex items-center gap-2.5 text-obsidian">
                        <Package className="w-4 h-4 text-slate shrink-0" strokeWidth={1.5} />
                        <span>Case quantity: <span className="font-semibold">confirm before ordering</span></span>
                    </div>
                )}
                <div className="flex items-center gap-2.5 text-obsidian">
                    <Truck className="w-4 h-4 text-slate shrink-0" strokeWidth={1.5} />
                    <span>Free shipping on orders over <span className="font-semibold">$99</span></span>
                </div>
            </div>
        </div>
    );
}

function VolumeTeaser({ variant }: { variant: ProductVariant | null | undefined }) {
    if (!variant?.webPrice1pc) return null;
    const tiers = buildDisplayVolumeTiers({
        webPrice1pc: variant.webPrice1pc,
        webPrice10pc: variant.webPrice10pc,
        webPrice12pc: variant.webPrice12pc,
        priceTiers: variant.priceTiers ?? null,
    });
    const quote = tiers.find((tier) => !tier.appliesAtCheckout);
    if (!quote) return null;

    return (
        <a
            href="#volume-pricing"
            data-testid="pdp-volume-teaser"
            className="mt-3 inline-flex flex-wrap items-baseline gap-x-2 text-sm text-slate hover:text-obsidian underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
        >
            <span>Volume from {quote.minQty.toLocaleString("en-US")}+</span>
            <span className="tabular-nums font-semibold text-obsidian">
                {formatPrice(quote.unitPrice)}/ea
            </span>
            <span>on quote</span>
        </a>
    );
}

function TierLadder({
    variant,
    qty,
    compact = false,
    onQtyChange,
}: {
    variant: ProductVariant | null | undefined;
    qty: number;
    compact?: boolean;
    onQtyChange?: (qty: number) => void;
}) {
    if (!variant?.webPrice1pc) return null;

    const p1 = variant.webPrice1pc;
    const tiers = buildDisplayVolumeTiers({
        webPrice1pc: variant.webPrice1pc,
        webPrice10pc: variant.webPrice10pc,
        webPrice12pc: variant.webPrice12pc,
        priceTiers: variant.priceTiers ?? null,
    });
    if (tiers.length === 0) return null;

    const activeIdx = activeVolumeTierIndex(tiers, qty);
    const next = tiers[activeIdx + 1];
    const unitsToNext = next ? next.minQty - qty : 0;
    const firstQuoteQty = tiers.find((tier) => !tier.appliesAtCheckout)?.minQty ?? null;
    const caseQty = variant.caseQuantity && variant.caseQuantity > 1 ? variant.caseQuantity : null;
    const quotedCaseUnit = caseQty
        ? tiers.reduce((price, tier) => (caseQty >= tier.minQty ? tier.unitPrice : price), p1)
        : null;

    const cell = compact ? "px-1.5 py-1.5" : "px-2 py-2.5";

    return (
        <div
            id="volume-pricing"
            style={{ scrollMarginTop: 120 }}
            className={`bg-travertine border border-champagne/60 rounded-sm ${compact ? "p-3" : "p-4 sm:p-5"}`}
        >
            <div className={`flex items-baseline justify-between gap-3 ${compact ? "mb-2" : "mb-3"}`}>
                <p className="text-xs uppercase tracking-wider font-bold text-slate">Volume pricing</p>
                {firstQuoteQty != null && (
                    <p className="text-[11px] text-slate">Quote {firstQuoteQty.toLocaleString("en-US")}+</p>
                )}
            </div>

            <table className="w-full border-collapse" data-testid="pdp-volume-tier-table">
                <caption className="sr-only">
                    Quantity breaks with price per unit. Checkout uses the 1-unit rate
                    {firstQuoteQty != null ? `; ${firstQuoteQty}+ rates are confirmed on a quote` : ""}.
                </caption>
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate border-b border-champagne/70">
                        <th scope="col" className={`${cell} text-left font-semibold`}>Quantity</th>
                        <th scope="col" className={`${cell} text-right font-semibold`}>Price / unit</th>
                        {!compact ? <th scope="col" className={`${cell} text-right font-semibold`}>At break</th> : null}
                        <th scope="col" className={`${cell} text-right font-semibold`}>Save</th>
                        <th scope="col" className={`${cell} text-right font-semibold`}>Path</th>
                    </tr>
                </thead>
                <tbody>
                    {tiers.map((tier, index) => {
                        const active = index === activeIdx;
                        const range = formatVolumeQtyRange(tier.minQty, tier.maxQty);
                        const rowClass = `border-b border-champagne/40 last:border-b-0 ${active ? "bg-white" : ""}`;
                        const qtyControl = onQtyChange ? (
                            <button
                                type="button"
                                onClick={() => onQtyChange(tier.minQty)}
                                aria-current={active ? "true" : undefined}
                                aria-label={`Set quantity to ${tier.minQty.toLocaleString("en-US")}`}
                                className={`text-left tabular-nums underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold ${
                                    active ? "font-semibold text-obsidian" : "text-obsidian"
                                }`}
                            >
                                {range}
                            </button>
                        ) : (
                            <span className={`tabular-nums ${active ? "font-semibold text-obsidian" : "text-obsidian"}`}>
                                {range}
                            </span>
                        );

                        return (
                            <tr key={tier.minQty} className={rowClass} data-volume-tier-active={active ? "true" : "false"}>
                                <th scope="row" className={`${cell} text-left text-sm font-normal`}>
                                    {qtyControl}
                                </th>
                                <td className={`${cell} text-right text-sm tabular-nums ${active ? "font-bold text-obsidian" : "font-semibold text-obsidian"}`}>
                                    {formatPrice(tier.unitPrice)}
                                    <span className="ml-0.5 font-normal text-slate">/ea</span>
                                </td>
                                {!compact ? (
                                    <td className={`${cell} text-right text-sm tabular-nums text-obsidian`}>
                                        {formatPrice(tier.unitPrice * tier.minQty)}
                                    </td>
                                ) : null}
                                <td className={`${cell} text-right text-xs tabular-nums ${tier.savePct > 0 ? "text-emerald-800" : "text-slate"}`}>
                                    {tier.savePct > 0
                                        ? compact
                                            ? `${tier.savePct}%`
                                            : `${tier.savePct}% · ${formatPrice(tier.saveEach)}`
                                        : "—"}
                                </td>
                                <td className={`${cell} text-right text-[10px] uppercase tracking-wider font-semibold ${
                                    tier.appliesAtCheckout ? "text-obsidian" : "text-slate"
                                }`}>
                                    {tier.appliesAtCheckout ? "Checkout" : "Quote"}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {caseQty && quotedCaseUnit != null && onQtyChange ? (
                <button
                    type="button"
                    onClick={() => onQtyChange(caseQty)}
                    data-testid="pdp-volume-case-shortcut"
                    className={`mt-2 w-full text-left rounded-sm border border-champagne/70 bg-white hover:border-muted-gold/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold ${
                        compact ? "px-2 py-1.5" : "px-3 py-2.5"
                    }`}
                >
                    <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-obsidian">
                            1 case
                            <span className="text-slate"> · {caseQty.toLocaleString("en-US")} units</span>
                        </span>
                        <span className="text-sm tabular-nums text-obsidian">
                            {formatPrice(quotedCaseUnit)}
                            <span className="ml-0.5 text-slate">/ea</span>
                            <span className="ml-2 text-slate">{formatPrice(quotedCaseUnit * caseQty)}</span>
                        </span>
                    </span>
                </button>
            ) : null}

            {VOLUME_TIERS_HONORED_AT_CHECKOUT ? (
                next && unitsToNext > 0 && unitsToNext <= 11 && (
                    <p className="text-xs text-muted-gold mt-3 leading-relaxed">
                        Add <span className="font-bold">{unitsToNext}</span> more to unlock {formatPrice(next.unitPrice)}/ea
                        <span className="text-slate"> · save {next.savePct}%</span>
                    </p>
                )
            ) : (
                <p className={`text-xs text-slate leading-relaxed ${compact ? "mt-2" : "mt-3"}`}>
                    {compact
                        ? `Checkout bills ${formatPrice(p1)}/ea. Quote ${firstQuoteQty != null ? `${firstQuoteQty}+` : "volume"} rates.`
                        : <>
                            Volume rates are confirmed on a quote — online checkout is billed at
                            the {formatPrice(p1)}/ea rate.{" "}
                            <span className="font-semibold text-obsidian">Request a quote</span> for
                            {firstQuoteQty != null ? ` ${firstQuoteQty}+ ` : " volume "}
                            pricing.
                        </>}
                </p>
            )}
        </div>
    );
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
    if (value == null || value === "") return null;
    return (
        <div className="flex items-start justify-between py-3.5 border-b border-champagne/50">
            <dt className="text-xs uppercase tracking-wider font-bold text-slate">{label}</dt>
            <dd className="text-sm text-obsidian font-medium text-right max-w-[55%]">{value}</dd>
        </div>
    );
}

function PdpLoadingSkeleton() {
    return (
        <main className="min-h-screen bg-bone">
            <Navbar hideMobileSearch />
            <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px]">
                <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-20 items-start">
                        <div className="aspect-[10/11] rounded-sm border border-champagne/50 bg-travertine animate-pulse" />
                        <div>
                            <div className="h-3 w-32 rounded bg-muted-gold/25 animate-pulse mb-4" />
                            <div className="h-10 w-4/5 rounded bg-champagne/40 animate-pulse mb-4" />
                            <div className="h-5 w-2/3 rounded bg-champagne/25 animate-pulse mb-6" />
                            <div className="grid grid-cols-2 gap-2 mb-6">
                                {["Neck size", "Capacity", "Case quantity", "Selected SKU"].map((label) => (
                                    <div key={label} className="rounded-sm border border-champagne/40 bg-white p-3">
                                        <p className="text-[9px] uppercase tracking-wider text-slate font-bold">{label}</p>
                                        <div className="mt-2 h-4 w-2/3 rounded bg-champagne/30 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                            <div className="h-12 w-full rounded-sm bg-obsidian/20 animate-pulse" />
                            <p className="mt-4 text-xs uppercase tracking-widest font-semibold text-slate">
                                Preparing product details and fitment data
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

// ── Main PDP ──────────────────────────────────────────────────────────────────

export interface ProductGroupPayload {
    group: {
        _id: string;
        slug: string;
        displayName: string;
        family: string;
        capacity?: string | null;
        capacityMl?: number | null;
        color?: string | null;
        category?: string | null;
        bottleCollection?: string | null;
        neckThreadSize?: string | null;
        variantCount?: number | null;
        priceRangeMin?: number | null;
        priceRangeMax?: number | null;
        heroImageUrl?: string | null;
        primaryWebsiteSku?: string | null;
        primaryGraceSku?: string | null;
        groupDescription?: string | null;
        applicatorTypes?: string[];
    };
    variants: ProductVariant[];
}

export interface SiblingGroup {
    _id: string;
    slug: string;
    color: string | null;
    displayName: string;
}

export default function ProductDetailClient({
    platesBySku = {},
    slug,
    initialData,
    initialPdpBlocks = [],
    initialRelations = null,
    initialCompatibility = null,
    siblingGroups = [],
}: {
    slug: string;
    initialData: ProductGroupPayload | null;
    initialPdpBlocks?: PdpBlock[];
    initialRelations?: FocusedPdpRelations | null;
    initialCompatibility?: PdpCompatibilityPayload | null;
    siblingGroups?: SiblingGroup[];
    /** static paper-doll plates for this catalogue, keyed by graceSku or websiteSku (the productPlates index; bytes on Vercel Blob) */
    platesBySku?: Record<string, { image: string; imageCapOff: string | null }>;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { openPanel: openGracePanel } = useGrace();
    const legacyRouteOverride = getLegacyProductRouteOverride(slug);
    const activeSlug = legacyRouteOverride ?? slug;
    const applicatorParam = searchParams.get("applicator");
    const selectedVariantParam = searchParams.get("sku");
    const selectedPdpPageUrl = useMemo(() => {
        const query = searchParams.toString();
        return `${pathname}${query ? `?${query}` : ""}`;
    }, [pathname, searchParams]);
    const safeFrom = safePdpReturnPath(searchParams.get("from"));
    const qtyParam = Math.max(1, Math.min(9999, parseInt(searchParams.get("qty") ?? "1") || 1));

    const data = initialData;

    const { addItems, itemCount } = useCart();

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [selectedApplicator, setSelectedApplicator] = useState<string | null>(null);
    const [selectedCapColor, setSelectedCapColor] = useState<string | null>(null);
    const [selectedCapStyle, setSelectedCapStyle] = useState<string | null>(null);
    const [selectedTrimColor, setSelectedTrimColor] = useState<string | null>(null);
    const [selectedCapComponentSku, setSelectedCapComponentSku] = useState<string | null>(null);

    const [qty, setQty] = useState(qtyParam);
    const [addedFlash, setAddedFlash] = useState(false);
    const [pdpBlocks, setPdpBlocks] = useState<PdpBlock[]>(initialPdpBlocks);
    const [stickyBarVisible, setStickyBarVisible] = useState(false);
    const inlineCartRef = useRef<HTMLDivElement>(null);
    const pendingPdpAnalyticsNavigation = useRef<PendingPdpAnalyticsNavigation | null>(null);

    useEffect(() => {
        if (!legacyRouteOverride) return;
        const qs = searchParams.toString();
        router.replace(`/products/${legacyRouteOverride}${qs ? `?${qs}` : ""}`);
    }, [legacyRouteOverride, router, searchParams]);

    const group = data?.group;
    const variants = useMemo(() => {
        const rawVariants = (data?.variants as ProductVariant[] | undefined) ?? [];
        return filterVariantsForProductGroup(data?.group, rawVariants);
    }, [data?.group, data?.variants]);
    const isRollonGroup = /roll-?on/.test(activeSlug);
    const variantFromUrl = useMemo(
        () => selectedVariantParam
            ? variants.find((variant) => variant.websiteSku === selectedVariantParam || variant.graceSku === selectedVariantParam) ?? null
            : null,
        [selectedVariantParam, variants],
    );
    useEffect(() => {
        if (!selectedVariantParam) {
            setSelectedVariantId(null);
            setSelectedApplicator(null);
            setSelectedCapColor(null);
            setSelectedCapStyle(null);
            setSelectedTrimColor(null);
            setSelectedCapComponentSku(null);
            return;
        }
        if (!variantFromUrl) {
            setSelectedVariantId(null);
            setSelectedApplicator(null);
            setSelectedCapColor(null);
            setSelectedCapStyle(null);
            setSelectedTrimColor(null);
            setSelectedCapComponentSku(null);
            return;
        }
        const finish = resolveVariantCapFinish(variantFromUrl);
        setSelectedVariantId(variantFromUrl._id);
        setSelectedApplicator(variantFromUrl.applicator ?? null);
        setSelectedCapColor(finish.swatchName);
        setSelectedCapStyle(variantFromUrl.capStyle ?? null);
        setSelectedTrimColor(variantFromUrl.trimColor || "Standard");
        setSelectedCapComponentSku(null);
    }, [selectedVariantParam, variantFromUrl]);

    // Atomizer family flag — these remain simplified until variant/color data is normalized.
    const isAtomizer = useMemo(() =>
        (group?.family ?? "").toLowerCase().includes("atomizer"),
        [group]
    );

    // ── Derived selector options ─────────────────────────────────────────────

    // Applicator options — excludes "Cap/Closure" (handled separately)
    // Glass Rod is for 18-400 bottles (e.g. Boston Round 15ml), NOT 17-415 (9ml Cylinder)
    const applicatorOptions = useMemo(() => {
        const seen = new Set<string>();
        const bottleThread = group?.neckThreadSize ?? "";
        return variants
            .map((v) => v.applicator)
            .filter((a): a is string => !!a && a !== "Cap/Closure")
            .filter((a) => {
                if (isRollonGroup && !ROLLON_APPLICATORS.has(a)) return false;
                if (a === "Glass Rod" && bottleThread === "17-415") return false;
                if (seen.has(a)) return false;
                seen.add(a);
                return true;
            });
    }, [variants, group?.neckThreadSize, isRollonGroup]);

    // Whether any variant has no applicator (plain cap closure)
    const hasCapClosure = useMemo(() =>
        variants.some((v) => v.applicator === "Cap/Closure"),
        [variants]
    );

    // Default applicator: URL param (Option A) > user selection > first option > cap closure
    const defaultFromUrl = useMemo(() => {
        if (!applicatorParam) return null;
        if (applicatorParam === "capclosure" && hasCapClosure) return "Cap/Closure";
        const bucket = APPLICATOR_BUCKETS.find((b) => b.value === applicatorParam);
        if (!bucket) return null;
        const match = applicatorOptions.find((opt) => (bucket.productValues as readonly string[]).includes(opt));
        return match ?? null;
    }, [applicatorParam, applicatorOptions, hasCapClosure]);
    const validApplicatorParam = defaultFromUrl ? applicatorParam : null;
    const primaryVariant = useMemo(() => {
        const primaryWebsiteSku = group?.primaryWebsiteSku?.trim();
        const primaryGraceSku = group?.primaryGraceSku?.trim();
        const explicitPrimary = variants.find((variant) =>
            (primaryWebsiteSku && variant.websiteSku === primaryWebsiteSku) ||
            (primaryGraceSku && variant.graceSku === primaryGraceSku)
        );
        // The guided stage leads with the plate for the selected SKU. When
        // the group's nominal primary has none (the Diva tassel's primary is
        // a decorative-ring SKU that was never photographed), open on the
        // first variant that does, so the customer meets a photograph, not
        // a fallback.
        const hasPlate = (variant: ProductVariant) =>
            Boolean(platesBySku[variant.graceSku] ?? (variant.websiteSku ? platesBySku[variant.websiteSku] : undefined));
        if (explicitPrimary && hasPlate(explicitPrimary)) return explicitPrimary;
        return variants.find(hasPlate) ?? explicitPrimary ?? variants.find(hasPreferredProductImage) ?? null;
    }, [variants, group?.primaryWebsiteSku, group?.primaryGraceSku, platesBySku]);

    // Guard stale deep links like ?applicator=spray on non-spray groups (e.g. decorative cap bottles).
    useEffect(() => {
        if (!applicatorParam) return;
        if (validApplicatorParam) return;
        router.replace(`/products/${activeSlug}`);
    }, [applicatorParam, validApplicatorParam, router, activeSlug]);

    const activeApplicator = selectedApplicator && applicatorOptions.includes(selectedApplicator)
        ? selectedApplicator
        : variantFromUrl?.applicator ?? defaultFromUrl ??
            (primaryVariant?.applicator && (applicatorOptions.includes(primaryVariant.applicator) || primaryVariant.applicator === "Cap/Closure")
                ? primaryVariant.applicator
                : null) ??
            applicatorOptions[0] ??
            (hasCapClosure ? "Cap/Closure" : null);
    const variantsForApplicator = useMemo(
        () => variants.filter((v) => v.applicator === activeApplicator),
        [variants, activeApplicator]
    );

    // Cap color options — use resolved finish (DB capColor + SKU + itemName) so null capColor variants still list (e.g. MSLV/SSLV).
    const capColorOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter((v) => v.applicator === activeApplicator)
            .map((v) => resolveVariantCapFinish(v).swatchName)
            .filter((c) => {
                if (seen.has(c)) return false;
                seen.add(c);
                return true;
            });
    }, [variants, activeApplicator]);

    // Photographs of closures live in per-neck component families keyed by
    // SKU token; pills are keyed by catalogue colourway. Carry the token keys
    // each pill's variants spell so the guided page can join the two.
    const capOptionPhotoKeys = useMemo(
        () => buildCapOptionPhotoKeys(
            capColorOptions,
            variants.filter((v) => v.applicator === activeApplicator),
            (v) => resolveVariantCapFinish(v).swatchName,
        ),
        [capColorOptions, variants, activeApplicator],
    );

    const primaryCapColor = primaryVariant?.applicator === activeApplicator
        ? resolveVariantCapFinish(primaryVariant).swatchName
        : null;
    const activeCapColor = selectedCapColor ?? (primaryCapColor && capColorOptions.includes(primaryCapColor) ? primaryCapColor : null) ?? capColorOptions[0] ?? null;

    // Cap style options — filtered by applicator + resolved cap finish
    const capStyleOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter(
                (v) =>
                    v.applicator === activeApplicator &&
                    resolveVariantCapFinish(v).swatchName === activeCapColor,
            )
            .map((v) => v.capStyle)
            .filter((s): s is string => !!s)
            .filter((s) => {
                if (seen.has(s)) return false;
                seen.add(s);
                return true;
            });
    }, [variants, activeApplicator, activeCapColor]);

    const primaryCapStyle = primaryVariant?.applicator === activeApplicator &&
        resolveVariantCapFinish(primaryVariant).swatchName === activeCapColor
        ? primaryVariant.capStyle
        : null;
    const activeCapStyle = selectedCapStyle ?? (primaryCapStyle && capStyleOptions.includes(primaryCapStyle) ? primaryCapStyle : null) ?? capStyleOptions[0] ?? null;

    // Trim options — filtered by applicator + resolved cap finish + cap style
    const trimColorOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter((v) =>
                v.applicator === activeApplicator &&
                resolveVariantCapFinish(v).swatchName === activeCapColor &&
                (capStyleOptions.length === 0 || v.capStyle === activeCapStyle)
            )
            .map((v) => v.trimColor || "Standard")
            .filter((c) => {
                if (seen.has(c)) return false;
                seen.add(c);
                return true;
            });
    }, [variants, activeApplicator, activeCapColor, activeCapStyle, capStyleOptions]);

    const primaryTrimColor = primaryVariant?.applicator === activeApplicator &&
        resolveVariantCapFinish(primaryVariant).swatchName === activeCapColor &&
        (capStyleOptions.length === 0 || primaryVariant.capStyle === activeCapStyle)
        ? primaryVariant.trimColor || "Standard"
        : null;
    const activeTrimColor = selectedTrimColor ?? (primaryTrimColor && trimColorOptions.includes(primaryTrimColor) ? primaryTrimColor : null) ?? trimColorOptions[0] ?? null;

    // Resolved variant — 4-way match with graceful fallback
    const selectedVariant = useMemo(() => {
        const explicit = variantFromUrl ?? (selectedVariantId
            ? variantsForApplicator.find((v) => v._id === selectedVariantId)
            : null);
        if (explicit) return explicit;
        const hasPlate = (v: ProductVariant) =>
            Boolean(platesBySku[v.graceSku] ?? (v.websiteSku ? platesBySku[v.websiteSku] : undefined));
        // The colourway the customer just clicked is authoritative. Cap style and
        // trim narrow the choice only when the customer picked those too: their
        // defaults are derived from whichever colourway was selected before, and
        // several Diva bulb colourways are shared between a plain SKU and a
        // decorative-ring SKU that was never photographed (capColor "Clear",
        // capStyle "Tall"). Filtering on the derived default handed back the ring
        // SKU, so clicking Lavender, Red, Ivory or White changed nothing on the
        // stage. Among the colourway's variants, prefer one we can actually show.
        const narrow = (pool: ProductVariant[], keep: (v: ProductVariant) => boolean) => {
            const next = pool.filter(keep);
            return next.length > 0 ? next : pool;
        };
        let pool = variants.filter((v) => v.applicator === activeApplicator);
        if (pool.length === 0) pool = variants;
        pool = narrow(pool, (v) => resolveVariantCapFinish(v).swatchName === activeCapColor);
        if (selectedCapStyle) pool = narrow(pool, (v) => v.capStyle === selectedCapStyle);
        if (selectedTrimColor) pool = narrow(pool, (v) => (v.trimColor || "Standard") === selectedTrimColor);
        return pool.find(hasPlate) ?? pool.find((v) => usableProductImageUrl(v.imageUrl)) ?? pool[0] ?? variants[0] ?? null;
    }, [variants, variantsForApplicator, selectedVariantId, variantFromUrl, activeApplicator, activeCapColor, selectedCapStyle, selectedTrimColor, platesBySku]);

    // the plate for the selected SKU (productPlates index), by graceSku then websiteSku
    // first and websiteSku second -- the two keys the plate manifests carry
    const selectedPlate = selectedVariant
        ? platesBySku[selectedVariant.graceSku]
            ?? (selectedVariant.websiteSku ? platesBySku[selectedVariant.websiteSku] : undefined)
            ?? null
        : null;
    const selectedKitQuery = useQuery(
        api.productKits.forSku,
        selectedVariant?.graceSku || selectedVariant?.websiteSku
            ? { graceSku: selectedVariant.graceSku ?? null, websiteSku: selectedVariant.websiteSku ?? null }
            : "skip",
    );
    const selectedKit = resolveSelectedSkuKit({
        websiteSku: selectedVariant?.websiteSku,
        graceSku: selectedVariant?.graceSku,
    }, selectedKitQuery);

    const productDescription = chooseCanonicalProductDescription({
        groupDescription: group?.groupDescription ?? null,
        variantDescription: selectedVariant?.itemDescription ?? null,
        graceDescription: selectedVariant?.graceDescription ?? null,
        applicators: selectedVariant?.applicator
            ? [selectedVariant.applicator]
            : group?.applicatorTypes ?? [],
    });

    const variantSwatchPreview = useMemo(() => {
        return variantsForApplicator.map((v) => {
            const resolved = resolveVariantCapFinish(v);
            const swatchHex = resolveSwatchHex(resolved.swatchName);
            const useDarkCheck = isLightSwatch(resolved.swatchName) || LIGHT_GLASS.has(resolved.swatchName);
            return {
                id: v._id,
                graceSku: v.graceSku,
                websiteSku: v.websiteSku,
                displayLabel: resolved.label,
                swatchHex,
                useDarkCheck,
                variantId: v._id as string | undefined,
                isComponentOnly: false,
            };
        });
    }, [variantsForApplicator]);

    // Cap swatches contain only actual buyable variants, so every selection
    // resolves to the selected SKU's price, availability, and transaction path.
    const capSwatchPreview = useMemo(() => variantSwatchPreview, [variantSwatchPreview]);

    const variantImageTiles = useMemo<VariantImageTile[]>(() => {
        const seen = new Set<string>();
        const tiles: VariantImageTile[] = [];
        for (const variant of variantsForApplicator) {
            if (seen.has(variant._id)) continue;
            const imageUrl = getVariantTileImageUrl(variant);
            if (!imageUrl) continue;

            seen.add(variant._id);
            const finish = resolveVariantCapFinish(variant);
            const swatchName = finish.swatchName;
            tiles.push({
                id: variant._id,
                variant,
                imageUrl,
                label: getVariantTileLabel(variant),
                swatchHex: resolveSwatchHex(swatchName),
                websiteSku: variant.websiteSku,
                graceSku: variant.graceSku,
                productGroupSlug: group?.slug ?? activeSlug,
                shopifyVariantId: variant.shopifyVariantId,
            });
        }
        return tiles;
    }, [activeSlug, group?.slug, variantsForApplicator]);
    const hasVariantImagePicker = variantImageTiles.length > 1;
    // configurator families: the 3D IS the imagery — no variant tile rail.
    // A registered family always takes the guided page; any other group whose
    // SKUs carry plates takes it too, as a photo-only family read off its slug
    // (2 Sep: 13-415 went live on prod and its pages still showed the Shopify
    // photo, because the guided page was gated on the hand-kept registry).
    const groupHasPlates = useMemo(
        () => variants.some((v) => Boolean(platesBySku[v.graceSku] ?? (v.websiteSku ? platesBySku[v.websiteSku] : undefined))),
        [variants, platesBySku]);
    const approvedGeometryFamily = familyForSlug(group?.slug ?? "");
    const is3dFamily = approvedGeometryFamily !== null
        || (groupHasPlates && familyForSlugOrDerived(group?.slug ?? "") !== null);
    const hasApproved3d = Boolean(approvedGeometryFamily && !approvedGeometryFamily.photoOnly);
    const focusedPdpCapabilities = useMemo(() => resolveFocusedPdpCapabilities({
        hasVariants: variants.length > 0,
        hasApprovedPhoto: Boolean(usableProductImageUrl(group?.heroImageUrl))
            || variants.some((variant) => Boolean(usableProductImageUrl(variant.imageUrl))),
        hasPlate: groupHasPlates,
        hasApproved3d,
        // A pending kit query is not negative truth. Once it resolves, this same
        // selected-SKU value governs both the shell and its stage modes.
        hasReleasedKit: Boolean(selectedKit?.parts?.length),
        hasDimensions: variants.some((variant) => Boolean(
            variant.heightWithCap?.trim()
            || variant.heightWithoutCap?.trim()
            || variant.diameter?.trim(),
        )),
    }), [group?.heroImageUrl, groupHasPlates, hasApproved3d, selectedKit, variants]);
    const isFocusedPurchasePdp = focusedPdpCapabilities.canRenderFocusedShell;
    const hasCompleteVariantImagePicker =
        hasVariantImagePicker && variantImageTiles.length === variantsForApplicator.length;

    const selectVariantFromImage = useCallback((variant: ProductVariant) => {
        const finish = resolveVariantCapFinish(variant);
        setSelectedVariantId(variant._id);
        setSelectedApplicator(variant.applicator ?? null);
        setSelectedCapColor(finish.swatchName);
        setSelectedCapStyle(variant.capStyle ?? null);
        setSelectedTrimColor(variant.trimColor || "Standard");
        setSelectedCapComponentSku(null);
    }, []);

    const customerFacingName = useMemo(
        () => group
            ? getCustomerFacingProductName({
                group,
                variant: selectedVariant,
                fallbackName: group.displayName,
            })
            : null,
        [group, selectedVariant],
    );
    const customerDisplayName = customerFacingName?.displayName ?? group?.displayName ?? selectedVariant?.itemName ?? "";

    const breadcrumbsSteps = useMemo(() => {
        if (!group) return [];
        const steps: BreadcrumbStep[] = [
            { label: "Catalog", href: "/catalog" }
        ];

        if (validApplicatorParam) {
            const applicatorLabel = APPLICATOR_BUCKETS.find((b) => b.value === validApplicatorParam)?.label ?? validApplicatorParam;
            steps.push({
                label: `${applicatorLabel} Bottles`,
                href: `/catalog?applicators=${encodeURIComponent(validApplicatorParam)}`
            });
        }

        if (group.family) {
            const applicatorQuery = validApplicatorParam ? `&applicators=${encodeURIComponent(validApplicatorParam)}` : "";
            steps.push({
                label: group.family,
                href: `/catalog?families=${encodeURIComponent(group.family)}${applicatorQuery}`
            });
        }

        steps.push({ label: customerDisplayName });
        return steps;
    }, [group, validApplicatorParam, customerDisplayName]);

    const uniqueColorGroups = useMemo(() => {
        if (!group) return [];
        const seenColors = new Set<string>();
        const list = [];

        const currentColor = group.color ?? "Clear";
        seenColors.add(currentColor.toLowerCase());
        list.push({
            slug: activeSlug,
            color: currentColor,
            displayName: group.displayName || "",
            isActive: true
        });

        for (const sib of siblingGroups) {
            const sibColor = sib.color ?? "Clear";
            const key = sibColor.toLowerCase();
            if (!seenColors.has(key)) {
                seenColors.add(key);
                list.push({
                    slug: sib.slug,
                    color: sibColor,
                    displayName: sib.displayName,
                    isActive: false
                });
            }
        }
        return list;
    }, [group, activeSlug, siblingGroups]);

    const sameApplicationGroups = useMemo(() => {
        if (!group) return [];
        return [
            { slug: group.slug, color: group.color, heroImageUrl: group.heroImageUrl ?? null },
            ...siblingGroups.map((sibling) => ({ slug: sibling.slug, color: sibling.color, heroImageUrl: null })),
        ];
    }, [group, siblingGroups]);

    // The glass colourways this family sells, this group first. One list feeds
    // the desktop configurator's glass step and the mobile glass picker.
    const guidedGlassOptions = useMemo(() => {
        if (!group?.slug) return [];
        const f = familyForSlugOrDerived(group.slug);
        if (!f) {
            return uniqueColorGroups.map((item) => ({
                id: item.color.toLowerCase(),
                label: item.color,
                href: `/products/${item.slug}`,
                active: item.isActive,
            }));
        }
        if (f.derived) {
            // the colourways are the sibling groups the catalogue has,
            // labelled by their own colour, this group first
            const seen = new Set<string>();
            const out: Array<{ id: string; label: string; href: string; active: boolean; imageUrl?: string | null }> = [];
            const push = (slug: string, color: string | null, imageUrl: string | null, active: boolean) => {
                const token = colourTokenFromSlug(slug) ?? slug;
                if (seen.has(token)) return;
                seen.add(token);
                out.push({ id: PRESET_FOR_COLOUR[token] ?? token, label: color ?? "Clear", href: `/products/${slug}`, active, imageUrl });
            };
            push(group.slug, group.color ?? null, group.heroImageUrl ?? null, true);
            for (const sib of siblingGroups) push(sib.slug, sib.color, null, false);
            return out;
        }
        const token = closureTokenFromSlug(f, group.slug);
        const current = glassFromSlug(f, group.slug);
        return f.glasses.flatMap((g) => {
            const colour = f.slugColour[g];
            const slug = colour ? f.buildSlug(colour, token) : null;
            const sibling = sameApplicationGroups.find((candidate) => candidate.slug === slug);
            if (!slug || !sibling) return [];
            return [{
                id: g,
                label: GLASS_PRESETS[g].label,
                href: `/products/${slug}`,
                active: g === current,
                imageUrl: sibling.heroImageUrl,
            }];
        });
    }, [group?.slug, group?.color, group?.heroImageUrl, siblingGroups, uniqueColorGroups, sameApplicationGroups]);

    // Mobile PDP: the sticky bar hides while a picker is open, and its anchor is
    // the mobile purchase block (the desktop anchor is display:none below md).
    const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
    const mobileCartRef = useRef<HTMLDivElement>(null);


    const selectedVariantSummary = useMemo(() => {
        if (!selectedVariant || !hasVariantImagePicker) return null;
        const finish = resolveVariantCapFinish(selectedVariant);
        return {
            label: customerFacingName?.variantLabel ?? getVariantTileLabel(selectedVariant),
            sku: canonicalSku(selectedVariant),
            swatchHex: resolveSwatchHex(finish.swatchName),
        };
    }, [customerFacingName?.variantLabel, selectedVariant, hasVariantImagePicker]);

    const showTrimSelector = useMemo(() => {
        if (hasCompleteVariantImagePicker) return false;
        if (trimColorOptions.length === 0) return false;
        if (trimColorOptions.length === 1 && trimColorOptions[0] === "Standard") return false;
        return true;
    }, [trimColorOptions, hasCompleteVariantImagePicker]);

    // ── Roller type toggle for roll-on groups ─────────────────────────────────
    const rollerTypeOptions = useMemo(() => {
        if (!isRollonGroup || applicatorOptions.length < 2) return [];
        // Normalize to "Metal" / "Plastic" labels
        return applicatorOptions.map((a) => ({
            value: a,
            label: /metal/i.test(a) ? "Metal Roller" : /plastic/i.test(a) ? "Plastic Roller" : a,
        }));
    }, [isRollonGroup, applicatorOptions]);

    // The guided page's Stainless / Plastic chooser drives the same applicator
    // switch as the classic roller chips: metal and plastic rollers are
    // separate SKUs, so the plate, price and resolved SKU must follow.
    const rollerVariantForGuided: "metal" | "plastic" | undefined =
        /metal/i.test(activeApplicator ?? "") ? "metal" : /plastic/i.test(activeApplicator ?? "") ? "plastic" : undefined;
    const rollerVariantsAvailable = useMemo<Array<"metal" | "plastic">>(
        () => rollerTypeOptions.map((opt) => (/metal/i.test(opt.value) ? "metal" : "plastic")),
        [rollerTypeOptions],
    );
    const handleRollerVariantChange = useCallback((variant: "metal" | "plastic") => {
        const opt = rollerTypeOptions.find((o) => (variant === "metal") === /metal/i.test(o.value));
        if (!opt) return;
        // Pin the finish the customer is looking at, then switch material: the
        // resolver narrows to that colourway in the other material when it
        // exists (Shiny Black metal → Shiny Black plastic) and falls back to
        // the pool when it does not. Without the pin the switch landed on the
        // other material's first colourway.
        if (activeCapColor) setSelectedCapColor(activeCapColor);
        setSelectedApplicator(opt.value);
        setSelectedVariantId(null);
    }, [rollerTypeOptions, activeCapColor]);

    const canonicalVariantUrl = useCallback((variant: ProductVariant) => {
        const sku = canonicalSku(variant);
        if (!sku) return null;
        const params = new URLSearchParams();
        params.set("sku", sku);
        if (qty > 1) params.set("qty", String(qty));
        if (safeFrom) params.set("from", safeFrom);
        return `/products/${activeSlug}?${params.toString()}`;
    }, [activeSlug, qty, safeFrom]);

    const handleGuidedVariantSelection = useCallback((selection: { rollerVariant?: "metal" | "plastic"; capOption?: string }) => {
        const nextApplicator = selection.rollerVariant
            ? rollerTypeOptions.find((option) => (selection.rollerVariant === "metal") === /metal/i.test(option.value))?.value ?? activeApplicator
            : activeApplicator;
        const nextCapOption = selection.capOption ?? activeCapColor;
        // The same rule the mobile picker previews with, so a preview and its
        // confirmation land on the same variant.
        const resolved = resolveGuidedVariant(variants, { applicator: nextApplicator, capOption: nextCapOption }, GUIDED_VARIANT_DEPS);
        if (!resolved) return;

        setSelectedApplicator(nextApplicator ?? null);
        setSelectedVariantId(resolved._id);
        setSelectedCapColor(resolveVariantCapFinish(resolved).swatchName);
        setSelectedCapStyle(resolved.capStyle ?? null);
        setSelectedTrimColor(resolved.trimColor || "Standard");

        const nextUrl = canonicalVariantUrl(resolved);
        if (nextUrl) {
            const dimension: PdpAnalyticsDimension = selection.rollerVariant ? "rollerMaterial" : "capFinish";
            pendingPdpAnalyticsNavigation.current = createPendingPdpAnalyticsNavigation({
                currentSlug: activeSlug,
                currentSku: variantFromUrl ? canonicalSku(variantFromUrl) : primaryVariant ? canonicalSku(primaryVariant) : null,
                targetSlug: activeSlug,
                targetSku: canonicalSku(resolved),
                dimension,
            });
            router.replace(nextUrl, { scroll: false });
        }
    }, [activeApplicator, activeCapColor, activeSlug, canonicalVariantUrl, primaryVariant, rollerTypeOptions, router, variantFromUrl, variants]);

    const handleGuidedProductUrlChange = useCallback((href: string) => {
        const target = new URL(href, "https://bestbottles.local");
        if (!target.pathname.startsWith("/products/")) return;
        if (safeFrom) target.searchParams.set("from", safeFrom);
        if (qty > 1) target.searchParams.set("qty", String(qty));
        router.replace(`${target.pathname}${target.search}`, { scroll: false });
    }, [qty, router, safeFrom]);

    useEffect(() => {
        const onPlate = (event: Event) => {
            const command = (event as CustomEvent<GracePdpPlateCommand>).detail;
            if (!isGracePdpPlateCommand(command)) return;

            if (command.sku) {
                const wanted = command.sku.trim();
                const resolved = variants.find((variant) =>
                    variant.websiteSku === wanted || variant.graceSku === wanted
                );
                if (!resolved) return;
                const nextUrl = canonicalVariantUrl(resolved);
                if (nextUrl) router.replace(nextUrl, { scroll: false });
                return;
            }

            if (command.capOption || command.rollerVariant) {
                const cap = command.capOption
                    ? matchListedOption(command.capOption, capColorOptions) ?? command.capOption
                    : undefined;
                handleGuidedVariantSelection({
                    rollerVariant: command.rollerVariant ?? undefined,
                    capOption: cap,
                });
            }
        };
        window.addEventListener(GRACE_PDP_PLATE_EVENT, onPlate);
        return () => window.removeEventListener(GRACE_PDP_PLATE_EVENT, onPlate);
    }, [canonicalVariantUrl, capColorOptions, handleGuidedVariantSelection, router, variants]);

    // ── Product view analytics ───────────────────────────────────────────────
    useEffect(() => {
        if (group) {
            analytics.productViewed({
                name: customerDisplayName,
                family: group.family,
                capacity: group.capacity ?? "",
                color: group.color ?? "",
                neckThreadSize: group.neckThreadSize ?? undefined,
                price: group.priceRangeMin ?? undefined,
                slug: activeSlug,
            });
        }
    }, [group, activeSlug, customerDisplayName]);

    // ── Bridge current PDP product data for global Grace widgets ────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        if (selectedVariant) {
            const globalWindow = window as Window & {
                __GRACE_PRODUCT_NAME__?: string;
                __GRACE_PRODUCT_SKU__?: string;
                __GRACE_THREAD_SIZE__?: string;
            };

            globalWindow.__GRACE_PRODUCT_NAME__ = customerDisplayName;
            globalWindow.__GRACE_PRODUCT_SKU__ = selectedVariant.graceSku ?? "";
            globalWindow.__GRACE_THREAD_SIZE__ = selectedVariant.neckThreadSize ?? "";
        }

        return () => {
            const globalWindow = window as Window & {
                __GRACE_PRODUCT_NAME__?: string;
                __GRACE_PRODUCT_SKU__?: string;
                __GRACE_THREAD_SIZE__?: string;
            };
            delete globalWindow.__GRACE_PRODUCT_NAME__;
            delete globalWindow.__GRACE_PRODUCT_SKU__;
            delete globalWindow.__GRACE_THREAD_SIZE__;
        };
    }, [customerDisplayName, selectedVariant]);

    const lastGracePdpContextSignature = useRef<string | null>(null);
    useEffect(() => {
        lastGracePdpContextSignature.current = null;
    }, [activeSlug]);
    useEffect(() => {
        if (!selectedVariant?.websiteSku || typeof window === "undefined") return;
        const rollerMaterial = /metal/i.test(selectedVariant.applicator ?? "")
            ? "metal"
            : /plastic/i.test(selectedVariant.applicator ?? "")
                ? "plastic"
                : undefined;
        const change = {
            websiteSku: selectedVariant.websiteSku,
            application: selectedVariant.applicator ?? undefined,
            glass: group?.color ?? undefined,
            rollerMaterial,
            finish: resolveVariantCapFinish(selectedVariant).label,
            pageUrl: selectedPdpPageUrl,
        } as const;
        const signature = JSON.stringify({
            websiteSku: change.websiteSku,
            application: change.application,
            glass: change.glass,
            rollerMaterial: change.rollerMaterial,
            finish: change.finish,
            pageUrl: change.pageUrl,
        });
        if (lastGracePdpContextSignature.current === signature) return;
        lastGracePdpContextSignature.current = signature;
        dispatchPdpContextChange(change);
    }, [group?.color, selectedPdpPageUrl, selectedVariant]);

    const lastTrackedPdpVariantSignature = useRef<string | null>(null);
    useEffect(() => {
        const sku = selectedVariant ? canonicalSku(selectedVariant) : null;
        const application = analyticsApplicationForApplicator(selectedVariant?.applicator);
        const resolution = resolveAndConsumePdpAnalyticsNavigation({
            slug: activeSlug,
            resolvedSku: sku,
            application,
            canonicalDefaultSku: primaryVariant ? canonicalSku(primaryVariant) : null,
            urlResolvedSku: variantFromUrl ? canonicalSku(variantFromUrl) : null,
            pendingNavigation: pendingPdpAnalyticsNavigation.current,
        });
        const { event } = resolution;
        if (!event) return;
        pendingPdpAnalyticsNavigation.current = resolution.pendingNavigation;
        const signature = `${event.slug}:${event.sku}:${event.application}`;
        if (lastTrackedPdpVariantSignature.current === signature) return;
        lastTrackedPdpVariantSignature.current = signature;
        analytics.pdpVariantResolved(event);
    }, [activeSlug, primaryVariant, selectedVariant, variantFromUrl]);

    const openGraceFromPdp = useCallback((options?: { enableVoice?: boolean }) => {
        const application = analyticsApplicationForApplicator(selectedVariant?.applicator);
        analytics.graceOpenedFromShopping({
            source: "pdp",
            ...(group?.family ? { family: group.family } : {}),
            ...(application ? { application } : {}),
        });
        openGracePanel({ source: "pdp", enableVoice: options?.enableVoice });
    }, [group?.family, openGracePanel, selectedVariant?.applicator]);

    // The mobile PDP hides the tab bar (Grace's usual mobile entry), so its inline
    // row is the only way in. Keep the tab bar's "Grace Mobile PDP Opened" series
    // continuous by firing it here with the product context the tab never had.
    const openGraceFromMobilePdp = useCallback(() => {
        analytics.graceMobilePdpOpened({
            pathname,
            ...(customerDisplayName ? { productName: customerDisplayName } : {}),
            ...(group?.family ? { productFamily: group.family } : {}),
        });
        openGraceFromPdp({ enableVoice: true });
    }, [customerDisplayName, group?.family, openGraceFromPdp, pathname]);

    // ── Sanity two-tier content (family template + product override) ──────────
    // Blocks are fetched server-side (page.tsx -> getPdpBlocks via sanityFetch) so
    // they carry draft content + stega click-to-edit overlays inside Presentation.
    // Sync from the server-provided props on navigation; never re-fetch here, which
    // would strip the overlays by overwriting with plain CDN content.
    useEffect(() => {
        setPdpBlocks(initialPdpBlocks);
    }, [initialPdpBlocks]);

    // ── Mobile sticky bar: only visible once inline Add to Cart scrolls out of view ──
    useEffect(() => {
        let frame = 0;
        const updateStickyBar = () => {
            // Both purchase blocks are mounted; only the one the breakpoint shows
            // has a box. A display:none anchor has no client rects.
            const el = [inlineCartRef.current, mobileCartRef.current]
                .find((candidate): candidate is HTMLDivElement => Boolean(candidate && candidate.getClientRects().length > 0))
                ?? inlineCartRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (el === mobileCartRef.current) {
                // Mobile PDP: one Add to Cart. The purchase block sits directly
                // under the configuration rows, so a second sticky button only
                // covers the rows it would lead to.
                setStickyBarVisible(false);
                return;
            }
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const bottomSafeArea = window.matchMedia("(max-width: 1023px)").matches ? 156 : 0;
            const headerSafeArea = 96;
            const inlineCartVisible =
                rect.bottom > headerSafeArea &&
                rect.top < viewportHeight - bottomSafeArea;
            setStickyBarVisible(!inlineCartVisible);
        };
        const scheduleUpdate = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(updateStickyBar);
        };

        scheduleUpdate();
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
        };
    }, [data, selectedVariant?._id]);

    // ── Loading state ────────────────────────────────────────────────────────

    if (data === undefined) {
        return <PdpLoadingSkeleton />;
    }

    // ── Not found state ──────────────────────────────────────────────────────

    if (!group) {
        return (
            <main className="min-h-screen bg-bone">
                <Navbar hideMobileSearch />
                <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px] max-w-[1440px] mx-auto px-4 sm:px-6 py-32 text-center">
                    <h1 className="font-serif text-4xl text-obsidian mb-4">Product Not Found</h1>
                    <p className="text-slate mb-8 text-sm">This product may have been moved or is no longer available.</p>
                    <Link
                        href="/catalog"
                        className="inline-flex items-center px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Browse Catalog
                    </Link>
                </div>
            </main>
        );
    }

    // A valid route can still resolve to no valid purchasable variants after
    // integrity filtering. Keep the recovery path honest: optional media is
    // irrelevant here, but cart, quote, quantity, and sticky purchase controls
    // cannot represent a product that does not exist to transact against.
    if (!focusedPdpCapabilities.isPurchasable) {
        return (
            <main className="min-h-screen bg-bone" data-testid="pdp-unavailable-state">
                <Navbar hideMobileSearch />
                <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px] max-w-[1440px] mx-auto px-4 sm:px-6 py-32 text-center">
                    <h1 className="font-serif text-4xl text-obsidian mb-4">Product currently unavailable</h1>
                    <p className="text-slate mb-8 text-sm">We could not find a purchasable configuration for this product. Grace can help you find the right bottle.</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <button type="button" onClick={() => openGraceFromPdp()} className="inline-flex items-center px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors">
                            Ask Grace
                        </button>
                        <Link href="/catalog" className="inline-flex items-center px-6 py-3 border border-obsidian text-obsidian uppercase text-xs font-bold tracking-wider hover:bg-obsidian hover:text-white transition-colors">
                            Browse Catalog
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const inStock = selectedVariant?.stockStatus === "In Stock";
    // A variant ID alone does not mean Shopify will sell it — a DRAFT or
    // unpublished parent product 410s at the /cart permalink. Respect the
    // synced sellability flag so these fall back to the quote path.
    const checkoutReady = selectedVariant
        ? isCheckoutReady({
            graceSku: selectedVariant.graceSku,
            shopifyVariantId: selectedVariant.shopifyVariantId ?? null,
            shopifySellable: selectedVariant.shopifySellable ?? undefined,
        })
        : false;
    const canAddToCart = inStock && checkoutReady && selectedVariant?.webPrice1pc != null;
    const quoteHref = `/request-quote?products=${encodeURIComponent(`${customerDisplayName} (SKU: ${selectedVariant?.graceSku ?? ""})`)}&quantities=${encodeURIComponent(`${qty} units`)}`;
    const handleAddToCart = () => {
        if (!selectedVariant || !canAddToCart) return;
        addItems([{
            graceSku: selectedVariant.graceSku,
            itemName: customerDisplayName,
            quantity: qty,
            unitPrice: selectedVariant.webPrice1pc ?? null,
            checkoutEligible: checkoutReady,
            shopifyVariantId: selectedVariant.shopifyVariantId ?? null,
            websiteSku: selectedVariant.websiteSku ?? null,
            variantId: selectedVariant._id,
            productGroupSlug: activeSlug,
            family: group?.family,
            capacity: group?.capacity ?? undefined,
            color: group?.color ?? undefined,
            applicator: selectedVariant.applicator,
            capColor: selectedVariant.capColor,
            category: group?.category,
            neckThreadSize: selectedVariant.neckThreadSize ?? group?.neckThreadSize ?? null,
            webPrice1pc: selectedVariant.webPrice1pc ?? null,
            webPrice10pc: selectedVariant.webPrice10pc ?? null,
            webPrice12pc: selectedVariant.webPrice12pc ?? null,
            priceTiers: selectedVariant.priceTiers ?? null,
        }]);
        analytics.cartItemAdded({
            sku: selectedVariant.graceSku,
            name: customerDisplayName,
            quantity: qty,
            unitPrice: selectedVariant.webPrice1pc,
            family: group?.family,
            capacity: group?.capacity ?? undefined,
            source: "pdp",
        });
        setAddedFlash(true);
        setTimeout(() => setAddedFlash(false), 1800);
        // Auto-open the cart drawer
        window.dispatchEvent(new Event("open-cart-drawer"));
    };

    const handleAddCompatibleComponent = (component: PdpCompatibilityComponent) => {
        const componentCheckoutReady = isCheckoutReady({
            graceSku: component.graceSku,
            shopifyVariantId: component.shopifyVariantId,
            shopifySellable: component.shopifySellable,
        });
        if (!componentCheckoutReady || component.webPrice1pc == null) return;

        addItems([{
            graceSku: component.graceSku,
            websiteSku: component.websiteSku,
            itemName: component.itemName,
            quantity: 1,
            unitPrice: component.webPrice1pc,
            webPrice1pc: component.webPrice1pc,
            webPrice12pc: component.webPrice12pc,
            checkoutEligible: componentCheckoutReady,
            shopifyVariantId: component.shopifyVariantId,
            shopifySellable: component.shopifySellable,
            family: group.family,
            category: "Component",
            neckThreadSize: selectedVariant?.neckThreadSize ?? group.neckThreadSize ?? null,
        }]);
    };

    return (
        <main
            className="min-h-screen bg-bone"
            data-mobile-pdp={isFocusedPurchasePdp ? "focused" : undefined}
            data-mobile-picker-open={isFocusedPurchasePdp && mobilePickerOpen ? "" : undefined}
        >
            <Navbar hideMobileSearch />
            <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px]" data-mobile-pdp-frame="">
                {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
                <div className={isFocusedPurchasePdp ? "hidden md:block" : undefined}>
                    <Breadcrumbs steps={breadcrumbsSteps} />
                </div>

                {/* ── Mobile PDP (below md): product-first, one property at a time.
                    Both trees are server-rendered and CSS-gated so there is nothing
                    to mismatch on hydration; the mobile tree only does work on the
                    mobile viewport and the desktop stage warms nothing there. ── */}
                {isFocusedPurchasePdp && group.slug ? (
                    <div className="md:hidden">
                        <MobileProductPdp
                            slug={group.slug}
                            group={group}
                            variants={variants}
                            selectedVariant={selectedVariant ?? null}
                            platesBySku={platesBySku}
                            selectedKitQuery={selectedKitQuery}
                            displayName={customerDisplayName}
                            inStock={inStock}
                            canAddToCart={canAddToCart}
                            addedFlash={addedFlash}
                            onAddToCart={handleAddToCart}
                            quoteHref={quoteHref}
                            qty={qty}
                            onQtyChange={setQty}
                            cartCount={itemCount}
                            backHref={safeFrom ?? "/catalog"}
                            cartAnchorRef={mobileCartRef}
                            glassOptions={guidedGlassOptions}
                            rollerOptions={rollerTypeOptions}
                            activeApplicator={activeApplicator ?? null}
                            capOptions={capColorOptions}
                            activeCapOption={activeCapColor}
                            capOptionPhotoKeys={capOptionPhotoKeys}
                            resolveCapFinish={resolveVariantCapFinish}
                            variantSku={canonicalSku}
                            onCommitVariant={handleGuidedVariantSelection}
                            onCommitGlass={handleGuidedProductUrlChange}
                            onPickerOpenChange={setMobilePickerOpen}
                            onAskGrace={openGraceFromMobilePdp}
                            volumePricing={<VolumeTeaser variant={selectedVariant} />}
                        />
                    </div>
                ) : null}

                {/* ── Hero Section ──────────────────────────────────────────────── */}
                <section className={`max-w-[1440px] mx-auto px-4 sm:px-6 py-3 sm:py-8 lg:py-16 ${isFocusedPurchasePdp ? "hidden md:block" : ""}`}>
                    {/* Real purchasable groups with an approved photo or plate share
                        this shell; missing optional media never removes purchase. */}
                    {isFocusedPurchasePdp && group.slug ? (
                        <div className="mb-8 lg:mb-14">
                            <ConfiguratorPdp
                                currentSlug={group.slug}
                                variantImageUrl={usableProductImageUrl(selectedVariant?.imageUrl) ?? null}
                                plateImage={selectedPlate?.image ?? null}
                                plateImageCapOff={selectedPlate?.imageCapOff ?? null}
                                heightWithCap={selectedVariant?.heightWithCap ?? null}
                                heightWithoutCap={selectedVariant?.heightWithoutCap ?? null}
                                diameter={selectedVariant?.diameter ?? null}
                                hasApproved3d={focusedPdpCapabilities.has3dMode}
                                kitQuery={selectedKitQuery}
                                selectedGraceSku={selectedVariant?.graceSku ?? null}
                                groupTitle={`${group.family ?? ""} ${(group.capacity ?? "").split(" (")[0]}`.trim()}
                                capacityLabel={`${group.color ?? "Clear"} glass`}
                                priceEach={selectedVariant?.webPrice1pc ?? null}
                                heroImageUrl={group.heroImageUrl}
                                onAddToCart={handleAddToCart}
                                onAskGrace={openGraceFromPdp}
                                displayName={customerDisplayName}
                                categoryLabel={`${group.category ?? "Glass Bottle"} · ${group.family ?? ""}`}
                                inStock={inStock}
                                caseQty={selectedVariant?.caseQuantity ?? null}
                                neckSize={group.neckThreadSize}
                                capacityText={group.capacity}
                                skuLabel={selectedVariant?.graceSku ?? null}
                                websiteSku={selectedVariant?.websiteSku ?? null}
                                checkoutReady={canAddToCart}
                                rollerVariant={rollerVariantForGuided}
                                rollerVariantsAvailable={rollerVariantsAvailable}
                                onRollerVariantChange={handleRollerVariantChange}
                                onVariantSelectionChange={handleGuidedVariantSelection}
                                onProductUrlChange={handleGuidedProductUrlChange}
                                capOptions={capColorOptions}
                                capOptionPhotoKeys={capOptionPhotoKeys}
                                activeCapOption={activeCapColor}
                                onCapOptionChange={(name) => {
                                    setSelectedVariantId(null);
                                    setSelectedCapColor(name);
                                    setSelectedCapStyle(null);
                                    setSelectedTrimColor(null);
                                }}
                                capSwatchStyle={(name) => getMaterialSwatchStyle(name, {})}
                                glassOptions={guidedGlassOptions}
                                quoteHref={quoteHref}
                                qty={qty}
                                onQtyChange={setQty}
                                ctaAnchorRef={inlineCartRef}
                                volumePricing={<VolumeTeaser variant={selectedVariant} />}
                            />
                        </div>
                    ) : null}
                    {!isFocusedPurchasePdp ? (
                    <FocusedPdpLayout
                        stage={(<>

                        {/* ── Image Panel ──────────────────────────────────────────── */}
                        {/*
                            Two rendering modes, in priority order:
                              1. ProductImageGallery — primary path. Renders Shopify-backed
                                 variant media at
                                 aspect-[10/11] (matches Madison's 2080×2288 render output)
                                 with a thumbnail strip below when both cap-on and cap-off
                                 views are available, plus a click-to-zoom lightbox.
                              2. Placeholder — when the selected variant has no trusted
                                 Shopify product media yet.
                            Variant-count badge and SKU watermark are shared overlays in
                            placeholder mode and passed as props to the gallery.
                        */}
                        <div className="lg:sticky lg:top-[120px]">
                            <div className={hasVariantImagePicker && !is3dFamily ? "space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[58px_minmax(0,1fr)] lg:gap-3" : ""}>
                                {hasVariantImagePicker && !is3dFamily && (
                                    <VariantImagePicker
                                        tiles={variantImageTiles}
                                        selectedVariantId={selectedVariant?._id}
                                        onSelect={selectVariantFromImage}
                                    />
                                )}
                                <div className="min-w-0">
                                    {(() => {
                                        const variantBadge = (
                                            <span className="inline-flex items-center px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/80 text-white backdrop-blur-sm">
                                                {group.variantCount} Variant{group.variantCount !== 1 ? "s" : ""}
                                            </span>
                                        );
                                        const skuWatermark = selectedVariant ? (
                                            <span className="text-[9px] uppercase tracking-widest text-slate/40 font-mono select-none">
                                                {canonicalSku(selectedVariant)}
                                            </span>
                                        ) : null;

                                        // Mode 1 — gallery. Shopify/Madison variant media is the source of
                                        // truth for the PDP. The side rail handles variant switching;
                                        // lifestyle/editorial images belong in the Sanity PDP gallery row below,
                                        // not in this product-image thumbnail strip.
                                        const galleryImages: GalleryImage[] = [];
                                        const seenGalleryUrls = new Set<string>();
                                        const addGalleryImage = (image: GalleryImage) => {
                                            const normalizedUrl = image.url.trim();
                                            const imageKey = normalizedUrl.split("?")[0];
                                            if (!normalizedUrl || seenGalleryUrls.has(imageKey)) return;
                                            seenGalleryUrls.add(imageKey);
                                            galleryImages.push({ ...image, url: normalizedUrl });
                                        };

                                        if (usableProductImageUrl(selectedVariant?.imageUrl)) {
                                            addGalleryImage({
                                                url: usableProductImageUrl(selectedVariant?.imageUrl)!,
                                                label: "Cap on",
                                                alt: customerDisplayName,
                                                auditMeta: {
                                                    surface: "pdp-gallery",
                                                    family: selectedVariant?.family ?? group.family,
                                                    productGroupSlug: group.slug,
                                                    graceSku: selectedVariant?.graceSku,
                                                    websiteSku: selectedVariant?.websiteSku,
                                                    shopifyVariantId: selectedVariant?.shopifyVariantId,
                                                },
                                            });
                                        }
                                        if (
                                            selectedVariant?.imageUrlCapOff &&
                                            supportsSecondaryPdpImage(selectedVariant) &&
                                            usableProductImageUrl(selectedVariant.imageUrlCapOff)
                                        ) {
                                            addGalleryImage({
                                                url: usableProductImageUrl(selectedVariant.imageUrlCapOff)!,
                                                label: "Cap off",
                                                alt: `${customerDisplayName} with cap off`,
                                                auditMeta: {
                                                    surface: "pdp-gallery",
                                                    family: selectedVariant.family ?? group.family,
                                                    productGroupSlug: group.slug,
                                                    graceSku: selectedVariant.graceSku,
                                                    websiteSku: selectedVariant.websiteSku,
                                                    shopifyVariantId: selectedVariant.shopifyVariantId,
                                                },
                                            });
                                        }
                                        if (galleryImages.length === 0 && variantImageTiles[0]?.imageUrl) {
                                            addGalleryImage({
                                                url: variantImageTiles[0].imageUrl,
                                                label: "Representative",
                                                alt: `${customerDisplayName} representative product image`,
                                                auditMeta: {
                                                    surface: "pdp-gallery",
                                                    family: variantImageTiles[0].variant.family ?? group.family,
                                                    productGroupSlug: group.slug,
                                                    graceSku: variantImageTiles[0].graceSku,
                                                    websiteSku: variantImageTiles[0].websiteSku,
                                                    shopifyVariantId: variantImageTiles[0].shopifyVariantId,
                                                },
                                            });
                                        }

                                        // Mode 0 — LIVE 3D CONFIGURATOR. Only for families whose
                                        // geometry, bake and materials are all approved (today: the
                                        // 17-415 9 ml cylinder). The gallery drops to thumbs-only
                                        // beneath it — the arrangement it was designed for.
                                        // The photo gallery is built FIRST, because it is also
                                        // the 3D viewer's safety net (see Viewer3DBoundary): a
                                        // missing GLB must cost the customer the 3D, never the
                                        // product page and its add-to-cart.
                                        const galleryNode = galleryImages.length > 0 ? (
                                            <ProductImageGallery
                                                images={galleryImages}
                                                primaryAlt={galleryImages[0]?.alt ?? customerDisplayName}
                                                badge={variantBadge}
                                                watermark={skuWatermark}
                                                aspectRatio="10/11"
                                                mainPadding="p-0"
                                            />
                                        ) : null;

                                        // On 3D families this whole panel is display:none -- the
                                        // guided stage above owns the imagery -- so nothing 3D is
                                        // ever mounted here. (It was: a WebGL context and a GLB
                                        // download inside a hidden subtree, for nobody.)
                                        if (galleryNode) return galleryNode;

                                        // Mode 2 — placeholder. Avoid falling back to legacy URLs or
                                        // paper-doll compositions for customer-facing product media.
                                        return (
                                            <motion.div
                                                key="placeholder"
                                                initial={{ opacity: 0.6 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.3 }}
                                                className="aspect-[10/11] bg-travertine rounded-none sm:rounded-sm border-0 sm:border border-champagne/50 flex items-center justify-center relative overflow-hidden"
                                            >
                                                <div className="flex flex-col items-center justify-center text-center p-6 sm:p-12">
                                                    <Package className="w-20 h-20 text-champagne mb-4" strokeWidth={0.75} />
                                                    <p className="text-xs text-slate/60 uppercase tracking-wider font-medium">{group.family}</p>
                                                    <p className="text-sm text-slate/80 font-medium mt-1">{group.capacity}</p>
                                                    <p className="text-[10px] text-slate/40 uppercase tracking-widest mt-6 font-medium">Photography coming soon</p>
                                                </div>
                                                <div className="absolute top-4 left-4 pointer-events-none">{variantBadge}</div>
                                            </motion.div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                        </>)}
                        purchase={(<>

                            {!isAtomizer && (
                                <div className="lg:hidden mt-3 rounded-sm border border-champagne/50 bg-white p-3 shadow-sm">
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">
                                        Choose Option
                                    </p>

                                    {rollerTypeOptions.length >= 2 && (
                                        <div className="mb-4">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Roller Type</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {rollerTypeOptions.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            setSelectedApplicator(opt.value);
                                                            setSelectedVariantId(null);
                                                            setSelectedCapColor(null);
                                                            setSelectedCapStyle(null);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`min-h-10 rounded-sm border px-3 py-2 text-sm font-medium transition-all ${activeApplicator === opt.value
                                                            ? "border-obsidian bg-obsidian text-white"
                                                            : "border-champagne text-obsidian"
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!hasCompleteVariantImagePicker && capColorOptions.length > 0 && (
                                        <div className="mb-4">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">
                                                Cap Color
                                                {activeCapColor && (
                                                    <span className="ml-2 normal-case tracking-normal text-obsidian">{activeCapColor}</span>
                                                )}
                                            </p>
                                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
                                                {capColorOptions.map((color) => {
                                                    const hex = resolveSwatchHex(color);
                                                    const isSelected = activeCapColor === color;
                                                    const useDarkCheck = isLightSwatch(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            onClick={() => {
                                                                setSelectedVariantId(null);
                                                                setSelectedCapColor(color);
                                                                setSelectedCapStyle(null);
                                                                setSelectedTrimColor(null);
                                                            }}
                                                            title={color}
                                                            aria-label={`Select ${color}`}
                                                            className={`relative h-11 w-11 shrink-0 rounded-full border-2 transition-all ${isSelected
                                                                ? "border-obsidian scale-105 shadow-md"
                                                                : "border-champagne"
                                                            }`}
                                                            style={getMaterialSwatchStyle(color, { fallbackColor: hex })}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`h-4 w-4 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {!hasCompleteVariantImagePicker && capStyleOptions.length > 1 && (
                                        <div className="mb-4">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Cap Style</p>
                                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
                                                {capStyleOptions.map((style) => (
                                                    <button
                                                        key={style}
                                                        onClick={() => {
                                                            setSelectedVariantId(null);
                                                            setSelectedCapStyle(style);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`min-h-10 shrink-0 rounded-sm border px-3 py-2 text-sm font-medium transition-all ${activeCapStyle === style
                                                            ? "border-obsidian bg-obsidian text-white"
                                                            : "border-champagne text-obsidian"
                                                        }`}
                                                    >
                                                        {style}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {showTrimSelector && (
                                        <div className="mb-1">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">
                                                Trim
                                                {activeTrimColor && (
                                                    <span className="ml-2 normal-case tracking-normal text-obsidian">{activeTrimColor}</span>
                                                )}
                                            </p>
                                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
                                                {trimColorOptions.map((color) => {
                                                    const hex = resolveSwatchHex(color);
                                                    const isSelected = activeTrimColor === color;
                                                    const useDarkCheck = isLightSwatch(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            onClick={() => {
                                                                setSelectedVariantId(null);
                                                                setSelectedTrimColor(color);
                                                            }}
                                                            title={color}
                                                            aria-label={`Select ${color} trim`}
                                                            className={`relative h-10 w-10 shrink-0 rounded-full border-2 transition-all ${isSelected
                                                                ? "border-obsidian scale-105 shadow-md"
                                                                : "border-champagne"
                                                            }`}
                                                            style={getMaterialSwatchStyle(color, { fallbackColor: hex })}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`h-3.5 w-3.5 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {!hasCompleteVariantImagePicker && variantsForApplicator.length > 1 && capColorOptions.length === 0 && (
                                        <div className="mb-1">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">
                                                {activeApplicator ? "Variant" : "Cap Finish"}
                                            </p>
                                            <div className="flex gap-3 overflow-x-auto pb-1 hide-scroll">
                                                {capSwatchPreview.map((item) => {
                                                    const isSelected = item.variantId
                                                        ? selectedVariant?._id === item.variantId
                                                        : selectedCapComponentSku === item.websiteSku;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                if (item.variantId) {
                                                                    setSelectedVariantId(item.variantId);
                                                                    setSelectedCapComponentSku(null);
                                                                } else {
                                                                    setSelectedCapComponentSku(item.websiteSku);
                                                                }
                                                            }}
                                                            title={item.graceSku ?? item.websiteSku}
                                                            className="flex shrink-0 flex-col items-center gap-1.5"
                                                        >
                                                            <span
                                                                className={`relative h-11 w-11 rounded-full border-2 transition-all ${isSelected
                                                                    ? "border-obsidian scale-105 shadow-md"
                                                                    : "border-champagne"
                                                                }`}
                                                                style={getMaterialSwatchStyle(item.displayLabel, { fallbackColor: item.swatchHex })}
                                                            >
                                                                {isSelected && (
                                                                    <span className="absolute inset-0 flex items-center justify-center">
                                                                        <Check
                                                                            className={`h-4 w-4 ${item.useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                            strokeWidth={2.5}
                                                                        />
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span className={`max-w-[76px] text-center text-[10px] leading-tight ${isSelected ? "font-semibold text-obsidian" : "text-slate"}`}>
                                                                {item.displayLabel}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isAtomizer && !hasCompleteVariantImagePicker && variantsForApplicator.length > 1 && (
                                <div className="lg:hidden mt-3 rounded-sm border border-champagne/50 bg-white p-3 shadow-sm">
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">
                                        Choose Shell
                                        {selectedVariant && (
                                            <span className="ml-2 normal-case tracking-normal text-obsidian">
                                                {getAtomizerShellInfo(selectedVariant).label}
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex gap-3 overflow-x-auto pb-1 hide-scroll">
                                        {variantsForApplicator.map((v) => {
                                            const shell = getAtomizerShellInfo(v);
                                            const isSelected = selectedVariant?._id === v._id;
                                            return (
                                                <button
                                                    key={v._id}
                                                    onClick={() => setSelectedVariantId(v._id)}
                                                    title={canonicalSku(v) ?? v.websiteSku}
                                                    className="flex shrink-0 flex-col items-center gap-1.5"
                                                >
                                                    <span
                                                        className={`relative h-11 w-11 rounded-full border-2 transition-all ${isSelected
                                                            ? "border-obsidian scale-105 shadow-md"
                                                            : "border-champagne"
                                                        }`}
                                                        style={{ backgroundColor: shell.hex }}
                                                    >
                                                        {isSelected && (
                                                            <span className="absolute inset-0 flex items-center justify-center">
                                                                <Check
                                                                    className={`h-4 w-4 ${shell.useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                    strokeWidth={2.5}
                                                                />
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className={`max-w-[76px] text-center text-[10px] leading-tight ${isSelected ? "font-semibold text-obsidian" : "text-slate"}`}>
                                                        {shell.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        {/* ── Config Panel ─────────────────────────────────────────── */}
                        <div className="px-2 sm:px-0">
                            {/* Identity lives in the configurator hero for 3D
                                families (single h1); repeat nothing here. */}
                            {!is3dFamily && (
                                <>
                                    {/* Category · Family */}
                                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-1 sm:mb-2">
                                        {group.category} · {group.family}
                                    </p>

                                    {/* Title */}
                                    <h1 className="font-serif text-xl sm:text-4xl lg:text-5xl font-medium text-obsidian leading-[1.1] mb-2 sm:mb-3">
                                        {customerDisplayName}
                                    </h1>
                                </>
                            )}

                            {/* Sanity trust badges */}
                            <PdpInlineBadges blocks={pdpBlocks} />

                            {/* Trust Stack — stock, case pack, shipping */}
                            {!is3dFamily && (
                                <TrustStack variant={selectedVariant} inStock={inStock} />
                            )}

                            {!is3dFamily && selectedVariantSummary && (
                                <SelectedVariantSummary
                                    label={selectedVariantSummary.label}
                                    sku={selectedVariantSummary.sku}
                                    swatchHex={selectedVariantSummary.swatchHex}
                                />
                            )}

                            {/* Concise unit price remains beside the CTA. Full volume and fulfillment details follow the buying sections. */}
                            <div className={`mb-4 sm:mb-8 pb-4 sm:pb-8 border-b border-champagne/50 ${is3dFamily ? "hidden" : ""}`}>
                                <p className="text-xs text-slate uppercase tracking-wider mb-1">From</p>
                                <p className="font-serif text-3xl sm:text-4xl font-medium text-obsidian mb-4">
                                    {formatPrice(selectedVariant?.webPrice1pc)}
                                    <span className="text-lg font-normal text-slate ml-1">/ea</span>
                                </p>
                            </div>

                            {/* ── Variant Selectors (desktop; mobile has a compact tray above price).
                                   3D families select roller/cap/trim in the panel. ── */}
                            <div className={is3dFamily ? "hidden" : "hidden lg:block"}>
                                {!isAtomizer && (
                                    <>
                                    {/* Roller type toggle — Metal vs Plastic for roll-on groups */}
                                    {rollerTypeOptions.length >= 2 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Roller Type
                                            </p>
                                            <div className="flex gap-2">
                                                {rollerTypeOptions.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            setSelectedApplicator(opt.value);
                                                            setSelectedVariantId(null);
                                                            setSelectedCapColor(null);
                                                            setSelectedCapStyle(null);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all ${
                                                            activeApplicator === opt.value
                                                                ? "border-obsidian bg-obsidian text-white"
                                                                : "border-champagne text-obsidian hover:border-muted-gold"
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Glass color selector — replaced by the configurator's
                                        navigating swatches on 3D families */}
                                    {!is3dFamily && uniqueColorGroups.length > 1 && (
                                        <div className="mb-6 relative">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Glass Color
                                                {group?.color && (
                                                    <span className="ml-2 normal-case font-medium text-obsidian">{group.color}</span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2.5">
                                                {uniqueColorGroups.map((item) => {
                                                    const hex = resolveGlassSwatchHex(item.color);
                                                    const isSelected = item.isActive;
                                                    const useDarkCheck = !item.color || LIGHT_GLASS.has(item.color);
                                                    return (
                                                        <button
                                                            key={item.color}
                                                            onClick={() => {
                                                                if (isSelected) return;
                                                                router.replace(`/products/${item.slug}${window.location.search}`, { scroll: false });
                                                            }}
                                                            title={item.color}
                                                            className={`w-9 h-9 rounded-full border-2 transition-all relative ${isSelected
                                                                ? "border-obsidian scale-110 shadow-md"
                                                                : "border-champagne hover:border-muted-gold"
                                                                }`}
                                                            style={{ backgroundColor: hex }}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`w-3.5 h-3.5 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cap color selector */}
                                    {!hasCompleteVariantImagePicker && capColorOptions.length > 0 && (
                                        <div className="mb-6 relative">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Cap Color
                                                {activeCapColor && (
                                                    <span className="ml-2 normal-case font-medium text-obsidian">{activeCapColor}</span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2.5">
                                                {capColorOptions.map((color) => {
                                                    const hex = resolveSwatchHex(color);
                                                    const isSelected = activeCapColor === color;
                                                    const useDarkCheck = isLightSwatch(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            onClick={() => {
                                                                setSelectedVariantId(null);
                                                                setSelectedCapColor(color);
                                                                setSelectedCapStyle(null);
                                                                setSelectedTrimColor(null);
                                                            }}
                                                            title={color}
                                                            className={`w-9 h-9 rounded-full border-2 transition-all relative ${isSelected
                                                                ? "border-obsidian scale-110 shadow-md"
                                                                : "border-champagne hover:border-muted-gold"
                                                                }`}
                                                            style={getMaterialSwatchStyle(color, { fallbackColor: hex })}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`w-3.5 h-3.5 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cap style selector — only when multiple options exist */}
                                    {!hasCompleteVariantImagePicker && capStyleOptions.length > 1 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">Cap Style</p>
                                            <div className="flex flex-wrap gap-2">
                                                {capStyleOptions.map((style) => (
                                                    <button
                                                        key={style}
                                                        onClick={() => {
                                                            setSelectedVariantId(null);
                                                            setSelectedCapStyle(style);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all ${activeCapStyle === style
                                                            ? "border-obsidian bg-obsidian text-white"
                                                            : "border-champagne text-obsidian hover:border-muted-gold"
                                                            }`}
                                                    >
                                                        {style}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Trim selector — the decorative accent ring */}
                                    {showTrimSelector && (
                                        <div className="mb-8">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Trim
                                                {activeTrimColor && (
                                                    <span className="ml-2 normal-case font-medium text-obsidian">{activeTrimColor}</span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2.5">
                                                {trimColorOptions.map((color) => {
                                                    const hex = resolveSwatchHex(color);
                                                    const isSelected = activeTrimColor === color;
                                                    const useDarkCheck = isLightSwatch(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            onClick={() => {
                                                                setSelectedVariantId(null);
                                                                setSelectedTrimColor(color);
                                                            }}
                                                            title={color}
                                                            className={`w-9 h-9 rounded-full border-2 transition-all relative ${isSelected
                                                                ? "border-obsidian scale-110 shadow-md"
                                                                : "border-champagne hover:border-muted-gold"
                                                                }`}
                                                            style={getMaterialSwatchStyle(color, { fallbackColor: hex })}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`w-3.5 h-3.5 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Explicit SKU-level selector fallback when metadata is sparse — hidden when Cap Color selector is already showing */}
                                    {!hasCompleteVariantImagePicker && variantsForApplicator.length > 1 && capColorOptions.length === 0 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                {activeApplicator ? "Cap Color / Variant" : "Cap Finish"}
                                            </p>
                                            <div className="flex flex-wrap gap-3">
                                                {capSwatchPreview.map((item) => {
                                                    const isSelected = item.variantId
                                                        ? selectedVariant?._id === item.variantId
                                                        : selectedCapComponentSku === item.websiteSku;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                if (item.variantId) {
                                                                    setSelectedVariantId(item.variantId);
                                                                    setSelectedCapComponentSku(null);
                                                                } else {
                                                                    setSelectedCapComponentSku(item.websiteSku);
                                                                }
                                                            }}
                                                            title={item.graceSku ?? item.websiteSku}
                                                            className="flex flex-col items-center gap-1.5 group/variant"
                                                        >
                                                            <span
                                                                className={`w-10 h-10 rounded-full border-2 transition-all relative ${isSelected
                                                                    ? "border-obsidian scale-110 shadow-md"
                                                                    : "border-champagne group-hover/variant:border-muted-gold"
                                                                    }`}
                                                                style={getMaterialSwatchStyle(item.displayLabel, { fallbackColor: item.swatchHex })}
                                                            >
                                                                {isSelected && (
                                                                    <span className="absolute inset-0 flex items-center justify-center">
                                                                        <Check
                                                                            className={`w-3.5 h-3.5 ${item.useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                            strokeWidth={2.5}
                                                                        />
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span
                                                                className={`text-[10px] leading-tight text-center max-w-[88px] ${isSelected
                                                                    ? "text-obsidian font-semibold"
                                                                    : "text-slate group-hover/variant:text-muted-gold"
                                                                    }`}
                                                            >
                                                                {item.displayLabel}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    </>
                                )}

                                {/* ── Atomizer Shell Design selector ── */}
                                {isAtomizer && !hasCompleteVariantImagePicker && variantsForApplicator.length > 1 && (
                                    <div className="mb-6">
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                        Shell Design
                                        {selectedVariant && (
                                            <span className="ml-2 normal-case font-medium text-obsidian">
                                                {getAtomizerShellInfo(selectedVariant).label}
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {variantsForApplicator.map((v) => {
                                            const shell = getAtomizerShellInfo(v);
                                            const isSelected = selectedVariant?._id === v._id;
                                            return (
                                                <button
                                                    key={v._id}
                                                    onClick={() => setSelectedVariantId(v._id)}
                                                    title={canonicalSku(v) ?? v.websiteSku}
                                                    className="flex flex-col items-center gap-1.5 group/variant"
                                                >
                                                    <span
                                                        className={`w-10 h-10 rounded-full border-2 transition-all relative ${isSelected
                                                            ? "border-obsidian scale-110 shadow-md"
                                                            : "border-champagne group-hover/variant:border-muted-gold"
                                                            }`}
                                                        style={{ backgroundColor: shell.hex }}
                                                    >
                                                        {isSelected && (
                                                            <span className="absolute inset-0 flex items-center justify-center">
                                                                <Check
                                                                    className={`w-3.5 h-3.5 ${shell.useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                    strokeWidth={2.5}
                                                                />
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className={`text-[10px] leading-tight text-center max-w-[88px] ${isSelected
                                                            ? "text-obsidian font-semibold"
                                                            : "text-slate group-hover/variant:text-muted-gold"
                                                            }`}
                                                    >
                                                        {shell.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    </div>
                                )}
                            </div>

                            {/* Sanity promo banner (above Add to Cart) */}
                            <PdpInlinePromo blocks={pdpBlocks} />

                            {/* Quantity + Add to Cart */}
                            <div ref={inlineCartRef} className={`flex items-stretch space-x-3 mb-6 ${is3dFamily ? "hidden" : ""}`}>
                                <div className="flex items-center border border-champagne rounded-sm bg-white">
                                    <button
                                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                                        className="px-3.5 py-3 text-obsidian hover:text-muted-gold transition-colors border-r border-champagne"
                                        aria-label="Decrease quantity"
                                    >
                                        <span className="text-lg leading-none select-none">−</span>
                                    </button>
                                    <span className="px-4 text-sm font-semibold text-obsidian min-w-[44px] text-center">{qty}</span>
                                    <button
                                        onClick={() => setQty((q) => q + 1)}
                                        className="px-3.5 py-3 text-obsidian hover:text-muted-gold transition-colors border-l border-champagne"
                                        aria-label="Increase quantity"
                                    >
                                        <span className="text-lg leading-none select-none">+</span>
                                    </button>
                                </div>
                                {qty >= 500 ? (
                                    <Link
                                        href={quoteHref}
                                        data-testid="pdp-request-quote-primary"
                                        className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-obsidian text-white hover:bg-muted-gold transition-colors"
                                    >
                                        Request Quote
                                    </Link>
                                ) : canAddToCart ? (
                                    <button
                                        disabled={!canAddToCart || addedFlash}
                                        onClick={handleAddToCart}
                                        data-testid="pdp-add-to-cart"
                                        className={`flex-1 flex items-center justify-center space-x-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                                            addedFlash
                                                ? "bg-emerald-600 text-white"
                                                : "bg-obsidian text-white hover:bg-muted-gold disabled:opacity-40"
                                        }`}
                                    >
                                        {addedFlash ? (
                                            <>
                                                <Check className="w-4 h-4" strokeWidth={2} />
                                                <span>Added!</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                                                <span>{inStock ? "Add to Cart" : "Out of Stock"}</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <Link
                                        href={quoteHref}
                                        data-testid="pdp-request-quote-primary"
                                        className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-obsidian text-white hover:bg-muted-gold transition-colors"
                                    >
                                        Request Quote
                                    </Link>
                                )}
                            </div>

                            {/* Request a Quote CTA */}
                            <div className={`mb-6 ${is3dFamily ? "hidden" : ""}`}>
                                {qty >= 500 && canAddToCart ? (
                                    <button
                                        disabled={!canAddToCart || addedFlash}
                                        onClick={handleAddToCart}
                                        className={`w-full flex items-center justify-center space-x-2 py-3 border text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                                            addedFlash
                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                : "border-obsidian text-obsidian hover:bg-obsidian hover:text-white disabled:opacity-40"
                                        }`}
                                    >
                                        {addedFlash ? (
                                            <>
                                                <Check className="w-4 h-4" strokeWidth={2} />
                                                <span>Added!</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                                                <span>{inStock ? "Add to Cart" : "Out of Stock"}</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <Link
                                        href={quoteHref}
                                        className="w-full flex items-center justify-center space-x-2 py-3 border border-obsidian text-obsidian text-xs font-bold uppercase tracking-widest hover:bg-obsidian hover:text-white transition-colors"
                                    >
                                        <span>Request a Quote</span>
                                    </Link>
                                )}
                            </div>

                            <div className={`mb-6 ${is3dFamily ? "hidden" : ""}`} data-testid="pdp-volume-under-atc">
                                <VolumeTeaser variant={selectedVariant} />
                            </div>

                            {/* Product Description — canonical copy avoids showing applicator-mismatched group text. */}
                            {pdpBlocks.every((b) => b._type !== "pdpRichDescription") && productDescription && (
                                <div className="mb-6 pt-5 border-t border-champagne/60">
                                    <p className="text-[9px] uppercase tracking-[0.18em] font-sans text-muted-gold mb-3">
                                        About This Product
                                    </p>
                                    <p className="font-serif text-[14.5px] text-obsidian leading-[1.75]">
                                        {productDescription}
                                    </p>
                                </div>
                            )}

                        </div>
                        </>)}
                    />
                    ) : null}
                </section>

                <PdpDiscoverySections
                    family={group.family}
                    relations={initialRelations}
                    initialCompatibility={initialCompatibility}
                    selectedWebsiteSku={selectedVariant?.websiteSku}
                    selectedGraceSku={selectedVariant?.graceSku}
                    onAskGrace={openGraceFromPdp}
                    onAddComponent={handleAddCompatibleComponent}
                />

                {/* ── Specifications ──────────────────────────────────────────── */}
                {selectedVariant && (
                    <section className="border-t border-champagne/50 bg-linen">
                        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                            <div className="flex border-b border-champagne/50">
                                <div className="px-4 sm:px-8 py-4 sm:py-5 text-[10px] sm:text-xs uppercase tracking-wider font-bold border-b-2 border-obsidian text-obsidian">
                                    Specifications
                                </div>
                            </div>
                            <div className="py-10 max-w-2xl">
                                <dl>
                                    <SpecRow label="SKU" value={canonicalSku(selectedVariant)} />
                                    <SpecRow label="Height (with cap)" value={selectedVariant.heightWithCap} />
                                    <SpecRow label="Height (without cap)" value={selectedVariant.heightWithoutCap} />
                                    <SpecRow label="Diameter" value={selectedVariant.diameter} />
                                    <SpecRow label="Neck Thread Size" value={selectedVariant.neckThreadSize} />
                                    <SpecRow label="Bottle Weight" value={selectedVariant.bottleWeightG ? `${selectedVariant.bottleWeightG}g` : null} />
                                    <SpecRow label="Case Quantity" value={selectedVariant.caseQuantity ? `${selectedVariant.caseQuantity} units/case` : "Confirm before ordering"} />
                                    <SpecRow label="Capacity" value={selectedVariant.capacity} />
                                    <SpecRow label="Glass Color" value={selectedVariant.color} />
                                    <SpecRow label="Applicator" value={selectedVariant.applicator} />
                                    <SpecRow label="Ball Material" value={selectedVariant.ballMaterial} />
                                    <SpecRow label="Cap Style" value={selectedVariant.capStyle} />
                                    <SpecRow label="Cap Height" value={selectedVariant.capHeight} />
                                    <SpecRow label="Trim Finish" value={selectedVariant.trimColor} />
                                    <SpecRow label="Cap Color" value={selectedVariant.capColor} />
                                    <SpecRow label="Shape" value={selectedVariant.shape} />
                                    <SpecRow label="Assembly Type" value={selectedVariant.assemblyType} />
                                    <SpecRow label="Component Group" value={selectedVariant.componentGroup} />
                                    <SpecRow label="Category" value={selectedVariant.category} />
                                    <SpecRow label="Collection" value={selectedVariant.bottleCollection} />
                                </dl>
                            </div>
                        </div>
                    </section>
                )}

                {selectedVariant && (
                    <section data-testid="pdp-volume-fulfillment" className="border-t border-champagne/50 bg-bone">
                        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
                            <div className="max-w-2xl">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-gold">Ordering details</p>
                                <h2 className="mt-1 font-serif text-2xl text-obsidian">Volume pricing and fulfillment</h2>
                                <p className="mt-2 text-sm text-slate">
                                    Checkout uses the 1-unit price next to Add to Cart. Quantity breaks below are for quote planning.
                                </p>
                                <div className="mt-6">
                                    <TierLadder variant={selectedVariant} qty={qty} onQtyChange={setQty} />
                                </div>
                                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                                    <div className="rounded-sm border border-champagne/50 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate">Availability</p>
                                        <p className="mt-1 font-semibold text-obsidian">{selectedVariant.stockStatus ?? "Confirm availability"}</p>
                                    </div>
                                    <div className="rounded-sm border border-champagne/50 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate">Case quantity</p>
                                        <p className="mt-1 font-semibold text-obsidian">{selectedVariant.caseQuantity ? `${selectedVariant.caseQuantity} units/case` : "Confirm before ordering"}</p>
                                    </div>
                                    <div className="rounded-sm border border-champagne/50 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate">Shipping</p>
                                        <p className="mt-1 font-semibold text-obsidian">Free over $99</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Sanity Editorial Zone (feature strip, gallery, FAQ, rich desc) ── */}
                <PdpEditorialZone blocks={pdpBlocks} />

                <PdpDiscoveryMatrixLink family={group.family} />

                {/* Footer spacer */}
                <div className="h-32 bg-linen border-t border-champagne/30"></div>
            </div>

            {/* Mobile sticky purchase bar — only appears once inline Add to Cart scrolls out of view (Baymard best practice) */}
            <div
                data-testid="pdp-sticky-cart-bar"
                className={`lg:hidden fixed inset-x-0 z-[55] border-t border-champagne bg-bone/95 backdrop-blur-md transition-transform duration-300 ${stickyBarVisible ? "translate-y-0" : "translate-y-[calc(100%+5rem)]"}`}
                style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
            >
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-slate font-semibold">From</p>
                        <p className="font-semibold text-obsidian truncate">
                            {formatPrice(selectedVariant?.webPrice1pc)}
                            <span className="text-xs text-slate ml-1">/ea</span>
                        </p>
                    </div>
                    <div className="flex items-center border border-champagne rounded-sm bg-white shrink-0">
                        <button
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            className="px-3 py-2 text-obsidian border-r border-champagne"
                            aria-label="Decrease quantity"
                        >
                            −
                        </button>
                        <span className="px-3 text-sm font-semibold text-obsidian min-w-[36px] text-center">{qty}</span>
                        <button
                            onClick={() => setQty((q) => q + 1)}
                            className="px-3 py-2 text-obsidian border-l border-champagne"
                            aria-label="Increase quantity"
                        >
                            +
                        </button>
                    </div>
                    {qty >= 500 ? (
                        <Link
                            href={quoteHref}
                            data-testid="pdp-sticky-request-quote"
                            className="flex-1 min-w-0 py-3 text-center text-[11px] font-bold uppercase tracking-wider bg-obsidian text-white"
                        >
                            Request Quote
                        </Link>
                    ) : canAddToCart ? (
                        <button
                            disabled={!canAddToCart || addedFlash}
                            onClick={handleAddToCart}
                            data-testid="pdp-sticky-add-to-cart"
                            className={`flex-1 min-w-0 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                                addedFlash
                                    ? "bg-emerald-600 text-white"
                                    : "bg-obsidian text-white disabled:opacity-40"
                            }`}
                        >
                            {addedFlash ? "Added!" : inStock ? "Add to Cart" : "Out of Stock"}
                        </button>
                    ) : (
                        <Link
                            href={quoteHref}
                            data-testid="pdp-sticky-request-quote"
                            className="flex-1 min-w-0 py-3 text-center text-[11px] font-bold uppercase tracking-wider bg-obsidian text-white"
                        >
                            Request Quote
                        </Link>
                    )}
                </div>
            </div>
        </main>
    );
}

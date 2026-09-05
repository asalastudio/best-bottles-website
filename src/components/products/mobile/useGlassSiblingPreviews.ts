"use client";

/**
 * Glass finishes are sibling product groups (a different slug per colourway),
 * so previewing Amber on a Cobalt page needs the sibling's variant that keeps
 * the customer's roller and cap finish, plus that variant's plate. Loaded only
 * on the mobile viewport, through the same Convex queries the product page and
 * plate loader already use; the images themselves load lazily.
 */
import { useMemo } from "react";
import { useQueries, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import type { PlateRef } from "@/lib/paper-doll/plates";
import { filterVariantsForProductGroup } from "@/lib/productVariantIntegrity";
import { resolveGlassSiblingVariant, type GuidedVariantDeps } from "@/lib/products/guided-variant-resolver";

export type GlassSiblingPreview = {
    slug: string;
    variant: ProductVariant | null;
    plate: PlateRef | null;
    /** True while the sibling's group or plates are still loading. */
    pending: boolean;
};

type SiblingGroupResult = { group: { color?: string | null } | null; variants: ProductVariant[] } | null | undefined | Error;

export function useGlassSiblingPreviews(params: {
    enabled: boolean;
    siblingSlugs: string[];
    selection: { applicator: string | null; capOption: string | null };
    deps: GuidedVariantDeps<ProductVariant>;
}): Record<string, GlassSiblingPreview> {
    const { enabled, siblingSlugs, selection, deps } = params;

    const groupQueries = useMemo(() => {
        if (!enabled) return {};
        return Object.fromEntries(siblingSlugs.map((slug) => [slug, { query: api.products.getProductGroup, args: { slug } }]));
    }, [enabled, siblingSlugs]);
    const groupResults = useQueries(groupQueries) as Record<string, SiblingGroupResult>;

    const resolved = useMemo(() => {
        const out: Record<string, { variant: ProductVariant | null; pending: boolean }> = {};
        for (const slug of siblingSlugs) {
            const result = groupResults[slug];
            if (result === undefined) { out[slug] = { variant: null, pending: enabled }; continue; }
            if (result === null || result instanceof Error) { out[slug] = { variant: null, pending: false }; continue; }
            const variants = filterVariantsForProductGroup(result.group, result.variants);
            out[slug] = { variant: resolveGlassSiblingVariant(variants, selection, deps), pending: false };
        }
        return out;
    }, [siblingSlugs, groupResults, selection, deps, enabled]);

    const skus = useMemo(() => {
        const wanted: string[] = [];
        for (const slug of siblingSlugs) {
            const variant = resolved[slug]?.variant;
            if (variant?.graceSku) wanted.push(variant.graceSku);
            if (variant?.websiteSku) wanted.push(variant.websiteSku);
        }
        return Array.from(new Set(wanted));
    }, [siblingSlugs, resolved]);
    const plates = useQuery(api.productPlates.forSkus, enabled && skus.length > 0 ? { skus } : "skip");

    return useMemo(() => {
        const out: Record<string, GlassSiblingPreview> = {};
        for (const slug of siblingSlugs) {
            const entry = resolved[slug];
            const variant = entry?.variant ?? null;
            const plate = variant
                ? plates?.plates[variant.graceSku] ?? (variant.websiteSku ? plates?.plates[variant.websiteSku] : undefined) ?? null
                : null;
            out[slug] = {
                slug,
                variant,
                plate,
                pending: Boolean(entry?.pending) || (Boolean(variant) && plates === undefined && enabled),
            };
        }
        return out;
    }, [siblingSlugs, resolved, plates, enabled]);
}

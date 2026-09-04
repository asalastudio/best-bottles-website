import type { ApplicatorNavValue } from "@/lib/catalogFilters";

export type PdpAnalyticsDimension = "application" | "capFinish" | "capStyle" | "glass" | "rollerMaterial" | "trimColor";

export type PendingPdpAnalyticsNavigation = {
    slug: string;
    sku: string;
    dimension: PdpAnalyticsDimension;
};

export function createPendingPdpAnalyticsNavigation(input: {
    currentSlug: string;
    currentSku: string | null | undefined;
    targetSlug: string;
    targetSku: string | null | undefined;
    dimension: PdpAnalyticsDimension;
}): PendingPdpAnalyticsNavigation | null {
    if (!input.targetSku) return null;
    if (input.currentSlug === input.targetSlug && input.currentSku === input.targetSku) return null;
    return {
        slug: input.targetSlug,
        sku: input.targetSku,
        dimension: input.dimension,
    };
}

export function resolveUrlAuthoritativePdpAnalytics(input: {
    slug: string;
    resolvedSku: string | null | undefined;
    application: ApplicatorNavValue | null | undefined;
    canonicalDefaultSku: string | null | undefined;
    urlResolvedSku: string | null | undefined;
    pendingNavigation?: PendingPdpAnalyticsNavigation | null;
}): { slug: string; sku: string; application: ApplicatorNavValue; dimension?: PdpAnalyticsDimension } | null {
    if (!input.resolvedSku || !input.application) return null;
    const authoritativeSku = input.urlResolvedSku ?? input.canonicalDefaultSku;
    if (input.resolvedSku !== authoritativeSku) return null;
    const pending = input.pendingNavigation;
    const matchesPendingNavigation = pending?.slug === input.slug
        && pending.sku === input.resolvedSku;
    return {
        slug: input.slug,
        sku: input.resolvedSku,
        application: input.application,
        ...(matchesPendingNavigation ? { dimension: pending.dimension } : {}),
    };
}

export function resolveAndConsumePdpAnalyticsNavigation(input: Parameters<typeof resolveUrlAuthoritativePdpAnalytics>[0]) {
    const event = resolveUrlAuthoritativePdpAnalytics(input);
    const pendingNavigation = input.pendingNavigation ?? null;
    const consumesPendingNavigation = event !== null
        && pendingNavigation?.slug === event.slug
        && pendingNavigation.sku === event.sku;
    return {
        event,
        pendingNavigation: consumesPendingNavigation ? null : pendingNavigation,
    };
}

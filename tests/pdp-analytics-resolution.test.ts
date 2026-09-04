import { describe, expect, it } from "vitest";
import {
  createPendingPdpAnalyticsNavigation,
  resolveAndConsumePdpAnalyticsNavigation,
  resolveUrlAuthoritativePdpAnalytics,
} from "@/lib/products/pdp-analytics";

describe("URL-authoritative PDP analytics resolution", () => {
  const current = {
    slug: "cylinder-9ml-clear-17-415-rollon",
    resolvedSku: "CYL9CLRROL",
    application: "rollon" as const,
    canonicalDefaultSku: "CYL9CLRROL",
  };

  it("does not emit a local-only selection before its canonical URL resolves", () => {
    expect(resolveUrlAuthoritativePdpAnalytics({
      ...current,
      resolvedSku: "CYL9AMBROL",
      urlResolvedSku: null,
    })).toBeNull();
  });

  it("emits the matching canonical URL target with the action dimension", () => {
    expect(resolveUrlAuthoritativePdpAnalytics({
      ...current,
      resolvedSku: "CYL9AMBROL",
      urlResolvedSku: "CYL9AMBROL",
      pendingNavigation: {
        slug: "cylinder-9ml-clear-17-415-rollon",
        sku: "CYL9AMBROL",
        dimension: "capFinish",
      },
    })).toEqual({
      slug: "cylinder-9ml-clear-17-415-rollon",
      sku: "CYL9AMBROL",
      application: "rollon",
      dimension: "capFinish",
    });
  });

  it("emits a resolved Back or Forward URL once without inventing a dimension", () => {
    expect(resolveUrlAuthoritativePdpAnalytics({
      ...current,
      resolvedSku: "CYL9AMBROL",
      urlResolvedSku: "CYL9AMBROL",
    })).toEqual({
      slug: "cylinder-9ml-clear-17-415-rollon",
      sku: "CYL9AMBROL",
      application: "rollon",
    });
  });

  it("does not attach a pending dimension to an unrelated SKU on the same route", () => {
    expect(resolveUrlAuthoritativePdpAnalytics({
      ...current,
      resolvedSku: "CYL9CLRROL",
      urlResolvedSku: "CYL9CLRROL",
      pendingNavigation: {
        slug: "cylinder-9ml-clear-17-415-rollon",
        sku: "CYL9AMBROL",
        dimension: "capFinish",
      },
    })).toEqual({
      slug: "cylinder-9ml-clear-17-415-rollon",
      sku: "CYL9CLRROL",
      application: "rollon",
    });
  });

  it("creates a pending dimension only for a changed canonical SKU target", () => {
    expect(createPendingPdpAnalyticsNavigation({
      currentSlug: "cylinder-9ml-clear-17-415-rollon",
      currentSku: "CYL9CLRROL",
      targetSlug: "cylinder-9ml-clear-17-415-rollon",
      targetSku: "CYL9AMBROL",
      dimension: "capFinish",
    })).toEqual({
      slug: "cylinder-9ml-clear-17-415-rollon",
      sku: "CYL9AMBROL",
      dimension: "capFinish",
    });
  });

  it("does not create a pending dimension for an active click or target route without a canonical SKU", () => {
    const activeClick = createPendingPdpAnalyticsNavigation({
      currentSlug: "cylinder-9ml-clear-17-415-rollon",
      currentSku: "CYL9CLRROL",
      targetSlug: "cylinder-9ml-clear-17-415-rollon",
      targetSku: "CYL9CLRROL",
      dimension: "glass",
    });
    expect(activeClick).toBeNull();
    expect(createPendingPdpAnalyticsNavigation({
      currentSlug: "cylinder-9ml-clear-17-415-rollon",
      currentSku: "CYL9CLRROL",
      targetSlug: "eternal-flame-35ml-clear-Ground",
      targetSku: null,
      dimension: "glass",
    })).toBeNull();
    expect(resolveUrlAuthoritativePdpAnalytics({
      ...current,
      resolvedSku: "CYL9AMBROL",
      urlResolvedSku: "CYL9AMBROL",
      pendingNavigation: activeClick,
    })).toEqual({
      slug: "cylinder-9ml-clear-17-415-rollon",
      sku: "CYL9AMBROL",
      application: "rollon",
    });
  });

  it("consumes an exact pending target so its dimension is only attached once", () => {
    const first = resolveAndConsumePdpAnalyticsNavigation({
      ...current,
      resolvedSku: "CYL9AMBROL",
      urlResolvedSku: "CYL9AMBROL",
      pendingNavigation: {
        slug: "cylinder-9ml-clear-17-415-rollon",
        sku: "CYL9AMBROL",
        dimension: "capFinish",
      },
    });
    expect(first).toEqual({
      event: {
        slug: "cylinder-9ml-clear-17-415-rollon",
        sku: "CYL9AMBROL",
        application: "rollon",
        dimension: "capFinish",
      },
      pendingNavigation: null,
    });
    expect(resolveAndConsumePdpAnalyticsNavigation({
      ...current,
      resolvedSku: "CYL9AMBROL",
      urlResolvedSku: "CYL9AMBROL",
      pendingNavigation: first.pendingNavigation,
    }).event).toEqual({
      slug: "cylinder-9ml-clear-17-415-rollon",
      sku: "CYL9AMBROL",
      application: "rollon",
    });
  });
});

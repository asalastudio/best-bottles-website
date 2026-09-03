import { describe, expect, it } from "vitest";
import { resolveUrlAuthoritativePdpAnalytics } from "@/lib/products/pdp-analytics";

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
});

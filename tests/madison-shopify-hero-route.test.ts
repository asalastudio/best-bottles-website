import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// These files live in the SEPARATE Madison Studio repo on the developer's
// machine, not in this repo. The tests validate Madison's Best Bottles hero
// route, so they only run where that checkout exists (skipped in CI and on
// any machine without it).
const routePath =
  "/Users/jordanrichter/Projects/Madison Studio/madison-app/supabase/functions/push-bestbottles-grid-hero/index.ts";
const imageLibraryPath =
  "/Users/jordanrichter/Projects/Madison Studio/madison-app/src/pages/ImageLibrary.tsx";

describe("Madison Best Bottles Shopify hero route", () => {
  it.skipIf(!existsSync(routePath))("routes product group hero images through Shopify instead of Sanity", () => {
    const route = readFileSync(routePath, "utf8");

    expect(route).toContain("push-shopify-product-images");
    expect(route).toContain("attachToVariant: true");
    expect(route).toContain("syncBestBottlesConvex: true");
    expect(route).toContain("primary_website_sku");
    expect(route).toContain("primary_grace_sku");
    expect(route).not.toContain("@sanity/client");
    expect(route).not.toContain("assets.upload");
    expect(route).not.toContain("productGroups:setHeroImageUrl");
  });

  it.skipIf(!existsSync(imageLibraryPath))("passes organization context and records Shopify results for grid hero publishes", () => {
    const imageLibrary = readFileSync(imageLibraryPath, "utf8");

    expect(imageLibrary).toContain('supabase.functions.invoke("push-bestbottles-grid-hero"');
    expect(imageLibrary).toContain("organizationId: currentOrganizationId");
    expect(imageLibrary).toContain("data?.forwarded?.results");
    expect(imageLibrary).toContain("Best Bottles Shopify hero updated");
  });
});

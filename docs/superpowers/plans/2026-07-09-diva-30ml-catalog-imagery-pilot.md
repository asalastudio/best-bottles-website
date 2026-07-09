# DIVA 30 ml Catalog Imagery Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce, approve, publish, and publicly verify physically truthful PDP-hero and catalog-grid images for 12 representative DIVA 30 ml Clear variants without disturbing the active Cylinder work.

**Architecture:** Convex remains product and measurement truth; Madison Studio owns evidence intake, deterministic scale/geometry, generation, QA, approval, the per-role asset ledger, and publish orchestration; Shopify stores production commerce media; the Best Bottles storefront consumes role-specific Convex URLs. GPT Image 2 improves photographic treatment, while deterministic code owns physical scale, body identity, baseline, canvas placement, and delivery state.

**Tech Stack:** TypeScript, React, Vite, Supabase/Postgres/Edge Functions, Convex, Shopify GraphQL Admin API, Next.js, Sharp, GPT Image 2, Firecrawl, Node test runner, Vitest.

## Global Constraints

- Best Bottles repository: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026`.
- Madison Studio repository: `/Users/jordanrichter/Projects/Madison Studio/madison-app`.
- Before Task 1, use `superpowers:using-git-worktrees` to create isolated `codex/` worktrees for both repositories. Do not implement on top of the current dirty worktrees.
- Do not edit Cylinder family profiles, manifests, references, generated assets, or active Cylinder pipeline rows.
- Never place Firecrawl, Shopify, Convex, OpenAI, Supabase, or encryption credentials in source files, generated manifests, command output, test fixtures, or chat.
- Run all live operations as dry runs first. A live Shopify/Convex publish requires explicit operator confirmation in Madison after the asset has passed QA.
- The model may improve lighting, glass, and finish. It may not choose scale, crop, body geometry, cap identity, baseline, or output role.
- Within `diva-30ml-clear-18-415`, every variant uses one cohort body master and one cohort-level PDP scale. Catalog assets use the versioned global bottle `pixelsPerMm`.
- `products.imageUrl` remains the PDP hero, `products.imageUrlCapOff` remains cap-off/detail, and `products.catalogGridImageUrl` is the new catalog-grid role.
- Reference, quality, and delivery are independent status axes. A publishing failure must never erase visual approval.
- Complete and commit each task before starting the next. Keep commits repository-local when a task changes both repositories.

---

## Task 1: Add the Madison per-role image-asset ledger

**Files:**

- Create: Madison `supabase/migrations/20260709090000_best_bottles_pipeline_image_assets.sql`
- Create: Madison `src/lib/bestBottlesImageAssets.ts`
- Test: Madison `src/lib/bestBottlesImageAssets.test.ts`
- Modify: Madison `src/lib/bestBottlesPipeline.ts`

**Interfaces:** Consumes a `best_bottles_pipeline_sku_jobs.id`; produces one active row per `(sku_job_id, asset_role, render_contract_version)` and exposes independent reference, quality, and delivery state.

- [ ] **Step 1: Write the failing state-model tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApproveAndPublish,
  getImageAssetNextAction,
  rollupRequiredImageAssets,
  type PipelineImageAsset,
} from "./bestBottlesImageAssets.ts";

const asset = (overrides: Partial<PipelineImageAsset>): PipelineImageAsset => ({
  id: "asset-1",
  organization_id: "org-1",
  sku_job_id: "sku-job-1",
  asset_role: "pdp-hero",
  render_contract_version: "bb-commerce-v1",
  geometry_cohort_id: "diva-30ml-clear-18-415",
  reference_status: "verified",
  quality_status: "approved-keep",
  delivery_status: "not-published",
  source_generation_id: null,
  source_asset_id: null,
  source_asset_url: null,
  approved_asset_id: "image-1",
  approved_asset_url: "https://storage.example/diva.png",
  source_reference_manifest: {},
  prompt_version: "diva-product-master-v1",
  model_version: "gpt-image-2",
  expected_measurements: {},
  measured_bounds: {},
  qa_report: { passed: true },
  approved_at: "2026-07-09T00:00:00.000Z",
  approved_by: "operator-1",
  shopify_product_id: null,
  shopify_variant_id: null,
  shopify_media_id: null,
  shopify_cdn_url: null,
  convex_destination_field: "imageUrl",
  convex_synced_at: null,
  ui_verification_url: null,
  ui_verification_result: null,
  ui_verified_at: null,
  retry_count: 0,
  last_error: null,
  superseded_by_asset_id: null,
  created_at: "2026-07-09T00:00:00.000Z",
  updated_at: "2026-07-09T00:00:00.000Z",
  ...overrides,
});

describe("Best Bottles image-asset state", () => {
  it("keeps approval when delivery fails", () => {
    const failed = asset({ delivery_status: "failed", last_error: "Convex timeout" });
    assert.equal(failed.quality_status, "approved-keep");
    assert.equal(getImageAssetNextAction(failed), "retry-publish");
  });

  it("requires both roles before a SKU is complete", () => {
    const rollup = rollupRequiredImageAssets([
      asset({ asset_role: "pdp-hero", delivery_status: "ui-verified" }),
      asset({ id: "asset-2", asset_role: "catalog-grid", delivery_status: "convex-synced" }),
    ]);
    assert.equal(rollup.required, 2);
    assert.equal(rollup.uiVerified, 1);
    assert.equal(rollup.complete, false);
  });

  it("enables publish only after reference, QA, and approval pass", () => {
    assert.equal(canApproveAndPublish(asset({})), true);
    assert.equal(canApproveAndPublish(asset({ reference_status: "conflict" })), false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails because the module does not exist**

Run: `npx tsx --test src/lib/bestBottlesImageAssets.test.ts`

Expected: FAIL with `Cannot find module './bestBottlesImageAssets.ts'`.

- [ ] **Step 3: Implement the domain types and pure transition helpers**

```ts
export const REQUIRED_COMMERCE_IMAGE_ROLES = ["pdp-hero", "catalog-grid"] as const;
export type CommerceImageAssetRole = typeof REQUIRED_COMMERCE_IMAGE_ROLES[number];
export type ReferenceStatus = "verified" | "conflict" | "missing" | "exception";
export type QualityStatus = "unreviewed" | "approved-keep" | "needs-regen" | "rejected";
export type DeliveryStatus =
  | "not-published"
  | "publishing"
  | "shopify-pushed"
  | "convex-synced"
  | "ui-verified"
  | "failed";

export function getImageAssetNextAction(asset: PipelineImageAsset) {
  if (asset.reference_status !== "verified" && asset.reference_status !== "exception") return "verify-reference";
  if (!asset.source_asset_url) return "generate";
  if (asset.quality_status === "unreviewed") return "review";
  if (asset.quality_status === "needs-regen" || asset.quality_status === "rejected") return "regenerate";
  if (asset.delivery_status === "failed") return "retry-publish";
  if (asset.delivery_status === "ui-verified") return "view-live";
  return "approve-and-publish";
}

export function canApproveAndPublish(asset: PipelineImageAsset): boolean {
  return (asset.reference_status === "verified" || asset.reference_status === "exception")
    && asset.quality_status === "approved-keep"
    && asset.qa_report?.passed === true
    && Boolean(asset.approved_asset_url && asset.prompt_version && asset.model_version);
}
```

- [ ] **Step 4: Add the migration with constraints and idempotency**

```sql
create table if not exists public.best_bottles_pipeline_image_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku_job_id uuid not null references public.best_bottles_pipeline_sku_jobs(id) on delete cascade,
  asset_role text not null check (asset_role in ('pdp-hero', 'catalog-grid', 'cap-off', 'detail')),
  render_contract_version text not null,
  geometry_cohort_id text not null,
  reference_status text not null default 'missing' check (reference_status in ('verified', 'conflict', 'missing', 'exception')),
  quality_status text not null default 'unreviewed' check (quality_status in ('unreviewed', 'approved-keep', 'needs-regen', 'rejected')),
  delivery_status text not null default 'not-published' check (delivery_status in ('not-published', 'publishing', 'shopify-pushed', 'convex-synced', 'ui-verified', 'failed')),
  source_generation_id uuid,
  source_asset_id uuid,
  source_asset_url text,
  approved_asset_id uuid,
  approved_asset_url text,
  source_reference_manifest jsonb not null default '{}'::jsonb,
  prompt_version text,
  model_version text,
  expected_measurements jsonb not null default '{}'::jsonb,
  measured_bounds jsonb not null default '{}'::jsonb,
  qa_report jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  shopify_product_id text,
  shopify_variant_id text,
  shopify_media_id text,
  shopify_cdn_url text,
  convex_destination_field text check (convex_destination_field in ('imageUrl', 'catalogGridImageUrl', 'imageUrlCapOff')),
  convex_synced_at timestamptz,
  ui_verification_url text,
  ui_verification_result jsonb,
  ui_verified_at timestamptz,
  publish_idempotency_key text,
  retry_count integer not null default 0,
  last_error text,
  superseded_by_asset_id uuid references public.best_bottles_pipeline_image_assets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sku_job_id, asset_role, render_contract_version),
  unique (organization_id, publish_idempotency_key)
);

alter table public.best_bottles_pipeline_image_assets enable row level security;

create policy "organization members manage Best Bottles image assets"
on public.best_bottles_pipeline_image_assets
for all
using (public.is_organization_member(auth.uid(), organization_id))
with check (public.is_organization_member(auth.uid(), organization_id));

create or replace function public.best_bottles_pipeline_image_assets_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger best_bottles_pipeline_image_assets_touch_updated_at
before update on public.best_bottles_pipeline_image_assets
for each row execute function public.best_bottles_pipeline_image_assets_touch_updated_at();
```

- [ ] **Step 5: Add typed Supabase reads/upserts and export the type from the pipeline module**

Implement `listImageAssetsForSkuJobs`, `upsertImageAsset`, `markImageAssetApproved`, and `markImageAssetDeliveryFailure`. Each write must include `organization_id` and target the unique key, never a URL-only match.

- [ ] **Step 6: Run focused tests and the existing pipeline suite**

Run: `npx tsx --test src/lib/bestBottlesImageAssets.test.ts src/lib/bestBottlesPipeline.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit in Madison**

```bash
git add supabase/migrations/20260709090000_best_bottles_pipeline_image_assets.sql src/lib/bestBottlesImageAssets.ts src/lib/bestBottlesImageAssets.test.ts src/lib/bestBottlesPipeline.ts
git commit -m "feat(best-bottles): add role-aware image asset ledger"
```

---

## Task 2: Add role-specific image truth to Convex

**Files:**

- Modify: Best Bottles `convex/schema.ts`
- Modify: Best Bottles `convex/products.ts`
- Modify: Best Bottles `src/lib/canonicalProduct.ts`
- Test: Best Bottles `tests/canonicalProduct.test.ts`

**Interfaces:** Consumes role-specific Shopify CDN URLs from Madison; persists PDP and catalog URLs independently; propagates only a primary SKU's catalog-grid URL to `productGroups.heroImageUrl`.

- [ ] **Step 1: Add failing canonical-product assertions**

```ts
it("preserves the catalog-grid commerce image independently from the PDP hero", () => {
  const product = buildCanonicalProductVariant({
    _id: "variant-1",
    graceSku: "GB-DIV-CLR-30ML-SPR-SBLK",
    websiteSku: "GBDiv30SpryBlkSh",
    imageUrl: "https://cdn.shopify.com/pdp.png",
    catalogGridImageUrl: "https://cdn.shopify.com/grid.png",
  });
  expect(product.imageUrl).toBe("https://cdn.shopify.com/pdp.png");
  expect(product.catalogGridImageUrl).toBe("https://cdn.shopify.com/grid.png");
});

it("rejects a Sanity catalog-grid URL from commerce truth", () => {
  const product = buildCanonicalProductVariant({
    _id: "variant-1",
    graceSku: "GB-DIV-CLR-30ML-SPR-SBLK",
    websiteSku: "GBDiv30SpryBlkSh",
    catalogGridImageUrl: "https://cdn.sanity.io/images/project/dataset/grid.png",
  });
  expect(product.catalogGridImageUrl).toBeNull();
  expect(product.dataQualityFlags).toContain("sanity_product_image_blocked");
});
```

- [ ] **Step 2: Run the test and verify the new field assertion fails**

Run: `npx vitest run tests/canonicalProduct.test.ts`

Expected: FAIL because `catalogGridImageUrl` is not part of the canonical contract.

- [ ] **Step 3: Extend the schema and canonical sanitizer**

```ts
// convex/schema.ts, inside products
catalogGridImageUrl: v.optional(v.string()),

// src/lib/canonicalProduct.ts
catalogGridImageUrl?: string | null;

// canonical result
catalogGridImageUrl: cleanProductImageUrl(input.catalogGridImageUrl) ?? undefined,
```

- [ ] **Step 4: Extend `setVariantImages` without changing existing role behavior**

```ts
args: {
  websiteSku: v.string(),
  imageUrl: v.optional(v.string()),
  catalogGridImageUrl: v.optional(v.string()),
  imageUrlCapOff: v.optional(v.string()),
  writeToken: v.string(),
},
handler: async (ctx, args) => {
  // Preserve the existing write-token check and exact websiteSku lookup.
  const patch: {
    imageUrl?: string;
    catalogGridImageUrl?: string;
    imageUrlCapOff?: string;
  } = {};
  if (args.imageUrl !== undefined) patch.imageUrl = args.imageUrl;
  if (args.catalogGridImageUrl !== undefined) patch.catalogGridImageUrl = args.catalogGridImageUrl;
  if (args.imageUrlCapOff !== undefined) patch.imageUrlCapOff = args.imageUrlCapOff;
  await ctx.db.patch(product._id, patch);

  if (args.catalogGridImageUrl && product.productGroupId) {
    const group = await ctx.db.get(product.productGroupId);
    const isPrimary = group?.primaryWebsiteSku === product.websiteSku
      || group?.primaryGraceSku === product.graceSku;
    if (isPrimary) await ctx.db.patch(product.productGroupId, { heroImageUrl: args.catalogGridImageUrl });
  }
}
```

Also update the legacy `setImageUrl` mutation: it may continue using the PDP URL as a group-hero fallback only while the primary product has no `catalogGridImageUrl`. Once the primary product has a catalog-grid URL, a later PDP republish must never overwrite `productGroups.heroImageUrl`.

- [ ] **Step 5: Return `catalogGridImageUrl` in both catalog variant-preview queries**

Add the field to `searchCatalog`'s `variantPreviewRows` mapper and `getCatalogGroupVariantPreviewData`'s declared return type and mapper.

- [ ] **Step 6: Run focused tests and a production build**

Run: `npx vitest run tests/canonicalProduct.test.ts && npm run build`

Expected: PASS; Next.js build and Convex-generated types compile.

- [ ] **Step 7: Commit in Best Bottles**

```bash
git add convex/schema.ts convex/products.ts src/lib/canonicalProduct.ts tests/canonicalProduct.test.ts
git commit -m "feat(catalog): add role-specific grid image truth"
```

---

## Task 3: Route grid images to catalog cards while PDP keeps the hero

**Files:**

- Create: Best Bottles `src/lib/products/product-image-roles.ts`
- Test: Best Bottles `tests/product-image-roles.test.ts`
- Modify: Best Bottles `src/lib/products/product-card-variant-previews.ts`
- Modify: Best Bottles `src/lib/catalogSearchFallback.ts`
- Modify: Best Bottles `src/components/products/ProductCardImagePreview.tsx`
- Test: Best Bottles `tests/product-card-variant-previews.test.ts`
- Test: Best Bottles `tests/catalog.smoke.test.ts`

**Interfaces:** Catalog cards and swatch previews prefer `catalogGridImageUrl`; PDP callers continue to use `imageUrl`; legacy rows fall back safely.

- [ ] **Step 1: Write failing role-resolution tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveCatalogImageUrl, resolvePdpHeroImageUrl } from "../src/lib/products/product-image-roles";

describe("product image roles", () => {
  const product = {
    imageUrl: "https://cdn.shopify.com/pdp.png",
    catalogGridImageUrl: "https://cdn.shopify.com/grid.png",
  };

  it("uses the physical-scale derivative on catalog surfaces", () => {
    expect(resolveCatalogImageUrl(product)).toBe("https://cdn.shopify.com/grid.png");
  });

  it("keeps the beautified hero on PDP surfaces", () => {
    expect(resolvePdpHeroImageUrl(product)).toBe("https://cdn.shopify.com/pdp.png");
  });

  it("falls back to the PDP hero for legacy catalog rows", () => {
    expect(resolveCatalogImageUrl({ imageUrl: "https://cdn.shopify.com/legacy.png" }))
      .toBe("https://cdn.shopify.com/legacy.png");
  });
});
```

- [ ] **Step 2: Run the test and verify the resolver is missing**

Run: `npx vitest run tests/product-image-roles.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the role resolver**

```ts
type RoleImageSource = {
  imageUrl?: string | null;
  catalogGridImageUrl?: string | null;
};

const clean = (value: string | null | undefined) => value?.trim() || null;

export function resolveCatalogImageUrl(source: RoleImageSource): string | null {
  return clean(source.catalogGridImageUrl) ?? clean(source.imageUrl);
}

export function resolvePdpHeroImageUrl(source: RoleImageSource): string | null {
  return clean(source.imageUrl);
}
```

- [ ] **Step 4: Update preview-source types and mappers**

Add `catalogGridImageUrl?: string | null` to `ProductCardVariantPreviewSource`, then construct each preview with `productImageUrl(resolveCatalogImageUrl(variant)) ?? productImageUrl(variant.imageUrlCapOff)`. Add the same field to fallback catalog shapes so both the native Convex search and fallback path behave identically.

- [ ] **Step 5: Expose deterministic verification metadata on card images**

```tsx
<Image
  key={displayImage.url}
  src={displayImage.url}
  alt={displayImage.alt ?? productTitle}
  fill
  data-bb-image-role="catalog-grid"
  data-bb-image-source-url={displayImage.url}
  data-bb-image-audit={auditMeta?.surface}
  data-bb-family={auditMeta?.family ?? undefined}
  data-bb-product-group-slug={auditMeta?.productGroupSlug ?? undefined}
  data-bb-grace-sku={displayImage.graceSku ?? undefined}
  data-bb-website-sku={displayImage.websiteSku ?? undefined}
  data-bb-shopify-variant-id={auditMeta?.shopifyVariantId ?? undefined}
  className="object-contain transition duration-500 ease-out group-hover/catalog-card:scale-[1.03]"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
/>
```

Retain the existing `data-bb-*` SKU, family, and route attributes.

- [ ] **Step 6: Run role, preview, and catalog regression tests**

Run: `npx vitest run tests/product-image-roles.test.ts tests/product-card-variant-previews.test.ts tests/catalog.smoke.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit in Best Bottles**

```bash
git add src/lib/products/product-image-roles.ts src/lib/products/product-card-variant-previews.ts src/lib/catalogSearchFallback.ts src/components/products/ProductCardImagePreview.tsx tests/product-image-roles.test.ts tests/product-card-variant-previews.test.ts tests/catalog.smoke.test.ts
git commit -m "feat(catalog): render physical-scale grid images"
```

---

## Task 4: Extend Firecrawl intake to complete product evidence

**Files:**

- Modify: Madison `src/lib/bestBottlesMeasurementFirecrawl.ts`
- Test: Madison `src/lib/bestBottlesMeasurementFirecrawl.test.ts`
- Modify: Madison `scripts/bestBottlesReferenceIntake.ts`
- Test: Madison `scripts/bestBottlesReferenceIntake.test.ts`

**Interfaces:** Consumes exact legacy product pages with SKU evidence; produces candidate measurements and reference-image roles. It never mutates Convex and blocks on conflicts.

- [ ] **Step 1: Add a failing DIVA extraction test**

```ts
it("extracts DIVA assembled geometry and reference roles only with exact SKU evidence", () => {
  const candidate = pickFirecrawlMeasurementCandidate(
    row({
      graceSku: "GB-DIV-CLR-30ML-SPR-SBLK",
      websiteSku: "GBDiv30SpryBlkSh",
      family: "Diva",
    }),
    {
      markdown: [
        "SKU: GBDiv30SpryBlkSh",
        "Capacity: 30 ml",
        "Height With Cap: 109 mm",
        "Height Without Cap: 81 +/-1 mm",
        "Item Diameter: 43 +/-0.5 mm",
        "Depth: 43 mm",
        "Neck Finish: 18-415",
        "![capped](https://www.bestbottles.com/images/diva-capped.jpg)",
        "![measured](https://www.bestbottles.com/images/diva-measured.jpg)",
      ].join("\n"),
    },
    "https://www.bestbottles.com/product/diva-30-ml",
  );

  assert.equal(candidate?.heightWithCap, "109");
  assert.equal(candidate?.heightWithoutCap, "81");
  assert.equal(candidate?.diameter, "43");
  assert.equal(candidate?.depth, "43");
  assert.equal(candidate?.neckFinish, "18-415");
  assert.equal(candidate?.capacityMl, "30");
  assert.deepEqual(candidate?.referenceImageUrls.capped, [
    "https://www.bestbottles.com/images/diva-capped.jpg",
  ]);
});
```

- [ ] **Step 2: Run the test and verify the added fields fail**

Run: `npx tsx --test src/lib/bestBottlesMeasurementFirecrawl.test.ts`

Expected: FAIL on `heightWithCap`, `depth`, `neckFinish`, `capacityMl`, and `referenceImageUrls`.

- [ ] **Step 3: Extend extraction and candidate provenance**

```ts
export interface BestBottlesReferenceImageRoles {
  capped: string[];
  capOff: string[];
  measured: string[];
  depth: string[];
  enlarged: string[];
}

export interface BestBottlesFirecrawlMeasurementCandidate {
  // existing fields remain
  heightWithCap: string | null;
  depth: string | null;
  neckFinish: string | null;
  capacityMl: string | null;
  referenceImageUrls: BestBottlesReferenceImageRoles;
  sourceContentHash: string;
  crawledAt: string;
}
```

Use label-specific regular expressions so plain `Height` cannot overwrite `Height With Cap`. Normalize only numeric values; retain raw source text in the evidence payload. Compute `sourceContentHash` with SHA-256 over the collected page text.

- [ ] **Step 4: Add conflict classification instead of overwrite behavior**

```ts
export function classifyEvidenceValue(params: {
  canonical: number | null;
  candidate: number | null;
  tolerance: number;
}): "verified" | "conflict" | "missing" {
  if (params.candidate == null) return "missing";
  if (params.canonical == null) return "verified";
  return Math.abs(params.canonical - params.candidate) <= params.tolerance
    ? "verified"
    : "conflict";
}
```

Persist candidates to Madison's existing reference/evidence artifacts with source URL, crawl time, hash, matched SKU, normalized values, tolerance, and conflict status. Do not write candidate values into Convex.

- [ ] **Step 5: Run Firecrawl and reference-intake tests**

Run: `npx tsx --test src/lib/bestBottlesMeasurementFirecrawl.test.ts scripts/bestBottlesReferenceIntake.test.ts`

Expected: PASS, including rejection when the page lacks exact SKU evidence.

- [ ] **Step 6: Commit in Madison**

```bash
git add src/lib/bestBottlesMeasurementFirecrawl.ts src/lib/bestBottlesMeasurementFirecrawl.test.ts scripts/bestBottlesReferenceIntake.ts scripts/bestBottlesReferenceIntake.test.ts
git commit -m "feat(best-bottles): capture complete legacy product evidence"
```

---

## Task 5: Implement deterministic physical-scale contracts and QA

**Files:**

- Create: Madison `src/lib/product-image/physicalScale.ts`
- Test: Madison `src/lib/product-image/physicalScale.test.ts`
- Modify: Madison `src/lib/product-image/types.ts`
- Modify: Madison `src/lib/product-image/framingQa.ts`
- Test: Madison `src/lib/product-image/framingQa.test.ts`

**Interfaces:** Consumes reconciled millimeters and canvas constraints; produces the cohort PDP scale, global grid scale, expected pixel bounds, and hard-fail QA results.

- [ ] **Step 1: Write failing scale tests using the approved DIVA bands**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCatalogGridScaleContract,
  buildPdpCohortScaleContract,
  deriveMaxSupportedBottleHeightMm,
  evaluatePhysicalScaleQa,
} from "./physicalScale.ts";

describe("physical scale contracts", () => {
  it("uses the tallest DIVA assembly once for every PDP variant", () => {
    const contract = buildPdpCohortScaleContract({
      canvas: { widthPx: 1600, heightPx: 1760 },
      padding: { topPx: 120, rightPx: 180, bottomPx: 120, leftPx: 180 },
      variants: [
        { sku: "reducer", heightWithCapMm: 85, widthMm: 43 },
        { sku: "spray", heightWithCapMm: 109, widthMm: 43 },
      ],
    });
    assert.equal(contract.limitingHeightMm, 109);
    assert.equal(contract.bySku.reducer.pixelsPerMm, contract.bySku.spray.pixelsPerMm);
    assert.ok(contract.bySku.spray.expectedHeightPx > contract.bySku.reducer.expectedHeightPx);
  });

  it("preserves global catalog ratios", () => {
    const contract = buildCatalogGridScaleContract({
      canvasHeightPx: 1760,
      baselineYPx: 1640,
      topPaddingPx: 120,
      maxSupportedBottleHeightMm: 152,
    });
    assert.ok(Math.abs(
      contract.expectedHeightPx(100) / contract.expectedHeightPx(85) - (100 / 85),
    ) < 1e-12);
  });

  it("derives the grid ceiling from bottle rows without letting accessories alter scale", () => {
    assert.equal(deriveMaxSupportedBottleHeightMm([
      { displayClass: "bottle", heightWithCapMm: 109 },
      { displayClass: "bottle", heightWithCapMm: 152 },
      { displayClass: "accessory", heightWithCapMm: 240 },
    ]), 152);
  });

  it("hard-fails body drift and assembled-height drift", () => {
    const report = evaluatePhysicalScaleQa({
      expectedBodyBounds: { top: 500, bottom: 1309, left: 585, right: 1014 },
      actualBodyBounds: { top: 500, bottom: 1313, left: 585, right: 1014 },
      expectedAssemblyHeightPx: 1090,
      actualAssemblyHeightPx: 1070,
      heightTolerancePx: 10,
      bodyTolerancePx: 1,
    });
    assert.equal(report.passed, false);
    assert.deepEqual(report.failures.sort(), ["assembled-height-drift", "body-bounds-drift"]);
  });
});
```

- [ ] **Step 2: Run the test and verify the scale module is missing**

Run: `npx tsx --test src/lib/product-image/physicalScale.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the scale formulas with versioned contracts**

```ts
export const COMMERCE_RENDER_CONTRACT_VERSION = "bb-commerce-v1";

export function buildPdpCohortScaleContract(input: PdpCohortScaleInput) {
  const availableHeight = input.canvas.heightPx - input.padding.topPx - input.padding.bottomPx;
  const availableWidth = input.canvas.widthPx - input.padding.leftPx - input.padding.rightPx;
  const limitingHeightMm = Math.max(...input.variants.map((variant) => variant.heightWithCapMm));
  const limitingWidthMm = Math.max(...input.variants.map((variant) => variant.widthMm));
  const pixelsPerMm = Math.min(availableHeight / limitingHeightMm, availableWidth / limitingWidthMm);
  return {
    version: COMMERCE_RENDER_CONTRACT_VERSION,
    limitingHeightMm,
    limitingWidthMm,
    pixelsPerMm,
    bySku: Object.fromEntries(input.variants.map((variant) => [variant.sku, {
      pixelsPerMm,
      expectedHeightPx: variant.heightWithCapMm * pixelsPerMm,
      expectedWidthPx: variant.widthMm * pixelsPerMm,
    }])),
  };
}

export function buildCatalogGridScaleContract(input: CatalogGridScaleInput) {
  const pixelsPerMm = (input.baselineYPx - input.topPaddingPx) / input.maxSupportedBottleHeightMm;
  return {
    version: COMMERCE_RENDER_CONTRACT_VERSION,
    pixelsPerMm,
    expectedHeightPx: (heightMm: number) => heightMm * pixelsPerMm,
  };
}

export function deriveMaxSupportedBottleHeightMm(rows: CatalogScaleRow[]): number {
  const heights = rows
    .filter((row) => row.displayClass === "bottle")
    .map((row) => row.heightWithCapMm)
    .filter((height) => Number.isFinite(height) && height > 0);
  if (heights.length === 0) throw new Error("No reconciled bottle heights are available");
  return Math.max(...heights);
}
```

- [ ] **Step 4: Extend geometry/QC types**

Add `geometryCohortId`, `renderContractVersion`, `heightWithCapMm`, `heightWithoutCapMm`, `widthMm`, `pixelsPerMm`, `expectedAssemblyHeightPx`, `actualAssemblyHeightPx`, and body-master bounds. Add `body_bounds_identical` and `assembled_height_matches_measurement` as hard-fail check IDs.

- [ ] **Step 5: Integrate the physical report into framing QA**

Framing QA remains responsible for canvas, centerline, and baseline. Physical-scale QA is composed into the result and prevents automatic normalization if body or assembled-height drift exceeds tolerance.

- [ ] **Step 6: Run scale, framing, and rig regression tests**

Run: `npx tsx --test src/lib/product-image/physicalScale.test.ts src/lib/product-image/framingQa.test.ts src/lib/product-image/familyRig.test.ts src/lib/product-image/rigPostprocess.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit in Madison**

```bash
git add src/lib/product-image/physicalScale.ts src/lib/product-image/physicalScale.test.ts src/lib/product-image/types.ts src/lib/product-image/framingQa.ts src/lib/product-image/framingQa.test.ts
git commit -m "feat(best-bottles): enforce measurement-based image scale"
```

---

## Task 6: Build the 12-SKU DIVA calibration manifest and preflight

**Files:**

- Create: Madison `src/lib/bestBottlesDivaCalibration.ts`
- Test: Madison `src/lib/bestBottlesDivaCalibration.test.ts`
- Create: Madison `scripts/build-bestbottles-diva-calibration.ts`
- Modify: Madison `package.json`

**Interfaces:** Consumes reconciled Madison/Convex product rows; produces a deterministic 12-SKU manifest, required roles, height bands, closure coverage, and explicit blockers.

- [ ] **Step 1: Write failing deterministic cohort-selection tests**

```ts
it("selects 12 DIVA 30 ml Clear 18-415 variants across approved closure and height bands", () => {
  const result = buildDiva30CalibrationManifest(fixtureRows);
  assert.equal(result.geometryCohortId, "diva-30ml-clear-18-415");
  assert.equal(result.items.length, 12);
  assert.deepEqual(new Set(result.items.flatMap((item) => item.requiredAssetRoles)),
    new Set(["pdp-hero", "catalog-grid"]));
  assert.deepEqual(new Set(result.items.map((item) => item.heightWithCapMm)),
    new Set([85, 92, 95, 104, 107, 109]));
  assert.deepEqual(new Set(result.items.map((item) => item.closureClass)),
    new Set(["reducer", "perfume-spray", "lotion-pump", "vintage-bulb"]));
  assert.deepEqual(result.blockers, []);
});

it("blocks selection when siblings disagree about body dimensions", () => {
  const result = buildDiva30CalibrationManifest([
    ...fixtureRows,
    { ...fixtureRows[0], graceSku: "CONFLICT", heightWithoutCapMm: 84 },
  ]);
  assert.ok(result.blockers.some((blocker) => blocker.code === "body-measurement-conflict"));
});
```

- [ ] **Step 2: Run the test and verify the manifest builder is missing**

Run: `npx tsx --test src/lib/bestBottlesDivaCalibration.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement exact eligibility and representative selection**

```ts
const DIVA_30_CONTRACT = {
  family: "Diva",
  capacityMl: 30,
  color: "Clear",
  neckFinish: "18-415",
  bodyHeightMm: 81,
  bodyHeightToleranceMm: 1,
  widthMm: 43,
  widthToleranceMm: 0.5,
  requiredHeightBandsMm: [85, 92, 95, 104, 107, 109],
  requiredClosureClasses: ["reducer", "perfume-spray", "lotion-pump", "vintage-bulb"],
  itemCount: 12,
} as const;
```

Filter by normalized family/capacity/color/neck; reject rows without exact identity, height-with-cap, height-without-cap, width, Shopify variant ID, or verified/exception reference status. Select at least one row from every height band and closure class, then fill remaining positions deterministically by `(heightWithCapMm, closureClass, graceSku)`.

- [ ] **Step 4: Add the script and dry-run output**

The command reads the existing Madison catalog/readiness artifacts, builds the manifest, derives `maxSupportedBottleHeightMm` from all reconciled rows classified as bottles, prints only counts and SKU identifiers, and writes `artifacts/best-bottles/diva-30ml-calibration-manifest.json`. It exits non-zero when any blocker exists and never prints credentials. The manifest records the derived catalog ceiling and the `bb-commerce-v1` render-contract version so later families reuse exactly the same grid scale.

```json
{
  "scripts": {
    "bestbottles:generation:preflight-diva": "tsx scripts/build-bestbottles-diva-calibration.ts"
  }
}
```

- [ ] **Step 5: Run the test and local preflight**

Run: `npx tsx --test src/lib/bestBottlesDivaCalibration.test.ts && npm run bestbottles:generation:preflight-diva -- --dry-run`

Expected: tests PASS; preflight either reports exactly 12 eligible targets or exits with named truth/credential blockers and makes no remote writes.

- [ ] **Step 6: Commit in Madison**

```bash
git add src/lib/bestBottlesDivaCalibration.ts src/lib/bestBottlesDivaCalibration.test.ts scripts/build-bestbottles-diva-calibration.ts package.json
git commit -m "feat(best-bottles): define DIVA calibration cohort"
```

---

## Task 7: Generate both roles from one locked DIVA body master

**Files:**

- Modify: Madison `src/config/bestBottlesFamilyProfiles.ts`
- Test: Madison `src/config/bestBottlesFamilyProfiles.test.ts`
- Create: Madison `src/lib/product-image/divaCalibrationPipeline.ts`
- Test: Madison `src/lib/product-image/divaCalibrationPipeline.test.ts`
- Modify: Madison `scripts/best-bottles/generate-family-batch.ts`
- Modify: Madison `src/lib/product-image/rigPostprocess.ts`
- Test: Madison `src/lib/product-image/rigPostprocess.test.ts`

**Interfaces:** Consumes the DIVA manifest and approved references; produces a source master plus deterministic `pdp-hero` and `catalog-grid` derivatives and upserts both ledger rows.

- [ ] **Step 1: Write failing orchestration tests**

```ts
it("creates two role jobs with one body master and role-specific scale", () => {
  const jobs = buildDivaCalibrationRenderJobs(divaManifestItem, scaleContracts);
  assert.deepEqual(jobs.map((job) => job.assetRole), ["pdp-hero", "catalog-grid"]);
  assert.equal(jobs[0].bodyMasterChecksum, jobs[1].bodyMasterChecksum);
  assert.equal(jobs[0].geometryCohortId, "diva-30ml-clear-18-415");
  assert.equal(jobs[0].pixelsPerMm, scaleContracts.pdp.pixelsPerMm);
  assert.equal(jobs[1].pixelsPerMm, scaleContracts.grid.pixelsPerMm);
});

it("locks every closure variant to one cohort body checksum", () => {
  const jobs = divaManifest.items.flatMap((item) =>
    buildDivaCalibrationRenderJobs(item, scaleContracts),
  );
  assert.deepEqual(new Set(jobs.map((job) => job.bodyMasterChecksum)),
    new Set([divaBodyMaster.checksum]));
});

it("does not queue DIVA when body lock or physical QA fails", () => {
  const decision = decideDivaAssetDisposition({
    bodyLockPassed: false,
    physicalScalePassed: true,
    visualQaPassed: true,
  });
  assert.equal(decision, "needs-regen");
});
```

- [ ] **Step 2: Run the test and verify the pipeline module is missing**

Run: `npx tsx --test src/lib/product-image/divaCalibrationPipeline.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Add the DIVA profile without touching Cylinder**

```ts
// Add "diva-bottle" to BestBottlesFamilyProfileId.
const DIVA_TEMPLATE = makeFamilyTemplate({
  id: "diva-bottle",
  family: "diva",
  label: "Diva Bottle",
  relativeScaleZoneId: "mini-decorative",
  relativeScaleZoneLabel: "Miniature decorative bottles",
  targetProductHeightRangePct: { min: 66, max: 74 },
  fallbackTargetProductHeightPct: 70,
  fillWidthPct: 62,
  observedHeightRangeMm: { min: 85, max: 109 },
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
});

// Add the exact normalized token to FAMILY_TEMPLATE_BY_TOKEN.
diva: DIVA_TEMPLATE,
```

- [ ] **Step 4: Implement the generation/derivative boundary**

The first approved GPT request establishes one opaque-background DIVA cohort body master. Closure/applicator work attaches to that locked body; it does not regenerate or rescale the body for each variant. Sharp-based postprocessing extracts/mattes the assembly and places it on role canvases using the scale contracts. Do not ask GPT to create the grid crop or decide relative size. If a closure edit necessarily returns a full assembly, replace its body region with the locked cohort body before role derivatives are rendered, then run body-lock QA.

```ts
const renderJobs = (["pdp-hero", "catalog-grid"] as const).map((assetRole) => ({
  skuJobId: item.skuJobId,
  graceSku: item.graceSku,
  assetRole,
  renderContractVersion: COMMERCE_RENDER_CONTRACT_VERSION,
  geometryCohortId: item.geometryCohortId,
  bodyMasterChecksum: bodyMaster.checksum,
  pixelsPerMm: assetRole === "pdp-hero" ? scales.pdp.pixelsPerMm : scales.grid.pixelsPerMm,
  baselineYPx: roleCanvas[assetRole].baselineYPx,
}));
```

For every result, record source-reference hashes, prompt version, model version, expected measurements, measured bounds, QA report, and source URL in `best_bottles_pipeline_image_assets`.

- [ ] **Step 5: Enforce body-lock and role QA before `qa-pending`**

Compare the body-only alpha bounds and checksum-normalized body raster against the approved cohort body. Within 1 px can normalize; beyond 1 px is `needs-regen`. Validate assembled height against `heightWithCapMm * pixelsPerMm` and retain true shorter closure height.

- [ ] **Step 6: Run generation-contract and postprocess tests**

Run: `npx tsx --test src/lib/product-image/divaCalibrationPipeline.test.ts src/config/bestBottlesFamilyProfiles.test.ts src/lib/product-image/physicalScale.test.ts src/lib/product-image/rigPostprocess.test.ts`

Expected: PASS.

- [ ] **Step 7: Run a no-generation dry run**

Run: `npm run bestbottles:generation:run-family -- --family Diva --capacity 30 --color Clear --manifest artifacts/best-bottles/diva-30ml-calibration-manifest.json --dry-run`

Expected: exactly 12 SKUs and 24 role jobs; zero Cylinder jobs; zero OpenAI, Supabase, Shopify, or Convex writes.

- [ ] **Step 8: Commit in Madison**

```bash
git add src/config/bestBottlesFamilyProfiles.ts src/config/bestBottlesFamilyProfiles.test.ts src/lib/product-image/divaCalibrationPipeline.ts src/lib/product-image/divaCalibrationPipeline.test.ts scripts/best-bottles/generate-family-batch.ts src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts
git commit -m "feat(best-bottles): generate locked DIVA image roles"
```

---

## Task 8: Publish by role with idempotent Shopify and Convex recovery

**Files:**

- Create: Madison `supabase/functions/_shared/bestBottlesImagePublishing.ts`
- Test: Madison `supabase/functions/_shared/bestBottlesImagePublishing.test.ts`
- Modify: Madison `supabase/functions/push-shopify-product-images/index.ts`
- Modify: Madison `supabase/functions/bestbottles-convex/index.ts`
- Modify: Madison `src/lib/bestBottlesImageAssets.ts`
- Test: Madison `scripts/bestBottlesShopifyPublishPreflightCore.test.ts`

**Interfaces:** Consumes an approved ledger asset ID; produces a Shopify media mapping and the exact role-specific Convex field. Retry resumes from the last successful delivery stage.

- [ ] **Step 1: Write failing routing and retry tests**

```ts
it("routes commerce roles without replacing the wrong storefront image", () => {
  assert.deepEqual(getPublishDestination("pdp-hero"), {
    convexField: "imageUrl",
    associateToVariant: true,
  });
  assert.deepEqual(getPublishDestination("catalog-grid"), {
    convexField: "catalogGridImageUrl",
    associateToVariant: false,
  });
});

it("resumes at Convex when Shopify already succeeded", () => {
  assert.equal(getPublishResumeStage({
    deliveryStatus: "failed",
    shopifyMediaId: "gid://shopify/MediaImage/1",
    shopifyCdnUrl: "https://cdn.shopify.com/grid.png",
    convexSyncedAt: null,
  }), "convex-sync");
});
```

- [ ] **Step 2: Run the test and verify the shared module is missing**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesImagePublishing.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement role routing and idempotency keys**

```ts
export function getPublishDestination(role: CommerceImageAssetRole) {
  return role === "pdp-hero"
    ? { convexField: "imageUrl" as const, associateToVariant: true }
    : { convexField: "catalogGridImageUrl" as const, associateToVariant: false };
}

export function buildPublishIdempotencyKey(input: {
  skuJobId: string;
  role: CommerceImageAssetRole;
  renderContractVersion: string;
  approvedAssetId: string;
}) {
  return [input.skuJobId, input.role, input.renderContractVersion, input.approvedAssetId].join(":");
}
```

- [ ] **Step 4: Change the Edge Function request from URL/mode to approved asset ID**

Load the ledger row server-side, verify organization membership, `quality_status = 'approved-keep'`, QA passed, and `approved_asset_url` exists. Set `delivery_status = 'publishing'` atomically. If the idempotency key already has a Shopify media result, reuse it.

- [ ] **Step 5: Preserve role-specific Shopify behavior**

For `pdp-hero`, create product media and associate it with the exact variant. For `catalog-grid`, create product media for CDN delivery but do not change the variant featured image. Poll Shopify media status until `READY` or a bounded failure state, then save media ID and CDN URL before calling Convex.

- [ ] **Step 6: Extend the Convex bridge allowlist**

```ts
const IMAGE_FIELDS = new Set([
  "imageUrl",
  "catalogGridImageUrl",
  "imageUrlCapOff",
]);
```

Call `products:setVariantImages` with only the selected role field. On Shopify success/Convex failure, set delivery to `failed` while retaining Shopify IDs and URL. Retry starts at Convex sync.

- [ ] **Step 7: Run publishing and preflight tests**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesImagePublishing.test.ts supabase/functions/_shared/shopifyPushDryRun.test.ts scripts/bestBottlesShopifyPublishPreflightCore.test.ts`

Expected: PASS, including duplicate request and partial recovery cases.

- [ ] **Step 8: Run the connected preflight without publishing**

Run: `npm run bestbottles:shopify:preflight -- --family Diva --capacity 30 --dry-run`

Expected: encrypted Shopify connection resolves, 12 exact Shopify variant identities resolve, Convex bridge is reachable, and no media is created.

- [ ] **Step 9: Commit in Madison**

```bash
git add supabase/functions/_shared/bestBottlesImagePublishing.ts supabase/functions/_shared/bestBottlesImagePublishing.test.ts supabase/functions/push-shopify-product-images/index.ts supabase/functions/bestbottles-convex/index.ts src/lib/bestBottlesImageAssets.ts scripts/bestBottlesShopifyPublishPreflightCore.test.ts
git commit -m "feat(best-bottles): publish approved image roles safely"
```

---

## Task 9: Add the clear Madison cohort review and action UI

**Files:**

- Create: Madison `src/lib/bestBottlesCohortReview.ts`
- Test: Madison `src/lib/bestBottlesCohortReview.test.ts`
- Create: Madison `src/components/bestbottles/CohortImageReviewBoard.tsx`
- Modify: Madison `src/pages/BestBottlesPipeline.tsx`
- Modify: Madison `src/components/bestbottles/GapWorklistView.tsx`

**Interfaces:** Consumes SKU jobs plus role-asset rows; presents family/size/color/cohort hierarchy, two assets per variant, three status axes, consistency overlays, and exactly one safe next action.

- [ ] **Step 1: Write failing view-model tests**

```ts
it("groups DIVA by size, color, cohort, and variant with one next action", () => {
  const view = buildCohortReviewView({ skuJobs, imageAssets });
  const cohort = view.families[0].sizes[0].colors[0].cohorts[0];
  assert.equal(cohort.id, "diva-30ml-clear-18-415");
  assert.equal(cohort.variants[0].assets.length, 2);
  assert.equal(cohort.variants[0].nextAction, "approve-and-publish");
  assert.deepEqual(Object.keys(cohort.summary), [
    "referenceReady",
    "generated",
    "needsReview",
    "approved",
    "shopifyPushed",
    "convexSynced",
    "uiVerified",
    "blockedConflicts",
  ]);
});

it("shows retry-publish without revoking approval", () => {
  const view = buildCohortReviewView({ skuJobs, imageAssets: failedDeliveryAssets });
  const variant = view.families[0].sizes[0].colors[0].cohorts[0].variants[0];
  assert.equal(variant.nextAction, "retry-publish");
  assert.equal(variant.qualityStatus, "approved-keep");
});
```

- [ ] **Step 2: Run the test and verify the view model is missing**

Run: `npx tsx --test src/lib/bestBottlesCohortReview.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the pure grouped view model**

The model must order sizes numerically, variants by assembled height then closure class, and assets as PDP then grid. It derives a single action priority: reference conflict, generate, review, approve/publish, retry publish, view live.

- [ ] **Step 4: Build the consistency board**

Render each catalog-grid asset on one shared baseline with optional millimeter guides and body-master silhouette overlay. Each variant row shows:

```text
SKU + closure | legacy reference | PDP hero | catalog grid | expected/measured height | Reference | Quality | Delivery | Next action
```

Keep prompts, hashes, QA JSON, Firecrawl evidence, and destination IDs in a collapsed inspector. Never place more than one primary action in a row.

- [ ] **Step 5: Integrate DIVA navigation without altering Cylinder defaults**

Add `Diva -> 30 ml -> Clear -> diva-30ml-clear-18-415` to the current pipeline routing. Existing family routes and Gap Worklist behavior remain intact.

- [ ] **Step 6: Run focused UI model and pipeline tests**

Run: `npx tsx --test src/lib/bestBottlesCohortReview.test.ts src/lib/bestBottlesImageAssets.test.ts src/lib/bestBottlesGapWorklist.test.ts src/lib/bestBottlesPipeline.test.ts`

Expected: PASS.

- [ ] **Step 7: Run lint and build**

Run: `npm run lint && npm run build`

Expected: PASS with no new warnings from the touched files.

- [ ] **Step 8: Commit in Madison**

```bash
git add src/lib/bestBottlesCohortReview.ts src/lib/bestBottlesCohortReview.test.ts src/components/bestbottles/CohortImageReviewBoard.tsx src/pages/BestBottlesPipeline.tsx src/components/bestbottles/GapWorklistView.tsx
git commit -m "feat(best-bottles): add DIVA cohort review board"
```

---

## Task 10: Verify role placement in the public Best Bottles UI

**Files:**

- Modify: Best Bottles `src/components/products/ProductImageGallery.tsx`
- Test: Best Bottles `tests/product-image-roles.test.ts`
- Create: Madison `supabase/functions/_shared/bestBottlesUiVerification.ts`
- Test: Madison `supabase/functions/_shared/bestBottlesUiVerification.test.ts`
- Create: Madison `supabase/functions/verify-bestbottles-image-placement/index.ts`
- Modify: Madison `src/lib/bestBottlesImageAssets.ts`

**Interfaces:** Consumes expected role URLs and public PDP/catalog routes; records evidence and reaches `ui-verified` only when the exact role is present for the exact SKU.

- [ ] **Step 1: Add failing HTML-verification tests**

```ts
it("verifies exact role, SKU, and Shopify source URL", () => {
  const html = `<img data-bb-image-role="catalog-grid"
    data-bb-grace-sku="GB-DIV-CLR-30ML-SPR-SBLK"
    data-bb-image-source-url="https://cdn.shopify.com/grid.png">`;
  assert.equal(verifyImagePlacementHtml({
    html,
    role: "catalog-grid",
    graceSku: "GB-DIV-CLR-30ML-SPR-SBLK",
    expectedSourceUrl: "https://cdn.shopify.com/grid.png",
  }).passed, true);
});

it("rejects a PDP hero appearing in the catalog-grid role", () => {
  const html = `<img data-bb-image-role="pdp-hero"
    data-bb-grace-sku="GB-DIV-CLR-30ML-SPR-SBLK"
    data-bb-image-source-url="https://cdn.shopify.com/pdp.png">`;
  assert.equal(verifyImagePlacementHtml({
    html,
    role: "catalog-grid",
    graceSku: "GB-DIV-CLR-30ML-SPR-SBLK",
    expectedSourceUrl: "https://cdn.shopify.com/grid.png",
  }).passed, false);
});
```

- [ ] **Step 2: Run the test and verify the verifier is missing**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesUiVerification.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Mark PDP source metadata explicitly**

Add an optional commerce role to `GalleryImage`, defaulting the main commerce image to `pdp-hero`:

```tsx
export type GalleryImage = {
  url: string;
  label: string;
  alt?: string;
  role?: "pdp-hero" | "cap-off" | "detail";
  auditMeta?: {
    surface: string;
    family?: string | null;
    productGroupSlug?: string | null;
    graceSku?: string | null;
    websiteSku?: string | null;
    shopifyVariantId?: string | null;
  };
};

<Image
  src={activeImage.url}
  alt={activeImage.alt ?? primaryAlt}
  fill
  loading="eager"
  fetchPriority="high"
  data-bb-image-role={activeImage.role ?? "pdp-hero"}
  data-bb-image-source-url={activeImage.url}
  data-bb-image-audit={activeImage.auditMeta?.surface ?? "pdp-gallery"}
  data-bb-family={activeImage.auditMeta?.family ?? undefined}
  data-bb-product-group-slug={activeImage.auditMeta?.productGroupSlug ?? undefined}
  data-bb-grace-sku={activeImage.auditMeta?.graceSku ?? undefined}
  data-bb-website-sku={activeImage.auditMeta?.websiteSku ?? undefined}
  data-bb-shopify-variant-id={activeImage.auditMeta?.shopifyVariantId ?? undefined}
  sizes="(min-width: 1024px) 50vw, 100vw"
  className={`object-contain ${mainPadding}`}
  unoptimized={isRemoteProductImageUrl(activeImage.url)}
/>
```

The catalog equivalent was added in Task 3.

- [ ] **Step 4: Implement strict placement verification**

Parse only `data-bb-*` attributes; do not accept a URL appearing in scripts, preload tags, JSON payloads, or another SKU's card. Return `{ passed, matchedRole, matchedSku, matchedSourceUrl, checkedAt, errors }`.

- [ ] **Step 5: Implement the verification Edge Function**

For an asset in `convex-synced`, query Convex to confirm the role-specific URL, fetch the exact PDP route plus the catalog route filtered to the product group, verify HTML, store both results, and transition to `ui-verified` only when the required role view passes. A failure retains Shopify and Convex success and increments retry count.

- [ ] **Step 6: Run verifier and storefront tests**

Run in Madison: `npx tsx --test supabase/functions/_shared/bestBottlesUiVerification.test.ts src/lib/bestBottlesImageAssets.test.ts`

Run in Best Bottles: `npx vitest run tests/product-image-roles.test.ts tests/product-card-variant-previews.test.ts tests/catalog.smoke.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit in each repository**

Best Bottles:

```bash
git add src/components/products/ProductImageGallery.tsx tests/product-image-roles.test.ts
git commit -m "feat(products): expose PDP image role verification"
```

Madison:

```bash
git add supabase/functions/_shared/bestBottlesUiVerification.ts supabase/functions/_shared/bestBottlesUiVerification.test.ts supabase/functions/verify-bestbottles-image-placement/index.ts src/lib/bestBottlesImageAssets.ts
git commit -m "feat(best-bottles): verify published image placement"
```

---

## Task 11: Run the DIVA pilot gate and document the operator procedure

**Files:**

- Create: Madison `docs/best-bottles/diva-30ml-calibration-runbook.md`
- Modify: Madison `package.json`
- Test: Madison full Best Bottles suite
- Test: Best Bottles catalog/PDP suite and build

**Interfaces:** Turns the implementation into a repeatable operator flow. It produces dry-run evidence first; generation and live publication remain separate, explicit actions.

- [ ] **Step 1: Add the runbook with exact gates**

```md
# DIVA 30 ml Clear Calibration Runbook

1. Confirm `FIRECRAWL_API_KEY` exists in Madison Supabase Edge Function secrets; never paste the value into logs or a manifest.
2. Run reference and measurement intake for family `Diva`, capacity `30`, color `Clear`.
3. Resolve every product-truth conflict until the manifest reports 12 eligible SKUs and 24 required role assets.
4. Run generation with `--dry-run`; confirm no Cylinder targets.
5. Run the connected Shopify/Convex preflight with `--dry-run`.
6. Generate the 12-SKU cohort; review the shared-baseline consistency board.
7. Approve each role independently. Use `Approve & Publish` only after geometry and visual QA pass.
8. Retry delivery failures from their saved stage; never regenerate an already approved asset because of a publish failure.
9. Finish only when all 24 assets are `ui-verified` and the 85/92/95/104/107/109 mm bands are visibly preserved.
```

- [ ] **Step 2: Add one aggregate pilot verification script**

```json
{
  "scripts": {
    "test:bestbottles:diva-pilot": "tsx --test src/lib/bestBottlesImageAssets.test.ts src/lib/bestBottlesMeasurementFirecrawl.test.ts src/lib/product-image/physicalScale.test.ts src/lib/bestBottlesDivaCalibration.test.ts src/lib/product-image/divaCalibrationPipeline.test.ts supabase/functions/_shared/bestBottlesImagePublishing.test.ts src/lib/bestBottlesCohortReview.test.ts supabase/functions/_shared/bestBottlesUiVerification.test.ts"
  }
}
```

- [ ] **Step 3: Run the complete Madison verification**

Run: `npm run test:bestbottles:diva-pilot && npm run test:bestbottles:image-coverage && npm run lint && npm run build`

Expected: all tests, lint, and build PASS.

- [ ] **Step 4: Run the complete Best Bottles verification**

Run: `npx vitest run tests/canonicalProduct.test.ts tests/product-image-roles.test.ts tests/product-card-variant-previews.test.ts tests/catalog.smoke.test.ts && npm run lint && npm run build`

Expected: all tests, lint, and build PASS.

- [ ] **Step 5: Run all connected preflights without remote mutations**

In Madison:

```bash
npm run bestbottles:references:intake -- --family Diva --capacity 30 --color Clear --dry-run
npm run bestbottles:measurements:intake -- --family Diva --capacity 30 --color Clear --dry-run
npm run bestbottles:generation:preflight-diva -- --dry-run
npm run bestbottles:generation:run-family -- --family Diva --capacity 30 --color Clear --dry-run
npm run bestbottles:shopify:preflight -- --family Diva --capacity 30 --dry-run
```

Expected: 12 exact SKUs, 24 role assets, one geometry cohort, six assembled-height bands, no product-truth conflicts, no Cylinder targets, and no writes.

- [ ] **Step 6: Inspect the Madison UI locally**

Start Madison with `npm run dev`, open the Best Bottles Pipeline, navigate to `Diva -> 30 ml -> Clear`, and verify:

- the cohort summary has all eight counts;
- each variant has two role tiles and one primary action;
- height guides preserve the six bands on one baseline;
- reference, quality, and delivery are distinct;
- failed delivery offers Retry Publish without removing Approved status;
- technical metadata is collapsed by default.

- [ ] **Step 7: Commit the runbook and aggregate script**

```bash
git add docs/best-bottles/diva-30ml-calibration-runbook.md package.json
git commit -m "docs(best-bottles): add DIVA pilot operating gate"
```

- [ ] **Step 8: Request review before any live generation or publish**

Use `superpowers:requesting-code-review`. Address findings, rerun Step 3 through Step 6, and present the dry-run manifest and UI for operator sign-off. Only then run live generation. Live publication remains per-asset through Madison's explicit `Approve & Publish` action.

---

## Plan Self-Review

- [x] Covers the approved two-output contract: PDP hero and catalog-grid derivative.
- [x] Preserves body identity across all closure variants and cap-specific assembled heights.
- [x] Uses the approved DIVA 30 ml Clear, 18-415, 12-SKU cohort and all six height bands.
- [x] Keeps Convex canonical, Madison operational, Shopify delivery-focused, and Sanity editorial.
- [x] Tracks every role asset from evidence through public UI verification.
- [x] Separates reference, quality, and delivery state and supports partial-publish recovery.
- [x] Provides exact repository paths, tests, commands, expected outcomes, and commit boundaries.
- [x] Isolates DIVA work from the active Cylinder work.
- [x] Contains no live credential values, placeholder steps, or implicit production mutations.
- [x] Defers DIVA 46 ml and 100 ml execution until the 30 ml render contract passes; the same schema, scale, ledger, publisher, UI, and verifier are reusable for those phases.

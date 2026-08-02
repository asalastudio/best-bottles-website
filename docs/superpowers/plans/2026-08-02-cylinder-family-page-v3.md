# Cylinder Family Page V3 and Unified 9 mL Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated Cylinder family page that helps B2B customers choose a bottle, then send them to one unified 9 mL 17-415 Cylinder PDP where all valid glass, applicator, roller-material, and finish configurations can be previewed with Paper Doll layers and purchased as exact catalog SKUs.

**Architecture:** The family page is a product-finding surface at `/catalog/cylinder`; the unified PDP is a configuration and purchasing surface at `/products/cylinder-9ml-17-415`. Convex remains the source of catalog, compatibility, pricing, stock, and SKU truth; Sanity owns editorial family content and Paper Doll layer assets. The initial storefront pilot is only `CYL-9ML` (classic 9 mL Cylinder, 17-415), and it is activated only after all 26 transparent layers pass the 2080×2288 migration gate.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Convex, Sanity, Sharp, Vitest, Tailwind CSS 4.

## Global Constraints

- The pilot is exactly `Cylinder + 9 mL + 17-415 + paperDollFamilyKey CYL-9ML`.
- Never include `TALLCYL-9ML`, the 9 mL 13-415 bottle, or infer compatibility from capacity alone.
- The family page finds the bottle; the unified PDP configures and purchases it.
- Default PDP view is `Beauty`; `Build This Bottle` is the equally visible alternate view.
- Selector order is Glass → Applicator → Roller Material when applicable → Finish.
- Convex product rows determine valid combinations; Sanity never invents compatibility.
- Paper Doll source layers are transparent RGBA PNGs on one exact 2080×2288 canvas.
- Recanvas all 26 `CYL-9ML` layers with one shared transform; never stretch or auto-center layers independently.
- The desktop screenshot is the first approval gate; mobile receives a safe stacked foundation in this branch and a separate visual-polish pass after desktop approval.
- Existing exact PDP routes remain recoverable and redirect to the unified page with the matching configuration preselected.
- Do not expose a builder when its Sanity document, canvas, layer mapping, or configuration coverage fails validation.

---

## Current-State Findings That Drive the Build

- There is no dedicated family route. `/catalog` is a filtered product list, and the current family banner reads `homepagePage.designFamilyCards`, not `productFamilyContent`.
- Production Sanity has zero `productFamilyContent` documents, so Version 3 needs a real Cylinder family content record.
- Production Sanity has four Paper Doll documents. `CYL-9ML` currently contains 26 matching-alpha layers on a legacy 1000×1300 canvas: 5 bodies, 10 roll-on caps, 2 rollers, 6 sprayers, and 3 pumps.
- The committed `data/paper-doll/CYL-9ML/manifest.json` says 2000×2200 and is stale relative to production Sanity. It cannot be used as migration truth.
- `PaperDollImage.tsx` is not wired into the live PDP. The PDP intentionally renders flattened Shopify/Madison imagery today.
- The current renderer derives layer keys from item names and family-specific lookup tables. The storefront builder must instead consume an explicit, validated configuration-to-layer mapping.
- Convex has 15 buildable 9 mL 17-415 groups linked to `CYL-9ML`, representing 145 configurations across five glass styles. Underlying variants include both metal and plastic rollers even where a product-group summary says only metal; option counts must be derived from product rows.
- The current uploader is CYL-9ML-specific, lacks a dry run and exact canvas validation, omits some supported slots, and replaces Sanity data without a full atomic preflight.

---

### Task 1: Define the unified product cohort and configuration contract

**Files:**
- Create: `src/lib/products/product-cohorts.ts`
- Create: `src/lib/products/cylinder-9ml-configurator.ts`
- Create: `src/lib/paper-doll/types.ts`
- Create: `tests/fixtures/cylinder-9ml.ts`
- Test: `tests/cylinder-9ml-cohort.test.ts`

**Interfaces:**
- Produces: `CYLINDER_9ML_17415_COHORT`, `isCylinder9ml17415Group()`, `buildCylinder9mlConfigurations()`, and the shared `PaperDollConfiguration` types.
- Consumes: raw Convex product groups and variants; no Sanity calls and no browser state.

- [ ] **Step 1: Write the cohort and mapping tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CYLINDER_9ML_17415_COHORT,
  buildCylinder9mlConfigurations,
} from "@/lib/products/cylinder-9ml-configurator";
import {
  swirlLegacySkuFixture,
  swirlWhiteCapFixtures,
  unknownFinishFixture,
} from "./fixtures/cylinder-9ml";

describe("CYL-9ML 17-415 configuration contract", () => {
  it("never accepts the 13-415 tall cylinder", () => {
    expect(CYLINDER_9ML_17415_COHORT.neckThreadSize).toBe("17-415");
  });

  it("maps both metal and plastic rollers with a white cap", () => {
    const rows = buildCylinder9mlConfigurations(swirlWhiteCapFixtures);
    expect(rows.map((row) => [row.applicatorKey, row.layerKeys.cap])).toEqual([
      ["metal-roller", "WHT"],
      ["plastic-roller", "WHT"],
    ]);
  });

  it("uses group color for the body layer even when a legacy SKU says CLR", () => {
    const [row] = buildCylinder9mlConfigurations([swirlLegacySkuFixture]);
    expect(row.layerKeys.body).toBe("SWL");
  });

  it("rejects unmapped layer values instead of guessing", () => {
    expect(() => buildCylinder9mlConfigurations([unknownFinishFixture])).toThrow(
      /Unmapped CYL-9ML finish/,
    );
  });
});
```

The fixture module must export complete group + variant rows. The two white-cap rows use group color `Swirl`, neck `17-415`, `paperDollFamilyKey: "CYL-9ML"`, and these identities:

```ts
export const swirlWhiteCapFixtures = [
  {
    group: { slug: "cylinder-9ml-swirl-17-415-rollon", family: "Cylinder", capacityMl: 9, neckThreadSize: "17-415", color: "Swirl", paperDollFamilyKey: "CYL-9ML" },
    variant: { graceSku: "GB-CYL-WHT-9ML-MRL-WHT", websiteSku: "GBCylSwrl9MtlRollWht", applicator: "Metal Roller Ball", capColor: "White" },
  },
  {
    group: { slug: "cylinder-9ml-swirl-17-415-rollon", family: "Cylinder", capacityMl: 9, neckThreadSize: "17-415", color: "Swirl", paperDollFamilyKey: "CYL-9ML" },
    variant: { graceSku: "GB-CYL-WHT-9ML-ROL-WHT", websiteSku: "GBCylSwrl9RollWht", applicator: "Plastic Roller Ball", capColor: "White" },
  },
] as const;
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/cylinder-9ml-cohort.test.ts`

Expected: FAIL because the cohort and mapping modules do not exist.

- [ ] **Step 3: Add the shared types and fixed cohort identity**

```ts
export type PaperDollMode = "rollon" | "spray" | "lotion";

export interface PaperDollLayerKeys {
  body: string;
  roller?: string;
  cap?: string;
  sprayer?: string;
  pump?: string;
}

export interface PaperDollConfiguration {
  graceSku: string;
  websiteSku: string;
  productGroupSlug: string;
  familyKey: "CYL-9ML";
  family: "Cylinder";
  capacityMl: 9;
  neckThreadSize: "17-415";
  glassLabel: string;
  glassKey: string;
  applicatorLabel: string;
  applicatorKey: string;
  mode: PaperDollMode;
  finishLabel: string;
  layerKeys: PaperDollLayerKeys;
  price1pc: number | null;
  priceTiers: Array<{ minQty: number; totalPrice: number; unitPrice: number }>;
  stockStatus: string | null;
  shopifyVariantId: string | null;
  shopifySellable: boolean | null;
}

export const CYLINDER_9ML_17415_COHORT = {
  slug: "cylinder-9ml-17-415",
  family: "Cylinder",
  capacityMl: 9,
  neckThreadSize: "17-415",
  paperDollFamilyKey: "CYL-9ML",
} as const;
```

- [ ] **Step 4: Implement explicit catalog-to-layer mapping**

Use these exact Sanity keys:

```ts
const BODY_KEYS = {
  Clear: "CLR",
  Amber: "AMB",
  "Cobalt Blue": "BLU",
  Frosted: "FRS",
  Swirl: "SWL",
} as const;

const ROLLON_CAP_KEYS = {
  "Black Dotted": "BLK-DOT",
  "Matte Copper": "MATT-CU",
  "Matte Gold": "MATT-GL",
  "Matte Silver": "MATT-SL",
  "Pink Dotted": "PNK-DOT",
  "Shiny Black": "SHN-BLK",
  "Shiny Gold": "SHN-GL",
  "Shiny Silver": "SHN-SL",
  "Silver Dotted": "SL-DOT",
  White: "WHT",
} as const;

const ROLLER_KEYS = {
  "Metal Roller Ball": "MTL-ROLL",
  "Plastic Roller Ball": "PLS-ROLL",
} as const;

const SPRAYER_KEYS = {
  Black: "BLK",
  Gold: "GL",
  "Matte Gold": "GL",
  "Shiny Gold": "GL",
  "Matte Silver": "MATT-SL",
  Red: "RD",
  "Shiny Silver": "SHN-SL",
  Turquoise: "TUR",
} as const;

const PUMP_KEYS = {
  Black: "BLK",
  Gold: "GL",
  "Matte Gold": "GL",
  "Shiny Gold": "GL",
  "Matte Silver": "MATT-SL",
} as const;
```

`buildCylinder9mlConfigurations()` must:

1. Require family `Cylinder`, capacity `9`, neck `17-415`, and group `paperDollFamilyKey === "CYL-9ML"`.
2. Read body color from the product group, not a legacy Grace SKU token.
3. Resolve the exact mode and layer keys from canonical applicator and finish fields.
4. Throw a diagnostic containing Grace SKU, group slug, and unmapped value when any required key is absent.
5. Return configurations sorted Glass → Applicator → Finish → Grace SKU.

- [ ] **Step 5: Run the focused and full unit suites**

Run: `npx vitest run tests/cylinder-9ml-cohort.test.ts`

Expected: PASS.

Run: `npx vitest run`

Expected: 38 existing test files plus the new cohort file pass.

- [ ] **Step 6: Commit the domain contract**

```bash
git add src/lib/products/product-cohorts.ts src/lib/products/cylinder-9ml-configurator.ts src/lib/paper-doll/types.ts tests/fixtures/cylinder-9ml.ts tests/cylinder-9ml-cohort.test.ts
git commit -m "feat: define unified 9ml cylinder configuration contract"
```

---

### Task 2: Add family-page and unified-cohort read APIs

**Files:**
- Modify: `convex/products.ts`
- Create: `src/lib/products/family-page-data.ts`
- Test: `tests/family-page-data.test.ts`

**Interfaces:**
- Produces: Convex queries `products.getFamilyPageData` and `products.getProductCohort`.
- Consumes: `CYLINDER_9ML_17415_COHORT` and the existing `productGroups` / `products` tables.

- [ ] **Step 1: Write failing aggregation tests**

Test pure normalization in `family-page-data.ts` with `tests/fixtures/cylinder-9ml.ts`, extending it with a zero-variant group, a 9 mL 13-415 group, and the inaccurate roll-on group summary.

```ts
it("derives roller material from variants instead of group applicatorTypes", () => {
  const page = buildFamilyPageData(cylinderFixtures);
  const cohort = page.cohorts.find((row) => row.slug === "cylinder-9ml-17-415");
  expect(cohort?.applicators).toContain("Metal Roller Ball");
  expect(cohort?.applicators).toContain("Plastic Roller Ball");
});

it("keeps 9ml 13-415 separate from 9ml 17-415", () => {
  const page = buildFamilyPageData(cylinderFixtures);
  expect(page.cohorts.map((row) => row.neckThreadSize)).toContain("17-415");
  expect(page.cohorts.find((row) => row.slug === "cylinder-9ml-17-415")?.paperDollFamilyKey)
    .toBe("CYL-9ML");
});
```

- [ ] **Step 2: Add the API payloads**

```ts
export interface FamilyPageData {
  family: string;
  totalReadyMadeGroups: number;
  totalVariants: number;
  cohorts: Array<{
    slug: string;
    capacityLabel: string;
    capacityMl: number;
    neckThreadSize: string;
    colors: string[];
    applicators: string[];
    variantCount: number;
    priceFrom: number | null;
    paperDollFamilyKey: string | null;
    isBuildable: boolean;
  }>;
}
```

`getFamilyPageData({ family })` must omit zero-variant groups and aggregate option breadth from real product variants. `getProductCohort({ family, capacityMl, neckThreadSize, paperDollFamilyKey })` must return only exact matching groups and their products, with enough pricing, sellability, image, specification, and cart fields to resolve an exact SKU without another browser query.

- [ ] **Step 3: Add bounded Convex reads**

Use the existing `by_family` and `by_productGroupId` indexes. Filter groups before loading products. Do not scan the full products table and do not use capacity as the only cohort key.

- [ ] **Step 4: Run tests and regenerate Convex types**

Run: `npx vitest run tests/family-page-data.test.ts tests/cylinder-9ml-cohort.test.ts`

Run: `npx convex codegen`

Expected: generated API includes both new queries and tests pass.

- [ ] **Step 5: Commit the read model**

```bash
git add convex/products.ts convex/_generated src/lib/products/family-page-data.ts tests/family-page-data.test.ts
git commit -m "feat: add family and product cohort read models"
```

---

### Task 3: Make Sanity the editorial and Paper Doll asset source

**Files:**
- Modify: `src/sanity/schemaTypes/documents/productFamilyContent.ts`
- Modify: `src/sanity/schemaTypes/documents/paperDollFamily.ts`
- Modify: `src/sanity/schemaTypes/objects/paperDollLayerAsset.ts`
- Modify: `src/sanity/lib/queries.ts`
- Create: `src/lib/paper-doll/sanity.ts`
- Test: `tests/paper-doll-sanity-contract.test.ts`

**Interfaces:**
- Produces: `getFamilyPageContent("Cylinder")` and `getStorefrontPaperDollFamily("CYL-9ML")`.
- Consumes: existing Sanity clients; no direct client-side GROQ inside the configurator.

- [ ] **Step 1: Add contract tests for a storefront-ready family**

```ts
it("rejects a storefront-ready paper doll family on the wrong canvas", () => {
  expect(() => validatePaperDollFamily({
    familyKey: "CYL-9ML",
    storefrontReady: true,
    canvasWidth: 1000,
    canvasHeight: 1300,
    layerAssets: [],
  })).toThrow(/2080×2288/);
});

it("requires every referenced asset to match the declared canvas", () => {
  expect(() => validatePaperDollFamily({
    familyKey: "CYL-9ML",
    storefrontReady: true,
    canvasPreset: "pdp-2080x2288",
    canvasWidth: 2080,
    canvasHeight: 2288,
    layerAssets: [{ slot: "body", variantKey: "CLR", width: 1000, height: 1300 }],
  })).toThrow(/canvas mismatch/);
});
```

- [ ] **Step 2: Extend `productFamilyContent` for the dedicated family page**

Add fields:

```ts
familyPageSlug: string;          // `cylinder`
familyPageEyebrow: string;       // `Buildable Bottle Family`
familyStory: string;             // existing field, used as the intro
familyHeroImage: image;          // opaque editorial 2080×2288 hero
familyHeroAlt: string;
featuredCohortSlug: string;      // `cylinder-9ml-17-415`
```

Update the image guidance from the obsolete 1400×600 banner recommendation to an exact 2080×2288 editorial image. Do not store product counts, prices, compatible colors, or applicators in Sanity.

- [ ] **Step 3: Add a safe Paper Doll publication contract**

Add:

```ts
canvasPreset: "legacy" | "pdp-2080x2288";
pipelineVersion: string;
assetRevision: string;
storefrontReady: boolean;
```

New documents default to 2080×2288 and `storefrontReady: false`. Existing legacy documents remain editable. A document can only be treated as storefront-ready when the server validator confirms exact dimensions, complete layer keys, and valid layer orders.

- [ ] **Step 4: Replace browser-side freeform resolution with server-side validated data**

`getStorefrontPaperDollFamily()` must return `null` unless:

- `familyKey === "CYL-9ML"`
- `storefrontReady === true`
- `canvasPreset === "pdp-2080x2288"`
- `canvasWidth === 2080` and `canvasHeight === 2288`
- all required layer assets have URLs and matching Sanity metadata dimensions
- layer keys are unique per slot

- [ ] **Step 5: Run schema and contract verification**

Run: `npx vitest run tests/paper-doll-sanity-contract.test.ts`

Run: `npx sanity schema validate`

Expected: tests pass and Sanity reports no schema errors.

- [ ] **Step 6: Commit the CMS contract**

```bash
git add src/sanity src/lib/paper-doll/sanity.ts tests/paper-doll-sanity-contract.test.ts
git commit -m "feat: add storefront-ready family and paper doll contracts"
```

---

### Task 4: Generalize and validate the 2080×2288 layer pipeline

**Files:**
- Create: `scripts/paper-doll/migrate-family-canvas.mjs`
- Create: `scripts/paper-doll/validate-family-assets.mjs`
- Modify: `scripts/paper-doll/generate-manifest.mjs`
- Modify: `scripts/paper-doll/upload-paper-doll-family.mjs`
- Replace: `data/paper-doll/CYL-9ML/manifest.json`
- Test: `tests/paper-doll-pipeline.test.ts`

**Interfaces:**
- Produces: a validated manifest and an idempotent `--dry-run` / `--apply` Sanity upload path.
- Consumes: the 26 local 1000×1300 `pipeline/paper-doll/output/CYL-9ML` source layers.

- [ ] **Step 1: Write Sharp-based pipeline tests using temporary RGBA fixtures**

The test imports `migrateLayerCanvas()` from the migration script, creates two 1000×1300 RGBA PNGs in a temporary directory with the same marker coordinate, migrates both, and proves that every slot receives the same affine transform and remains transparent and aligned.

```ts
const result = await migrateLayerCanvas({
  inputPath: bodyFixturePath,
  outputPath: migratedBodyPath,
  sourceWidth: 1000,
  sourceHeight: 1300,
  targetWidth: 2080,
  targetHeight: 2288,
});
expect(result.width).toBe(2080);
expect(result.height).toBe(2288);
expect(result.hasAlpha).toBe(true);
expect(result.transform).toEqual({ scale: 1.76, translateX: 160, translateY: 0 });
```

- [ ] **Step 2: Implement the deterministic recanvas operation**

For all 26 source layers use exactly:

```ts
const scale = 2288 / 1300; // 1.76
const translateX = (2080 - 1000 * scale) / 2; // 160
const translateY = 0;
```

Resize each full source canvas uniformly to 1760×2288 and extend 160 transparent pixels on both sides. Do not crop, trim, distort, or calculate transforms per layer. Transform anchors with `x2 = x1 * 1.76 + 160` and `y2 = y1 * 1.76`.

- [ ] **Step 3: Make manifest generation family-config-driven**

Support all current slots: `body`, `cap`, `roller`, `sprayer`, `overcap`, `shortcap`, and `pump`. Read filenames and keys from family configuration rather than CYL-9ML regex assumptions. The manifest must contain source checksum, output checksum, dimensions, alpha flag, layer order, transformed anchors, pipeline version, and generation time.

- [ ] **Step 4: Add exact preflight failures**

`validate-family-assets.mjs` exits nonzero for:

- a non-2080×2288 output
- a missing alpha channel
- duplicate `(slot, variantKey)`
- a missing required layer
- an unknown slot
- a missing source checksum
- any configuration layer key not present in the manifest

- [ ] **Step 5: Make upload dry-run-first and atomic**

`upload-paper-doll-family.mjs --dry-run` reads and validates without writing. `--apply` uploads checksum-missing assets, then patches the Sanity document only after all uploads succeed. The final patch sets canvas dimensions, preset, revision, layer orders, transformed anchors, and layer assets together; it leaves `storefrontReady` false until the post-upload readback passes.

- [ ] **Step 6: Generate and validate the real CYL-9ML outputs**

Run:

```bash
node scripts/paper-doll/migrate-family-canvas.mjs --family CYL-9ML --source pipeline/paper-doll/output/CYL-9ML --output pipeline/paper-doll/processing/CYL-9ML-2080x2288
node scripts/paper-doll/generate-manifest.mjs --family CYL-9ML --assets pipeline/paper-doll/processing/CYL-9ML-2080x2288
node scripts/paper-doll/validate-family-assets.mjs --family CYL-9ML --require-configurations 145
node scripts/paper-doll/upload-paper-doll-family.mjs --family CYL-9ML --dry-run
```

Expected: 26/26 layers valid, 145/145 configurations resolvable, zero canvas mismatches.

- [ ] **Step 7: Generate visual QA artifacts before production upload**

Render at minimum:

- five bodies with one neutral roll-on configuration
- metal and plastic rollers with white cap on Swirl
- all ten roll-on cap finishes on Clear
- all six sprayers on Amber
- all three lotion pumps on Frosted

Build one contact sheet plus full-size composites. Compare centerline, bottom baseline, neck registration, clipping, edge halos, and cap-to-fitment overlap. Production `--apply` is blocked until these pass human review.

- [ ] **Step 8: Commit code and the current manifest, not generated pipeline output**

```bash
git add scripts/paper-doll data/paper-doll/CYL-9ML/manifest.json tests/paper-doll-pipeline.test.ts
git commit -m "feat: migrate paper doll pipeline to 2080x2288"
```

---

### Task 5: Build the dedicated Cylinder family page V3

**Files:**
- Create: `src/app/catalog/[familySlug]/page.tsx`
- Create: `src/components/catalog/FamilyPageHeroV3.tsx`
- Modify: `src/app/catalog/CatalogClient.tsx`
- Modify: `src/app/catalog/page.tsx`
- Modify: `src/lib/seo.ts`
- Test: `tests/cylinder-family-page.test.ts`

**Interfaces:**
- Produces: canonical `/catalog/cylinder` and a `FamilyPageHeroV3` driven by Convex + Sanity data.
- Consumes: `getFamilyPageData`, `getFamilyPageContent`, and existing catalog filtering/grid behavior.

- [ ] **Step 1: Write route and content contract tests**

Verify:

- `cylinder` resolves to `Cylinder`
- unknown family slugs return `notFound()`
- the canonical is `/catalog/cylinder`
- the featured builder text says `9 mL · 17-415`
- the hero never reports hard-coded option counts
- the primary family CTA scrolls to the product list
- the featured cohort CTA links to `/products/cylinder-9ml-17-415?view=build`

- [ ] **Step 2: Add the dedicated server route**

The route fetches in parallel:

```ts
const [familyData, familyContent, catalogResult, taxonomy] = await Promise.all([
  convex.query(api.products.getFamilyPageData, { family: "Cylinder" }),
  getFamilyPageContent("Cylinder"),
  searchCatalogServer({ filters: cylinderLockedFilters, ... }),
  convex.query(api.products.getCatalogTaxonomy, {}),
]);
```

The generic `/catalog` remains unchanged for broad search. Existing links for a single family should be updated to `/catalog/cylinder`; multi-filter URLs remain on `/catalog`.

- [ ] **Step 3: Implement the desktop hero hierarchy**

Match the supplied desktop reference at its original viewport:

1. Left: eyebrow, `Cylinder`, family story, and dynamic breadth summary.
2. Center: dedicated opaque editorial hero image, independent of Paper Doll layers.
3. Right: `Featured bottle · 9 mL · 17-415` and a concise preview of five glass styles, three applicator systems, two roller materials, and finish breadth.
4. Primary CTA: `View & build the 9 mL Cylinder`.
5. Secondary CTA: `Browse all Cylinder bottles`, scrolling to the ready-made grid.

Do not repeat the same three option tiles in both left and right columns. The left side explains the family; the right side previews the featured buildable bottle.

- [ ] **Step 4: Reuse the existing catalog grid and filters**

Pass a locked family filter into `CatalogClient` instead of duplicating product-card, pagination, sorting, or filter logic. Hide the generic family filter group on the dedicated page; preserve Capacity, Glass Color, Applicator, and Neck Finish. Product cards link to the unified cohort PDP when the card belongs to `CYL-9ML`; include a configuration query that preselects the card's representative SKU.

- [ ] **Step 5: Add the responsive foundation**

Below the desktop breakpoint stack: title → hero image → featured bottle preview → CTAs → product list. Use semantic buttons, 44px minimum targets, visible focus, no horizontal overflow, and no modal builder. Full mobile screenshot matching is deferred until the desktop approval gate.

- [ ] **Step 6: Run route, unit, lint, and build checks**

Run:

```bash
npx vitest run tests/cylinder-family-page.test.ts tests/catalogFilters.test.ts tests/catalog.smoke.test.ts
npm run lint
npm run build
```

- [ ] **Step 7: Compare the implementation against the supplied desktop screenshot**

Capture the exact target viewport and place the reference and implementation screenshots side by side. Correct visible differences in grid proportions, hero crop, spacing, type scale, borders, CTA hierarchy, and below-fold transition before approval.

- [ ] **Step 8: Commit the family page**

```bash
git add src/app/catalog src/components/catalog/FamilyPageHeroV3.tsx src/lib/seo.ts tests/cylinder-family-page.test.ts
git commit -m "feat: add cylinder family page v3"
```

---

### Task 6: Build the unified PDP with Beauty and Build views

**Files:**
- Create: `src/components/products/UnifiedBottlePdp.tsx`
- Create: `src/components/products/PaperDollCanvas.tsx`
- Create: `src/components/products/BottleConfigurator.tsx`
- Modify: `src/app/products/[slug]/page.tsx`
- Modify: `src/components/products/ProductImageGallery.tsx`
- Modify: `src/lib/analytics.ts`
- Test: `tests/unified-cylinder-pdp.test.ts`

**Interfaces:**
- Produces: `/products/cylinder-9ml-17-415`, `?view=beauty|build`, and `?configuration=<graceSku>`.
- Consumes: the validated 145-row configuration array and storefront-ready Sanity Paper Doll family.

- [ ] **Step 1: Write state-machine and route tests**

Cover:

- Beauty is the default view.
- `?view=build` opens the configurator.
- a valid `configuration` selects the exact SKU.
- an invalid configuration falls back to the default and removes the bad query value.
- selecting a different glass invalidates only downstream choices that are not compatible.
- Roll-On reveals Metal / Plastic Roller; Spray and Lotion Pump do not.
- Swirl + Plastic Roller + White resolves to `GB-CYL-WHT-9ML-ROL-WHT`.
- Swirl + Metal Roller + White resolves to `GB-CYL-WHT-9ML-MRL-WHT`.
- price, tier ladder, stock, SKU, specifications, and cart identity come from the same selected configuration.
- missing or invalid Sanity assets hide the Build tab and leave the Beauty PDP fully usable.

- [ ] **Step 2: Add unified route resolution**

In `[slug]/page.tsx`, detect `cylinder-9ml-17-415`, fetch the exact cohort and Sanity asset document in parallel, build/validate the 145 configurations, and render `UnifiedBottlePdp`. Exact legacy CYL-9ML group slugs redirect to the unified route with their primary Grace SKU in `configuration`; unrelated PDPs continue through `ProductDetailClient` unchanged.

- [ ] **Step 3: Implement the view switch**

Use two labeled tabs directly above the image panel:

- `Beauty View`
- `Build This Bottle · 145 configurations`

Beauty renders the existing trusted Shopify/Madison gallery. Build renders `PaperDollCanvas`. The tab is text, not an unexplained icon. Preserve both experiences in the same 10:11 media frame so the page does not jump.

- [ ] **Step 4: Implement an explicit Paper Doll canvas**

`PaperDollCanvas` accepts only validated layer URLs and explicit layer keys:

```ts
interface PaperDollCanvasProps {
  canvas: { width: 2080; height: 2288; revision: string };
  selected: PaperDollConfiguration;
  assets: Record<string, Record<string, { url: string; alt: string }>>;
}
```

It never parses names, SKUs, or colors. Render selected layers on the full canvas at `(0,0)`, preserve order by mode, show a stable skeleton until all required layers load, and fall back to Beauty without leaving a broken transparent frame.

- [ ] **Step 5: Implement compatibility-aware controls**

Derive each next option from the remaining valid configuration rows:

1. Glass: Clear, Amber, Frosted, Cobalt Blue, Swirl.
2. Applicator: Roll-On, Fine Mist Spray, Lotion Pump.
3. Roller Material: Metal or Plastic, only for Roll-On.
4. Finish: visible labeled image/material buttons for the currently selected path.

Unavailable values remain visible only when they help explain the assortment; they are disabled with `Not available with this selection`. Never silently substitute a different SKU.

- [ ] **Step 6: Keep URL, commerce, and analytics state synchronized**

Use `router.replace()` with `view` and `configuration` while preserving scroll. Back/forward must restore the selection. Emit `paper_doll_view_opened`, `paper_doll_option_selected`, and `paper_doll_configuration_resolved` with family key, capacity, neck, SKU, and option dimension; never send image URLs.

- [ ] **Step 7: Run focused and regression verification**

Run:

```bash
npx vitest run tests/unified-cylinder-pdp.test.ts tests/checkout-readiness.test.ts tests/cart-direct-checkout.test.ts tests/customer-facing-product-names.test.ts
npx vitest run
npm run lint
npm run build
```

- [ ] **Step 8: Commit the unified PDP**

```bash
git add src/app/products src/components/products src/lib/analytics.ts tests/unified-cylinder-pdp.test.ts
git commit -m "feat: add unified 9ml cylinder paper doll pdp"
```

---

### Task 7: Production data, accessibility, performance, and rollout gate

**Files:**
- Create: `scripts/paper-doll/audit-storefront-family.mjs`
- Create: `tests/cylinder-v3-acceptance.test.ts`
- Modify: `docs/IMAGE_PIPELINE_CONTRACT.md`
- Modify: `docs/LAUNCH-READINESS-AUDIT-2026-07-29.md`

**Interfaces:**
- Produces: one pass/fail release report for the Cylinder V3 pilot.
- Consumes: production Convex data, production Sanity metadata, built Next.js app, and visual QA artifacts.

- [ ] **Step 1: Create the Cylinder Sanity editorial record**

Publish one `productFamilyContent` document with:

- family `Cylinder`
- slug `cylinder`
- eyebrow `Buildable Bottle Family`
- the approved family story
- a dedicated 2080×2288 opaque editorial hero image
- descriptive hero alt text
- featured cohort `cylinder-9ml-17-415`

Do not reuse Paper Doll transparent layers as the family hero.

- [ ] **Step 2: Upload the migrated layers and verify readback**

After contact-sheet approval, run the uploader with `--apply`, query Sanity again, and confirm 26 assets, exact 2080×2288 dimensions, unique keys, correct layer order, and matching asset revision. Only then set `storefrontReady: true` in the same controlled release session.

- [ ] **Step 3: Run the storefront family audit**

The audit fails unless all are true:

- exact cohort identity is 9 mL 17-415 / `CYL-9ML`
- 15 product groups and 145 configurations resolve
- 5 body, 10 cap, 2 roller, 6 sprayer, and 3 pump layers exist
- both Swirl white-cap roller configurations resolve
- all selected SKUs are present in Convex
- every layer is 2080×2288 with alpha
- the Sanity family is storefront-ready
- the Cylinder editorial hero exists

- [ ] **Step 4: Verify accessibility and mobile safety**

Keyboard-test tab switching and every selector. Confirm focus order follows visual order, selected state is announced, disabled choices explain why, alt text describes the current assembled bottle, 200% zoom does not clip controls, and 320px width has no horizontal scrolling. Confirm the global mobile navigation does not cover the configurator or cart action.

- [ ] **Step 5: Verify performance behavior**

The editorial hero is the only family-page LCP candidate. Do not preload all 26 Paper Doll layers. Preload only the selected configuration's 2–3 layers when the Build tab is opened; cache already-seen layers by Sanity revision and URL. Confirm switching a warmed option does not blank the entire canvas.

- [ ] **Step 6: Run the complete release gate**

```bash
npx vitest run
npm run lint
npm run build
node scripts/paper-doll/audit-storefront-family.mjs --family CYL-9ML --capacity 9 --neck 17-415
```

Expected: all tests pass, build succeeds, and the audit reports 145/145 valid configurations with zero missing layers.

- [ ] **Step 7: Record the rollout and commit**

Document the exact Sanity revision, audit timestamp, visual review result, and the fact that CYL-5ML, TALLCYL-9ML, and CYL-100ML remain legacy and disabled for the unified builder.

```bash
git add scripts/paper-doll/audit-storefront-family.mjs tests/cylinder-v3-acceptance.test.ts docs/IMAGE_PIPELINE_CONTRACT.md docs/LAUNCH-READINESS-AUDIT-2026-07-29.md
git commit -m "chore: add cylinder v3 release gate"
```

---

## Acceptance Summary

- A customer can land on `/catalog/cylinder`, understand the family, inspect capacities and ready-made products, and intentionally open the 9 mL 17-415 bottle.
- `/products/cylinder-9ml-17-415` is one PDP for all 145 valid configurations, not a generic family-wide builder.
- Beauty remains the default; Build is obvious and text-labeled.
- Glass, applicator, roller material, and finish selections always resolve to one real Convex SKU whose price, stock, specifications, and cart identity update together.
- Metal and plastic rollers with a white cap are available for the Swirl bottle.
- No 9 mL 13-415 assets, products, or fitments enter the pilot.
- Paper Doll layers switch without loading 30–40 flattened PDP images and without geometry movement.
- The desktop implementation visibly matches the supplied Version 3 reference; the mobile structure remains usable and ready for the subsequent polish pass.

## Explicit Defaults

- Branch: `codex/family-page-v3-cylinder`, based on `d132e97` (`codex/restore-release-gate`).
- Canonical family route: `/catalog/cylinder`.
- Canonical cohort PDP: `/products/cylinder-9ml-17-415`.
- Default configuration: Clear + Roll-On + Metal Roller + Matte Gold, provided that exact SKU passes the final Convex audit; otherwise select the first sellable configuration in the deterministic Glass → Applicator → Finish sort and record it in the audit output.
- Exact legacy CYL-9ML PDPs redirect to the unified PDP with a preselected configuration; no other family or capacity route changes.
- Legacy Paper Doll fields and documents remain readable for rollback but are not used by Version 3.

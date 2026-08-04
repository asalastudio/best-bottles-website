# CYL-9ML Paper Doll Draft Preview Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the current CYL-9ML Sanity draft release in the existing local/editorial Build UI without weakening or mutating the public storefront release gate.

**Architecture:** Add a server-only preview access decision and `previewDrafts` Sanity reader, factor Paper Doll validation into public and preview modes, and pass an explicitly labeled preview family into the existing unified PDP. Resolve each selected configuration before rendering so incomplete roll-on cap combinations produce a precise diagnostic while complete spray and lotion combinations render normally.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Sanity Client 7, Vitest 3.

## Global Constraints

- Preserve `/products/cylinder-9ml-17-415` and the existing `UnifiedBottlePdp`, configurator, and `PaperDollCanvas` presentation shell.
- Keep public reads gated by `storefrontReady === true`.
- Allow draft preview only in local development or signed Next.js Draft Mode.
- Never expose `SANITY_API_READ_TOKEN` to browser code.
- Do not publish or mutate Sanity, Madison, Current Release, or the public storefront.
- Require exact 2080 x 2288 Sanity CDN layers and fail closed on structural errors.
- Never substitute a missing cap or silently fall back inside the Paper Doll canvas.
- Preserve unrelated dirty work already present in the repository.

---

### Task 1: Preview access and validation contract

**Files:**
- Create: `src/lib/paper-doll/preview.ts`
- Modify: `src/lib/paper-doll/sanity.ts`
- Create: `tests/paper-doll-draft-preview.test.ts`

**Interfaces:**
- Produces: `isPaperDollDraftPreviewAllowed(input: { requested: boolean; draftModeEnabled: boolean; nodeEnv: string | undefined }): boolean`.
- Produces: `RenderablePaperDollFamily`, the shared structurally validated family shape with `storefrontReady: boolean`.
- Produces: `assertPreviewPaperDollFamily(value: unknown): RenderablePaperDollFamily`.
- Preserves: `assertStorefrontPaperDollFamily(value: unknown): StorefrontPaperDollFamily`, including the strict `storefrontReady === true` requirement.

- [ ] **Step 1: Write failing access and validation tests**

```ts
expect(isPaperDollDraftPreviewAllowed({ requested: true, draftModeEnabled: false, nodeEnv: "development" })).toBe(true);
expect(isPaperDollDraftPreviewAllowed({ requested: true, draftModeEnabled: true, nodeEnv: "production" })).toBe(true);
expect(isPaperDollDraftPreviewAllowed({ requested: true, draftModeEnabled: false, nodeEnv: "production" })).toBe(false);
expect(() => assertStorefrontPaperDollFamily(draftFixture)).toThrow("storefrontReady must be true");
expect(assertPreviewPaperDollFamily(draftFixture)).toMatchObject({ storefrontReady: false, familyKey: "CYL-9ML" });
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts`

Expected: FAIL because the preview access and preview validator exports do not exist.

- [ ] **Step 3: Implement the minimal access helper and shared structural validator**

`preview.ts` must return true only when `requested` is true and either Draft Mode is enabled or `nodeEnv === "development"`. Refactor the existing parser in `sanity.ts` so one internal validator accepts `{ requireStorefrontReady: boolean; requireLayerOrderCoverage: boolean }`. The public assertion passes `true` for both requirements. The preview assertion passes `false` for both, while retaining layer-order structure, dimension, URL, uniqueness, and metadata checks; per-configuration preflight reports missing selected layers.

- [ ] **Step 4: Run focused and existing contract tests**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts tests/paper-doll-shared-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/paper-doll/preview.ts src/lib/paper-doll/sanity.ts tests/paper-doll-draft-preview.test.ts
git commit -m "feat(paper-doll): add safe draft preview contract"
```

---

### Task 2: Server-only Sanity draft reader and product-page bridge

**Files:**
- Modify: `src/sanity/lib/serverClient.ts`
- Modify: `src/sanity/lib/queries.ts`
- Modify: `src/app/products/[slug]/page.tsx`
- Modify: `tests/paper-doll-draft-preview.test.ts`

**Interfaces:**
- Produces: `previewServerClient: SanityClient | null`, configured with the private server token and `perspective: "previewDrafts"`.
- Produces: `getPreviewPaperDollFamily(familyKey: string): Promise<RenderablePaperDollFamily | null>`.
- Product page passes `paperDollPreview: boolean` to `UnifiedBottlePdp` only when a permitted preview family was resolved.

- [ ] **Step 1: Add failing source-boundary tests**

```ts
expect(serverClientSource).toContain('perspective: "previewDrafts"');
expect(serverClientSource).not.toContain("NEXT_PUBLIC_SANITY_API_READ_TOKEN");
expect(queriesSource).toContain("getPreviewPaperDollFamily");
expect(productPageSource).toContain("isPaperDollDraftPreviewAllowed");
expect(productPageSource).toContain("paperDollPreview={paperDollPreview}");
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts`

Expected: FAIL because the server preview client and page bridge are absent.

- [ ] **Step 3: Implement the server-only draft reader**

Create `previewServerClient` beside `authenticatedServerClient`, using the same private token, `useCdn: false`, and `perspective: "previewDrafts"`. Add `getPreviewPaperDollFamily` that runs the existing family/current-release projection with the preview client and calls `assertPreviewPaperDollFamily(selectStorefrontPaperDollReleaseCandidate(family))`.

- [ ] **Step 4: Wire the explicit preview request into the unified product page**

Read `paperDollPreview` from `searchParams`, read `draftMode().isEnabled`, and call `isPaperDollDraftPreviewAllowed`. Use `getPreviewPaperDollFamily` only for an allowed preview; otherwise retain `getStorefrontPaperDollFamily`. Pass a boolean preview flag into the unified PDP. Do not change the Beauty Gallery query or public release behavior.

- [ ] **Step 5: Run the focused test and TypeScript**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/sanity/lib/serverClient.ts src/sanity/lib/queries.ts 'src/app/products/[slug]/page.tsx' tests/paper-doll-draft-preview.test.ts
git commit -m "feat(paper-doll): bridge Sanity drafts to local preview"
```

---

### Task 3: Partial-release canvas diagnostics and visual preview state

**Files:**
- Modify: `src/lib/paper-doll/render.ts`
- Modify: `src/components/products/PaperDollCanvas.tsx`
- Modify: `src/components/products/UnifiedBottlePdp.tsx`
- Modify: `tests/unified-cylinder-pdp.test.ts`
- Modify: `tests/paper-doll-draft-preview.test.ts`

**Interfaces:**
- Produces: `resolvePaperDollLayersResult(family, configuration): { ok: true; layers: StorefrontPaperDollLayer[] } | { ok: false; missing: { slot: string; variantKey: string | null; sku: string } }`.
- Preserves: `resolvePaperDollLayers`, which throws using the result for existing callers.
- `PaperDollCanvas` accepts `preview?: boolean` and renders only a successful layer result.
- `UnifiedBottlePdp` accepts `paperDollPreview?: boolean` and shows a labeled preview banner plus an exact missing-layer state.

- [ ] **Step 1: Write failing layer-resolution and UI contract tests**

```ts
expect(resolvePaperDollLayersResult(completeDraftFamily, sprayConfiguration)).toMatchObject({ ok: true });
expect(resolvePaperDollLayersResult(incompleteDraftFamily, rollonConfiguration)).toEqual({
  ok: false,
  missing: { slot: "cap", variantKey: "WHT", sku: rollonConfiguration.graceSku },
});
expect(unifiedPdpSource).toContain("Draft preview — not publicly released");
expect(unifiedPdpSource).toContain("Missing cap layer");
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts tests/unified-cylinder-pdp.test.ts`

Expected: FAIL because the result API and draft UI do not exist.

- [ ] **Step 3: Implement non-throwing preflight resolution**

Resolve the configured layer order in sequence. Return the first exact missing `{ slot, variantKey, sku }`; otherwise return all ordered layers. Keep the throwing wrapper for existing callers.

- [ ] **Step 4: Add the preview banner and exact missing-layer panel**

When `paperDollPreview` is true, enable the Build tab for a structurally valid draft. Preflight the selected configuration before mounting `PaperDollCanvas`. Render an amber `Draft preview — not publicly released` banner. For a missing layer, render `Missing <slot> layer: <variantKey>` and keep Beauty View available. Do not substitute a hero image inside the Build canvas.

- [ ] **Step 5: Run focused tests and TypeScript**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts tests/unified-cylinder-pdp.test.ts tests/paper-doll-shared-contract.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Verify the local UI**

Open: `http://localhost:3000/products/cylinder-9ml-17-415?view=build&paperDollPreview=1&applicator=Fine+Mist+Spray`

Verify: the amber draft banner is visible, a complete spray composition renders, changing to Lotion Pump renders, and selecting Roll-On reports the missing cap instead of showing a false composite or crashing.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/lib/paper-doll/render.ts src/components/products/PaperDollCanvas.tsx src/components/products/UnifiedBottlePdp.tsx tests/unified-cylinder-pdp.test.ts tests/paper-doll-draft-preview.test.ts
git commit -m "feat(paper-doll): show partial draft release in builder"
```

---

### Task 4: Final regression and handoff

**Files:**
- Modify only if verification reveals a defect in the files listed above.

**Interfaces:**
- Consumes the completed preview contract, server query, and UI state.
- Produces a verified local preview URL and no Sanity mutations.

- [ ] **Step 1: Run the complete focused regression set**

Run: `npx vitest run tests/paper-doll-draft-preview.test.ts tests/unified-cylinder-pdp.test.ts tests/paper-doll-shared-contract.test.ts tests/madison-sanity-adapter.test.ts`

Expected: PASS.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Confirm repository scope**

Run: `git status --short`

Expected: only pre-existing unrelated user changes remain; the preview work is committed.

- [ ] **Step 4: Handoff the local preview**

Leave the verified Chrome tab open at the preview URL and report the exact remaining cap blockers. Do not publish the Sanity release or family document.

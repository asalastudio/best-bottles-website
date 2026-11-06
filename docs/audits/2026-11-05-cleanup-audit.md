# Codebase cleanup, image and performance audit — 5 November 2026

Phase 1 (audit) and Phase 2 (baseline) of Jordan's cleanup directive. Nothing in the
codebase was changed to produce this document. Branch `claude/cleanup-performance-audit-999c4f`,
cut from `main` at `8bb70174` (merge of #407).

Method. Four read-only sweeps ran in parallel over the worktree: Convex and data fetching,
`public/` asset references, components/CSS/dependencies, and SEO/accessibility/scripts/tests.
Their full reports (with the exact grep patterns used) are kept with the session notes and are
summarised here. On top of that, an import graph of `src/` was built from every `import`,
`export … from`, `import()` and `require()` specifier (resolving `@/` and relative paths) with
Next.js convention files, `proxy.ts`, instrumentation, Sentry configs, `convex/**`, `tests/**`,
`scripts/**` and the root configs as entry points. Every "unused" claim below says which checks
support it. Convex data is not in the repo, so anything a Convex `imageUrl` row could point at is
flagged as such rather than called unused.

---

## 0. Highest-impact opportunities, in order

| # | Opportunity | Evidence | Expected effect | Batch |
|---|---|---|---|---|
| 1 | `display-images.generated.json` (733 KB raw, 138 KB gzip) ships in the client JS of essentially every page | It is imported by `display-derivative.ts` → `optimizable-image.ts`, which 25 client components use (Navbar, HomePage, CatalogClient…). The built chunk `4920-….js` is 753 KB raw / 142 KB gzip and is almost entirely this JSON; Lighthouse attributes 83 ms of script evaluation to it on the catalog page. | About 140 KB gzip less JavaScript and less parse time on every page. Move the lookup server-side (resolve derivative URLs in the server component / search response) or ship only the keys the page needs. | Frontend perf |
| 2 | Catalog cards are invisible until hydration, and the client repeats the server search on mount | `CatalogClient.tsx:449,621` wrap cards in `motion.article initial={{ opacity: 0 }}`; Lighthouse records no LCP element on `/catalog` and a simulated mobile LCP of 8.5 s with only 138 KB of images. The mount effect at `CatalogClient.tsx:1248-1298` POSTs `/api/catalog/search` (98 KB) for the state the server just rendered as `initialResult`; every filter change then triggers both an RSC navigation and the POST. | Catalog LCP should fall to roughly FCP (≈2 s simulated) once cards paint from SSR; one Convex search per interaction instead of two. | Frontend perf + data |
| 3 | Product page: Render Delay of 7.7 s on the LCP layer, whole Convex documents serialized twice | Lighthouse on the Pillar PDP: TTFB 0.46 s, image loaded by 2.0 s, painted at 9.6 s. `page.tsx` passes every variant's full 78-field row (including `components: v.any()`) to the client, and `GraceProvider.tsx:807` re-subscribes `useQuery(api.products.getProductGroup)` for the same slug on every `/products/*` URL. `loadRedesignPayload` awaits sibling `getProductGroup` calls, two `loadRegisterKits`, kit chunks, `getShopCollectionGroups` and stage envelopes sequentially after the first `Promise.all`. | Smaller RSC payload, one fewer live subscription per PDP, lower TTFB; the render delay needs a trace to pin down (likely hydration-gated stage). | Data + frontend perf |
| 4 | ~600 MB of `public/` ships to Vercel but production never reads it; 131 MB is provably unreferenced | `public/preview` 80 MB (0 src refs), non-excluded `public/local-kits` 181 MB (read only on localhost; `.vercelignore` already excludes 12 of its folders), non-excluded `public/reviews` 164 MB (review artefacts), `images/boston-plate-candidates` + `boston-source-recovery` 115 MB (team ledger inputs only), `images/store` 9.6 MB (local mirror never served), lab-only `models/bodies*` 32 MB. Provably unreferenced: `public/assets/Untitled-{1,2}.psd` (49 MB), `images/catalog/cylinder/` (70 MB, 0 hits anywhere; Convex caveat), three HDRs (9.8 MB), `env/studio_small_08_1k.hdr` (1.4 MB), 5 Next scaffold SVGs. | Smaller deploy uploads and build output; repo clone shrinks (CI checkout is 82 s today). Deliver as `.vercelignore` rules first (zero risk to the site), deletions second. | Dead code / assets |
| 5 | Every route is dynamic and the root layout does a Sanity round trip per request | `layout.tsx` calls `cookies()`, `headers()` and an uncached `getMegaMenuPanels()` on every request; `force-dynamic` on catalog/PDP is redundant. Local TTFB is 450–620 ms before any Convex work. | Cache the mega menu (`unstable_cache`, 5 min); later move the region cookie read below the shell. | Data |
| 6 | Dead code: ≈3,050 lines of unreachable `src/` files, ~750 dead lines in `HomePage.tsx`, ~190 dead lines in `globals.css`, 7 dependencies with no import | Import graph + import-specific grep (section 1). Ten components defined in `HomePage.tsx` lines 78–822 are never rendered. | Smaller bundles for the dead framer-motion importers, faster typecheck/lint, less to review. | Dead code |
| 7 | hreflang is dropped on most pages | Next merges `alternates` shallowly; only 5 pages call `buildHreflangAlternates`, the rest set `alternates: { canonical }` and lose `languages`/`x-default`. No test covers it. | Correct en/es signals on PDP, blog, policies. | SEO |
| 8 | Product JSON-LD omits `image` unless the variant image is a preferred Shopify URL | `page.tsx:478-480`; OG already falls back to the group hero. | Product rich results eligible. | SEO |
| 9 | Clerk development instance on production | 296–310 KB of script from `together-lemur-38.clerk.accounts.dev` plus a handshake redirect on every first visit (known from #403). | ~2 s of simulated LCP; account/config decision for Jordan at the domain cutover, not a code change. | Out of scope |

---

## 1. Safe removals (a)

### 1.1 Unreachable `src/` files (import graph + import-specific grep)

Check: not an entry point; no `import`/`import()`/`require` specifier resolves to the file from
`src/`, `convex/`, `tests/`, `scripts/` or configs; basename re-grepped as text repo-wide.

| File | Lines | Notes |
|---|---:|---|
| `src/components/PaperDollImage.tsx` | 632 | only a doc comment in `ProductImageGallery.tsx:31` and a comment in `convex/fix5mlCapColors.ts` mention it |
| `src/components/products/Bottle3DConfigurator.tsx` | 428 | imports framer-motion and `Bottle3DViewer` |
| `src/components/mobile/MobileTabBar.tsx` | 195 | `--mobile-tab-bar-height` is already `0px` (globals.css:9, 4 Nov); six text-reading contract tests pin the file (see 1.6) |
| `src/components/ui/sheet.tsx`, `table.tsx`, `minimal-card.tsx`, `texture-button.tsx`, `direction-aware-tabs.tsx`, `alert.tsx`, `animated-number.tsx`, `separator.tsx`, `tooltip.tsx`, `progress.tsx`, `skeleton.tsx` | 905 | shadcn/cult-ui components never imported (`@/components/ui/<name>` has zero hits); live `ui/` files are `button`, `badge`, `card` |
| `src/components/matrix/ClosureIcon.tsx` | 138 | |
| `src/lib/three/studioEnvironment.ts` | 125 | procedural HDRI; parallel to the live `components/products/StudioEnvironment.tsx` |
| `src/components/home/HomeCatalogBrowser.tsx` | 101 | its `.module.css` **is** imported by `HomePage.tsx` and stays |
| `src/app/team/asset-ledger/LedgerTable.tsx` | 89 | |
| `src/components/products/Viewer3DBoundary.tsx` | 89 | only a comment in `ProductDetailClient.tsx:2384` and `tests/observability-wiring.test.ts` (reads the file as text) |
| `src/components/products/PaperDollCanvas.tsx` | 87 | |
| `src/components/catalog/RefineSection.tsx` | 72 | framer-motion importer |
| `src/components/grace/GraceFileChips.tsx` | 66 | |
| `src/lib/useIsAuthenticated.ts` | 54 | |
| `src/components/PdpGraceTrigger.tsx` | 53 | |
| `src/components/grace/GraceLauncher.tsx` + `.module.css` | 62 | floating bubble removed in #405; two contract tests read the file |
| `src/components/executive/ExecutiveRankedBars.tsx` | 47 | |
| `src/lib/executive/contracts.ts` | ~80 | |
| `src/lib/portal/addressSync.ts` | ~100 | |
| `src/lib/asset-ledger/plate-geometry.json` | 1.65 MB | written by `scripts/asset-ledger/measure-plates.py`, read only by `scripts/asset-ledger/build.mjs`; a script artefact under `src/` — move to `data/asset-ledger/` |
| `src/lib/bottle-builder/circle-bodies.generated.json` | 1.4 KB | written/read only by `scripts/paperdoll/*.py` |

Keep (false positives of a naive check): `src/i18n/global.ts` (ambient `declare module` for
next-intl), `src/i18n/request.ts` (referenced by path in `next.config.ts`).

### 1.2 Dead code inside live files

- `src/components/HomePage.tsx` lines 78–822: `Hero`, `MobilePostHeroSearch`, `TrustBar`,
  `GuidedSelector`, `PathChooser`, `ApplicationShowcase`, `SampleTestersFeature`,
  `EditorialStories`, `PackagingAccessoriesStory`, `SocialProof` are defined and never rendered
  (`<Name` has zero uses in the file and repo-wide; the default export renders only
  `ShoppingHeader`, `CollectionShopping`, `EducationPreview`, `Footer`). They hold the only `fill`
  images without `sizes`, an `<Image priority unoptimized>`, an `alt=""` on a meaningful image and
  two image-only links without labels. ≈750 lines.
- `src/app/globals.css`: ≈190 dead lines — `.animate-fade-in-up`, `.animate-fade-up`,
  `.body-copy`/`.product-description`, `.brand-heading`, `.cart-drawer-enter/-exit`,
  `.cart-overlay-enter`, `.text-shimmer`, the Grace launcher/voice block (lines 480–668 except
  `grace-wave-bar`, which `VoiceWaveGlyph.tsx` uses), keyframes with no user
  (`grace-launcher-pulse`, `kitIn`, and those used only by dead classes), `[data-shop-menu]`,
  and the `[data-mobile-tab-bar]` rules. Which rules consume `gracePulse*` must be confirmed before
  deleting those keyframes. Clerk's `.cl-*` rules (18 classes) are applied by Clerk's DOM and stay.
- `src/components/icons.tsx`: 18 re-exported names with no importer; a second Phosphor shim in
  `grace-workspace/icons.tsx` (3 importers) can fold into it.
- `src/lib/seo.ts:160` `buildCollectionPageJsonLd` has no caller (either wire into `/collections`
  or drop).
- `src/lib/shopify.ts`: `getProductByHandle`, `getProductByGid`, `getAllProducts`,
  `getInventoryLevels`, `createMetafieldDefinition` (≈190 lines) have no caller. Admin-API code;
  remove only after confirming no script relies on them by dynamic name.
- Unreferenced exports in `catalogFilters.ts`, `pdp-redesign/model.ts`, `pdp-redesign/stage.ts`,
  `register/stage-kit.ts`, `catalog/searchInterpretation.ts`, `configurator/families.ts`,
  `materials/glassPresets.ts`, `team/createProduct.ts`, `portal/draftEditor.ts`,
  `item-description/compose.ts`, `canonicalProduct.ts` (list in the components report). Tree-shaken
  already; hygiene only.

### 1.3 Dependencies

Check: grep of every import specifier across `src/`, `convex/`, `scripts/`, `tests/`, `tools/`,
`pipeline/` and the root configs.

| Package | Status | Note |
|---|---|---|
| `@ai-sdk/anthropic`, `@ai-sdk/provider-utils`, `@anthropic-ai/sdk`, `ai` | no import anywhere | Grace runs on `openai` and `@openai/agents`. Verify `npm ls` peers before removing (`ai` could be a peer of `@convex-dev/agent`). |
| `styled-components` | no import anywhere | |
| `@convex-dev/rag` | no import anywhere | `convex.config.ts` registers only `agent` and `posthog` |
| `react-use-measure`, `@radix-ui/react-progress`, `@radix-ui/react-separator`, `@radix-ui/react-tooltip` | each imported by exactly one dead `ui/` file | remove with the files |
| `shadcn` (dev) | CLI only | keep only if the team still runs `npx shadcn add`; `components.json` names `lucide` which is not installed |
| `@convex-dev/agent` | registered in `convex/convex.config.ts` only; no `components.agent` use in `convex/` or `src/` | removing a component changes the Convex deployment — Jordan's call, not a code cleanup |
| `next-sitemap` | one import (`server-sitemap.xml/route.ts` serialiser) | keep |
| `@edge-runtime/vm` (dev) | no import, but 10+ tests use `// @vitest-environment edge-runtime` | keep |
| `@vercel/blob` (dev) | only `scripts/paperdoll/lib/store-blob.mjs` | placement correct |

### 1.4 `public/` (reference checks: literal paths, dynamic template literals into each directory, JSON registries, tests, scripts, `.vercelignore`)

Provably unreferenced (no hit anywhere, no dynamic path into the directory, not a convention):

| Path | Size | Check |
|---|---|---|
| `public/assets/Untitled-1.psd`, `Untitled-2.psd`, `uploaded_hero.png`, `vintage-spray.png`, `hero_bottles.png` | 50 MB | 0 hits; `/assets/` root has no template literal |
| `public/images/catalog/cylinder/` (52 files) | 70 MB | 0 basename hits in any tracked text file; added in 696ea7cd, superseded by `cylinder-hover`. **Convex `imageUrl` rows not checked** — verify with a read-only dev-Convex query before deleting |
| `public/models/studio-classic.hdr`, `studio-universal.hdr`, `studio-metal-ph.hdr` | 9.8 MB | all HDR names are literals; 0 hits |
| `public/env/studio_small_08_1k.hdr` | 1.4 MB | 0 hits; byte-identical to `studio-metal-ph.hdr` |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | 3 KB | Next scaffold; 0 hits |
| `public/reviews/icons-2026-11-04/` (2 html), `public/bottle25/*.json` | small | 0 hits |

Deploys but is never read by production code (candidates for `.vercelignore`, which is the
zero-risk first step):

| Path | Size | Why it is safe to exclude from deploys |
|---|---|---|
| `public/preview/` | 80 MB | 0 src refs; inputs for `scripts/assemble-cylinder-hover.cjs` |
| `public/local-kits/*` not already excluded | 181 MB | read only via `readFileSync` behind `NODE_ENV==="development" && !VERCEL` in 15 `api/bottle-masters/*` routes and `local-component-kits.ts` (`if (process.env.VERCEL) return null`). **Keep `pillar-caps-2026-11-04/kits.json`**: it is a build-time static import in `approved-component-kits.ts:2` |
| `public/reviews/*` not already excluded | 164 MB | review artefacts; storefront touches only `cylinder28-sunburst-2026-11-04` (2 PNGs on a dev-gated path) and the team ledger links |
| `public/images/boston-plate-candidates`, `boston-source-recovery`, `cylinder-plate-candidates`, `boston-kit-*`, `missing-plate-acquisition-*`, `bottle-standards` | ~130 MB | referenced only by `ledger.json`/`data/asset-ledger/*.json` for the internal Team asset-ledger page; `cylinder-plate-candidates` is 71/72 byte-identical to `plate-contact-sheets` |
| `public/images/store/` | 9.6 MB | the site matches the *remote* `www.bestbottles.com/images/store/` host, never the local path |
| `public/models/bodies`, `bodies-threaded`, `matcaps`, `pbr/brush` | 32 MB | used only by `/lab/*` and `/dev/*` |
| `public/assets/hero/v4–v7, frames` | 13.8 MB | `EmpireFitmentHero` reads `NEXT_PUBLIC_HERO_SET ?? "v8"`; older sets only in scripts — confirm the env var is unset on Vercel |
| `public/assets/cards/`, `sketches` extras, `references/9ml` | ~8 MB | scripts/docs only |

Byte-identical duplicates under `public/`: 641 groups, 1,451 files, 60 MB reclaimable (largest:
`cylinder-plate-candidates` ↔ `plate-contact-sheets` 8.2 MB; within `reviews/legacy-rebuild`
6.6 MB; `local-kits/elegant60-100-masters` ↔ `reviews/elegant-master-candidates` 6.5 MB).

Release artefacts to keep exactly as they are: every `public/images/catalog/<release>/` folder
named in a `catalog-hero-*.json` / `catalog-heroes.json` registry (1,051 heroes, 1.27 GB), the
`cylinder-hover` WebPs, `cap-swap-shadows`, `images/register/tubes`, `images/bottle-builder`
(part URLs come from Convex kits), the 19 `local-kits/*/kits.json` files that tests hash, and
`public/local-kits/pillar-caps-2026-11-04/kits.json`.

### 1.5 Repo root and tooling clutter

- Tracked Office lock files: `~$Grid-Image-Tracker.xlsx`, `.~lock.Grid-Image-Tracker.xlsx#`.
- Tracked `scripts/__pycache__/*.pyc` (2 files); `.gitignore` has no `__pycache__`, `*.pyc`,
  `~$*`, `.~lock.*#` rules.
- `path/to/your/convex_products.csv` (1.9 MB; a placeholder path from a copy-paste), `static/.gitkeep`
  (Next warns the `static` directory is deprecated on every start), `format_json.js` (one-off),
  `outputs/product-knowledge-2026-05-14/` (99 MB, zero references, already in `.vercelignore`).
- `clear_loop.mjs` at the repo root calls `api.seedProducts.clearAll` (wipes products). Delete or
  quarantine under `scripts/legacy/` with a guard. Not a performance item, a safety one.
- Three `tests/*.test.mjs` files are never run (vitest includes only `*.test.{ts,tsx}`).
- 49 of 232 top-level `scripts/` entries have no reference from `package.json`, workflows, docs or
  other scripts (list in the scripts report). Four of them (`run_*`) call Convex mutations and
  should be quarantined rather than left discoverable.
- Convex modules with no reference anywhere (deploy on every push): `backfillEmpireSprayerTrimColor`,
  `backfillTrimColor`, `backfillTrimColorFromDescription`, `debug5ml`, `fix5mlCapColors`,
  `fixEmpireDiameters`, `fixOrphanProducts`, `importMissingLiveProducts`, `repairCylinderPilot`,
  `repairCylinderAvailability` (+ its 27 KB JSON). "No reference" cannot see ad-hoc
  `npx convex run`; removing them changes the deployed function set, so this is a Jordan-approval
  item. `migrations.ts` (~110 exports) is a runtime dependency only through `getProductPage`.

### 1.6 Tests that pin dead files

Seven contract tests read `MobileTabBar.tsx` / `GraceLauncher.tsx` as text
(`responsive-shell-contract`, `grace-agentic-handoff`, `mobile-homepage-redesign`,
`mizan-ux-recovery`, `mobile-pdp-models`, `portal-mobile-shell`, `grace-hardening`) and
`observability-wiring` reads `Viewer3DBoundary.tsx`. Removing the components means updating those
assertions to check the absence (and the `AppProviders` comment), not deleting the tests.

---

## 2. Consolidation opportunities (b)

- Two product pages are both live: the redesigned PDP (`src/components/pdp`, 2,411 lines +
  2,083-line module) serves bottle-grammar slugs; the classic `ProductDetailClient.tsx`
  (3,299 lines, client) still serves Atomizer, zero-variant and non-bottle slugs, with ≈7,170
  lines of classic-only code behind it (`ConfiguratorPdp`, `PdpDiscoverySections`,
  `ProductImageGallery`, `products/mobile/*`). How many live groups hit the classic page is
  unverified (needs a dev-Convex query). Keep both; this is a product migration, not a cleanup.
- Byte-identical helpers: `isBlockedProductImageUrl`/`usableProductImageUrl` in four files
  (`ProductDetailClient.tsx:606`, `CatalogClient.tsx:193`, `catalog-line-items.ts:46` (exported),
  `product-card-variant-previews.ts:424`); `isShopifyCdnImageUrl` in `page.tsx:62` and
  `ProductDetailClient.tsx:622`; `formatCurrency` ×4 and `money` ×3 in portal pages; local
  `money`/`formatPrice` wrappers around `useRegion().formatPrice` in 10 files
  (`MobileBuilder.tsx:20` hard-codes USD and bypasses the region).
- 15 server-side `ConvexHttpClient` factories each reading `NEXT_PUBLIC_CONVEX_URL` → one
  `lib/convex/server.ts`.
- 20 raw `window.matchMedia` sites in 11 files with six different breakpoints (640, 767/768, 899,
  1023, 1099, 1279) beside one hook (`use-viewport-is-mobile.ts`).
- Homepage hero: three scenes shipped (`StoneHeroArt` default, `?hero=water` → `ImmersiveHeroArt`,
  `?hero=niche` → `EmpireFitmentHero` 204 lines + 202-line module); `CollectionShopping.module.css`
  has 15 classes no importer uses and 5 selectors defined twice (~470 lines once the stone hero is
  confirmed final — comment at line 53 says keep for comparison as of 4 Nov).
- Section-specific rules in `globals.css` (`data-mobile-pdp`, `data-builder-page`,
  `data-portal-shell` + 63 `!important`s, `data-pdp-redesign`) belong in their modules.
- Two cached copies of `getAllCatalogGroups` (`catalogServer.ts:106-121` at 30 s and
  `homepageBrowse.server.ts:9-12` at 60 s) → one shared snapshot with `revalidateTag`.
- `src/lib/matrix/*`, `cylinder-9ml-configurator`, `cylinder-v3-release`, `unified-cylinder-pdp`,
  `catalog-ux-matrix`, `cylinder-catalog-heroes`, `paper-doll/{madison-sanity-adapter,preview,render}`,
  `catalogResultIntegrity`, `grace/sessionTraceEval`, `portal/certificateNotifications` are reached
  only from tests or scripts — alive for tests, dead for the app. Decide per file whether the test
  documents a contract worth keeping.

---

## 3. Refactoring opportunities (c)

- `GraceProvider.tsx` is 3,282 lines, `"use client"`, and mounts on every page through
  `AppProviders` (31 `useEffect`, 41 `useRef`, 19 `useState`, Convex hooks, 14 `window` reads,
  `ResizeObserver`, `sessionStorage`). The realtime SDK is already lazy (#403), but the provider
  itself is not split; a thin context plus a `next/dynamic` body on first open would move most of it
  off the first load.
- `GraceChatDrawer` (framer-motion) and `CartDrawer` (framer-motion) are always mounted but render
  nothing until opened → lazy-mount candidates; framer-motion stays in the shared chunk while they
  are static imports.
- `HomePage.tsx` (892 lines) is one client component for the whole homepage; `Footer.tsx` is client
  only for the newsletter `useMutation` (server shell + small island).
- `/products/[slug]/page.tsx` imports three `.mjs` files from `scripts/asset-ledger/` into the
  page module; the `redesignApplies` branch still awaits classic-only reads being skipped by
  `Promise.resolve`, and `loadRedesignPayload` is sequential (section 4).
- Nine redundant `"use client"` directives on components with no hooks or browser APIs
  (`PatternH_ReferenceMatch`, `PatternE_Anatomy`, `GraceSpecBlock`, `AuthShell`,
  `SwitchAccountButton`, `VoiceWaveGlyph`, `PdpKitStackImage`, both icon shims).
- Dev and lab routes (`/dev/*`, `/lab/*`, `/example`, `/fitment-demo`, `/tech-stack`): ~4,900 lines
  and the Three.js stack compiled as 8 extra route chunks on every build (relevant to the webpack
  OOM history in `next.config.ts`). They are noindexed and disallowed, but not gated: a
  `notFound()` in `dev/layout.tsx` and `lab/layout.tsx` when `VERCEL_ENV === "production"` is the
  minimum. `/example` and `/fitment-demo` (plus `FitmentCarousel`/`FitmentDrawer`/
  `FitmentIntegrationDemo`, 448 lines) have no other importer.
- `/team/**` pages each do their own `auth()` + allow-list; a `team/layout.tsx` gate would stop a
  new sub-page shipping ungated. `/executive` is page-gated only.

---

## 4. Performance bottlenecks (d)

### 4.1 Lab measurements that frame the work

Simulated mobile (Lighthouse 12.8.2, slow 4G, 4× CPU) against a local production build with the
dev Convex deployment, median of 3; see section 7 for the full table. Script bytes are 0.9–1.1 MB
gzip on every page (296 KB of that is Clerk from `accounts.dev`); images are small everywhere
(largest 131 KB). LCP is therefore script-bound, not image-bound:

| Page | FCP | LCP | LCP breakdown |
|---|---|---|---|
| Home | 2.2 s | 6.5 s | hero `<img>` requested 5.3 s after TTFB (Load Delay), 2.0 s to load, 0.9 s render delay |
| Catalog | 2.1 s | 8.5 s | no LCP element recorded; cards are `opacity: 0` until hydration |
| PDP (Pillar 9 ml) | 2.2 s | 9.2 s | body layer loaded by 2.0 s, painted at 9.6 s (Render Delay 7.7 s) |
| Cart | 2.0 s | 4.7 s | text LCP, 4.3 s render delay (client page) |

### 4.2 Frontend

1. `display-images.generated.json` in the client bundle (opportunity 1).
2. Catalog cards gated by `motion.article initial={{ opacity: 0 }}` (`CatalogClient.tsx:449,621`)
   and `CylinderMasterPreview` painting nothing until a client fetch.
3. Home hero: the LCP `<img>` has `fetchPriority="high"` but is discovered late (5.3 s Load Delay);
   there is no `<link rel="preload">` for it while the brand wordmark PNG *is* preloaded, and the
   decorative mirror copy (`stoneMirrorImage`, `alt=""`) is also `loading="eager"` at the same
   3840 w. Both hero `<img>`s go through `/_next/image` at `w=3840` with `sizes="100vw"`.
   `EmpireFitmentHero.tsx:85` fetches its manifest with `?t=Date.now()` and `cache: "no-store"`
   (only on `?hero=niche`).
4. Always-mounted client code: `GraceProvider` (3,282 lines), `GraceChatDrawer` + `CartDrawer`
   (framer-motion), `ConvexReactClient` created at module scope so every page, including `/cart`
   which uses no Convex data, opens a WebSocket.
5. Clerk dev instance: 296 KB of third-party script and the handshake redirect (opportunity 9).
6. `PdpBlocks.tsx:237,258,274` `fill` images without `sizes` and `unoptimized`; blog/journal
   `<Image unoptimized>` on Sanity CDN images (`blog/[slug]/page.tsx:158,201`,
   `BlogGrid.tsx:52,106`) although `cdn.sanity.io` is in `remotePatterns`.
7. `public/og-default.png` is 1.2 MB (1200×630 RGBA PNG) and `public/logo.png` 360 KB (512×512);
   both are fetched by crawlers and share previews.
8. Scroll listeners on a mobile PDP: `Navbar.tsx:156` (always), `ProductDetailClient.tsx:2008`,
   `MobileProductPdp.tsx:515` (+ `visualViewport`), `MobileProductHero.tsx:69` — all passive, no
   polling; the only `setInterval`s are the 6 s hero carousel and a local-preview-only poll.
9. Fonts are already right: self-hosted variable WOFF2 via `next/font/local`, `display: swap`,
   Garamond/Cormorant not preloaded. Sentry (post-load, DSN-gated) and PostHog (lazy, proxied) are
   already deferred.

### 4.3 Backend and data

1. Root layout: `cookies()` + `headers()` + uncached Sanity `getMegaMenuPanels()` per request;
   `force-dynamic`/`revalidate = 0` on catalog and PDP routes are redundant.
2. PDP payload: `getProductGroup` returns full documents (78 fields incl. `components: v.any()`),
   serialized to the client and re-subscribed by `GraceProvider.tsx:807`; the classic page also
   re-runs `grace.getBottleComponents` on mount despite `initialCompatibility`.
3. PDP waterfall: `loadRedesignPayload` runs after the first `Promise.all` and awaits sibling
   `getProductGroup` calls, two `loadRegisterKits`, `productKits.forSkus` chunks,
   `getShopCollectionGroups` and stage envelopes in sequence; `getFocusedPdpRelations` does one
   `.first()` per family group; `glassStageEnvelopes` reads every group at that capacity on first
   visit per family (1 h cache).
4. Catalog: duplicate search per interaction (RSC navigation + POST), POST never CDN-cacheable,
   each POST runs 1–2 `graceRateLimits.check` mutations before the query; family/application
   finders request `limit: 240` while `/api/catalog/search` rejects anything over 48
   (`route.ts:16-19`), so every refine on those pages likely makes a wasted 400 request (unverified
   in a browser).
5. Convex `searchCatalog` (`products.ts:850-1154`): `collect()` of all ~380 `productGroups`,
   eight in-memory filter passes for facets, then one `products` index collect per card (N+1,
   ≤48; the 16 MB read-budget comment at `:1061-1066`); line view adds two `productPlates` reads
   per SKU. Precomputing facet fields and a slim preview array on `productGroups` at sync time
   would remove the `products` reads.
6. Visibility snapshot: two full-table `productGroups` reads every 30 s (`catalogServer.ts:106`)
   plus a second cached copy per minute for the homepage; `getCatalogGroupPrimarySkus` has an
   N+1 fallback for groups missing `primaryGraceSku` (whether any remain is unverified).
7. Per-card live subscriptions: `CatalogCapDots.tsx:43` (`productPlates.byFamily`, limit 200, ×2),
   `CatalogCardPreview.tsx:66` (`productPlates.forSkus` per card), `ConfiguratorPdp.tsx:405`
   (same `byFamily` ×2) — kept open for the whole visit for data that never changes mid-session.
8. Home: `HomePage.tsx:290` live `useQuery(products.getHomepageStats)` collects the whole groups
   table to show a rounded "2,300+" that `browseData` already knows.
9. Sequential per-SKU `await` loops in `productPlates.ts:90-114`, `productKits.ts:97-150`,
   `registerStage.forSkus`, `products.ts:1075-1085`; `catalogComponentSources.ts:84-85` takes 1,201
   Cylinder products per compatibility call. `Promise.all` in batches of 16 (as
   `getCatalogGroupVariantPreviewData` already does) is the fix.
10. `shopifySync.syncProductDelete` (`shopifySync.ts:194`) collects all `productGroups` to find one
    by `shopifyProductId` → missing `by_shopifyProductId` index. Unused indexes
    (`by_shopifyVariantId`, `by_compatibilityClass`, `by_neck_type`, `by_neck_status`) cost write
    amplification; confirm no dashboard use before dropping.
11. Sanity: `sanityFetch` defaults to `revalidate: false` in production while `<SanityLive>` is
    never mounted for visitors → published block edits may wait for the next deploy (runtime
    unverified); conversely the plain-client helpers (mega menu, family content) are fetched every
    request.
12. Crons are light (Convex: Sentry sync 15 min no-op without env, search-log purge daily; Vercel:
    hourly builder warm, bounded). Builder API routes already have good `s-maxage` +
    `stale-while-revalidate` headers.

### 4.4 Repo and build weight

- 4.2 GB tracked: `public/` 2.6 GB, `docs/` 1.0 GB (`docs/reviews` 913 MB, deploy-excluded),
  `data/` 315 MB, `outputs/` 99 MB. GitHub Actions clones all of it on every run (checkout 82 s of a
  10.5 min CI job). `.git` on the main checkout is 10 GB with 2,311 prune-packable objects and 85 MB
  of garbage.
- Build: 249 s locally with webpack; 17 MB of client chunks; the largest chunks are Sanity Studio
  (2.4 MB raw, studio route only), three.js (lab/PDP viewer, dynamic), the display-images JSON
  (753 KB raw) and `@openai/agents` + zod (lazy).

---

## 5. SEO and accessibility findings

| Item | Where | Severity |
|---|---|---|
| hreflang/x-default dropped on every page that sets `alternates: { canonical }` (PDP, blog, about, contact, resources, request-*, policies, matrix) | `src/i18n/metadata.ts`, per-page `metadata` | high |
| Product JSON-LD omits `image` unless the variant URL is a preferred Shopify URL; `AggregateOffer` has no `offerCount`/`url`; no `BlogPosting` on journal posts; no `ItemList` on catalog/collections; `buildCollectionPageJsonLd` unused | `page.tsx:478`, `seo.ts` | medium |
| No site-wide `:focus-visible`; 43 `outline-none` without a `focus-visible` pairing, including catalog qty/search inputs (`CatalogClient.tsx:552,742,1527,1590`), Navbar search (437, 576), `ConfiguratorPdp.tsx:813` | globals + components | medium |
| Lighthouse a11y (95–96): `color-contrast` on slate/grey text (`#637588` on bone 4.27:1, footer `#656566` on `#0f0f10` 3.29:1, `opacity-60` tabular prices), `heading-order` (catalog card `<h3>` under the page `<h1>` with no `<h2>`), `label-content-name-mismatch` on 26 catalog add-to-cart buttons whose `aria-label` ("Add 1 … to cart") does not contain the visible text | storefront | medium |
| `/cart` has no `noindex` meta (robots.txt disallows it; Lighthouse SEO 66 for `is-crawlable`); `(portal)/layout.tsx`, `/sign-in`, `/sign-up`, `/studio`, `/team/*` rely on robots.txt only | layouts | low |
| `/catalog/application/[application]` has no canonical | page metadata | low |
| No `/es/*` URLs in either sitemap although hreflang advertises them; `server-sitemap.xml` sets `lastmod = new Date()` for every product on every request; `/:path*.php → /` catch-all is a soft-404 pattern | crawl libs, `next.config.ts` | low |
| Lighthouse flags `meta-description` on the Pillar PDP although `curl` shows the tag present with the `?cap=matte-black` redirect applied | unverified cause | investigate |
| Headings, alt text and icon buttons on home, catalog and PDP are otherwise in order; hero, first card and PDP body layer carry the correct eager/`fetchPriority` attributes | | ok |

---

## 6. Needs further investigation (e)

- Count of live product groups still served by the classic PDP (dev-Convex query, read-only).
- The 7.7 s render delay on the PDP body layer and the missing LCP element on the catalog —
  needs a DevTools trace against the local build before Phase 3 touches the stage.
- Whether `NEXT_PUBLIC_HERO_SET` is set on Vercel (decides the fate of `assets/hero/v4–v7`).
- Whether any Convex `imageUrl` points into `public/images/catalog/cylinder/` or the other
  "unreferenced" image folders (read-only query on dev Convex, then production via Jordan).
- Which `globals.css` rules consume the `gracePulse*` keyframes.
- Whether the `.vercelignore` additions for `public/local-kits` and `public/reviews` affect any
  Preview workflow Jordan uses (they are read on localhost only, per the code).
- Whether the `@convex-dev/agent` component and the ten unreferenced Convex repair modules are run
  ad hoc from the dashboard.
- Runtime behaviour of `sanityFetch` revalidation on production.
- The `limit: 240` finder requests against the 48 cap: reproduce in a browser.

---

## 7. Baseline (Phase 2)

### 7.1 Field-style production numbers from PR #403 (the baseline to beat)

Mobile Lighthouse, median of 3, production deploy of #403, from the PR comment. "Public" is
`best-bottles-website.vercel.app` with no share link.

| Page | After #403 (share link) | Public |
|---|---|---|
| Home | 71 / 5.1 s / 251 ms | 64 / 5.2 s / 493 ms |
| Catalog, glass | 64 / 6.6 s / 378 ms | 60 / 6.2 s / 578 ms |
| Catalog, Cylinder | 64 / 6.4 s / 416 ms | 61 / 6.6 s / 494 ms |
| Catalog, Elegant | 66 / 6.4 s / 383 ms | 66 / 6.4 s / 379 ms |
| PDP, 3.3 ml cylinder mist | 68 / 7.3 s / 305 ms | 70 / 7.0 s / 241 ms |
| PDP, 4 ml amber vial | 65 / 6.9 s / 345 ms | 64 / 7.0 s / 375 ms |
| PDP, 2 ml amber vial | 65 / 6.9 s / 388 ms | 67 / 7.0 s / 321 ms |
| PDP, Elegant 15 ml roll-on | 64 / 7.1 s / 356 ms | 61 / 7.2 s / 460 ms |
| PDP, Boston 15 ml dropper | 67 / 7.2 s / 262 ms | 64 / 7.1 s / 367 ms |

(score / LCP / TBT)

### 7.2 Local lab baseline (this worktree, 5 Nov 2026)

`next build --webpack` of `8bb70174`, `next start` on port 3100, `.env.local` pointing at the dev
Convex deployment, Lighthouse 12.8.2 headless Chrome, 3 runs per page, median by LCP. Local
numbers are not comparable with the Vercel numbers above (no CDN, no edge, dev Convex); they are
the before/after yardstick for Phase 3.

Mobile (simulated slow 4G, 4× CPU):

| Page | Perf | FCP | LCP | TBT | CLS | JS (gzip) | Images | Total | a11y / SEO / BP | LCP per run |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | 73 | 2.2 s | 6.5 s | 156 ms | 0.000 | 978 KB / 46 | 988 KB / 22 | 2,150 KB | 95 / 100 / 75 | 8.9 / 5.5 / 6.5 |
| `/catalog` | 69 | 2.1 s | 8.5 s | 204 ms | 0.000 | 1,033 KB / 70 | 138 KB / 10 | 1,452 KB | 95 / 100 / 75 | 9.6 / 8.5 / 8.4 |
| `/catalog/cylinder` | 66 | 2.4 s | 8.7 s | 266 ms | 0.000 | 1,028 KB / 70 | 258 KB / 27 | 1,797 KB | 95 / 100 / 75 | 9.9 / 8.7 / 8.6 |
| `/products/pillar-9ml-clear-17-415-finemist` | 67 | 2.2 s | 9.2 s | 184 ms | 0.002 | 1,077 KB / 45 | 442 KB / 19 | 1,733 KB | 96 / 92 / 75 | 9.7 / 8.9 / 9.2 |
| `/catalog?q=roll+on+bottles` | 69 | 2.2 s | 8.6 s | 194 ms | 0.000 | 1,027 KB / 70 | 138 KB / 10 | 1,445 KB | 95 / 100 / 75 | 8.6 / 9.5 / 8.4 |
| `/cart` | 79 | 2.0 s | 4.7 s | 162 ms | 0.032 | 882 KB / 38 | 33 KB / 1 | 1,042 KB | 96 / 66 / 79 | 4.7 / 4.1 / 5.0 |

Desktop preset:

| Page | Perf | FCP | LCP | TBT | CLS | JS (gzip) | Images | Total | a11y / SEO / BP |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 93 | 0.6 s | 1.7 s | 0 ms | 0.000 | 984 KB / 46 | 1,040 KB / 23 | 2,217 KB | 95 / 100 / 78 |
| `/catalog` | 91 | 0.7 s | 1.8 s | 0 ms | 0.000 | 1,079 KB / 72 | 327 KB / 32 | 1,722 KB | 95 / 100 / 78 |
| `/catalog/cylinder` | 89 | 0.8 s | 1.9 s | 0 ms | 0.000 | 1,079 KB / 72 | 609 KB / 80 | 2,241 KB | 95 / 100 / 78 |
| `/products/pillar-9ml-clear-17-415-finemist` | 90 | 0.7 s | 1.8 s | 0 ms | 0.000 | 1,132 KB / 48 | 442 KB / 19 | 1,797 KB | 96 / 92 / 78 |
| `/catalog?q=roll+on+bottles` | 91 | 0.7 s | 1.8 s | 0 ms | 0.000 | 1,079 KB / 72 | 327 KB / 32 | 1,724 KB | 95 / 100 / 78 |
| `/cart` | 93 | 0.7 s | 1.6 s | 0 ms | 0.000 | 960 KB / 43 | 33 KB / 1 | 1,154 KB | 96 / 66 / 78 |

Notes: the "search results" URL uses `?q=`; the catalog reads `?search=`, so the run above is the
default catalog with a query it ignores — Phase 3 measurements will use `?search=roll+on`. Best
Practices is 75–79 everywhere because the local build has no HTTPS. The 296 KB of third-party
script on every page is Clerk's development instance. The `/cart` SEO score reflects the
intentional robots.txt disallow.

### 7.3 Checks (this worktree)

| Check | Result |
|---|---|
| `npm ci` | exit 0 |
| `npx tsc --noEmit -p .` | exit 0 (91 s) |
| `npm run lint` | exit 0 (37 s): 0 errors, 123 warnings (unused vars; 19 auto-fixable) |
| `npx vitest run` | 394 files passed, 2 failed, 2 skipped; 3,371 tests passed, 2 failed, 7 skipped (119 s, run concurrently with the build and the audit sweeps). The two failures were 5 s timeouts in `tests/rectangle10-rollon-shared-hero.test.ts` and `tests/tall9-pour-cap-fit.test.ts` (recipe-hash tests); re-run alone they pass in 1.2 s each. Load-sensitive, not broken; a higher `testTimeout` for the hash tests is a Phase 3 hygiene item. |
| `npm run build -- --webpack` | exit 0 (249 s); every page route is `ƒ (Dynamic)`; Next warns that the `static/` directory is deprecated |
| Last green CI run (42142660125) | checkout 82 s, install 88 s, typecheck 51 s, lint 39 s, tests 118 s, build 231 s |

### 7.4 Rollback point

`main` at `8bb70174`. Every Phase 3 batch lands as its own PR against `main`; reverting a batch is
reverting one merge.

---

## 8. Proposed Phase 3 batches

Each batch is one PR with its own regression pass (typecheck, lint, vitest, build, browser check
of home, catalog, PDP variants, cart, checkout navigation on mobile and desktop widths).

1. **Repo hygiene and deploy weight (no site behaviour change).** `.vercelignore` rules for
   `public/preview`, the rest of `public/local-kits` (keeping `pillar-caps-2026-11-04/kits.json`),
   the rest of `public/reviews`, the team-ledger image folders, `images/store`, lab-only models;
   `.gitignore` for `__pycache__`, `*.pyc`, Office locks; untrack the lock files, `__pycache__`,
   `path/to/your`, `static/`, `format_json.js`, `outputs/`; quarantine `clear_loop.mjs` and the
   four orphan `run_*` writers; rename or delete the three `.test.mjs` files. Deletion of the
   provably unreferenced `public/` files (131 MB) goes in the same PR only for the items with zero
   Convex exposure (PSDs, HDRs, scaffold SVGs); `images/catalog/cylinder/` waits for the Convex
   check.
2. **Dead code and dependencies.** The 1.1 file list, `HomePage.tsx` dead sections, dead
   `globals.css` rules, icon shim consolidation, seven unused packages plus the four radix/measure
   packages; update the eight contract tests that read removed files. Convex repair modules and
   `@convex-dev/agent` stay out of this PR pending Jordan.
3. **Images and LCP.** Preload the home hero and lazy-load its mirror copy; move
   `display-images.generated.json` off the client; render catalog cards visible from SSR (replace
   `initial={{ opacity: 0 }}` with a CSS entrance that does not hide SSR content); SSR placeholder
   for Cylinder master cards; `sizes` on `PdpBlocks` fills; drop `unoptimized` on Sanity blog
   images; re-export `og-default.png` and `logo.png`; investigate the PDP render delay with a trace
   and fix what it shows.
4. **Frontend JS.** Lazy-mount `GraceChatDrawer` and `CartDrawer`; split `GraceProvider` into a
   thin context and a lazily loaded body; `notFound()` gate for `/dev` and `/lab` in production;
   remove `/example` and `/fitment-demo`; remove redundant `"use client"` directives; shared
   breakpoint constants.
5. **Data efficiency.** `unstable_cache` for `getMegaMenuPanels`; one visibility snapshot;
   projected `getProductGroupForPdp`; `GraceProvider` reads the PDP group from context instead of
   re-querying; first-render guard and single source of truth in `CatalogClient`; fix the 240/48
   finder limit; `Promise.all` in the per-SKU Convex loops; parallelise `loadRedesignPayload`;
   `by_shopifyProductId` index; homepage count from `browseData`; cap-dot thumbnails from the
   search response. Convex schema/index changes deploy with `main` automatically
   (`scripts/vercel-build.sh`), so they are called out explicitly in that PR.
6. **SEO and accessibility.** One `alternates` helper for every page plus a test; Product JSON-LD
   `image` fallback and `BlogPosting`; site-wide `:focus-visible` and the `outline-none` cleanup;
   `noindex` on cart/portal/sign-in/studio/team layouts; canonical on the application finder;
   catalog add-to-cart `aria-label` wording; contrast on slate/grey text (design tokens only where
   the ratio is below 4.5:1 — flag for Jordan before changing colours).

Out of scope for this session unless Jordan says otherwise: the Clerk production instance, removal
of the classic PDP, Convex component/function removals, any write to Convex, Shopify, Sanity or
Blob, and any change to pricing, SKUs, variant ids, product copy or checkout behaviour.

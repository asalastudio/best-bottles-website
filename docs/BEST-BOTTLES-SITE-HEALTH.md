# Best Bottles Site Health

Date: 2026-09-16  
Branch: `cursor/site-health-optimization-04e5`  
Scope: public storefront delivery, crawlability, and device chrome. Catalog logic, pricing, compatibility, cart math, and Grace tools were not redesigned.

## 1. Executive Summary

The Best Bottles storefront is commercially usable: homepage, catalog, family pages, PDP, Build Your Bottle, search, cart drawer, and cart page all loaded and accepted a real add-to-cart in this pass. No P0 checkout, cart-corruption, or configuration-logic failures were found.

The site is heavier than it needs to be on first paint (large client islands, Convex + Grace + analytics on every route) and several delivery details were working against mobile customers and crawlers. This cycle fixed the ones that could be changed without touching shopping behavior:

- iOS safe-area insets now apply (`viewport-fit: cover`)
- Journal serif files are no longer preloaded on commerce pages
- Sanity Live no longer opens a browser SSE for ordinary shoppers
- Internal `/team`, `/executive`, `/lab`, and `/dev` routes are kept out of robots/sitemaps
- Accidental page-level horizontal overflow is clipped
- The first mobile catalog card is marked as the LCP image

Remaining cost is architectural (force-dynamic catalog/PDP, homepage as a client tree, `searchCatalog` collecting product groups). Those are documented, not rewritten.

## 2. Architecture Observed

| Layer | What is actually used |
|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind 4, CSS modules |
| Backend | Convex (`productGroups` / `products`, Grace, portal, Shopify sync) |
| CMS | Sanity (homepage, mega menu, journal, PDP editorial) |
| Commerce | Convex catalog + localStorage cart → Shopify checkout / wholesale draft orders |
| Auth | Clerk, gated by `NEXT_PUBLIC_CLERK_ENABLED`; portal and Team Hub only |
| Search | Convex `searchCatalog` / `searchProducts`; navbar → `/catalog?search=` |
| AI | Grace drawer + workspace; Convex `askGrace` |
| Analytics | PostHog via `/ingest` proxy; Sentry via `/monitoring-tunnel` |
| Images | `next/image` + many raw `<img>` heroes; Sanity, Shopify, Supabase, Vercel Blob, Convex storage |
| Caching | Homepage browse `unstable_cache` 60s; builder families 300s; catalog/PDP `force-dynamic` |
| Deploy | Vercel; `next-sitemap` postbuild |
| Testing | Vitest (no Playwright in `package.json`; this pass used the local Playwright MCP) |

Root providers on every public page: Clerk (optional) → Region → Convex → Cart → Grace → mega menu → MobileTabBar → analytics.

## 3. Baseline Metrics

Collected on the local Next.js 16 dev server at a 390×844 CSS-pixel viewport. These are **lab / local-dev** numbers, not production field data. Transfer sizes were often 0 because of the warm dev cache.

| Page | FCP | TTFB | Overflow | Console | Notes |
|---|---|---|---|---|---|
| `/` | 664 ms | 579 ms | none | Sanity Live CORS (before) | 95 resources, 55 JS files, 6 font URLs including unused editorial faces |
| `/` after | — | — | none | **0 errors / 0 warnings** | 1 font preload; `viewport-fit=cover`; Montserrat headline |
| `/catalog` | — | — | none at 320 and 390 | LCP image warning (first cards lazy) | Results render; Filters control present |
| `/products/cylinder-3.3ml-clear-12mm-finemist` | — | — | none | 0 | Add to Cart opened the drawer |
| `/matrix` | — | — | none | 0 | Mobile builder: “Choose your bottle” |
| `/catalog?search=boston` | — | — | none at 320 | LCP warning | Boston Round results |
| `/catalog/cylinder` | — | — | none | 0 | “Cylinder bottles” |
| `/cart` | — | — | none | 0 | Cylinder line persisted; checkout present |
| `/blog` | — | — | none | LCP image warning | After font correction: EB Garamond on `.font-serif` |

Core Web Vitals, Speed Index, and production TBT were **not** available from a trusted RUM source in this environment. Do not treat the local FCP/TTFB as a production Lighthouse score.

## 4. Problems Found

### P0 — Critical

None found that broke checkout, cart integrity, authentication, or bottle/closure compatibility.

### P1 — High

1. **iOS safe-area insets were dead.** Tab bar, sticky PDP chrome, and builder sheets use `env(safe-area-inset-*)`, but Next did not emit `viewport-fit=cover`. Documented in `src/lib/products/mobile-pdp-chrome.ts`.
2. **Sanity Live SSE on every published homepage / PDP / journal view.** `SanityLive` mounted even when Draft Mode was off, opening `api.sanity.io` live events and throwing CORS on unknown origins.
3. **Internal tools were crawlable.** `/team`, `/executive`, `/lab`, `/dev` were missing from robots/sitemap deny lists (some pages had `noindex`, lab/dev 3D pages did not).
4. **Unused Journal font preloads on commerce pages.** EB Garamond and Cormorant were registered and preloaded from the root layout even though `--font-serif` is the brand face outside `.editorial`.

### P2 — Medium

1. First mobile catalog card was lazy-loaded while it was the LCP image.
2. Family banner `next/image` lacked `sizes`.
3. `100vw` marquees/rails can create a 1–2px page scrollbar; now clipped at `html`.
4. Homepage is a large `"use client"` tree (`HomePage.tsx` + `CollectionShopping`).
5. Catalog and PDP are `force-dynamic` with `revalidate = 0`.
6. `searchCatalog` still `.collect()`s `productGroups` (scalability).
7. Catalog cards often set `unoptimized` (intentional for some remote/blob URLs; still extra bytes).
8. Homepage hero layers are raw `<img>` without `srcset`.
9. Dual `h1` text on catalog (“Catalog” + “Master Catalog”) is awkward for AT.
10. Mobile tab labels are 8px (below WCAG text-size comfort).

### P3 — Low

1. `reactStrictMode: false` hides hydration double-render bugs.
2. No Playwright suite in CI.
3. Journal lead image is also a lazy LCP candidate.
4. Clerk-disabled environments show a static portal block.
5. Dead Shopify CDN URLs are cleaned by a Convex mutation, not at request time.

## 5. Changes Implemented

### 5.1 iOS viewport-fit cover

- **Problem:** Safe-area and visual-viewport chrome sat under the iOS home indicator / URL bar.
- **Cause:** No root `viewport` export.
- **Fix:** `export const viewport` with `viewportFit: "cover"` and bone `themeColor`.
- **Files:** `src/app/layout.tsx`
- **Benefit:** `env(safe-area-inset-*)` becomes non-zero on notched iPhones.
- **Verification:** Homepage meta is `width=device-width, initial-scale=1, viewport-fit=cover`.

### 5.2 Editorial fonts without commerce preload

- **Problem:** Commerce pages preloaded unused Garamond/Cormorant files.
- **Cause:** Root layout applied both variable classes; next/font preloads by default.
- **Fix:** Keep the variables on `<html>` so `.editorial` can resolve them; set `display: "swap"` and `preload: false` on those faces; point `.editorial { --font-serif }` at `--font-eb-garamond` directly.
- **Files:** `src/app/fonts.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/blog/layout.tsx`
- **Benefit:** Homepage still preloads one brand face; journal headings compute to EB Garamond.
- **Verification:** Homepage `h1` = Montserrat, 1 font preload; `/blog` `h1` = EB Garamond.

### 5.3 Sanity Live only in Draft Mode

- **Problem:** Published shoppers paid for a live Sanity connection and saw CORS failures in the console.
- **Cause:** `SanityLive` rendered unconditionally; only `VisualEditing` was draft-gated.
- **Fix:** Return `null` unless `draftMode().isEnabled`.
- **Files:** `src/components/SanityLiveVisualEditing.tsx`
- **Benefit:** Homepage console 2 errors → 0. Editors in Presentation still get live + overlays.
- **Verification:** Homepage and PDP after the change: 0 console errors.

### 5.4 Internal routes off the public index

- **Problem:** Team Hub, executive, lab, and dev surfaces could be crawled.
- **Cause:** `next-sitemap` / `public/robots.txt` omitted those prefixes; lab/dev pages lacked `noindex`.
- **Fix:** Disallow + sitemap exclude; `src/app/lab/layout.tsx` and `src/app/dev/layout.tsx` set `robots: { index: false }`.
- **Files:** `next-sitemap.config.js`, `public/robots.txt`, lab/dev layouts
- **Benefit:** Crawlers are told not to index internal tools. Page-level `noindex` remains on Team/Executive.

### 5.5 Horizontal overflow clip

- **Problem:** `100vw` animation/rails can create a page-level horizontal scrollbar.
- **Cause:** Viewport units include the scrollbar gutter.
- **Fix:** `html { overflow-x: clip }` (not `hidden`, so `position: sticky` still works).
- **Files:** `src/app/globals.css`
- **Verification:** No `scrollWidth > clientWidth` at 320, 390, or 1280 on the pages walked.

### 5.6 Catalog LCP and family banner sizes

- **Problem:** Next warned that the first catalog card was LCP and lazy; family banner lacked `sizes`.
- **Fix:** `priority={index === 0}` on the mobile line-item image; `sizes="100vw"` on the family banner.
- **Files:** `src/app/catalog/CatalogClient.tsx`
- **Benefit:** First mobile result can be the LCP candidate without a lazy fetch.

## 6. Performance Before / After

| Signal | Before | After |
|---|---|---|
| Homepage console | Sanity Live CORS errors | Clean |
| Homepage font preloads | 6 URLs (brand + editorial + Geist) | 1 brand-face preload |
| Homepage overflow | none at 390 | none at 390 |
| Viewport | `width=device-width, initial-scale=1` (Next default) | `…, viewport-fit=cover` |
| Journal type | `.editorial` existed but lost Garamond if variables left the root | EB Garamond on journal `.font-serif` |
| Catalog first card | lazy LCP warning | `priority` on index 0 |

No production Lighthouse before/after is claimed. Field Web Vitals should be read from PostHog / Sentry after deploy.

## 7. Mobile / Device Findings

Walked at 320, 390, and 1280 CSS pixels (portrait). Emulation only — not Safari iOS, Chrome Android, or a physical device.

- No page-level horizontal overflow on homepage, catalog, PDP, builder, search, family, cart, or journal.
- Mobile tab bar already uses 44px-wide slots and `padding-bottom: env(safe-area-inset-bottom)`.
- Builder mobile shell (“Choose your bottle”) loaded without overflow or console errors.
- Sticky PDP Add to Cart was present and worked.
- Not verified: iOS Safari URL-bar overlay, Android keyboard, landscape tablets, 768 / 820 / 1024 / 1440 / 1920 in this pass (320 / 390 / 1280 were).

## 8. Browser Findings

- Chromium (Playwright MCP) only.
- Safari-specific sticky, `100dvh`, and `visualViewport` behavior was **not** re-tested on a real iPhone. The viewport-fit change is the prerequisite those paths already assumed.
- No Chrome/Edge Windows or macOS Safari run.

## 9. Commerce Flow Validation

| Flow | Status |
|---|---|
| Homepage | Pass — overlay hero, Popular Families, Shop Bottles |
| Catalog | Pass — grid/list, Filters, no overflow at 320 |
| Search | Pass — `?search=boston` returns Boston Round bottles |
| Filters | Control present; full facet matrix not re-run |
| Family page | Pass — `/catalog/cylinder` |
| PDP | Pass — Cylinder 3.3 ml spray, specs, Add to Cart |
| Build Your Bottle | Pass — `/matrix` mobile chooser |
| Cart drawer | Pass — line item + “Proceed to Checkout” |
| Cart page | Pass — persisted Cylinder, checkout control |
| Checkout handoff | Control present; Shopify redirect **not** completed (would leave the app) |
| Sign-in / portal | Not signed in; routes exist; Clerk-gated |

## 10. Accessibility Findings

- Viewport and announcement region are labeled.
- Cart drawer exposes “Your Cart”.
- Material leftover issues: 8px tab labels, catalog heading concatenation, some `next/image` `alt=""` decorative cases, Grace tooltip dismiss hit area.
- No axe/WCAG automated sweep was run. No critical focus-trap or unlabeled submit was seen on the walked paths.

## 11. Remaining Risks

- Catalog/PDP remain uncached (`force-dynamic`). Mobile TTFB on production will follow Convex + Vercel, not this local number.
- Homepage client bundle (Grace + Convex + Framer Motion) is still the dominant JS cost.
- `searchCatalog` full-table collect will get more expensive as the catalog grows.
- Hero PNG/WebP layers are still full-resolution `<img>` tags.
- No field Web Vitals segmented by mobile/desktop in this report.
- Checkout was not driven through Shopify.
- Safari / Android were not in the device matrix this cycle.

## 12. Future Recommendations

Only items justified by what was observed:

1. Add a Playwright smoke in CI for homepage, catalog search, PDP add-to-cart, and matrix load.
2. Measure production LCP/INP from PostHog after this deploy, split mobile vs desktop.
3. Consider caching published catalog HTML or a short ISR window; keep checkout and portal dynamic.
4. Give the first catalog **grid** card `priority` as well if desktop LCP is the plate, not the line item.
5. Mark the journal hero `priority` to clear the remaining Next LCP warning.
6. Do **not** lift `searchCatalog` off `.collect()` without a dedicated query-plan and tests.
7. Do **not** split Grace out of the root providers without a hydration plan — it is on every page by design.

## 13. Files Changed

- `src/app/layout.tsx`
- `src/app/fonts.ts`
- `src/app/globals.css`
- `src/app/blog/layout.tsx`
- `src/app/lab/layout.tsx`
- `src/app/dev/layout.tsx`
- `src/app/catalog/CatalogClient.tsx`
- `src/components/SanityLiveVisualEditing.tsx`
- `next-sitemap.config.js`
- `public/robots.txt`
- `tests/site-health-invariants.test.ts`
- `docs/BEST-BOTTLES-SITE-HEALTH.md`

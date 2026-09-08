# Homepage: Cards first

September 8, 2026. Local implementation on `codex/homepage-cards-first`; no deployment.

## Presentation

Below the existing 1024 px breakpoint, the homepage opens with the existing brand navigation, a compact wholesale descriptor and search, photographic Popular families, and the complete catalog browser. The desktop hero's source, dimensions, crop classes, headline, copy and CTA are unchanged. Both layouts share the same new browsing module and existing merchandising configuration.

Popular families use editorial ordering, not a claimed sales ranking. Both carousels have visible arrow controls; catalog tabs also support arrow keys, Home and End. View all remains outside the track and expands every item into a regular grid. Session storage retains the active tab, expansion and per-tab scroll positions. Storage is optional; navigation works when it is unavailable.

Existing supporting sections, cart, account, Grace, bottom navigation and builder entry remain. Search and all collection parameters reuse current destinations. This change does not edit product records, compatibility, quantities, pricing, checkout enforcement, kits or hero assets.

## Catalog findings

The current visible dataset returned **23 glass-bottle family labels**, and **27 bottle/jar/metal-atomizer groups** under the existing bottle categories. These are different counts; 27 must not be described as glass-bottle families. The browser also contains five existing applicator destinations and six curated collections. The navigation snapshot is in `catalog-navigation.json`; runtime counts come from the server dataset, cached for 60 seconds.

`Bell` exists. `Bell Collection` was not present in the queried dataset. Similar labels are not merged or renamed. Unknown family labels retain their exact catalog filter URL. Plastic Bottle has no approved family image in the available sources and uses a labeled browsing fallback. No unrelated bottle photograph is substituted.

## Verification

- Full test suite: 1,558 passed, 7 skipped.
- TypeScript and targeted lint passed.
- Production Webpack build and its TypeScript check passed.
- Desktop hero before/after metadata is identical: image URL, 1440 × 1000 bounds, crop classes, text and `/catalog` CTA.
- Chromium and WebKit passed at 320, 390, 430, 768 and 1440 px, including traversal to the end of every carousel, View all, keyboard tabs, search and Back restoration. The local production server returns HTTP 200 at http://localhost:3001/.
- Browser verification script: `scripts/verify-homepage-browse.mjs`. It exercises both browser engines at 320, 390, 430, 768 and 1440 px, all tabs, arrows, expanded grids, keyboard navigation, route return, search and page overflow.

Physical iOS Safari toolbar/safe-area behavior and VoiceOver require a real-device check. Automated WebKit coverage does not establish those results. Cart/account/Grace entry points are preserved, but this read-only test does not place orders or submit account/Grace requests. Existing development-auth warnings are outside this homepage presentation change. WebKit also exposed an existing minimum-width overflow in the supporting Help me choose section; its mobile grid now wraps without expanding the page, preserving its actions and desktop spacing.

## Final sizing adjustment

After the browser verification and captures, mobile popular cards increased from 210 to 214 px, and compact card image areas from 104 to 107 px, following the requested approximately 2% height increase. Desktop sizing is unchanged. Captures show the preceding, slightly shorter sizing; the full browser matrix was not repeated for this CSS-only adjustment.

## Captures

- `before-390.png` and `after-390.png`: mobile homepage.
- `before-1440.png` and `after-1440.png`: unchanged desktop hero.
- `mobile-applicators.png`, `mobile-view-all.png` and `desktop-browser.png` show the alternate tab, expanded grid and desktop browsing module.

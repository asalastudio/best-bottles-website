# Grace shop redesign — September 27, 2026

Status: local implementation on `codex/grace-shop-redesign`; not merged or deployed. The primary checkout and its unrelated changes were preserved. Visual approval is still the customer’s decision.

## Reference analysis and decisions

Source: `Bottle shop flow redesign (1).zip`, 50 files with two interactive HTML design documents, logo masters, raster lockups, and a favicon set. Turn 14 of `Grace Chat Entry.dc.html` supplies the welcome, menu, conversation, and launcher treatment; the brand guide supplies the bottle geometry, color, and motion.

The archive is a design reference. Its placeholder product data and operational promises are not production facts. The user’s subsequent directions take precedence:

- Keep the existing full-screen Grace workspace and make expansion available to guests.
- Open Grace only on a visitor’s click; omit the suggested eight-second automatic greeting.
- Use the new mark in the footer and once in the panel header; omit the duplicate welcome mark and answer avatars. Keep the site header wordmark.
- Add the supplied favicon and Apple touch icon.
- Put the black Voice pill with gold waveform inside the rounded composer, beside text entry and image attachment.
- Keep order, sample, and upload actions useful. The support destination and response policy are pending user input.

## Implemented

- Desktop compact panel, mobile full-screen sheet, page-aware welcome and three concise intent prompts (refined below). Existing agentic push mode and full-screen workspace remain available.
- Menu with order history/tracking and sample-request routes, current-conversation access, order-list review, cart links, and contact access. No fabricated recent history.
- CSV/TSV file import and pasted spreadsheet rows, capped at 50 rows/256 KB. Strict SKU and positive whole-quantity parsing, duplicate consolidation, exact catalog lookup, stock/checkout checks, and a proposed cart that requires confirmation. Only SKU and quantity are sent for lookup; the file stays local.
- Three-column product cards and quantity-144 controls, actual catalog per-piece checkout pricing, checkout eligibility guards, and existing verified-SKU navigation. A neck-thread match alone is not labeled verified physical fitment.
- Actual cart count/subtotal and progress toward the existing $50 checkout minimum. Quote-only lines prevent immediate checkout.
- Black customer messages, bordered Grace answers, answer-feedback analytics without transcript content, streaming states, and a single header brand mark.
- Explicit voice control using the existing voice session, image attachment using the existing image analysis flow, keyboard dismissal, mobile focus containment, focus restoration, and reduced-motion behavior.
- New conversation now clears the full-screen workspace’s message history through the existing reset function.
- English and Spanish UI strings for the new shop interface.

## Validation

- 116 targeted tests passed across 11 suites covering import parsing/eligibility, rendered interactions, Grace navigation, push layout, hardening, responsive contracts, workspace, and component cards.
- The final focus/reset changes were followed by another successful focused run: 9 tests across the rendered-interaction and workspace suites.
- Scoped ESLint completed without findings.
- Final `npm run build` succeeded, including TypeScript and all 73 static pages. Existing asset-ledger dynamic file-tracing warnings remain outside this change. A stopped development cache briefly conflicted with a standalone type check; moving that generated cache aside resolved the issue before the final build.
- `git diff --check` passed. Generated sitemap and Next.js type-reference drift were restored.
- The production build is served locally at `http://localhost:3084` from this worktree.
- Browser checks: explicit click-to-open, desktop welcome/menu, actual page context, one panel mark, active-conversation expansion into `/grace-workspace`, and New conversation clearing the workspace.
- Live order-list check: `GB-CYL-CLR-9ML-T-08` resolved at $0.72/pc; `REVIEW-NOT-A-SKU` was flagged. Nothing entered the cart before confirmation. Confirmation added exactly one 144-piece line ($103.68); the unknown line was excluded. The $50 progress state appeared. The temporary cart item was subsequently removed and the cart verified empty. No checkout or order was submitted.
- Mobile browser measurements at 390 × 844: dialog width 390, height 844, scroll width 390, one bottle mark, and the Voice control present. No horizontal overflow. Viewport override reset afterward.
- Request samples opened the existing sample form. Order/tracking menu destination was verified as `/portal/orders`; signed-in order data was not exercised.
- Footer mark rendered correctly; document metadata registered the new ICO, SVG, and Apple-touch assets. Microphone/audio and image-upload service calls were not exercised by the browser review.

Screenshots: `/Users/jordanrichter/.codex/visualizations/2026/09/27/01a0e1f2-1045-73f2-a10a-2bba94e5c59c/`

- `grace-desktop-welcome.png`, `grace-desktop-menu.png`
- `grace-mobile-welcome.png`, `grace-mobile-menu.png`
- `grace-order-review.png`, `grace-full-screen.png`, `grace-footer.png`

## Boundaries and follow-up

- Human support currently links to the existing contact page. No support ticket, transcript forwarding, or response-time promise has been added; destination and policy are pending.
- Samples use the existing request form. Free/paid/quantity policy has not been invented.
- Order tracking/reordering links into the existing account flow. No new tracking provider or order API was built.
- Native XLSX files are not accepted in this pass; CSV, TSV, and pasted Excel rows are supported.
- Compatibility of imported components still needs review; exact SKU identity and matching neck text do not establish physical fit.
- Favicon is static. No animated browser-tab icon was added.
- Live microphone permission, voice audio quality, signed-in order access, and completed checkout require their own acceptance checks.


## Full-screen follow-up: exit control and complete family browsing

The user requested a clear way to close the full Grace experience and imagery for every family sold. The previous rail called a popularity query with a ten-family limit and only used homepage editorial images, leaving Rectangle as a letter placeholder.

- Added a persistent, labeled **Close Grace** button with an X in the full-screen top bar. Escape performs the same exit. Closing stops voice/reconnect through the existing session teardown, closes the companion panel, returns to the storefront, and preserves the transcript.
- Replaced the popularity cap with the complete storefront visibility snapshot. Current coverage is 36 listed families/product lines, including bottles, jars, components, packaging, and tools. Source-held, internal, empty, and hidden groups follow the existing catalog visibility rules.
- Every family links to its complete catalog filter. Approved family artwork is preferred; otherwise the rail uses actual product imagery from that exact family. Product thumbnails use object-contain. Broken images fall back to other images from the same family rather than another shape or finish family.
- The live source check found image candidates for 36/36 families; Slim and Cream Jar needed a second image candidate. Source URLs were checked without modifying or publishing catalog/media records.
- Added a mobile Families menu, with keyboard dismissal and focus containment, so the full list is available below the desktop breakpoint as well.
- Fixed the full-screen Cart button to use the existing cart route instead of racing a timed header-drawer event.
- Scoped ESLint and 14 focused tests passed (family completeness/holds, same-family image fallback, close/voice teardown, Escape behavior, cart navigation, and existing guest/navigation contracts).

The rail uses one representative image per family; individual SKU imagery remains in each family’s complete catalog results. This was the stated default while the optional clarification was pending.

### Follow-up verification

- Final production build passed with TypeScript and static generation. Existing asset-ledger tracing warnings remain. Generated sitemap and Next type-reference changes were restored.
- Browser decoded 36/36 family thumbnails after scrolling the complete rail, with no remaining broken images. Rectangle now displays an actual Rectangle product photograph.
- Verified Close Grace returns to `/`. At 390 x 844, the close button remains visible with a 44px target; document width is 390px without horizontal overflow. Escape closes the family menu and restores focus, then exits Grace on the next press. Live microphone permission/audio was not exercised.
- Removed the stale hardcoded SKU/family totals from the welcome footer.
- Screenshots: `grace-workspace-close-families.png`, `grace-workspace-rectangle.png`, and `grace-workspace-mobile-families.png` in the review screenshot directory above.
- Served locally on port 3084; these changes have not been merged or deployed.

## Workspace cart experience

The user requested a clearer shopping cart inside the full Grace workspace. The cart previously navigated away to `/cart`, removing the conversation from view.

### Design and implementation

- A right-side cart panel keeps the workspace visible behind it, with a full-width view on mobile. Explicit Back to Grace and close controls return to the same conversation. The existing dark ink, white/bone, champagne, gold, and slate palette and brand type are retained; product identity and pricing carry the visual hierarchy.
- The top-bar cart shows product-line count and, on desktop, checkout-ready subtotal. Inside, product count and total pieces are labeled separately.
- Each row resolves current imagery and product links by exact SKU using the existing catalog lookup, with an exact-SKU hero fallback. No family-level substitute is used for a cart selection.
- Quantities can be typed or adjusted one piece at a time. Whole-number validation preserves the previous quantity on invalid input. Remove offers Undo for the exact line.
- A persistent footer shows subtotal, progress toward the existing $50 minimum, shipping/tax wording, and one checkout action. Lines requiring review are identified and block this panel’s checkout action instead of being silently omitted.
- Uses the shared CartProvider for cart state, pricing, edits, and existing checkout resolution. No payment, catalog, backend, or pricing-policy changes. Uses the existing Radix dialog for focus containment/restoration; Escape closes the cart without closing Grace.

### Validation

- Scoped ESLint passed. 22 tests passed across the workspace-cart interaction, workspace-controls, direct-cart-checkout, and workspace-shell suites. Coverage includes exact identity, invalid quantities, updated totals, remove/undo, checkout errors, eligibility/minimum gating, focus restoration, and staying in the workspace.

- Final `npm run build` passed, including TypeScript and all 73 static pages; the pre-existing asset-ledger tracing warnings remain. Generated sitemap and Next type-reference changes were restored.
- Live browser check used two temporary exact catalog selections: `GBCyl5GlMattSht` and `GBCylBlu5SlMattSht`. Both exact images decoded and their SKU-specific product links resolved. Changing each quantity to 144 produced 288 pieces and $139.68 ($67.68 + $72.00), with the minimum reached and checkout enabled. Below-minimum state was also verified.
- Browser removal/Undo restored the exact cobalt selection, 144 pieces, and the subtotal. Escape returned to the same workspace with focus on the cart trigger. Both temporary items were removed afterward and the cart verified empty. No checkout or order was submitted.
- At 390 x 844, the panel measures 390 x 844 with document scroll width 390; both rows were readable and the checkout action remained visible with a 48px target. Viewport override reset after review.
- Screenshots: `grace-workspace-cart-desktop.png` and `grace-workspace-cart-mobile.png` in the review screenshot directory.
- Updated production preview remains local at port 3084. Not merged or deployed.

## Welcome-panel refinement using Mobbin

The user identified the compact homepage panel as busy. The screenshot gave the greeting, four outlined suggestions, header utilities, policy text, page context, and gold composer outline similar emphasis. The refinement reduces that competition while preserving the full-screen workspace and existing shopping flows.

### References and design decisions

Reviewed Mobbin previews for ChatGPT, Mistral AI, Dropbox Dash, Grok, Zalando, Walmart, and Alta. The most relevant patterns were:

- [ChatGPT welcome screen](https://mobbin.com/screens/1ad0a887-6daf-4e08-b45a-71e041ebd91a): short greeting, quiet background, prominent composer.
- [Zalando shopping assistant](https://mobbin.com/screens/21291d75-1b00-4410-a41e-c3078fe5d556): compact shopping suggestions with a simple introductory hierarchy.

Implemented locally:

- A shorter heading, three consistent text actions with subtle dividers, and a flat bone background replace the large time-of-day greeting, individually boxed suggestions, and gradient.
- One bottle mark and the AI concierge identity anchor the header. Menu, expand, and close remain available; New conversation lives in the menu instead of duplicating a header reset control.
- Reordering/tracking, samples, uploads, cart access, and contact remain in the menu. Privacy, terms, and the AI disclosure are grouped at its bottom.
- Context is shown for a product, filtered catalog, or collection; the generic homepage context is omitted.
- The composer uses a neutral border and shorter placeholder. The black Voice pill remains; typing replaces idle Voice with Send. An active voice session remains stoppable while drafting text.
- The same hierarchy and copy changes apply in Spanish. Mobile remains a full-screen sheet with a 16px input and explicit close control.

### Verification

- Scoped ESLint passed.
- 17 tests passed across three suites: rendered Grace redesign interactions, responsive shell contracts, and workspace controls. The added cases cover underlying prompt dispatch, menu reset/policy access, Voice-to-Send behavior, and meaningful page context.
- Production build passed, including TypeScript and static generation. Existing asset-ledger file-tracing warnings remain. Generated sitemap and Next type-reference drift were restored.
- Browser review confirmed click-only opening; the shortened desktop welcome; draft input switching idle Voice to Send; menu order/sample/upload/cart/policy destinations; Escape dismissing the menu and then Grace; expansion into the full-screen workspace; and Close Grace returning to the storefront.
- Mobile review at 390 x 844 measured a 390 x 844 dialog with both dialog and document scroll width 390. The composer and exit control remain visible. The temporary viewport override was reset.
- No AI prompt, microphone session, file upload, checkout, or order was submitted during this refinement review.
- Screenshots: `grace-welcome-refined-desktop.png`, `grace-welcome-refined-mobile.png`, and `grace-welcome-refined-menu.png` in the review screenshot directory above.
- Updated preview is served locally on port 3084. Not merged or deployed; visual approval remains with the user.

## Side launcher position

Moved the desktop product/cart edge launcher down 100px from its previous 46%-of-viewport position. A short-viewport limit keeps the complete tab visible. The existing small-screen bottom anchor remains in effect.

Production build passed. Browser measurement at a 720px viewport: top 431.195px versus the previous 331.2px; measured shift 99.995px. Screenshot: `grace-launcher-lowered.png`. Local preview updated at port 3084; not deployed.

## Composer focus cleanup

Removed the separate text-area focus outline, then removed the parent composer’s gold focus border and halo after the user pointed out that a visible outline remained. Clicking into the text field keeps the same neutral 28px rounded composer border; the text caret indicates the active input. Buttons and links retain their distinct focus outlines.

The first focused review screenshot (`grace-composer-single-outline.png`) still showed the unwanted gold rounded focus border and was superseded. The final no-outline verification is recorded below.

### Final focus verification

The final production build passed. In the browser, the composer border remained `rgb(213, 208, 199)` before and after focusing the text area; its box shadow remained `none`, and the text area outline was `none`. The focused screenshot is `grace-composer-no-focus-outline.png` in the review screenshot directory above. This verifies the local preview only; it has not been merged or deployed.

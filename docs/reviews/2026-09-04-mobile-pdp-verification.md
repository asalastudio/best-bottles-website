# Mobile PDP verification — 4 September 2026

## Original Cursor baseline recommendation

**Hold production release.** The main mobile shopping interactions work in browser emulation, but the deployed preview still crashes, the tested catalog exposes contradictory product details, and the smallest tested screen has a cramped picker. Physical iPhone/Safari gesture validation and checkout handoff remain outstanding.

## Original test scope and environment

- Cursor PR #89, commit `f7760f04b1bb6dcf7453d657a8022bfe12d74f20`.
- Local repair branch: `codex/mobile-pdp-preview-repair`.
- Product: `/products/cylinder-9ml-clear-17-415-rollon` — 9 ml clear cylinder roll-on, neck 17-415.
- Browser tests used the local Next.js webpack server with the existing development catalog (`helpful-elephant-638`). Prices and content observed here are not independent verification of production data.
- The only application change needed to render the test was the local Grace-memory error-tolerance fix. Mobile design components were not edited.
- No code was pushed, merged, or deployed. Production and the existing development backend were not modified.
- Before the user redirected this work to testing, an empty isolated Convex preview (`expert-curlew-793`) was created with a 13-day expiration. No code/data was loaded and no deploy credential was created. Preview build-script changes are local and inactive.

## Verified behavior

| Check | Evidence |
| --- | --- |
| Mobile layout | Real browser at 390 × 844 and 430 × 932: document width matched viewport; product image loaded. Mobile tree hidden at 768 px. |
| Cap picker | Black → Shiny Gold updated the bottle preview; Cancel restored Black; confirmation changed the product title, price, and SKU. |
| Roller picker | Plastic → Metal preserved the gold cap and resolved `GBCyl9MtlRollShnGl` at $0.72/each. |
| Glass picker | Amber resolved `/products/cylinder-9ml-amber-17-415-rollon?sku=GBCylAmb9MtlRollShnGl`, retaining the metal roller and gold cap. |
| Direct SKU URL | Direct loading of the clear product with `?sku=GBCyl9MtlRollShnGl` restored that configuration. Glass selection replaces browser history; Back returned to the preceding page, not the prior glass selection. |
| Expanded viewer | Open/close, Cap On/Cap Off, and mouse double-click zoom worked. Closing restored focus to View Larger and preserved scroll at 19.5 px. Sticky CTA was hidden while the viewer was open. |
| Sticky CTA | Hidden at initial landing; visible below the configurator (sentinel top -218.03 px). |
| Inline cart action | 12 selected metal-roller/gold-cap bottles × $0.72 = $8.64; cart displayed matching roller, thread, title, quantity, and price. |
| Sticky cart action | Added another 12 of the same configuration; cart merged to 24 units / $17.28. Test cart was cleared afterward. No checkout or order submitted. |
| Pricing disclosure | Rendered all five stored tiers through 2,880+ and clearly distinguished quoted volume rates from the flat checkout rate. |
| Details | Specifications and Compatible Components opened with keyboard; volume pricing opened by click. Loaded component thumbnails were confirmed; additional offscreen images remained lazy and were not classified as failures. |
| Grace shell | Opened with Cylinder 9 ml context. Voice token request returned 503 because this local test had no OpenAI API key; voice/chat quality is not verified. |
| Grace error isolation | Actual browser logged a warning that preferences were unavailable while the PDP remained usable. Regression test exercises failure → recovery → failure through real Convex React hooks. |

## Findings before release

1. **P1 — Deployed preview cannot render the page.** Existing preview throws `Could not find public function for 'graceMemory:getByOwner'`. The local fallback is verified but remains uncommitted and undeployed. Backend/frontend parity and the fallback must be validated in the release environment.
2. **P2 — Contradictory product copy in tested data.** The roll-on page's visible “About This Product” text says it is built for fine mist sprayers. Confirm and repair the relevant catalog/CMS source before publishing.
3. **P2 — Cap specification contradicts the selected option.** For `GBCyl9MtlRollShnGl`, the selector/title say Shiny Gold, while Specifications says `Cap Color: Clear`. `MobileProductDetails.tsx` displays the raw `variant.capColor`. Reconcile the data or use the same canonical finish resolution as the selector.
4. **P2 — Small-screen picker needs refinement.** At 320 × 568, the cap sheet occupied y=360–568 (208 px total), leaving a 65 px vertically scrollable option area containing 240 px of content. Option labels/cards are substantially clipped. Selection was possible using browser automation, but that is not proof of usable touch interaction.
5. **Boundary observation — 768 px layout overflow.** At the switch to desktop presentation, document scroll width was 823 px for a 768 px viewport. This was outside the mobile-only tree; attribution to this PR versus existing desktop code was not established.

## Automated checks

- 58 tests passed across mobile PDP models, focused PDP purchase/DOM tests, Grace memory resilience, and preview build guard tests.
- `npx tsc --noEmit`: passed.
- Changed-file ESLint: no errors; one existing exhaustive-deps warning in GraceProvider.
- `git diff --check`: passed.
- `npx next build --webpack`: passed (exit 0), including TypeScript, all 54 static pages, and build tracing. The local preview was then switched to `next start` to serve this optimized build.
- Optimized-build browser check: correct 9 ml / 17-415 product and `GBCyl9RollBlkDot` rendered at 390 × 844, hero image loaded, document scroll width 390 px. Local URL: `http://localhost:3001/products/cylinder-9ml-clear-17-415-rollon`.

## Not established by this test

- Real iOS Safari browser chrome, safe-area behavior, pinch-to-zoom, touch panning, double-tap, sheet drag dismissal, or rotation.
- Shopify checkout handoff/payment or production checkout pricing parity.
- Grace voice/chat behavior and backend memory persistence.
- Production data parity, all bottle families/SKUs, or a full desktop regression pass.

## Next release gate

Address the deployment crash and contradictory product details, improve or accept the documented small-screen limitation, then verify the same exact 9 ml SKU in an authenticated deployment preview on a physical phone before authorizing production.

## Repair candidate — codex/mobile-pdp-preview-repair

The repair branch starts at the exact PR #89 head above. It is a separate continuation of the Cursor implementation; production remains a separate release gate.

### Changes

- Optional Grace-memory failures return an unavailable state instead of unmounting the storefront.
- Mobile and desktop specifications, plus new cart lines, use the same resolved cap finish as the selector. Shared catalog rows are not modified.
- Editorial rich descriptions now use the existing applicator-consistency check. Incompatible text uses a compatible canonical product description, or is omitted if none exists. The stale source is Sanity document `productGroupContent-cylinder-9ml-clear-17-415-rollon`, block `desc-cylinder-9ml-clear-1`. That shared document is unchanged.
- On screens at most 700 px tall, the cap picker uses one horizontally scrolling row. The bottle keeps exactly its normal scale; the View Larger entry is temporarily hidden while the picker is open.
- The desktop quantity input is constrained to 48 px and purchase controls can wrap, resolving the 768 px overflow.
- An inactive, branch-level preview-build opt-in accepts only preview-scoped Convex keys. This repair preview uses the existing backend; the opt-in is not enabled and no new deploy credential is issued.

### Repair verification

- 62 tests pass, including the existing mobile/purchase checks, actual Convex-hook failure recovery, editorial conflict cases, and preview-build guards.
- TypeScript and changed-file ESLint pass; `git diff --check` passes.
- After the scale correction, at 320 × 568 the bottle stage is 216.86 × 238.53 px both before and after opening. The sheet is y=300–568, and its complete single row is y=373–486.5 with the confirmation button visible. This supersedes the earlier compressed-bottle/two-row repair.
- Document width matches viewport at 320, 390, 430, and 768 px. The corrected tablet quantity input measures 48 px.
- Pointer selection of Shiny Gold works, and Specifications displays Shiny Gold. The visible roll-on editorial copy no longer says it is built for fine mist sprayers.
- Selecting Metal Roller preserves Shiny Gold and resolves `GBCyl9MtlRollShnGl`, $0.72. A 12-unit cart addition totals $8.64. No checkout or order is submitted.

### Remaining release gates

- Verify the deployed repair URL on a physical iPhone/Safari, including safe area, pinch/pan, sheet dismissal, and rotation.
- Complete checkout handoff and confirm production catalog/pricing parity.
- Verify Grace voice/chat and memory on a backend that contains the matching functions. Grace memory remains optional and unavailable on the existing test backend.
- The existing shared Sanity record still contains stale sprayer copy; the repair renders compatible catalog copy instead. An editorial source correction can be reviewed separately.

### Cap naming and image-scale follow-up

- Preserve dotted cap identity from website SKU, legacy Grace token, or explicit cap wording. Black with Dots, Silver with Dots, and Pink with Dots remain distinct from solid/shiny finishes.
- Use the shared dotted identity in product titles and the PDP finish resolver, which supplies configuration rows, specifications, and new cart lines. Keep the existing component-photo lookup vocabulary separate.
- Optimized build and 72 focused tests passed, covering naming, SKU/photo mappings, mobile models, and purchase controls. Small-screen pointer opening confirms the image does not shrink; all ten finish options remain accessible by horizontal scrolling.

# Catalog and Paper Doll Readiness Design

**Date:** 2026-08-03
**Status:** Approved for implementation
**Golden family:** Cylinder · 9 mL · 17-415 · `CYL-9ML`

## Objective

Prepare the full Best Bottles storefront for incoming Paper Doll assets without weakening catalog truth. The public experience must remain useful before assets are released, become fully layered when a family passes its release gate, and preserve the same capacity, neck finish, family, color, applicator, price, stock, SKU, cart, and Grace context throughout the journey.

## Product-truth boundary

Convex owns product identity, capacity, neck finish, compatible configurations, pricing, stock, SKU identity, and catalog counts. Sanity owns editorial family content and registered Paper Doll layer assets. OpenAI/Grace consumes the storefront's canonical URL-backed Refine state and may only broaden a constraint after explicit customer language.

The Cylinder pilot is exactly `Cylinder + 9 mL + 17-415 + CYL-9ML`. The 9 mL 13-415 Tall Cylinder is a separate platform even when capacity, glass color, or visible silhouette appear similar.

## Shared Paper Doll contract

- Canvas: exactly 2080×2288 RGBA PNG.
- Preset: `pdp-2080x2288`.
- Required release metadata: `pipelineVersion`, `assetRevision`, `storefrontReady: true`.
- Supported slots: `body`, `roller`, `cap`, `sprayer`, `overcap`, `pump`, `shortcap`.
- Render hierarchy:
  - Roll-on: body → roller → cap.
  - Fine mist: body → sprayer → overcap when supplied.
  - Lotion: body → pump → overcap when supplied.
  - Bottle-only/short-cap: body → shortcap.
- Every layer uses the same registered canvas and transform. The storefront never stretches or independently centers layers.
- Convex configurations reference explicit Sanity `(slot, variantKey)` registrations. Missing keys fail release validation instead of being guessed.

## Release behavior

The Beauty and Build choices are always explained as peers on the unified PDP. When assets are released, Build opens the layered canvas. When they are not released, Build remains visible but unavailable and explains that the layered preview is being prepared; it never silently redirects to Beauty.

The family page receives the same release status. Before release, its primary action opens the exact configuration controls and identifies the layered preview as pending. After release, it opens Build directly.

## Authoritative Refine state

The canonical query parameters are shared with the main catalog:

- `families`
- `capacities`
- `colors`
- `applicators`
- `threads`
- `sort`
- `view`
- `search`

The Cylinder family maps its customer labels to the catalog applicator buckets `rollon`, `finemist`, and `lotionpump`. Applied values are visible as removable chips. Counts and result copy are derived from filtered groups, not the unfiltered model. The URL changes with every committed desktop filter action and every mobile Apply action.

Mobile uses a full-height Refine sheet with Capacity, Glass color, Delivery system, and Neck finish. Customers set multiple values, then apply them with a sticky `Show X groups` action. Capacity and neck finish remain active until explicitly removed.

Grace reads this URL-backed state through the existing `GraceRefineState` contract. It does not receive a second Cylinder-only state representation.

## Responsive behavior

- The full desktop navigation appears only when the logo, links, search, account, and cart fit within the viewport. Compact navigation remains available below that breakpoint.
- Header search width and link gaps scale between 1280 and 1536 px.
- The mobile menu uses the existing typographic Best Bottles wordmark; it does not request a missing image asset.
- All mobile pages reserve tab-bar height plus safe-area inset. Drawers terminate above or suppress the tab bar.
- Primary mobile targets are at least 44×44 px.

## Catalog component behavior

- Variant swatches use one interactive button pattern whenever a preview can change.
- Accessible names include enough configuration context to distinguish variants.
- Static/non-previewable options are presented as labeled availability, not as controls.
- Product cards prioritize capacity, neck finish, delivery system, finish breadth, and price.
- Mobile family cards use a denser media ratio than the desktop editorial grid.
- Empty, unavailable, and loading states explain the next action.

## Verification matrix

Automated contract coverage includes:

- Cylinder 9 mL 17-415 Paper Doll cohort.
- Cylinder 9 mL 13-415 exclusion.
- Boston Round, Elegant, Diva, and Empire representative routes.
- Bottle-only, roll-on, fine-mist, lotion-pump, quote-only, out-of-stock, and incompatible states.
- URL round trips, applied-filter removal, result-count synchronization, Grace inheritance, build availability, and cart identity.

Browser verification covers 1440×1000 desktop and 390×844 mobile. Physical-device checkout and voice latency remain a final release gate because they require real devices and production-like credentials.

## Error handling

- Unreleased or invalid Paper Doll assets produce an honest unavailable Build state.
- Invalid URL filter values are ignored without removing valid constraints.
- Empty result sets retain the applied filters and provide Clear filters.
- Invalid configuration SKUs resolve to a valid exact-platform default and remove only the invalid configuration key.
- Catalog/Grace failures never broaden capacity or thread automatically.

## Non-goals

- Uploading unfinished Paper Doll assets.
- Marking Sanity documents storefront-ready before validation.
- Changing Convex product truth or creating compatibility from visual similarity.
- Claiming physical-device or WCAG conformance from automated checks alone.

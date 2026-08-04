# CYL-9ML Paper Doll Draft Preview Bridge

**Status:** Approved design pending written-spec review  
**Date:** 2026-08-04  
**Scope:** Best Bottles local/editorial preview only

## Outcome

Allow the current CYL-9ML Paper Doll Sanity draft to render in the existing unified product UI before public storefront approval. The preview must expose only layer combinations that can be assembled from the current release, identify missing layers honestly, and leave all published Sanity documents and public storefront behavior unchanged.

## Existing system preserved

- The existing product route remains `/products/cylinder-9ml-17-415`.
- The existing `UnifiedBottlePdp`, configurator, and `PaperDollCanvas` remain the presentation shell.
- `paperDollFamily.currentRelease` remains the pointer to the immutable release.
- The public path continues to require the strict `storefrontReady === true` release gate.
- Sanity remains the asset source; Madison remains the source of release provenance and geometry approval.

## Preview entry

The local/editorial preview uses:

`/products/cylinder-9ml-17-415?view=build&paperDollPreview=1`

Preview access is allowed only when either:

1. Next.js Draft Mode is enabled through the signed Sanity preview flow, or
2. the application is running locally in development.

The query parameter alone must never expose Sanity drafts in a public production request.

## Data flow

1. The product page detects a permitted Paper Doll preview request.
2. A server-only authenticated Sanity client reads the `paperDollFamily` draft using the `previewDrafts` perspective.
3. The family draft resolves its `currentRelease` reference to the corresponding draft release.
4. The draft release is validated with the same canvas, URL, dimension, unique-layer, and layer-order checks as a public release, except `storefrontReady` is not required.
5. The validated preview family is passed to the existing `UnifiedBottlePdp` and `PaperDollCanvas`.
6. The browser never receives the Sanity token.

## Partial-release behavior

The current release contains five body layers, two roller layers, six sprayer layers, and three lotion-pump layers. Ten roll-on cap layers remain blockers.

- Spray and lotion configurations with complete required layers may render.
- Roll-on configurations requiring a missing cap must remain selectable as catalog truth but must not attempt a false composite.
- An unavailable configuration shows a precise `Missing cap layer` message instead of a generic load failure.
- No substitute cap, legacy hero, or silent layer fallback is allowed inside the Paper Doll canvas.
- The release remains labeled `Draft preview — not publicly released`.

## UI behavior

- Enable the Build tab when a valid preview release is present.
- Add a small amber draft-preview banner above the canvas.
- Preserve the Beauty View as an independent fallback tab.
- Disable or visibly annotate only the unavailable layer combination, not the entire 145-configuration catalog.
- Keep normal public behavior unchanged when preview access is absent.

## Error handling

The preview fails closed when:

- the request is not local and Draft Mode is not enabled;
- the draft family or release cannot be resolved;
- an asset is not a Sanity CDN URL;
- an asset is not exactly 2080 x 2288;
- a required slot or layer order is invalid;
- the selected configuration references a missing layer.

Errors are shown as preview diagnostics and do not mutate Sanity or Madison.

## Testing

Add focused tests proving:

- preview access is restricted to local development or signed Draft Mode;
- public validation still requires `storefrontReady === true`;
- preview validation accepts a structurally valid draft with `storefrontReady === false`;
- spray and lotion composites resolve from the current 16 assets;
- roll-on composites report the exact missing cap key;
- no public Sanity mutation is performed;
- the existing 145-configuration catalog and Beauty View remain intact.

Run the focused Paper Doll and unified PDP tests plus TypeScript validation before handoff.

## Public release boundary

This feature does not publish Sanity documents. Public visibility still requires a separate named approval after the cap blockers are resolved, followed by publication of the immutable release and the `paperDollFamily` document that points to it.


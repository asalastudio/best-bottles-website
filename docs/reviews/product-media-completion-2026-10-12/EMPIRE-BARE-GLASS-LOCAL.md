# Empire bare glass integration, 14 October 2026

Local work on `codex/product-media-completion-2026-10-12`. No merge, asset publication, backend write or deployment.

## Implemented locally

- The generated 50 ml and 100 ml empty masters replace the body in 90 of 91 captured Empire combinations through the shared register loader used by PDP and Builder. The chooser and glass swatches also use these masters. Each size shares one fixed image across finishes.
- Replacements align uniformly to the captured shoulder, axis and foot. Existing source plate, component, tube and closure guards continue checking the original metadata before the display replacement. Source bytes remain unchanged.
- Twenty-four exact reducer SKUs receive a separate source-backed insert. Proposed seating is a visual registration and still needs review. The bare Builder stage excludes the insert.
- Three 50 ml droppers use their exact-SKU published photographic pipettes. The shared promoted pipette was hidden behind the opaque plate and, when exposed, reached into the glass foot. The recovered photos retain their aspect ratio and use a uniform source-body scale, with the head seated under the closure. Their final visual acceptance remains pending.
- The new paths are disabled outside local development, including Vercel.

## Coverage and checks

Captured production family: 91 exact SKUs in 11 groups. New masters applied to 90 assemblies. The exact `LBEmp100WhtClOvrCp` white pump/clear overcap remains unresolved and keeps its older fallback, explicitly held on the review page. Its source drive at `/Volumes/Achive` is disconnected; no substitute was invented.

Rendered 144 supported PDP views and 540 Builder stage/cover layouts using the actual shared layout functions. Four PDP contact sheets and representative enlarged views inspected. These are offline renders, not browser screenshots or interaction acceptance. The separate bare, reducer, pipette and hardware states remain available in review.html.

Twenty-nine focused tests pass, including real server loaders for both Empire sizes with network prohibited, immutable source hashes, exact source guards, production/Vercel exclusion, shared-body identity, retained hardware placement and chooser/swatch paths. TypeScript and git diff whitespace checks pass.

## Remaining acceptance

- Browser verification of selectors, zoom, image delivery, finish changes and desktop/mobile layouts. Attempting the local review page was rejected by the saved browser permission setting for localhost:3005. No workaround or alternate browser path was used. The review server is listening on localhost:3005 from the verified worktree.
- Owner visual review of the new master assemblies, proposed reducer seating, photographed pipette seating and the existing white-pump detached-cover candidate.
- Exact 100 ml white-pump source recovery when the archive is available.
- Catalogue card images still use the captured published artwork. New master integration is scoped to PDP and Builder, including bare chooser/swatch paths. Catalogue-card replacement and whole-catalogue dip-tube acceptance remain open.

Review: http://localhost:3005/team/media-review

Artifacts: verification.json, review.html, manual-ui-checks.csv, empire-overview.jpg and all-pdp-views-1.jpg through all-pdp-views-4.jpg in the dated output directory. Manual UI checklist entries remain pending.

## Correction after close visual review

The earlier separate-layer checks did not establish that seated tubes appeared inside the glass. Enlarged views revealed opaque bone pixels and old glass rim/base fragments in the photographic tube cuts. Those fragments were drawn over the new body, producing the exterior sticker effect.

The local Empire replacement now maps a traced inner cavity from each master into the assembly. Seated tubes and pipettes use that mask, multiply blending and 0.68 opacity so glass reflections remain visible. Exposed tubes retain their full separate appearance. The pipette registration also raises the complete tip above the inner cavity floor without changing its source aspect ratio. The cavity trace is a visual approximation, not a new physical measurement. Original source files are unchanged.

Both PDP and Builder use the same appearance helper. Their local cache versions were advanced. Production and Vercel remain excluded.

Fresh verification: 33 focused tests pass, including actual component static rendering and a pixel regression proving the old tube cut no longer paints over the solid glass base. TypeScript and git diff whitespace checks pass. Regenerated 144 PDP views and 540 Builder layouts, inspected all four PDP contact sheets and enlarged pump/dropper samples. These remain offline renders, not browser screenshots. Localhost browser access is still denied by the saved permission setting; no workaround was used.

Correction artifacts: `outputs/media-completion-2026-10-12/empire-through-glass-2026-10-14/`, including `tube-depth-before-after.png` and `full-review/review.html`. The 100 ml white-pump hold and catalogue-card coverage gap above remain open. Owner visual acceptance is pending.

## Vintage and tassel tube correction

The 50 ml vintage/tassel hero extraction retained only a 4–9 px edge through much of its length. Multiplying those nearly white edge pixels made them appear broken. The previous contact-sheet review missed this defect. A retained pixel-width test fails against that rejected extraction.

Recovered the complete `Layer 4 copy` from the saved black tassel Photoshop source, with its original RGBA bytes preserved in a content-addressed PNG. The 18-415 source scale is retained uniformly. A display polygon excludes surrounding retouch scraps and cuts the visible tube just above the inner floor. Seated lighting is slightly attenuated before blending through the glass. No bottle, collar, hose or bulb geometry changed.

Applied locally to 18 captured Empire 50 ml vintage/tassel assemblies in PDP and Builder. The 100 ml source retains its full tube and is unchanged by this correction. Vintage configurations expose only the assembled view; dormant exploded cuts were not replaced or accepted here. Native source receipt and pilot renders: `outputs/media-completion-2026-10-12/empire-tassel-tube-2026-10-14/`. The shared full review now includes the corrected 18 product views and 108 Builder layouts. Browser and owner visual acceptance remain pending; nothing published.

The focused tube/component checks and TypeScript pass. The initial complete Vitest run reported 337 passing suites and 9 import failures from the `server-only` marker. Failed suites: `application-finder-route`, `catalog-missing-source-visibility`, `catalog-server-sanitization`, `grace-accuracy-audit.live`, `grace-navigation-battery.live`, `grace-policy-corpus`, `grace-tool-gateway-server`, `knowledge-openai-responses`, and `cylinder-focused-finder`. The original output remains in `vitest.log`. During PR preparation, explicit test-only mocks corrected those imports while retaining the Next server boundary. A subsequent complete run passed 344 suites and 3,131 tests, with 2 suites and 7 tests intentionally skipped. See [PR readiness](PR-READINESS-2026-10-14.md) for the final commit gates and remaining acceptance work.

# Round 78 ml spray source tubes, 14 October 2026

Twelve local review candidates are implemented: six clear and six frosted fine-mist spray combinations. Final browser, physical iPhone and owner visual acceptance remain pending. Publication is disabled; merge and release require separate authorization.

## Close-up correction

The owner supplied a close-up of the seated tube. Inspection identified a flat gray cast from `brightness(0.96)`: even the source's white highlights became gray before multiplication through the glass. Round 78 seated views now preserve native source lighting. Geometry, opacity, masking and original source bytes are unchanged.

All twelve finishes were rendered again in 36 PDP and 72 Builder layouts, saved under `native-highlights-final/`. Byte comparisons confirm all 12 exposed renders and all 24 bare Builder renders are unchanged; the 72 seated renders changed. Fourteen focused tests pass, including Empire material regression coverage. TypeScript passes; ESLint reports no errors and one existing unused-variable warning in the Round test. The final full-suite run includes this correction.

The local review page now shows the previous gray cast beside native highlights with a new image URL. Browser and owner acceptance remain pending. This removes an introduced cast; the flat source artwork still does not simulate physical glass refraction.

## Scope and source

The exact website SKUs are:

| Clear | Frosted |
| --- | --- |
| GBRnd78SpryCu | GBRndFrst78SpryCu |
| GBRnd78SpryMtGl | GBRndFrst78SpryMtGl |
| GBRnd78SpryMtSl | GBRndFrst78SpryMtSl |
| GBRnd78SpryShnGl | GBRndFrst78SpryShnGl |
| GBRnd78SpryShnBlk | GBRndFrst78SpryShnBlk |
| GBRnd78SpryShnSl | GBRndFrst78SpryShnSl |

The intact tube is Layer 25, index 2, from `29. GBRnd78SpryShnSl.psd`. The recorded master SHA-256 is `7110a4ea8d947058c893eb8c78fe9a44dbceeca11afad02f1fdd6f265de906a4`. The source archive is disconnected, so this batch uses the previously verified cached extraction. The master was not freshly rehashed.

The 131 by 697 PNG is copied unchanged to `public/local-media/source-tubes/round78-spray.d4949a59193c.png`. Its byte hash, source bounds, registration and exact component metadata are retained in `src/lib/register/local-round78-tubes.json`. Alpha continuity is tested separately from successful decoding.

## Assembly changes

- A complete native tube replaces the fragmented hero cut in seated and exposed views. The bottles remain empty.
- One uniform scale uses the source body's meaningful shoulder at y=612 and baseline at y=1410. Its upper retouch scraps are excluded as a registration datum.
- The tube head seats two canvas pixels under the unchanged sprayer. The tip must end above the recorded inner floor, 6.5 mm above the bottle foot.
- Clear glass uses a subdued seated treatment; frosting further softens the tube. Exposed artwork retains its separate material treatment and moves with the sprayer.
- Original glass URLs, dimensions and seated hardware placement remain unchanged. Exposed stack spacing accounts for the complete source tube.
- The override runs only in local development without Vercel. Exact SKU, plate and participating mechanism-layer guards reject changed sources. Extra Empire-specific layers do not participate in Round; a future Round-specific layer disables this pilot.

## Verification

| Check | Result |
| --- | --- |
| Fresh public production Round capture | 22 groups, 178 variants, 223 product lookups |
| Exact batch coverage | 12 of 12 |
| Current development registration | 12 of 12; no missing candidates |
| Legacy reference pages | 12 retrieved, 12 exact SKU headings; reader cache age unavailable |
| Offline PDP renders | 36: Cap On, Sidecar and Exploded for every SKU |
| Offline Builder renders | 72: body, fitment and complete, with both cover states |
| Focused Round source-tube tests | 5 passed |
| Full test suite | 345 suites passed, 2 skipped; 3,136 tests passed, 7 skipped (`--maxWorkers=2`) |
| TypeScript and changed-source ESLint | Passed |
| Independent implementation review | No important defects found |

Close inspection covered the full PDP contact sheet, representative seated clear and frosted views, exposed source continuity, and representative Builder complete views. The review script uses shared layout functions and a custom rasterizer. It does not reproduce every `BuilderImage` blend or the shared `builderBodyFrame` camera, and these renders do not establish browser acceptance.

The fresh production capture supports the offline comparison. Product links in the local review page use current development data. No database or environment mutation was performed. Historical URL counts, continuity flags and exact-SKU counts are different measures and must not be subtracted from one another.

The default-concurrency PR check hit one five-second timeout in the existing 373-plate approval test. That test passed alone in 334 ms, and the complete suite passed with two workers. No timeout or test implementation was changed.

## Review and remaining work

Open `/team/media-review/round78` on the existing local server. Check all twelve exact finishes on their product pages, including zoom and Exploded, then the same selected finish in Builder. Confirm continuous tubing, correct sprayer seating, the tip above the inner floor, and softened visibility through frosting. Browser automation remains denied by the saved localhost permission; no workaround was used.

Evidence is saved under:

`/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/round78-source-batch-2026-10-14`

This batch covers Round 78 ml fine-mist sprays only. Lotion, vintage/tassel and reducer combinations remain in their separate source and assembly review queues. The catalogue has not passed dip-tube acceptance.

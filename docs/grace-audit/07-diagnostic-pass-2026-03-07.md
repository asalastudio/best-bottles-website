# Grace Diagnostic Pass — 2026-03-07

## Current Snapshot

- Navigation audit: `32 / 32` pass, `0` broken
- Ask Grace prompt pack: `9 / 9` high-signal prompts returned grounded, usable answers
- Browserless truth audit for Batch 2: `877` live products matched to `877` Convex products with `0` missing and `0` color/capacity mismatches

## Diagnostics Run

### 1. Navigation regression

Command:

```bash
node scripts/audit_grace_navigation.mjs --json
```

Latest result after `GI-0003` fix:

- `32` pass
- `0` broken
- `0` warnings
- `0` no-results

Synthetic hallucination-slug probes now resolve safely to catalog URLs instead of dead PDPs.

### 2. Direct `askGrace` prompt pack

Prompts checked:

- `Show me roll-on bottles`
- `9ml clear cylinder roll-on`
- `What bottle should I use for oud oil?`
- `Tell me about the Circle family`
- `Do you have a 100ml circle bottle?`
- `What fits 20-400?`
- `What fits a 30ml amber Boston Round roll-on bottle?`
- `Can I pick up from your warehouse?`
- `Show me spray bottles`

Observed result:

- All `9` prompts returned coherent, grounded answers
- Retrieval and policy behavior looked healthy
- No obvious hallucination appeared in this prompt set

### 3. Family overview vocabulary check

Direct query of `api.grace.getFamilyOverview` for `Royal` returned canonical applicator types:

- `Fine Mist Sprayer`
- `Metal Roller Ball`
- `Plastic Roller Ball`

This indicates the old grouped applicator terminology drift has been corrected in current runtime data.

### 4. Fitment parity check

Direct comparison of:

- `api.grace.getBottleComponents({ bottleSku: "GB-CIR-FRS-100ML-RDC-WHT" })`
- `api.grace.checkCompatibility({ threadSize: "18-415" })`

still shows a contradiction:

- grouped bottle components include `Dropper`
- the 18-415 fitment matrix for `Circle 100ml Frosted` marks `Dropper` as not fitting

This was the remaining contradiction at the end of the diagnostic run.

### 5. Update after `GI-0006` fix

`GI-0006` is now verified.

Runtime bottle-component queries were updated to reconcile embedded component groups against the matched bottle-specific fitment rule before returning results.

Verification command:

```bash
node scripts/grace-fixes/GI-0006-fitment-parity-18-415-circle-reducer.mjs
```

Observed result:

- `grace:getBottleComponents({ bottleSku: "GB-CIR-FRS-100ML-RDC-WHT" })` no longer returns `Dropper`
- `products:getCompatibleFitments({ bottleSku: "GB-CIR-FRS-100ML-RDC-WHT" })` also no longer returns `Dropper`
- both runtime paths now match the `Circle 100ml Frosted` 18-415 fitment rule

### 6. Update after `GI-0003` fix

`GI-0003` is now verified.

Grace's client-side navigation fallback now preserves more of the original slug intent before searching, and the navigation audit now exercises the same safe-fallback behavior for fabricated PDP targets.

Verification command:

```bash
node scripts/grace-fixes/GI-0003-slug-safe-navigation.mjs
```

Observed result:

- refreshed navigation audit: `32 / 32` pass
- fabricated slugs like `/products/cylinder` now resolve to safe catalog URLs
- no broken navigation targets remain in the regression pack

### 7. Update after `GI-0005` fix

`GI-0005` is now verified.

`products:auditDataQuality` was converted from a single full-table query into a paginated action that reads the catalog in bounded internal pages.

Verification commands:

```bash
node scripts/grace-fixes/GI-0005-paginate-data-quality-audit.mjs
node scripts/data_quality_audit.mjs
```

Observed result:

- audit completes successfully on `2318` products
- returned issue summary: `15` total findings, `1` high severity, `14` medium severity
- no Convex byte-read limit failure

### 8. Live sign-off pass update

Additional browser-verified live cases were run after the code-level fixes.

Newly verified passes:

- `E2`: homepage hero `Ask Grace — AI Bottling Specialist` opens the same shared panel shell
- `V1`: live voice session initializes successfully (`/api/elevenlabs/signed-url` returns `200`, ElevenLabs conversation websocket upgrades with `101`)
- `V2`: switching from live voice back to text leaves the panel usable and Grace continues answering typed follow-ups
- `N2`: typed prompt `Show me the 100ml frosted Circle reducer bottle` now auto-navigates to `/products/circle-100ml-frosted-18-415-reducer`
- `N4`: PDP quick action `Add to order` now opens a `Confirm` / `Cancel` cart proposal card instead of falling back to generic cart text
- `N5`: typed prompt `Show me spray bottles` now transitions the browser to a valid catalog browse state (`/catalog?search=spray+bottles`)

Still partial after live browser verification:

- `V3`: session connect and fallback are healthy, but a true spoken interruption was not fully reproduced in this browser run

### 9. Follow-up V3 retest

An additional live retest was run specifically for `V3` after the `N2` / `N4` / `N5` fixes.

Observed result:

- homepage and PDP entry points both fetched `/api/elevenlabs/signed-url` successfully
- the ElevenLabs conversation websocket upgraded with `101`
- the session then disconnected almost immediately before Grace remained in a stable speaking state long enough to test `Cut in`
- browser console captured `WebSocket is already in CLOSING or CLOSED state` immediately before disconnect cleanup

Conclusion:

- `V3` still cannot be signed off as `pass`
- the current blocker is live session stability during the speaking phase, not just lack of a manual spoken repro

## Current Read

Grace is substantially healthier than the initial audit state:

- `GI-0001` verified
- `GI-0002` verified
- `GI-0003` verified
- `GI-0004` verified
- `GI-0005` verified
- `GI-0006` verified
- `GI-0007` verified

Open material risks:

- no open code-level Grace issues in the current tracked queue
- live sign-off remains partial only on `V3`

## Recommended Next Step

Run one short, direct spoken-session verification for:

- `V3`

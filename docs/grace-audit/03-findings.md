# Grace Audit Findings

## Executive Summary

Grace is already capable of answering real catalog and fitment questions, especially in text mode, but she is not yet robust enough to be treated as fully reliable without guardrails.

Strong signals:

- Homepage text chat works and returned a correct answer for the 100ml Circle prompt.
- Product-page text chat works and used page context correctly for `What fits this bottle?`
- `getBottleComponents` returns concrete, useful compatibility detail for specific bottles.
- The existing navigation audit shows most tested routes resolve cleanly.

High-risk gaps:

- Applicator vocabulary is inconsistent across schema, prompt guidance, and grouped data.
- One Grace audit utility now fails at dataset scale due to the 16 MB Convex read limit.
- Grace can still be steered into empty result sets if old applicator strings are used.
- The navbar voice-search path points to a route that does not exist in the current app tree.
- Product-page text responses are materially slower than homepage answers.

## Evidence Snapshot

### Runtime counts

- `grace:getCatalogStats`
  - `totalGroups`: 345
  - `totalVariants`: 2310
- `products:auditApplicatorValues`
  - `total`: 2318 products scanned

The count mismatch between utilities should be reviewed so the team is not comparing inconsistent metrics.

### Automated audit summary

- `scripts/audit_grace_navigation.mjs --json`
  - 32 scenarios tested
  - 27 pass
  - 5 broken
  - The 5 broken cases were fabricated or hallucinated PDP slug shapes such as `/products/cylinder` and `/products/boston-round`

### Manual UI checks

- Homepage Grace text prompt: `Do you have a 100ml circle bottle?`
  - Passed
  - Returned a correct answer in roughly 5.6 seconds
- PDP Grace text prompt: `What fits this bottle?`
  - Passed
  - Returned a context-aware answer in roughly 15.9 seconds
- PDP console
  - Repeated Sanity CORS errors in local dev for `productGroupContent` and `productFamilyContent` queries

## Severity-Ranked Findings

## P0

### 1. Exact roll-on filter values can produce zero results

What happened:

- `grace:searchCatalog` with `applicatorFilter: "Metal Roller,Plastic Roller"` returned `[]`
- The same query with `applicatorFilter: "Metal Roller Ball,Plastic Roller Ball"` returned immediate matches

Why this matters:

- If Grace uses the old filter terms, valid roller products disappear from the result set.
- This is a direct correctness risk for customer-facing recommendations.

Likely root cause:

- `convex/schema.ts` stores `Metal Roller Ball` and `Plastic Roller Ball`
- `convex/grace.ts` tool guidance still tells the model to use `Metal Roller,Plastic Roller`
- grouped data and some overview paths still expose old terms

Recommended fix:

- Normalize all Grace-facing applicator strings to one canonical vocabulary
- Update prompt/tool descriptions, grouped data, UI filters, and migration logic together

### 2. Navbar voice-search is wired to a missing route

What happened:

- `src/components/Navbar.tsx` posts recorded audio to `/api/voice/transcribe`
- The current `src/app/api` tree contains `voice/route.ts` but no `voice/transcribe/route.ts`

Why this matters:

- The header mic is a customer-visible entry point and likely fails or silently degrades.

Recommended fix:

- Either restore `src/app/api/voice/transcribe/route.ts`
- Or update the navbar to use the current supported speech path

### 3. Grace can still hallucinate clean-looking PDP slugs

What happened:

- The navigation audit flagged 5 invalid slug patterns such as `/products/cylinder` and `/products/boston-round`

Why this matters:

- Any path that lets Grace fabricate a plausible but nonexistent slug creates a broken customer handoff.

Recommended fix:

- Validate every generated PDP target against the known slug set before navigation
- If validation fails, fall back to a catalog URL

## P1

### 4. Grouped applicator values still reflect the old roller vocabulary

What happened:

- `grace:getFamilyOverview` for `Royal` and `Square` returned `applicatorTypes` containing `Metal Roller` and `Plastic Roller`
- runtime enum audit shows stored product values are now `Metal Roller Ball` and `Plastic Roller Ball`

Why this matters:

- Even when a query succeeds, Grace may speak with one vocabulary while the catalog is filtered with another.
- This makes future prompt tuning and UI filtering fragile.

Recommended fix:

- Rebuild or patch `productGroups.applicatorTypes`
- Standardize all render paths to the same user-facing term set

### 5. `products:auditDataQuality` no longer runs safely at current scale

What happened:

- `npx convex run products:auditDataQuality` failed with `Too many bytes read in a single function execution`

Why this matters:

- One of the planned quality gates is currently unusable on the live dataset.
- The team cannot rely on it as a regression check until it is paginated or reworked.

Recommended fix:

- Rewrite the audit to page through the dataset or operate via indexed slices
- Keep the script wrapper, but point it at a scalable backend function

### 6. PDP Grace responses are significantly slower than homepage text responses

What happened:

- Homepage query completed in about 5.6 seconds
- PDP fitment query completed in about 15.9 seconds and required 4 tool iterations

Why this matters:

- The PDP is where Grace is most likely to be used as a purchase assistant.
- A 16-second delay can feel broken even when the answer is correct.

Recommended fix:

- Optimize the PDP prompt path to prefer `getBottleComponents` immediately when page context already identifies the product
- Reduce extra search iterations once the current bottle is known

### 7. Product pages still show repeated Sanity CORS errors in local development

What happened:

- Manual PDP testing showed repeated blocked requests for:
  - `productGroupContent`
  - `productFamilyContent`

Why this matters:

- Grace still functioned, but the page environment is noisy and partially degraded.
- This can mask real Grace failures during local QA.

Recommended fix:

- Add the local origin to Sanity CORS or shift those queries to a server-safe fetch path during development

## P2

### 8. Console noise is high during normal Grace testing

What happened:

- The browser console included Clerk dev-key warnings and many Next image `sizes` warnings.

Why this matters:

- These are not Grace failures, but they increase QA noise and make it easier to miss real assistant issues.

Recommended fix:

- Reduce unrelated warnings in the local environment used for Grace testing

## Passes Worth Keeping

### 1. Thick-oil guidance was correct at the conversation layer

- `grace:askGrace` for `I need an attar bottle for thick perfume oil` correctly recommended a tola-style bottle and explicitly avoided roll-on guidance.

### 2. Circle family discovery was correct

- `grace:askGrace` for `Do you have a 100ml circle bottle?` returned a correct, grounded answer.

### 3. Product-page fitment answer was grounded in the current PDP

- On the 100ml Frosted Circle reducer PDP, Grace answered `What fits this bottle?` with a response aligned to the visible compatible options.

### 4. `getBottleComponents` is useful and detailed

- The Boston Round 30ml amber roll-on query returned grouped component details with real SKUs, names, and prices.

## Overall Assessment

Grace is already useful, but current reliability depends too much on fragile vocabulary alignment and manual vigilance. The fastest path to a higher-confidence assistant is not more prompt polish first. It is:

1. Normalize applicator and grouped vocabulary.
2. Fix the broken or missing test and voice entry points.
3. Make navigation and audit tooling impossible to fail silently.
4. Add a repeatable regression suite around the scenarios in `02-test-matrix.md`.

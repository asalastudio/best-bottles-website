# Grace Remediation, Observability, And QA Roadmap

## Immediate Priorities

## Phase 0: Stop Wrong Answers

### 1. Normalize applicator vocabulary everywhere

Target files:

- `convex/schema.ts`
- `convex/grace.ts`
- `convex/migrations.ts`
- `src/lib/catalogFilters.ts`
- any scripts that seed or patch `productGroups.applicatorTypes`

Goal:

- One canonical internal vocabulary
- One stable user-facing vocabulary
- No path where `Metal Roller` and `Metal Roller Ball` compete

Definition of done:

- Exact filter queries return the same result set regardless of which Grace surface is used
- `getFamilyOverview` and `searchCatalog` speak the same vocabulary

### 2. Fix the broken navbar voice-search path

Target files:

- `src/components/Navbar.tsx`
- `src/app/api/voice/route.ts`
- or restore `src/app/api/voice/transcribe/route.ts`

Goal:

- The visible mic button in the navbar either works or is removed until it works

Definition of done:

- The voice-search button does not send requests to a nonexistent route

### 3. Add slug validation before any PDP navigation

Target files:

- `src/components/GraceElevenLabsProvider.tsx`
- any helper that turns search results into `/products/{slug}`

Goal:

- Grace never sends a user to a fabricated PDP slug

Definition of done:

- Unknown slugs downgrade to a safe catalog navigation path

## Phase 1: Improve Trust And Speed

### 4. Fast-path PDP fitment questions

Target files:

- `src/components/GraceElevenLabsProvider.tsx`
- `convex/grace.ts`

Goal:

- If Grace already knows the current PDP bottle, she should call `getBottleComponents` immediately instead of performing extra catalog search hops first.

Definition of done:

- Typical PDP fitment questions complete in one tool hop or the minimum viable number of hops

### 5. Make the quality audits scale

Target files:

- `convex/products.ts`
- `scripts/data_quality_audit.mjs`

Goal:

- Existing audit scripts should remain usable as the catalog grows

Definition of done:

- `products:auditDataQuality` runs without hitting the Convex byte-read limit

### 6. Reduce local PDP noise from Sanity CORS failures

Target files:

- Sanity CORS project settings
- or server-safe fetching path for Sanity-driven PDP content

Goal:

- Product page QA should not be polluted by repeated CORS failures

Definition of done:

- Local PDP loads without repeated CORS errors for `productGroupContent` and `productFamilyContent`

## Phase 2: Ongoing Reliability

### 7. Add a repeatable Grace regression suite

Recommended artifact:

- `docs/grace-audit/02-test-matrix.md` becomes the canonical scenario list
- Add a machine-readable companion later if needed, for example `grace-regression-cases.json`

Minimum scenarios to automate first:

- roll-on exact filter behavior
- thick-oil routing
- Circle 100ml existence
- Boston Round fitment
- slug validation
- one policy answer for MOQ
- one policy answer for pickup

### 8. Log enough to debug real failures

Add structured logging for:

- user prompt
- entry point
- page context present or absent
- tool sequence used
- result count from `searchCatalog`
- final navigation target
- total latency
- fallback reason when voice fails
- explicit error category

Recommended storage:

- Convex `messages` or a dedicated audit table
- Keep personally identifying info minimal

### 9. Track Grace quality with simple scorecards

Track weekly:

- P0 scenario pass rate
- P1 scenario pass rate
- average text latency
- average PDP latency
- voice failure rate
- no-result rate
- invalid-navigation rate
- top failed prompts

## Recommended Regression Cadence

### Before every production deploy

- Run the canonical prompt set from `02-test-matrix.md`
- Run the navigation audit
- Run the applicator-value audit
- Run at least one PDP manual check

### After any data migration or description deployment

- Re-test roll-ons
- Re-test thick-oil prompts
- Re-test one product-page compatibility prompt
- Re-test at least one family overview prompt

### Weekly

- Review recent failure prompts
- Review latency outliers
- Re-score P0 scenarios

## Suggested Owners

- Data normalization owner
  - applicators, grouping, slug integrity, descriptions
- Grace logic owner
  - prompt/tool loop, navigation safety, fallback behavior
- Frontend QA owner
  - entry points, panel behavior, voice recovery, PDP context
- Content owner
  - `groupDescription` coverage and maintenance for Grace recall

## Recommended Acceptance Bar

- P0 scenarios must pass before Grace is promoted as highly reliable.
- P1 scenarios can remain in backlog only if they do not produce wrong answers or broken navigation.
- Any regression in slug safety, fitment safety, or policy accuracy should block release.

## Practical Next Build Order

1. Fix applicator vocabulary and grouped data drift.
2. Fix the navbar voice-search path.
3. Add slug-safe navigation fallback.
4. Refactor the oversized data-quality audit to paginate.
5. Add structured Grace telemetry.
6. Automate the highest-value scenarios from the matrix.

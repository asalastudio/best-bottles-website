# Published Cylinder and Circle component recovery

Published September 22, 2026 to the backend serving
https://best-bottles-website.vercel.app: `https://precise-raccoon-123.convex.cloud`.
This release changes 47 exact-SKU component kits and their matching product
photographs. Approved 2080 × 2288 catalog heroes are unchanged. Component/plate
exports remain 1000 × 1100.

| Recovery | Released pairs |
| --- | ---: |
| Clear standard Cylinder 9 mL: six sprays, three treatment pumps | 9 |
| Cylinder 25 mL: source-native exposed spray/pump mechanisms | 9 |
| Clear Circle 15 mL: eight spray finishes | 8 |
| Circle 50 mL: six clear + six frosted sprays, nine clear tassels | 21 |
| Total | 47 |

## Verification and evidence

- `scope.json` identifies every SKU and its checked-in source batch.
- `preflight.json`: 85 original source files rehashed; exact catalog identity,
  source reconstruction gates, alpha, dimensions, and part hashes verified.
- `publication-receipt.json`: 325 content-addressed hosted assets; every URL
  passed HTTP, content type/length, CORS, cache, and delivered SHA256 checks.
- `publication-payload.json` records the actual plate and kit rows written.
- `served-verification.json`: all 47 exact SKU lookups return the new kit parts
  and the matching cap-on/off plate URLs with no kit conflicts.
- `productPlates-before.json` / `productKits-before.json` are full scoped
  before-images. No source/master files were edited.

The publisher installs each new kit before its matching plate. The storefront's
existing plate-hash guard keeps mismatched kits hidden during the transition.
Before each change, the publisher rechecks the previous plate and kit, refusing
concurrent changes. New assets never overwrite previous bytes.

## Actual shared-site checks

Checked the shared staging hostname, without local review flags:

- Clear Circle 50 mL tassel, Gold versus Ivory Silver: identical glass image
  and SVG viewport; no opaque white rectangle. Each shows its correct finish.
- Frosted Circle 50 mL Copper perfume spray: exposed sprayer, dip tube and
  copper sidecar present in Builder and the normal PDP. PDP resolves
  `GBCrclFrst50SpryCu` / `GB-CIR-FRS-50ML-SPR-CPR` and loads the published plate.
- Clear Cylinder 9 mL Black treatment pump: correct actuator/collar, thin dip
  tube, clear sidecar, and properly seated cap-on state.
- Cylinder chooser contains the six intended body options. Removed 3.3 mL,
  4 mL and 16mm 28/50 mL options remain outside Builder.
- Cylinder 9 mL exposes spray, lotion pump, metal roller, plastic roller choices.
- Cylinder 25 mL exposes dropper, spray, lotion pump, reducer, bulb and tassel
  choices; it is no longer restricted to lotion pumps.

PR #230 was merged as `9b138227508df8121649687b59df6a765f6d1880`.
After publication, the shared hostname resolved to Ready production deployment
`dpl_7bRBzGA2yQxCq8RT7ZiWezrXbYHi`,
`best-bottles-website-lrbhwh7dx-asala.vercel.app`.
The host is the user-designated staging site; Vercel calls its deployment
channel production. No separate live-domain cutover was performed.

Checks are sampled visual proof plus exhaustive exact-SKU asset delivery proof.
They are not a claim that all 925 catalog configurations have been visually
approved, that mobile/cart flows were exhaustively tested, or that every PDP
fitment shares a single body scale. Native flat plates retain source registration;
PDP cross-fitment framing still needs its own clearance.

## Rollback

With the correct staging write credential in the environment, from the repository:

```sh
node scripts/paperdoll/publish-native-recovery.mjs \
  --release docs/reviews/component-release-2026-09-22 \
  --target https://precise-raccoon-123.convex.cloud --rollback
```

Rollback refuses changed plate URLs or an active kit from a later release. It restores the original
plate and prior kit where one existed. Newly inserted kit records remain inactive
behind the plate-hash guard; no destructive index deletion or blob deletion occurs.
Keep the receipt and before-images together. Applying this completed release
again deliberately fails the unchanged-before-image gate; it is not a resume tool.

## Held and next work

Nine frosted Circle 50 mL tassel assemblies remain held for exact component
compatibility. Their recovered artwork is preserved. The 45 disputed stock
changes remain unapplied. Round/Empire media were not part of this 47-pair write.

The follow-up four-family ledger covers 925 current catalog rows and records
missing/partial artwork, exact component resolution, and all replayed Builder
states. Structural and framing results do not substitute for source/visual fit
review. See [the complete accounting](../four-family-component-accounting-2026-09-22/README.md).

Validation: publication gate tests, Builder readiness/registration and resolver
parity tests passed (27 tests); TypeScript passed. Previous merged implementation
passed its full CI and production build. No new web runtime was changed by the
media publisher itself.

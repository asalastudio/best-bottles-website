# Codex handoff — finish the plates, the kits and the hero images

Written 2026-09-12 at the end of the Claude session that built the asset ledger.
Everything below is the state as of that session. Re-run the ledger before trusting
any number in this file; the ledger is the truth, this file is the map.

## The job

Three asset kinds, one ledger, one definition of done:

1. **Plates** — one finished photograph per bottle SKU, cap on and cap off, on Vercel
   Blob, indexed in Convex `productPlates`. Done when the ledger reads
   `plated` or `plated-no-capoff-by-design` for every bottle SKU.
2. **Kits** — the photographic component parts behind each plate, in Convex
   `productKits`. Done when the ledger reads `live` for every kit-applicable SKU.
3. **Heroes** — one catalogue hero per product group in the registry
   `src/lib/products/catalog-heroes.json`. Done when every group with a product
   record has an approved, locked, indexed Sunburst hero and the guard test passes.

The ledger page shows all three per family with a "What's left" column. A family is
green only when all three are complete and nothing is flagged or stale.

## Standing constraints (from Jordan, still in force, not negotiable)

- Preserve existing dirty changes in the repository. `.claude/launch.json` is a
  pre-existing dirty change: never commit it.
- Do not merge old branches. Do not overwrite original images. Do not publish media
  without Jordan's explicit "ship" for that release.
- Visual approval is not technical approval. Visual approval, sizing approval,
  technical clearance, indexing and live publication are five separate states. Never
  collapse two of them.
- The only PSD source is `/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master`.
  Never `BBUAT-Upload-Files`, never `paper-doll/reference-images`. The tooling
  refuses other lineages; do not disable the guard.
- Never fabricate an exposed component from an ambiguous PSD. Never infer product
  identity from a filename or a SKU string. Identity comes from Convex
  (`groupSlug`, `graceSku`, `shopifyVariantId`) or Shopify, nowhere else.
- Code never touches shadows.
- Every claimed visual change needs a same-zoom before/after image and a metric in
  Jordan's hands before you say it is done.
- Approvals bind to exact image bytes (sha256). A re-render is a new image and goes
  back on a review card. It does not inherit the old approval.
- The frosted hero prompt is locked: `scripts/sunburst-heroes/prompts/frosted.txt`,
  two lines, unchanged, one input image, no clear-glass reference. Read the README
  beside it before touching any hero prompt.
- Keep prompts simple. Jordan: "we are going to keep it a super simple prompt."

## Where the truth lives

| thing | where |
|---|---|
| Asset ledger (data) | `src/lib/asset-ledger/ledger.json`, rebuilt by `npm run ledger:build` |
| Plate correctness measurements | `src/lib/asset-ledger/plate-geometry.json`, rebuilt by `python3 scripts/asset-ledger/measure-plates.py` (run this first, then the ledger) |
| Ledger page | `/team/asset-ledger` (Clerk-gated on staging; locally append `?preview=1`) |
| Ledger builder + state definitions | `scripts/asset-ledger/build.mjs` (TWO_PIECE, NO_PLATE_CATEGORY, DONE_PLATE at the top) |
| Hero registry | `src/lib/products/catalog-heroes.json` (391 rows keyed `websiteSku`) |
| Hero release manifest | `docs/reviews/catalog-complete-hero-release-2026-09-07.json` (moves with the registry) |
| Hero guard test | `tests/catalog-approved-heroes.test.ts` (hashes every registry image; checks release-locked rows against their lock) |
| Hero release locks | `docs/reviews/sunburst-heroes-release-{1..4}/approved-lock.json` (sku → sha256, card, approvedAt) |
| All 90 locked heroes incl. 8 with no registry row | `docs/reviews/sunburst-heroes-release-4/approved-lock-all-90.json` |
| Hero indexing script | `node scripts/publish-sunburst-heroes.mjs release-N` (indexing only; touches no Shopify, Convex or hosted media) |
| Review library (cards, decisions, image bytes) | `/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff/hero-reviews/<card>/{data.json,feedback.json,assets/<sha>.png}` |
| Review server | `npm run review:heroes` (tool in `tools/hero-review/`, port 3028 via `.claude/launch.json` entry `hero-review`); URL `localhost:3028/review/?collection=<card>&view=all` |
| Plate pipeline | `scripts/paperdoll/` — read `scripts/paperdoll/README.md` and `.claude/skills/bestbottles-plate-kit-lane/SKILL.md` first |
| Plate builder | `scripts/paperdoll/build_plates.py` (`plan_groups` at ~line 192, family-fit scale at ~line 444) |
| Family batch runner (isolated, master-only, no publishing) | `python3 scripts/paperdoll/family_batch.py --family <F> --catalog <json> --out dist/paper-doll/<x> --stage prepare|plates|audit-kits` |
| Plate publish | `node scripts/paperdoll/publish.mjs --dist dist/paper-doll/manifest.json [--family <id>]` then `--apply`; verify with `node scripts/paperdoll/verify.mjs` |
| Kit publish | `node scripts/paperdoll/publish-kits.mjs [--family <id>]` then `--apply` |
| Cap-state fix evidence | `docs/reviews/paperdoll-cap-state-2026-09-12/` (PR #132, merged) |
| Hero lane scripts (batch render, gate, size, shadow audit, base builder for groups with no hero) | **Not on main.** On the open PR #122 branch `claude/best-bottles-review-work-741634`: `scripts/sunburst-heroes/heroes/*.py`, `scripts/sunburst-heroes/missing/build_bases_v2.py`, `build_bases_matte.py`, `scripts/sunburst-heroes/sunburst.py` (the raw API helper), plus `docs/reviews/sunburst-heroes/` (targets, sizing manifests, proofs). PR #122 is mergeable and clean; whether to merge it is Jordan's call. Until then read the files with `git show origin/claude/best-bottles-review-work-741634:<path>`. |
| Clear-glass hero prompt | Built inline in `scripts/sunburst-heroes/heroes/hero_batch.py` (~line 48–53 on the PR #122 branch): locked-geometry clause, a glass-quality reference as image 2, the locked shadow clause. Its frosted branch is superseded by `prompts/frosted.txt`; the "white patches are artefacts" clause is for CLEAR glass only and strips frost. Non-bottle rows take a per-job `material_clause` (closures: "closure only, no bottle"; white/frosted plastic jars: "opaque plastic, not clear glass"; atomizer sleeves: "opaque metal sleeve"). |
| Preserved raw renders, built bases, locked images, card files (1.5 GB) | `/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff/sunburst-preserve-2026-09-10/{raw,bases,locked,cards-public}` |
| Earlier handoff notes in the same directory | `plates-kits-heroes-handoff/HANDOFF.md` and `AGENT-PROMPTS.md` (older; where they disagree with this file or the ledger, this file wins) |
| Convex | dev = `helpful-elephant-638`; prod is read-only from tooling unless the prod write token is set. `NEXT_PUBLIC_CONVEX_URL` alone decides which deployment a script touches. |

Environment variable names (values in `.env.local`, never paste them anywhere):
`NEXT_PUBLIC_CONVEX_URL`, `BLOB_READ_WRITE_TOKEN`, `BEST_BOTTLES_CONVEX_WRITE_TOKEN`,
`OPENAI_API_KEY`, `SHOPIFY_ADMIN_TOKEN`. Run `set -a; source .env.local; set +a` before
the paper-doll scripts. `npm run ledger:build` loads `.env.local` itself.

**Important about the locks:** the `file` field in each `approved-lock.json` points into
a scratch directory that no longer exists. The durable bytes are in the review
library under `<card>/assets/<sha256>.png`. Resolve by sha, never by that path.

## State at handoff (ledger built 2026-09-12 18:59 UTC, PR #134)

Heroes (per product group; 377 groups, 370 have a hero):

| state | rows |
|---|---|
| indexed | 391 registry rows; 82 of them Sunburst 2.5 heroes live across releases 1–4 |
| locked, awaiting a registry row (no group row exists yet) | 8: GBBell10RollBlkDot, GBBstn1ozRollonShBlk, GBBstn2ozMtlRollGl, GBBstnAmb1ozRollonMattGl, GBBstnAmb2ozRollonMattGl, GBBstnBlu1ozRollonMattBlk, GBBstnBlu2ozRollonMattGl, GBCrcl15RollBlkSh |
| approved on cards, not yet locked or indexed | see the ledger `approved-not-locked` / `approved-not-indexed` rows |
| need re-render (defects) | GBCylAmb9RollBlkDot (streaks), GBCylBlu5RollBlkDot (white streaks), GBRoyal13RollSlDot (cap overflow), GBMtlMrblLarge and GBMtlMrblSmall (pipette sits below the foot; translation cannot fix it) |
| awaiting Jordan's clicks | `r15-rollon-matched-2026-09-12` (16 rows; every height matched to a live same-group sibling). Cards r12, r13, r14 are superseded by r15 — do not act on them. |

Plates (per bottle SKU; 2,427 bottles are plate-applicable):

| state | plates | meaning |
|---|---|---|
| plated | 946 | served, right size, from the PSD master, has cap-off |
| plated-no-capoff-by-design | 173 | two-piece product (bulb sprayer, tassel, atomizer, reducer, dropper); no cap-off owed |
| plated-legacy-source | 453 | built from the old website's GIFs, not the PSD master |
| plated-wrong-size | 174 | glass body width more than 5% off its bottle's median |
| plated-cap-on-only | 130 | real cap-off gap (Cylinder 86) |
| none | 551 | bottle with no plate (Diva 108, Slim 102, Sleek 79, Elegant 66) |
| not-applicable | 109 | components, packaging, gift bags |

Kits (per SKU): live 420, held 880, no-plate 687, candidate 358,
approved-not-published 70, changes_requested 38, not-applicable 118.
Of the 880 held, 499 were held by the blob-count misread fixed in PR #132; the fix is
merged but the family batches have not been re-run, so the ledger still shows them held.

## Root causes already found (do not re-investigate; fix)

1. **Render groups keyed by SKU text.** `plan_groups` in `build_plates.py` keys each
   group by `(familyId, parse_sku(sku)["body"])`. SKU strings are spelled
   inconsistently, so one bottle splits into several groups, each fitted to the
   canvas on its own. A short cap alone in a group of one fills the frame; the same
   glass with droppers shrinks. Boston 15 ml amber cap measures 362 px wide against
   285 for its droppers. 28 families split this way, 350 SKUs, ~15 plates change.
   **Fix:** key by `familyId` alone (it already is family+capacity+colour+neck).
   One line, then re-render those families.
2. **Legacy GIF sources.** 550 plates were built from `bestbottles.com/images/store/enlarged_pics/*.gif`
   because the blob-count heuristic labelled the master PSD "cap off" and the builder
   refused it as a front. PR #132 fixed the label. Re-running `family_batch.py --stage prepare`
   then `--stage plates` for those families rebuilds them from the PSD. This also
   unblocks the 499 held kits and gives 162 unplated SKUs a source.
3. **Two-piece products owe no cap-off.** Already encoded in the ledger (TWO_PIECE).
   Do not build a cap-off view for them.
4. **Atomizer proof:** after #132, 23/23 pass preflight; 14 plates publishable, 9
   `registration_unmatched` (10 ml clear 5/6, 5 ml clear 3/5). Those 9 overlap
   Jordan's "clear glass should be aluminium" hero rejections; investigate before
   publishing.

## Order of work

Do them in this order. After each step run the two ledger commands and confirm the
counts moved the way the step predicts. If they did not, stop and find out why before
the next step.

```bash
python3 scripts/asset-ledger/measure-plates.py && npm run ledger:build
```

### Step 1 — grouping fix (plates)

1. Change `plan_groups` to key registered groups by `familyId` only.
2. `family_batch.py --stage plates` for the 28 split families (list them with the
   snippet below). Compare each re-rendered plate to the served one at the same zoom.
3. Expected ledger result: `plated-wrong-size` drops by ~15 on those bottles and by
   0 elsewhere. Anything still wrong-size in those families is cause 2 (legacy).
4. Dry-run publish, show Jordan the before/after, publish only on his "ship".

```bash
python3 - <<'EOF'
import sys,json,collections; sys.path.insert(0,"scripts/paperdoll")
from build_tokens import parse_sku
x=json.load(open("data/paper-doll/xref.json"))
fam=collections.defaultdict(set)
for r in x["products"]:
    if r.get("publishable") and (r.get("renderMode") or "registered")!="standalone":
        fam[r["familyId"]].add(parse_sku(r["websiteSku"])["body"] or r["websiteSku"])
print("\n".join(sorted(f for f,g in fam.items() if len(g)>1)))
EOF
```

### Step 2 — rebuild the legacy-sourced plates from the PSD master (plates + kits)

1. For every family with `plated-legacy-source` rows: `--stage prepare`, then
   `--stage plates`, then `--stage audit-kits`, in an isolated `dist/paper-doll/<family>-master`.
2. Expected: `plated-legacy-source` → 0 for that family; `none` shrinks where the PSD
   now supplies a source; held kits with `source_preflight:no approved capped/front source`
   clear.
3. Publish plates first, then kits (`publish-kits.mjs` refuses a kit whose plate is
   not indexed). Verify with `verify.mjs --strict`.
4. Three kits that were live before #132 must be re-verified; the dry-run diff in
   `docs/reviews/paperdoll-cap-state-2026-09-12/dry-run-diff.json` names them.

### Step 3 — real cap-off gaps (130 plates, Cylinder 86)

Check the PSD master for an uncapped layer or a paired uncapped PSD before deciding a
cap-off is missing. Never invent one. If the master has no uncapped view, record the
SKU as needing photography and leave the plate `plated-cap-on-only`.

### Step 4 — bottles with no plate (551)

Diva 108, Slim 102, Sleek 79, Elegant 66, Round 45, Boston 33, Empire 30. For each,
the cross-reference (`xref.py`) says whether a PSD exists. Where one exists, it is a
render. Where none exists, it is a photography gap: list it, do not fabricate.

### Step 5 — kits to completion

After steps 2 and 4: `kit_audit.py` per family, review cards for the 358 candidates,
publish the 70 approved-not-published, resolve the 38 changes_requested against their
feedback notes. Kits only for SKUs whose plate is indexed.

### Step 6 — heroes to completion

1. **Registry rows for the 8 locked heroes with no row.** Identity must come from
   Convex `productGroups`/`products` (groupSlug, graceSku, shopifyVariantId). If the
   group does not exist in Convex, the hero waits; do not create a row from the SKU string.
2. **Re-render the 5 defective heroes** (list above) with Sunburst 2.5, enhancement
   only, then fit to the approved silhouette height, settle foot to y=1562 and centre
   to x=780 on the 1560×1716 bone canvas (bone = 245,243,239). New review card, new
   bytes, Jordan's clicks, then lock and index.
3. **Lock and index everything approved but not locked/indexed** (the ledger lists
   them). Lock → `approved-lock.json` for a new release directory → `publish-sunburst-heroes.mjs release-N`
   → `npm test -- tests/catalog-approved-heroes.test.ts` must pass.
4. **r15** waits for Jordan's clicks. Do not reuse r12–r14 decisions.
5. Groups with no hero at all (34 groups, 247 SKUs, mostly plastic roller-ball
   colourways): build a deterministic base from the PSD master with
   `scripts/sunburst-heroes/missing/build_bases_v2.py` (or `build_bases_matte.py`
   when the PSD layers are not isolated), roller fitted, cap standing loose beside
   the bottle on the same baseline, group centred at x=780, scaled to a sized
   same-body sibling. Never drop a loose cap layer, never let the model invent one.
   Check the base sheet by eye before spending render money. Then the same Sunburst
   → gate → size → review-card path. The 29 bases already built are in the
   preserve directory under `bases/`.

Sunburst render call (the helper is `scripts/sunburst-heroes/sunburst.py` on the PR #122
branch; the one-off Node harness from the last session lived in a wiped scratch
directory, so use the Python helper or rebuild):
`images.edit`, model `gpt-image-2.5-sunburst`, one input image (plus the glass
reference as image 2 for CLEAR glass only), size `2080x2288`, quality `high`, about
35 s and $0.11 per image, downscaled to 1560×1716 afterwards. Frosted uses
`prompts/frosted.txt` verbatim with no second image. Clear glass uses the prompt
`hero_batch.py` builds. Write the usage/cost JSON beside every render.

## Definition of done, per family

- Ledger row for the family: `complete: true`, blockers empty.
- Plates: every bottle SKU `plated` or `plated-no-capoff-by-design`; `verify.mjs --strict` exits 0.
- Kits: every kit-applicable SKU `live`; `productKits.integrity` reports 0 issues.
- Heroes: every group indexed; guard test green; release README written in
  `docs/reviews/sunburst-heroes-release-N/` with the lock and the card names.
- Jordan has seen the before/after for every visual change and said "ship" for each
  publish. His visual approval on a card is not that "ship".

## Things that went wrong before, so you do not repeat them

- Judging roll-on heights without a reference bounced across three cards. Always match
  a new hero's height to a live same-group sibling; never eyeball.
- Click-to-place on the review UI silently saves a target height. Treat unexpected
  `targetHeight` entries as accidental and ask; do not resize on them.
- Scratch directories are wiped between sessions. Anything you need next session goes
  in the repo or the review library.
- Longer, more careful frosted prompts made the frost worse every time. Two lines won.
- The plate audit's early metrics (raw height, source ratio, family parse) were all
  wrong before settling on finished-plate glass body width per bottle. Use the
  measurement script, not a new ruler.
- "Held kits = photography gap" was wrong. The PSDs were on disk. Check the source
  before concluding anything is missing.

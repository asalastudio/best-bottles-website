---
name: bestbottles-bottle-scale
description: Best Bottles bottle measurements and hero sizing, end to end. The source-of-truth glass heights (production Convex, grouped into glass bodies), the review sheet prepared for Jordan's boss and reconciling his answers into proposed Convex corrections, the universal scale card (bare glass mm to % of the 10:11 product card, tags S20-S200), the locked Cylinder sizes and their 2026-09-16 amendment, and the photoreal Sunburst hero pipeline that applies them. Use for "bottle heights", "measurements", "source of truth", "how many bottles/bodies", "scale card", "tag this bottle", "how big should this bottle be on the card", "send for review", "reconcile corrections", "resize heroes", "next family's heroes", "sunburst render", "matte silver looks wrong", "caliper", "measure the bottle", "caliper log", "record measurements", "cap / sprayer / overcap dimensions".
---

# Best Bottles: bottle scale, measurements and hero sizing

Everything built on 2026-09-16 to make every product photo the right size, kept so it can be picked up without
searching. Read **Where things stand** first, then the workflow you need. The history and Jordan's exact decisions
are in `references/decisions.md`.

## Where things stand (2026-09-16)

| Item | State | Where |
|---|---|---|
| Measurements snapshot: 2,269 live SKUs → 108 glass bodies (97 if frosted/swirl twins count once), 27 families | Pulled from production Convex | `docs/reviews/bottle-measurements-2026-09-16/` |
| 19 glasses with measurement problems | Review copy prepared for Jordan's boss; Jordan emails it (confirm it went out before waiting on a reply) | `…/Best Bottles bottle heights - please check (sent 2026-09-16).xlsx` |
| Universal scale card v1 | **Proposal, not approved** | `…/scale-card/`, control points in `references/approved-sizes-2026-09-16.json` |
| Cylinder hero sizes | **Locked** 2026-09-07, **amended** 2026-09-16 (four bodies), both on main | `docs/reviews/cylinder-family-final-manifest-2026-09-07.json` + `docs/reviews/sunburst-heroes-release-5/lock-amendment-2026-09-16.json` |
| Boston Round 15/30/60 ml | **Locked** 2026-09-12, full-glass % | `data/asset-ledger/bottle-standards.json` |
| Cylinder photoreal heroes | 45 of 52 live on main (PR #179, merged 2026-09-16); 7 have no PSD | `scripts/hero-pipeline/` |
| **Caliper Log** (physical measurements, live; pinned in Jordan's sidebar) | Started 2026-09-26: 94 register bodies + 34 closure designs. Measured so far: Tall Cylinder 9 ml 13-415 (partial), 13-415 fine-mist sprayer + overcap (complete) | https://claude.ai/artifact/WBbAwDiM8WKx3u2dfGzvTh · `references/caliper-log.md` |

## Rules that are not re-derived

1. **A lock is a decision, not an estimate.** When a family has a final manifest or a bottle standard, hit its numbers.
   Never replace them with a fitted curve, a canvas-fill percentage or UX guidance. A size change is a dated
   amendment file that Jordan approved, next to the lock.
2. **One glass, one size.** Every SKU built on the same glass (any colour, cap or fitment) shows the same glass at the
   same height. Fitments ride on top at true proportion.
3. **Size the glass, never the assembly.** The Cylinder lock measures the glass shoulder; the scale card measures the
   bare glass foot to rim. Neither ever uses the top of a sprayer or cap.
4. **Measurement truth order:** caliper readings in the **Caliper Log** (workflow G) → the reviewer's physical check → exact-SKU legacy site evidence (see
   `bestbottles-plate-kit-lane`) → production Convex (`measurementSource = best-bottles-master-truth@2026-07-12`)
   → dev Convex, which is stale. Always snapshot production.
5. **Nothing is written to Convex** until Jordan approves a `proposed-corrections.csv`.
6. **Sunburst renders are fixed by re-rendering, never by lifting pixels.** A brightness gain on rendered matte silver
   made reducer caps look like decals ("like it's going to rub off"). Name the finish in the prompt instead. Model:
   `gpt-image-2.5-sunburst` only.
7. **Every size or colour change ships with proof:** before and after at one zoom, with the number.

## Workflows

All commands run from the repo root. `SNAP` is a snapshot folder, e.g. `docs/reviews/bottle-measurements-2026-09-16`;
scripts default to the newest one.

**A. Refresh the measurements from production**
```bash
node .claude/skills/bestbottles-bottle-scale/scripts/pull_prod_measurements.mjs docs/reviews/bottle-measurements-$(date +%F)
python3 .claude/skills/bestbottles-bottle-scale/scripts/bottle_bodies.py docs/reviews/bottle-measurements-$(date +%F)
```
Start a new dated folder. Never overwrite a snapshot a review file was built from: body numbers are positional.

**B. The measurements workbook (one row per glass + every SKU + read-me)**
```bash
python3 .claude/skills/bestbottles-bottle-scale/scripts/build_measurements_workbook.py "$SNAP"
```

**C. A review copy for someone to check**
```bash
python3 .claude/skills/bestbottles-bottle-scale/scripts/build_review_copy.py "$SNAP"
```
Tabs: Start here, Issues to fix (red), All bottles, SKU detail. The reviewer types only in yellow cells. Keep the file
as handed over, renamed `… (sent YYYY-MM-DD).xlsx`, in the snapshot (the 2026-09-16 copy was named that when it was
prepared for emailing).

**D. Reconcile a returned review**
```bash
python3 .claude/skills/bestbottles-bottle-scale/scripts/reconcile_review.py "path/to/returned.xlsx" "$SNAP"
```
Writes `SNAP/reconcile-<time>/` with `proposed-corrections.csv` (SKU, field, current, proposed, reason, how checked),
`confirmed.csv`, `follow-up.csv` and `summary.md`. Show Jordan the summary and the proposals. After approval, write
the values to production, then run A again.

**E. The scale card and a one-product example**
```bash
python3 .claude/skills/bestbottles-bottle-scale/scripts/scale_card.py "$SNAP"
python3 .claude/skills/bestbottles-bottle-scale/scripts/card_example.py "$SNAP"
```
While the card is a proposal it changes nothing on the site. If Jordan approves it, commit the curve and tags as the
repo standard, then resize families to it. That amends the Cylinder lock and the Boston standards (rule 1), so it
needs Jordan's explicit yes.

**F. Photoreal heroes for a family**: see `scripts/hero-pipeline/README.md`.

**G. Record and read caliper measurements (the Caliper Log)**
The Caliper Log is a claude.ai page with a shared database, pinned in Jordan's sidebar:
https://claude.ai/artifact/WBbAwDiM8WKx3u2dfGzvTh. One row per register body (`bodies`) and per closure design
(`parts`, every colour of a design shares its numbers). The team types readings there; Claude reads them with the
`ArtifactData` tool (`list` / `get` on `measurements/<bodyId>` and `partMeasurements/<partKey>`). Field codes, the
measuring method and the readings so far are in `references/caliper-log.md`.
- Readings Jordan gives in chat go into the log the same way (`ArtifactData` `set`, keep his raw numbers).
- "Circumference" in speech means the caliper's diameter reading.
- When readings disagree physically (for example an overcap whose inside is under the collar it slips over), keep the
  raw values and add a `model` object with the values the 3D model uses, plus a `modelNote` explaining the adjustment.
  Never overwrite a raw reading.
- The body and closure lists are seeded from the register (dev Convex) and only editors can change them. Re-seed after
  the register gains bodies or components. Document keys replace `/` with `~` (`cream-jar-40ml-48~400`).
- Blender builds read the log first. Drawings and site dimensions come second (rule 4).

## Traps already paid for

- **Grouping SKUs into glasses:** a `GBTall…`/`LBTall…` prefix is a tall glass (GBTallCyl9, GBTallRect10). A trailing
  `…Tall` (GBDiva30RdcrMtSlTall) is a tall reducer cap on the same glass. The `shape` field is mostly noise.
- **Suspicious heights:** short-cap listings (`…Sht`) often record a taller height, probably measured cap-on
  (cobalt 5 ml Cylinder 60 vs 53 mm, frosted 15 ml Elegant 70 vs 61 mm). GBSpry1ozGl (30 ml tube) shows 50.8 × 42 mm,
  which is wrong.
- **Convex access:** the Convex MCP only reads dev data; production is read through the site's public queries (script A).
- **Excel:** LibreOffice is not installed, so formulas cannot be pre-calculated. Set `fullCalcOnLoad`, keep formulas to
  Excel-2007 functions, and check every formula's result in Python before sending.
- **Scale card measure:** Cylinder is locked by shoulder %, Boston by full-glass %. Convert with each body's
  rim/shoulder ratio (in the reference file) before comparing families.
- **Jordan's files:** Jordan moves delivered files into `~/Desktop/Best Bottles/…` and opens workbooks in Excel.
  Read from there if needed, never write there, and don't regenerate a workbook he has open.
- **Worktrees:** a session may not write into another worktree. To put new files on a separate branch, write them in
  your own worktree and commit with a temporary index (`GIT_INDEX_FILE`, `update-index`, `write-tree`, `commit-tree`).

## Files

```
SKILL.md
references/decisions.md                     what was decided, when, and Jordan's words
references/approved-sizes-2026-09-16.json   locks, amendment, Boston standards, rim/shoulder ratios, scale card control points
references/caliper-log.md                   G: the Caliper Log (link, data layout, field codes, method, readings so far)
scripts/pull_prod_measurements.mjs          A
scripts/bottle_bodies.py                    A (grouping; imported by B-E)
scripts/build_measurements_workbook.py      B
scripts/build_review_copy.py                C
scripts/reconcile_review.py                 D
scripts/scale_card.py, card_example.py      E
scripts/hero-pipeline/                      F
```

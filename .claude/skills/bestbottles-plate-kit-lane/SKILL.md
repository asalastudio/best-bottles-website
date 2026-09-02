---
name: bestbottles-plate-kit-lane
description: Take Photoshop sources through to the guided product page — inventory, dedupe, cross-reference against Convex, render plates, cut component kits, publish to Vercel Blob and index in Convex. Use when asked to add a family to the PDP, publish plates or kits, rebuild the paper-doll index, run the data audit, or diagnose a missing/wrong plate. NOT for Shopify PDP photography, which is bestbottles-paperdoll-compositor.
---

# Best Bottles — plate & kit lane

Photographs reach the guided product page as **plates** (one finished image per
SKU) and **kits** (the same image kept in layers, so a cap can change without
the bottle moving). The bytes live on Vercel Blob; Convex holds an index whose
row existence *is* its readiness — no draft, no release, no ready flag. Sanity
holds nothing: its release model is what blanked the 9 mL, and this lane
replaced it.

**Not this skill:** Shopify/PDP catalogue photography onto the studio canvas →
`bestbottles-paperdoll-compositor`. Different scripts, different destination.

## What is built, and what is not

| stage | state |
|---|---|
| plates, any family | **proven** — 1,964 SKUs, 129 families, 0 refused groups |
| kits from *layered* sources (9 mL) | **proven** — 145 kits, 26 parts, published |
| kits from *flattened* PSDs | **NOT BUILT.** `kit_audit.py` sizes it: ~858 full, ~832 capSplit |

Do not tell anyone a flattened family can be kitted today. The audit measured
the opportunity; the extractor does not exist.

## Run order

Every stage writes evidence next to its output. Nothing later may contradict
something earlier without saying so.

```bash
set -a; source .env.local; set +a          # every script picks its deployment from NEXT_PUBLIC_CONVEX_URL

python3 scripts/paperdoll/inventory.py                     # 12,754 files, 0 unclassified
python3 scripts/paperdoll/dedupe.py                        # one source per (stem, cap state)
npx tsx scripts/paperdoll/export-convex-products.ts        # catalogue snapshot
python3 scripts/paperdoll/xref.py                          # match kinds + publishable
python3 scripts/paperdoll/build_tokens.py                  # the SKU vocabulary
python3 scripts/paperdoll/emit_tokens_ts.py                # the PDP's finish table
python3 scripts/paperdoll/build_plates.py --family <id>    # render
node    scripts/paperdoll/publish.mjs --dist dist/paper-doll/manifest.json --apply
node    scripts/paperdoll/verify.mjs                       # exits non-zero on any index failure
```

Kits, for a layered family:

```bash
python3 scripts/paperdoll/build_cyl9_kits.py
node    scripts/paperdoll/publish-kits.mjs --apply
```

Full command reference, flags and gotchas: `scripts/paperdoll/README.md`.

## The rules that are not negotiable

**Identity comes from the catalogue, never from a folder.**
`familyId` = `<family>-<capacityMl>ml-<color>-<neck>` from the product group's
fields. `skuKey` = the website SKU exactly as Convex spells it. Grace SKUs are
*looked up* from the product document — never derived, never taken from a CSV.
A publisher that stamped them from a spreadsheet shipped stale codes and the
integrity sweep caught it.

**Neck is mandatory in `familyId`.** Drop it and physically incompatible
families merge. 40 family/capacity/colour combinations legitimately span
several necks.

**Keys are content-addressed** — the filename starts with the sha256 of the
bytes. A re-render is a new key; nothing is ever overwritten or deleted.
Publishing never deletes; `prune.mjs` is the only delete path and is dry-run by
default.

**A row is written only after its public URL answers** 200, `image/webp`, the
right length, `access-control-allow-origin: *`, one-year cache.

**A SKU no product document carries is uploaded but never indexed.** An orphan
row is one the page can never reach.

**Near-misses never publish.** `alias-map.json` is the only match-time rewrite;
candidates sit in `alias-candidates.json` until a human promotes them.

**`tokens.json` needs `reviewedAt`** before `publish.mjs --dist` will run.

## Gates that have each caught something real

| gate | threshold | what it caught |
|---|---|---|
| registration residual | ≤ 12/255 within a session | families that are two shoots, not one |
| closure axis | ≤ 2 px from centre | plates that drifted between colourways |
| kit composite parity | mean ≤ 6/255 over ink | parts that don't rebuild their plate |
| kit alpha | ≥ 5 % transparent, no ink on its own edge | a hard crop passed off as a cut-out |
| kit → plate | a kit needs a published plate | a stage with nothing to fall back to |

## Two things that will bite you

**A family is often photographed more than once.** Circle frosted 100 ml
carries bodies 494 px and 1,062 px wide. `build_plates.py` clusters shots into
sessions **by measured body width, not by residual** — a frosted wall is nearly
featureless, so a base template matches a differently scaled photograph at a
*low* residual and both scales land in one "session". Grouped by width the
rendered plates agree to 0.4 %; grouped by residual they ranged 276–596 px.

**The 9 mL is not regenerated by `build_family_plates.py`.** That script covers
Diva ×2 and Cylinder 50 only. The 9 mL comes from `build_cyl9_plates.py`.
Forgetting this ships a publish missing 145 configurations — caught once by a
dry run showing 3 families where there should be 4.

## Deployments

`NEXT_PUBLIC_CONVEX_URL` alone decides the target. Production is
`precise-raccoon-123`; the prod write token comes from
`npx convex env get BEST_BOTTLES_CONVEX_WRITE_TOKEN --prod`.

**The dev deployment is shared with other worktrees.** Each `convex dev` push
replaces the whole function set, so plate functions vanish when another branch
deploys. Data always survives; restore with `npx convex dev --once` from this
worktree. Production is the trustworthy environment until the lane is on `main`.

## Verifying in the browser

The in-app browser blanks on the PDP — use Playwright. Check the stage `<img>`
resolves to the Blob host, the overcap toggle swaps to a `front-off` URL, and
for a kitted family that a cap change fetches **only** the cap: body and
fitment keep their URLs, so the network panel should show one request each for
them and one per cap colourway.

## When something looks wrong

1. `node scripts/paperdoll/verify.mjs` — index issues fail, catalogue issues are
   listed; `--strict` fails on those too.
2. `python3 scripts/paperdoll/audit.py` → `docs/data-audit/…-audit.md`.
3. Duplicate SKUs are **dev drift**: production carries 2, dev 153. Do not send
   these to the catalogue owner without checking prod first.

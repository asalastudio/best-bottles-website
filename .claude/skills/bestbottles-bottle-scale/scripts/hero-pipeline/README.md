# Photoreal hero pipeline (as used for the Cylinder release, PR #179)

Turns PSD masters into photoreal 1560 × 1716 heroes on bone (#F5F3EF) with a real contact shadow, sized by the family's
lock. Preserved as run on 2026-09-16. Paths come from `hero_paths.py`:

```bash
export BB_HERO_WORK=~/BestBottles/hero-work          # bases, renders, sized files, proofs
export BB_PSD_LIBRARY=~/Projects/Clients/Nemat-International/BB-PSD-Files-Master
set -a; source .env.local; set +a                    # OPENAI_API_KEY for sunburst.py (never print it)
```

## Steps

| # | Script | What it does | Gate |
|---|---|---|---|
| 1 | `build_cylinder.py --no-shadow [SKU ...]` | PSD → geometry-only base: body = largest layer standing on the floor; fitted parts centred over it or chained by touching boxes (bulb, hose, tassel); a cap standing on the baseline stays beside; flat-white retouch patches dropped, never from the body. Records shoulder/rim/foot from the body-layer alpha. Needs `$BB_HERO_WORK/cylinder-barrel.json` (sku, heightMm, capacity, fitment); build that for a new family from the measurements snapshot. | Bases rebuild byte-identical |
| 2 | `enhance.py [SKU ...]` | `gpt-image-2.5-sunburst` edit at 2080 × 2288 `high` (about $0.12 per image), downsampled. Prompt from `prompt_for.py`: LOCK (input is a flat cut-out; keep silhouette, proportions, position and scale) + GLASS (clear / frosted / swirl / amber / cobalt) + FITMENT + HARDWARE (finish from the SKU) + COLOUR + SHADOW. | Envelope gate: top ≤ 1.5 %, foot ≤ 0.8 %, sides ≤ 2 %, centre ≤ 0.8 % at 70 levels. Clear glass, clear caps and tassels trip it; re-check at 40 levels and by eye (`finish_batch.py`). |
| 2b | `candidates.py SKU N` | N renders of one SKU in parallel; pick by eye. | |
| 3 | `flatfield.py`, `ship.py` | Paper flattened to bone (quadratic surface fit), corners anchored, grain cleaned, 48 px edge feather. | Corners within 2/255 |
| 4 | `colorlock.py` | Measures the fitment colour against the PSD above the glass shoulder. **Measure only: do not apply its gain to metal** (rejected). Fix colour by prompt and re-render. | Report drift |
| 5 | `restore_lock.py` | Scales each render about its foot so the glass shoulder lands on the locked line (lock + amendment). The shoulder position comes from the lock's own coordinates as a fraction of standing height. | No envelope or corner failures |
| 6 | `legacy_slim.py` | Same line for SKUs with no PSD (legacy photographs). | |
| 7 | `swap_into_registry.py` | Copies files to `public/images/catalog/bone-review/<sku>.<sha12>.png`; updates `src/lib/products/catalog-heroes.json` and the release manifest together (identity framing); writes the release `approved-lock.json`. Then re-pin the URL in `tests/catalog-approved-heroes.test.ts`, prune superseded files, run `npx tsc --noEmit` and `npx vitest run`. | Hero registry test green |
| 8 | `lock_proof.py`, `scale_check.py`, `catalogue_sheet.py` | Proof sheets: locked line on every render; bottle-to-bottle scale; the family at catalogue scale. | Jordan sees them before merge |

## Lessons

- Two-line "enhance" prompts only sharpen the Photoshop look ("These look terrible"). The model needs the flat cut-out
  framing plus the photoreal ask.
- Matte silver renders dark and gold pale without the COLOUR and HARDWARE clauses. Pixel gains on metal read as decals.
- `17. Additional Bottles/*.psd` vials carry a reflection under the glass in the body layer; use the `<sku>..psd`
  merged composite. The 25 ml Cylinder SKUs alias the 30 ml masters.
- Clear-glass body layers that are mostly white get mistaken for retouch patches, and the dip tube becomes the
  "body". The lock's shoulder coordinates avoid reading clear glass at all.
- `build_cylinder.py`'s `fit()` only sets a working scale for the base; the shipped size is always set in step 5.

# Step 1: one frame per glass, no plate-era limits on library drawings

Approved by Jordan on 2026-09-27, as step 1 of the size-consistency audit's fix plan.

## What changed on the product page

- **One frame per glass.** A component-library (register) SKU is now framed to its glass's envelope: the bounds that every SKU of the same register body needs, across all its colours and closure pages. Before, each SKU was framed to its own parts, so a tall overcap or a cap parked beside the glass shrank that SKU's glass. The envelope is read from the catalogue and the register (`src/lib/register/stage-envelopes.ts`) and cached for an hour per family and capacity. The page also merges in its own kits, so a SKU added after the cache was filled is never cut off.
- **Bulb sprayers get the size and baseline agreed on 2026-09-13.** Vintage bulb sprayers, with and without a tassel, sell on their own pages, and their hose and tassel reach far beside and below the glass. Each type is framed with its own kind, then held to the plate lane's ruling (`scripts/paperdoll/build_plates.py`). The bottle keeps the size of the glass's other pages unless the composition needs less to stay uncropped. Its foot stands on their baseline, raised only as far as the stage needs. Plain bulb sprayers now match their glass's other pages (234 of 257 SKUs, up from 136). Tassel pages keep the smallest size that stays whole, set down toward the baseline. Framing every page around the tassel instead would have shrunk the Round 78 mL's other 46 SKUs by 44%.
- **No capacity limits on library drawings.** The scales in `data/asset-ledger/pdp-capacity-standards.json` were written for flat plates. A register kit is already sized by its body's px/mm datum, so they now apply only to plates and legacy per-SKU kits. The dated note is in that file.
- **Dip tubes stop at the foot.** A behind-glass layer is painted clipped at the glass's foot, so the frame no longer reserves room for the hidden part below.
- **The clear overcap off the bottle.** The library's overcap for the 18-415 matte silver lotion pump with the clear overcap (`CMP-LPM-MSLV-18-415-02`, 26 SKUs on 20 glasses) was cut from the capped photograph, so the pump showed through it. Parked beside the bottle, it read as a second pump. Wherever the cover is off the bottle (SIDECAR, EXPLODED, and Build Your Bottle with the cover off), the empty cover is drawn instead, at the capped cover's width. It comes from the master library's cap-off photograph (`27. LBSlm30LtnClOvrCap.psd`, layer 19; the same cut-out is in every 18-415 cap-off PSD), cut by `scripts/register/cut_detached_overcap.py`, and served from `public/assets/register/overcaps/`. CAP ON and "Show cap" keep the capped look. The other 29 library overcaps were checked: the 17-415 clear covers are already cut empty, and the rest are opaque.

Build Your Bottle already framed each glass once; its only change is the empty clear cover.

## Files

- `summary.json`: before/after counts, per page, per glass, and per glass and frame key, from production data.
- `1-size-limits.webp`, `2-one-frame-per-glass.webp`, `3-bulb-sprayers.webp`, `4-clear-overcap.webp`: the same stage at the same zoom. "Before" is live production; "after" is this branch run against the same production data, read-only.

## How it was measured

The audit's `pdp-stage.ts` (PR #300) was run twice on the same production data. The before run reproduced the original audit exactly: 0 of 2,479 SKUs differed. Glass width comes from the drawn images, as in the audit. Once both PRs are merged, `pdp-stage.ts` will call `glassStageEnvelopes` so the audit mirrors this framing.

## Left for later steps

- Pages that mix library drawings with store photos or legacy per-SKU kits still change size in the swapper (79 pages). These are steps 3 and 4.
- Elegant 60 mL: the frosted photo body is drawn 5% narrower than the clear plate at the same height. Five clear tassel sprayers (`GBElg60AnSpTsl` Gl, MtSl, Red, Wht, IvySl) are labelled plain "Vintage Bulb Sprayer" and listed on the plain page, so the glass's plain bulb pages are framed for a tassel. That is a catalogue fix.
- Every glass taller than 76 mm is drawn 800 px tall by the register datum, so tall capacities differ less on screen than they physically do.
- Build Your Bottle, Boston Round 60 mL clear: the builder converts its frame to pixels through the clear reference kit's recorded glass width, which is 10% narrower than amber's and cobalt's, so clear draws 10% large. This goes with Boston's move to the register in step 4.

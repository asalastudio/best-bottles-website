# Component register — Phase 3: pilot plates and layers (17-415 Cylinder 9 mL)

**Status: cut, measured and self-checked locally (2026-09-25). Awaiting Jordan's review of the two
sheets.** Nothing is uploaded and no plate or layer is in Convex yet. On approval,
`push-phase3.ts --apply --approve` uploads to Vercel Blob and writes dev in one run.

## What was built

- `scripts/register/phase3/cut_pilot.py` reads the master PSDs read-only and writes native-resolution
  cut-outs to `output/register-phase3/pilot/` (gitignored). Every number goes to
  `data/register/phase3/pilot-measurements.json` (committed).
- `scripts/register/phase3/review_sheet.py` builds `review-plates.png` and `review-components.png`.
- `scripts/register/phase3/push-phase3.ts` is the loader. It dry-runs by default, writes dev only, and
  never approves a plate that fails the size gate.
- `convex/register.ts` gains `upsertBodyPlates` and `setComponentLayers`, deployed to dev and not yet called.

## How each number is measured

**Body plates.** One per glass, cut from the uncapped PSD's body layer (`3.  17-415 Bottles/<glass> (Uncapped)`):
- seat = the rim, the first solid row.
- shoulder = the highest row at 92% or more of the barrel width.
- foot = the last solid row.
- axis = the median barrel centre.

The scale comes from the barrel width at alpha 0.5. That width equals 19.3 mm, the diameter the
2026-09-23 kit-fit study fitted to these photos, which were shot from about 6° above. A cylinder's width
does not change with tilt, so the check runs the other way: the apparent height predicted at 6°
(72.2 cos 6° + 19.3 sin 6° = 73.8 mm) must hold within ±2%.

**Components.** The 19 pilot components come from the master component library
(`20. Caps/12–14. 17-415 …`). Each library PSD is registered against the same closure where it sits,
screwed down, on the matching CAPPED clear 9 mL bottle PSD. That gives:
- the layer's px/mm, as the bottle px/mm divided by the fitted scale;
- its anchor, the bottle's rim point mapped onto the layer;
- an overlap score (IoU) as the self-check.

The library sprayers and pumps have no overcap, so each overcap is cut from the capped bottle photo at
the bottle's own scale.

**Roller inserts.** These are cut from the capped clear bottle PSDs, the same source the kits used, and
anchored at the rim. Every 17-415 metal roller layer is about 92% flat white below the rim; that fill is
in the master PSD, so the metal insert is clipped at the rim. The plastic insert is clean and kept whole.
Both sit behind the glass, as they do in the master PSDs.

## Results

| | result |
|---|---|
| Plates within ±2% | Clear −1.0%, Frosted +0.2%, Swirl +0.6% |
| Plates flagged | Amber and Cobalt +2.6%. Both files carry the same slimmer photo, and the gate holds them at "measured" |
| Component registration | IoU 0.92–0.99, all 19 |
| Visual check | every part, drawn only from our anchors, sits rim-on-rim with the master capped photo |

## Source defects found

- **The shiny-silver sprayer's master photo is wrong.** The capped master photo for `GBCyl9SpryShSl`
  (`10. Clear (Capped)/24. GBCyl9SpryShSl.psd`) shows a gold collar. The library `Spry17-415ShnSl` is silver,
  and the register uses the library, so the new renderer draws it correctly.
- **The Amber and Cobalt uncapped photos** are about 6% slimmer than the clear photo relative to their
  height. They need either a re-shoot or Jordan's ruling to accept them at "measured".

## To approve

```bash
npx tsx scripts/register/phase3/push-phase3.ts --apply --approve
```

To hold back any item, add `--except <plateKey|componentId>,…`. The upload step needs
`BLOB_READ_WRITE_TOKEN`, which is not in `.env.local`. It lives in the Vercel project's environment.

# Circle kit scale is not dimensionally anchored

**Status: diagnosed, corrected values computed, not applied.** Applying them means
re-rendering the Circle plates, so this is written up to be folded into the next
planned plate rebuild rather than to trigger one on its own.

## The finding

Kit renders across the Circle family do not share a scale. Rendered body width per
millimetre spans **5.27 to 12.32**, a 2.3× range, and the ordering inverts: a 15 ml
bottle renders **wider** than a 100 ml one.

| capacity | colour | rendered body px | major axis mm | px/mm |
|---|---|---:|---:|---:|
| 15 | clear | 616 | 50 | **12.32** |
| 30 | clear | 594 | 60 | 9.90 |
| 50 | clear | 388 | 72 | **5.39** |
| 50 | frosted | 642 | 72 | 8.92 |
| 100 | clear | 543 | 89 | 6.10 |
| 100 | frosted | 469 | 89 | **5.27** |

Medians measured off the rendered kit images of 96 Circle rows across the current kit
queues. They match what the registration files predict, so the images and the metadata
agree — both are wrong together.

This is what Jordan saw when he wrote "looks good, but the image is small, compared to
the others, 100 ml" on the frosted 100 ml tassel rows. Those render at 5.27 px/mm
beside clear siblings at 6.10.

## Cause

Kit scale is `registration.scale × session.scaleFactor`, from
`_registration-<body>.json` per body family.

The session factors are fine. Each file normalises its own sessions to one reference
body width — `circle-100ml-frosted` maps 494 × 1.5385 and 1062 × 0.7156 and 760 × 1.0
all to 760.0, which is exactly right.

The defect is one level up: the family-level `scale` is set per file with nothing tying
it to the bottle's real size. Two files describing the same physical bottle in different
finishes end up at different scales, and nothing across the family is comparable.

## The correction

Anchor every registration on one px/mm, taken from `circle-100ml-clear-18-415`: the
best-registered file in the family (worstResidual 1.31 across 44 shots) and the largest
bottle, so anchoring there leaves canvas fit unchanged.

**Target: 6.0902 px/mm.** Millimetres come from `major_axis_mm` in
`data/paper-doll/body-dims.csv` — `high` or `verified` confidence, 30–86 live samples
per body. `major_axis_mm` is the right column rather than `diameter_mm`, which is empty
for the flat cross-sections; it is the widest dimension, which is what rendered body
width corresponds to.

Per-registration values are in [`corrected-registration-scales.json`](./corrected-registration-scales.json).
The 15 ml roughly halves (×0.495). That is the correct dimensional answer — it really is
the smallest bottle — but it will leave noticeably more empty canvas on a 1000×1100 kit
sheet, so it is worth looking at before committing to it. Changing the appetite for that
is a single number: `targetPxPerMm`.

## Why it cannot be applied to the kits alone

The kit builder validates each reassembled kit against the **published plate**, which was
rendered at the old scale. Changing kit scale without re-rendering that plate breaks
parity by construction.

Running `build_paired_psd_kits.py` over Circle with the corrected scales gives:

- **13 candidate** — every row left at ratio 1.000, all `circle-100ml-clear`
- **28 review** — every row with a changed scale, parity means of 24–123 against a gate
  of 6/255

The split is exactly along whether the scale moved. The gate is doing its job: it is
reporting that a kit-only change is incomplete, not that the scale is wrong.

So the order of work is plates first, then kits. Circle plates are published media that
the storefront and PDP consume, which is why this is queued behind a planned plate
rebuild rather than done here.

## Reproducing

The rebuild above ran against a copy of the batch in a scratchpad, with a published-plate
index synthesised from the batch manifest, because no live plate index covering Circle
exists in the artifacts — `plates-snapshot.json` holds 280 Cylinder-era SKUs with zero
Circle, and `plate-kit-coverage-2026-09-08.json` has no Circle groups. That synthesis
bypasses the live-plate guard, so those outputs were scale previews and never
release-ready. **No original registration, plate or PSD was modified.**

A real application of this needs the live Circle plate index.

## Not just Circle

Circle is the worst case, not the only one. Measured across the 202-row kit remediation
queue, seven `(family, capacity)` groups exceed 10 percentage points of internal spread:
Circle 100 (28.3), Tulip 6 (25.7), Rectangle 10 (23.7), Royal 13 (18.2), Flair 15 (16.7),
Round 78 (11.6), Tulip 5 (11.5). The same anchoring method applies to each, and
`body-dims.csv` covers 144 bodies — though only 71 of them carry `high` or `verified`
confidence, so the rest need their millimetres established first.

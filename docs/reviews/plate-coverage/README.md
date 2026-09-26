# Plate coverage, and why Slim is stuck

Two questions answered here: how many plates each family still needs, and what is
actually blocking Slim.

## Coverage

**1,812 of 2,330 catalogue products have a plate. 504 do not.**
Full table in [`coverage-by-family.json`](./coverage-by-family.json).

The ten largest gaps:

| family | products | plated | needed |
|---|---:|---:|---:|
| **Slim** | 123 | 27 | **96** |
| Sleek | 186 | 113 | 73 |
| Diva | 176 | 120 | 56 |
| Round | 178 | 141 | 37 |
| Boston Round | 123 | 90 | 33 |
| Elegant | 254 | 224 | 30 |
| Empire | 91 | 65 | 26 |
| Gift Bag | 21 | 0 | 21 |
| Cap/Closure | 32 | 14 | 18 |
| Gift Box | 15 | 0 | 14 |

Cylinder (372), Square (29), Flair (30) and Lotion Pump (7) are complete.

Of the 504: 288 are `remote_only_healthy` — live media exists but no plate has been
built — 124 need source matching, 75 have no verified source, and 17 sit on a local
fallback.

**Two caveats before treating these as release numbers.** The non-plated list holds 660
rows but only 504 appear in this 2,330-product snapshot, so 156 rows describe SKUs the
snapshot does not carry. And 14 products fall in neither list. Both lists are saved
evidence, not a live census; refresh against the deployment before planning a release
around them.

## Slim

Slim is the biggest gap, so it was run end to end through the real pipeline:
`family_batch.py --family Slim`, prepare then plates.

**19 plates render. 104 of 123 are blocked. Not one is blocked by a missing PSD.**

215 PSDs cover the family across four folders. Every blocked row has at least one
candidate source. The blockers are:

- **37** — `SAME_STEM_DIFFERENT_PHOTOGRAPH`
- **67** — `source_preflight:no approved capped/front source`

55 stems carry more than one candidate file, and none of the competitors are
byte-identical, so nothing can be deduplicated away. But they fall into exactly two
shapes, and neither is an aesthetic judgement:

**Pattern A — 37 stems.** Two `role=front` files at different ordinals in the family
folder (`11.` and `13.` of the same SKU), plus one `role=capped` `capState=on` file in
`31. Capped & Uncapped`. The capped file is the unambiguous capped front a plate needs;
the ambiguity is only between the two unlabelled family-folder files.

**Pattern B — 18 stems.** One `role=front` in the family folder, plus a file in
`21. Tassels/Updated Tassels` classified `role=component`. Rendered, both are complete
bottle-plus-tassel assemblies, so that component label looks wrong — worth confirming
before either is treated as the front.

Per-SKU detail, including every candidate path, is in
[`slim-source-decisions.json`](./slim-source-decisions.json).

So finishing Slim is a source-classification job, not new photography. Resolving these
two patterns is what unblocks the family.

## Reproducing

```
python3 family_batch.py --family Slim --catalog <convex snapshot> --out <dir> --stage prepare
python3 family_batch.py --family Slim --catalog <convex snapshot> --out <dir> --stage plates
```

The snapshot must be passed whole — the crosswalk needs `products`, `groups`,
`generatedAt` and `deployment`. This ran against a scratchpad copy of the pipeline; no
original PSD, registration or plate was modified, and nothing was published.

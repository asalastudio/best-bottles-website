# Sunburst hero prompts

The enhancement pass that produces the catalogue heroes runs
`gpt-image-2.5-sunburst` over an existing hero image. It is an **enhancement**,
never a re-render: the input photograph is the authority for shape, components,
material and colour, and the model may only make that same product read more
cleanly.

## `prompts/frosted.txt` — approved 2026-09-12

Use this, unchanged, for every frosted bottle.

**Why it exists.** The shared prompt used for clear glass attached a second
reference image for "glass rendering quality", and that clause ended with
`true refraction, no milky haze`. On a frosted bottle that is a direct
instruction to remove the etch — the milky body *is* the product. All 104
frosted prompts in the 2026-09-10 run carried it, and the frost came back thinned
or polished toward clear glass every time. Jordan: "the frost is getting rubbed
off."

Three of my own rewrites failed in different ways before this one: a "uniform
milky" version washed the body to flat white, a "defined etch" version read too
dark, and a "micro-texture" version hollowed out the centre of each disc, leaving
frost at the rim and near-background in the middle. The approved prompt is
Jordan's own, and it works because it frames the job as **photo restoration**
rather than rendering, and names the frost as part of the product rather than a
defect to clean up.

**How it is run.** One image only — the bottle's own current hero. Do **not**
attach a clear-glass quality reference. The prompt is SKU-agnostic: it refers to
"the supplied original product photograph" and mentions cap, atomizer, cord and
tassel only where present, so it needs no per-SKU substitution.

Model `gpt-image-2.5-sunburst`, size 2080x2288, quality `high`. About 35 s and
$0.11 per image.

**Known behaviour.** On a dense frosted body the pass still lightens it slightly
(measured: one bottle's frost density fell about a fifth, from 25.4 to 20.2 on a
distance-from-background scale; a lighter bottle came back unchanged at 20.7).
The silhouette can drift 1-2 %, which the sizing step corrects by matching the
approved frame. Neither was enough to matter at review.

## Sizing is separate

Enhancement never sets size or position. A fresh render is fitted to the frame
that was already approved for that SKU: match the approved image's silhouette
height, then seat the foot on the 1562 baseline and the group centre on x=780.
Approval binds to exact bytes, so any re-render goes back on a review card before
it can be locked or indexed.

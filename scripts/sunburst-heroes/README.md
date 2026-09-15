# Sunburst hero prompts

The enhancement pass that produces the catalogue heroes runs
`gpt-image-2.5-sunburst` over an existing hero image. It is an **enhancement**,
never a re-render: the input photograph is the authority for shape, components,
material and colour, and the model may only make that same product read more
cleanly.

## `prompts/frosted.txt` — approved 2026-09-12

The whole prompt is two lines:

```
1. Keep geometry locked
2. Enhance the quality
```

Use it unchanged. Do not add to it.

**Why it is this short.** The shared prompt used for clear glass attached a
second reference image for "glass rendering quality", and that clause ended with
`true refraction, no milky haze`. On a frosted bottle that is a direct
instruction to remove the etch — the milky body *is* the product. All 104 frosted
prompts in the 2026-09-10 run carried it, and the frost came back thinned or
polished toward clear glass every time. Jordan: "the frost is getting rubbed
off."

Four longer rewrites then failed, each in a different way:

| attempt | what it said | how it failed |
|---|---|---|
| A | enhancement only, no clear-glass reference | silhouette drifted 3.4 % |
| B/C | "uniform density", "sandblasted micro-texture" | hollowed the centre of each disc, frost only at the rim |
| earlier | "even etch, cooler and deeper" | read too dark |
| E | a careful photo-restoration brief naming the frost as part of the product | fixed the centre, then washed out the base so the bottle read as a dome with nothing under it |

The pattern is consistent: **the more the prompt argues about what frosted glass
is, the more the model treats the material as something to decide about, and it
keeps deciding the pale parts are background.** Saying almost nothing leaves the
material alone. Two lines beat every careful brief we wrote.

**How it is run.** One image only — the bottle's own current hero. Do **not**
attach a clear-glass quality reference. Model `gpt-image-2.5-sunburst`, size
2080x2288, quality `high`. About 35 s and $0.11 per image.

**Why enhance at all, rather than use the original photograph.** The approved
Circle sizes are larger than the original shots, so using an original means
enlarging it and it goes soft. The enhancement renders at 2080 px and comes down
to 1560, so the base keeps a real edge and the metal stays crisp. Measured on
three bottles, the enhanced base has definition the enlarged original has lost.

## Sizing is separate

Enhancement never sets size or position. A fresh render is fitted to the frame
that was already approved for that SKU: match the approved image's silhouette
height, then seat the foot on the 1562 baseline and the group centre on x=780.
Approval binds to exact bytes, so any re-render goes back on a review card before
it can be locked or indexed.

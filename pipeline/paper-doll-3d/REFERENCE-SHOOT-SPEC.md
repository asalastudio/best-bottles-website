# Reference shoot — what to capture, and why

For locking glass material in the Material Lab (`/dev/material-lab`).

**Five photographs, one sitting.** Clear · Amber · Cobalt · Frosted · Swirl.

The point of these is not beauty. It is **measurement**. We extract one thing
from each photo — how much of each colour channel survives the glass — and
that number becomes the material. Everything else about your photo is
discarded.

---

## The ONE thing that must be right

**Nothing may be blown out.**

The measurement is a ratio: glass brightness divided by background brightness.
If either clips to pure white (255), the ratio is destroyed and the photo is
unusable — no matter how good it looks.

- Underexpose slightly rather than over. Shadow detail is recoverable; clipped
  white is not.
- On a phone: tap the bottle, then drag the exposure slider DOWN a little.
- Check the highlight warning if your camera has one.

Everything below is in service of that.

---

## Setup

**Background.** A plain, mid-tone, matte surface — a wall, grey card, or white
foamboard. It must be **visible on both sides of the bottle**: that is the
reference the measurement divides by. A pure-white lightbox is the one thing to
avoid, because it clips.

**Lighting.** Soft and even. A north-facing window, an overcast day, or one
diffused lamp bounced off a wall. Specifically:

- **no direct sun, no bare bulb, no on-camera flash** — hard sources blow
  specular highlights to pure white
- light from the **front-side**, not from behind the bottle. Backlighting
  floods glass and destroys the reading
- one soft source is better than three hard ones

**You do not need a studio.** The best amber measurement we have — IMG_5040 —
was a bottle against a wall, shot on a phone. That is the bar.

**Bottle prep.** Cap **off**. No roller ball, no sprayer — we are measuring
glass. Wipe fingerprints. Stand it upright, straight on.

**Include a white or grey card** in one frame per session if you can. It lets
us normalise across the set.

---

## Camera

- **Straight on**, roughly at the bottle's mid-height
- Stand back and zoom in rather than getting close — a wide lens bends the
  silhouette. On a phone, use the 2x/3x lens, not 0.5x
- Fill maybe half the frame. Leave background on both sides
- Focus on the front glass surface

---

## What does NOT matter

Genuinely, don't spend effort here:

| | |
|---|---|
| resolution | the measurement is a ratio — scale-invariant |
| exact framing | the lab has scale and offset controls to line it up |
| identical distance between shots | ditto |
| which camera or phone | any |
| whether it looks beautiful | we are not copying your lighting |

**Your photo's lighting is never reproduced in the browser.** The browser has
its own studio rig, tuned separately for what looks right on screen. From your
photo we take only the absorption, which is lighting-independent because it is
a ratio. So an honest, flat, slightly dull photo is *more* useful than a
dramatic one.

---

## Consistency across the five

Shoot all five **in one session without changing anything** — same light, same
background, same exposure setting, same distance. That is the real prize.

Right now our presets come from different sessions, and it shows: amber has two
conflicting measurements (`#8b6a38` from a wall shot, `#c88e63` from an older
catalogue shot) purely because the lighting differed. One session removes that.

Two of the five have **no usable reference at all** today:
- **clear** — no 9 mL clear reference exists
- **swirl** — none at all

---

## Checklist

```
[ ] cap off, no fitment, wiped clean
[ ] plain mid-tone background, visible both sides of the bottle
[ ] soft light from the front-side; no sun, flash or bare bulb
[ ] nothing clipped to pure white  ← the one that matters
[ ] straight on, mid-height, zoomed in rather than close
[ ] all five shot without changing the setup
[ ] one frame with a white/grey card
```

---

## On AI-generated reference

**Do not use generated images to measure material.**

A generated amber bottle shows a model's idea of amber, not Nemat's. Measuring
absorption from it would produce a preset that is confidently wrong, and every
bottle in the configurator would inherit that fiction — while looking
plausible, which is worse than looking broken.

Generated imagery is legitimate for **art direction** — agreeing on mood,
lighting style, or a target look. That is a different job from establishing
what our glass actually does, and the two must not be mixed.

The physical bottles are the only source of truth for the material.

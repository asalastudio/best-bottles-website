# Physical measurement protocol — Boston Round

Purpose: replace the reverse-engineered figures (live-site scrape + one
photograph) with measured ground truth, so the model is a true twin rather
than a close approximation.

Written: 2026-08-06
Applies to: any capacity. Record which one on each sheet.

## Tools

| tool | needed for | notes |
|---|---|---|
| digital caliper, 0.01 mm | all linear dimensions | 150 mm jaw is plenty |
| kitchen/jewellery scale, 0.1 g | glass mass, water mass | 0.01 g better if available |
| water + syringe or dropper | brim capacity | room temperature |
| straightedge / steel rule | base punt depth | any flat edge |
| paper towel | drying between steps | |

No ultrasonic gauge required. Wall thickness is **derived**, see §4.

## Method notes — read once

- **Measure every dimension 3x, rotating the bottle ~60° between takes, and
  record all three.** Moulded glass is not perfectly round. The spread IS data:
  it tells us the ovality to model or ignore, and it is lost if you average on
  the spot.
- Record raw numbers, not rounded ones. Rounding is our job, not yours.
- Caliper jaws on glass: firm contact, no squeeze. Glass does not compress but
  the caliper will read low if you force it.
- If a dimension is ambiguous or you are unsure you measured the right thing,
  write "unsure" next to it. An honest gap is far better than a confident
  wrong number — a bad bore figure propagates into every fitment forever.

---

## 1. Overall envelope

Drives the packaging software and the top-level model dimensions.

| # | dimension | how | take 1 | take 2 | take 3 |
|---|---|---|---|---|---|
| 1.1 | bare height | base to top of finish rim, bottle standing | | | |
| 1.2 | max body diameter | widest point of the body | | | |
| 1.3 | base diameter | the actual standing/contact circle | | | |
| 1.4 | height at max diameter | base up to where 1.2 was taken | | | |

## 2. Neck finish — FITMENT CRITICAL

These decide whether the roll-on, the dropper and the cap seat correctly.
Every downstream component depends on them. Measure carefully.

| # | dimension | how | take 1 | take 2 | take 3 |
|---|---|---|---|---|---|
| 2.1 | thread major dia (T) | across the thread **crests** | | | |
| 2.2 | thread root dia (E) | across the valleys **between** threads | | | |
| 2.3 | bore dia (I) | caliper's inside jaws, in the opening | | | |
| 2.4 | finish height (H) | rim down to bottom of the thread land | | | |
| 2.5 | straight neck below finish | bottom of thread land to where the shoulder curve starts | | | |
| 2.6 | rim wall thickness | (T minus I) / 2 — or measure the rim annulus directly | | | |

Also note:
- number of thread turns (visual count): ______
- thread start position relative to the seam: ______
- is there a transfer bead / flange ring at the base of the neck? Y / N
  if yes, its outer diameter: ______ and its height above the shoulder: ______

## 3. Profile landmarks

Heights measured from the base, standing upright.

| # | dimension | take 1 | take 2 | take 3 |
|---|---|---|---|---|
| 3.1 | height where the straight wall ends (shoulder begins) | | | |
| 3.2 | height where the shoulder meets the neck | | | |
| 3.3 | base punt depth (straightedge across base, measure gap) | | | |
| 3.4 | heel: height at which the body reaches full diameter | | | |

## 4. Wall thickness — derived, do not measure directly

Three weighings recover the interior exactly. This is more accurate than any
direct attempt on a sealed bottle.

| # | measurement | value |
|---|---|---|
| 4.1 | mass of the empty, dry bottle (no closure) | ______ g |
| 4.2 | mass filled with water to the very brim | ______ g |
| 4.3 | water temperature (if not ~20 °C) | ______ °C |

From these:
- **brim capacity** = (4.2 − 4.1) ml, since water is ~1 g/ml
- **glass volume** = 4.1 ÷ 2.52 ml (soda-lime density ≈ 2.52 g/cm³)
- **wall thickness** solves out, because the outer profile is known from §1–3

This also gives two independent cross-checks on the whole model: the computed
brim capacity must match 4.2 − 4.1, and the modelled glass volume must match
4.1 ÷ 2.52. If either disagrees, the outer profile is wrong somewhere.

Fill to the **brim** — the very top of the rim, not to a shoulder or a fill
line. Overfill slightly, then draw back with a dropper until level with the rim.

## 5. Base

| item | value |
|---|---|
| punt present (concave underside)? | Y / N |
| any embossing / mould numbers on the base? | ______ |
| contact ring width (the flat annulus it actually stands on) | ______ mm |

## 6. Mould seam

| item | value |
|---|---|
| seam visible? | Y / N |
| how far up does it run (from base)? | ______ mm |
| raised or flush to the touch? | ______ |

Absence of a seam is a common "CGI tell" in bottle shots. Even 0.05 mm of
relief catches a highlight and reads as real.

## 7. Components — separate pieces, measure separately

Each closure is its own configurator piece. Repeat per closure you have.

Closure type (roll-on / dropper / screw cap): ______
Finish it fits (18-400 / 20-400): ______

| # | dimension | value |
|---|---|---|
| 7.1 | outer diameter | ______ |
| 7.2 | overall height | ______ |
| 7.3 | skirt inner diameter (what closes over the thread) | ______ |
| 7.4 | skirt depth | ______ |
| 7.5 | assembled height, closure fitted to bottle | ______ |
| 7.6 | mass | ______ g |

For a **roll-on** also record:
- housing outer diameter (the part that press-fits into the bore): ______
- insertion depth into the neck: ______
- ball diameter: ______
- how far the ball crown sits above the rim: ______

For a **dropper** also record:
- bulb diameter and height: ______
- pipette outer diameter: ______
- pipette length below the collar: ______

7.5 is what the packaging software needs — the capped heights on the live site
vary by closure (30 ml reads 97 mm with a roller, 102 mm with a dropper) and
those are the carton-sizing numbers.

---

## When done

Send the filled sheet back and the figures go straight into
`scripts/paper-doll-3d/build-boston-round.py` as preset values, plus
`NECK_FINISHES` for the measured finish. The current SPI table entries are
book values reproduced from standard tables, not measured — yours replace them.

Anything measured here overrides both the live-site scrape and the photo
extraction. Order of authority becomes:

1. **your measurements** (this sheet)
2. supplier technical drawing, if it ever arrives
3. live-site scrape (verified, but published specs carry tolerance)
4. photo silhouette extraction (~±1 mm, scale-ambiguous)

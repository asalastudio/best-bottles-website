# Component register — Phase 4: the renderer and the parity gate (17-415 Cylinder 9 mL)

**Status: gate ACCEPTED by Jordan, 2026-09-25** ("accept the thresholds, keep rim-on-rim, stand on legacy
pixels"). Nothing on the storefront reads the register yet; that switch is Phase 5, one consumer at a time.

## What was built

| piece | where | what it does |
|---|---|---|
| placement | `src/lib/register/compose.ts` | Pure arithmetic from the Phase 2 coordinate contract: scale each image by `frame.pxPerMm / image.pxPerMm`, translate so its anchor lands on the frame's seat, stack behind-body layers → plate → front layers (highest `explodeIndex` first, as the approved Phase 3 sheet draws them). `frameFromLegacyKit` stands a plate exactly where an existing kit stands its bottle. |
| browser renderer | `src/components/register/RegisterStage.tsx` | Draws a composition as absolutely positioned images inside a box shaped like the frame; every position is a percentage, so it scales with its container. Takes geometry and URLs only — no Convex — so the lab feeds it local cut-outs today and a storefront consumer will feed it `register:composition`. |
| Node renderer | `scripts/register/phase4/render.ts` | The same placement rasterised with sharp for the gate: the register render and the legacy composite for every pilot SKU, in the kit's own frame, split by slot group. |
| legacy side | `scripts/register/phase4/fetch-legacy-kits.ts` | Reads each pilot SKU's published `productKits` row from dev (public query, read only) and its part images. |
| gate | `scripts/register/phase4/parity_gate.py` | Measures each pair and writes `data/register/phase4/parity-pilot.json` (committed) and review sheets. |
| lab | `/lab/register-parity` | Legacy kit · register render · the register drawn live in the browser · the gate's overlay, per SKU, with the numbers. Local output only. |

Run, in order: `fetch-legacy-kits.ts` → `render.ts` → `parity_gate.py`, then open the lab page.

## What the gate measures (per SKU, 1000 × 1100, the builder's canvas)

- **seat / foot**: the first and last rows of the body's alpha, register vs legacy, in px.
- **body**: overlap (IoU) of the row-filled body silhouettes, plus the 95th-percentile outline distance.
- **closure**: overlap of the closure parts as drawn (cap, or sprayer + collar + overcap, or pump + collar + overcap).
- **behind**: overlap of the roller insert above the rim (the register clips the metal insert at the rim, so only the visible part counts).
- **silhouette**: overlap of the whole assembly.

## Results

133 of the 145 pilot SKUs have a published kit on dev; the other 12 render on the pilot datum (the frame most kits share).

| check | result over 133 kits |
|---|---|
| seat | 0–1 px off, every SKU |
| foot | 0–1 px off, every SKU |
| body IoU | Clear 0.986–0.995 · Swirl 0.981–0.985 · Frosted 0.969–0.972 · Amber 0.963–0.964 · Cobalt 0.960–0.962 |
| closure IoU | median 0.94; min 0.869 (all twelve below 0.90 are Amber or Frosted) |
| insert above rim | median 0.95 |
| silhouette IoU | min 0.943, median 0.970 |

Two things the numbers say, both about the legacy kits rather than the render:

1. **The legacy kits' recorded anchors are not where their pixels are.** All 133 record `axisX = 500`, but
   their bodies stand up to 8 px off it, and the recorded foot sits 1–5 px below the glass. Framing the
   register on the recorded anchors scored body IoU 0.95 and looked misaligned; framing on the legacy body's
   own pixels (where the customer sees the bottle) is what the table above reports. `render.ts` does that by
   default and keeps the recorded anchors in the manifest. The register's own anchors are exact: seat and foot
   land to the pixel.
2. **The legacy kits disagree with each other by glass; the register does not.** Against the clear kits, which
   share a source photo with the plate geometry, the register scores 0.99. The amber and cobalt photos are
   about 4 % slimmer than the clear one, cap included — the same photos Jordan accepted at +2.6 % width in
   Phase 3 — and the register draws one geometry for every glass, so those bodies cannot score above ~0.96
   and their caps ~0.87–0.90 against their own slimmer kits. The clear-glass score is the evidence that the
   placement is right; the amber/cobalt gap is the approved same-geometry ruling showing up.

The register's closures also sit ~5 px (0.5 mm) lower than the legacy caps. The register anchors every part at
the rim (Phase 3: rim on rim with the master capped photo); the legacy caps hover half a millimetre above it.
Relative to their own body, register and legacy closures are centred within a pixel of each other.

## Gate thresholds (accepted 2026-09-25)

| check | threshold | why |
|---|---|---|
| seat, foot | ≤ 2 px | the Phase 2 §6 requirement; measured 0–1 |
| body IoU | ≥ 0.96 | the floor the approved same-geometry ruling sets on Amber/Cobalt (0.960); clear glass sits at 0.99 |
| closure IoU | ≥ 0.86 | the floor the slimmer amber/frosted photos set (0.869); clear-glass caps sit at 0.93–0.99 |
| silhouette IoU | ≥ 0.94 | follows from the two above (measured min 0.943) |

At these thresholds all 133 pass (`parity-pilot.json`, pinned by `tests/register-phase4-parity.test.ts`). At the
first-draft thresholds (0.97 / 0.90 / 0.95) 69 pass, and every miss is on Amber, Cobalt or Frosted for the
reason above. The thresholds are arguments to `parity_gate.py`; a different ruling changes one number.

## Rulings (Jordan, 2026-09-25)

1. **Thresholds accepted** as the cut-over gate for the pilot: seat/foot ≤ 2 px, body ≥ 0.96, closure ≥ 0.86,
   silhouette ≥ 0.94. They are the defaults in `parity_gate.py`.
2. **Stand on the legacy pixels.** When a consumer switches, the bottle is framed on the legacy body's own
   pixels (`frameFromLegacyKit` with the measured anchors), so nothing moves on the page. The 12 kit-less
   SKUs stand on the pilot datum.
3. **Keep rim-on-rim.** The register's closure anchor stays at the rim; the legacy caps' 0.5 mm hover is not
   reproduced.

## Phase 5, when the gate is accepted

One consumer at a time, pilot family first: the PDP stage for the 145 pilot SKUs reads `register:composition`
and draws with `RegisterStage`, behind a flag, with the legacy kit as fallback; then Build Your Bottle. The
register functions need re-deploying to dev first: `register:*` were removed when main was pushed there, though
the tables and their rows are intact (5 approved plates, 21 measured components).

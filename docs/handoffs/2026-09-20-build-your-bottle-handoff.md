# Handoff — Build Your Bottle: component model, Empire 50 ml (2026-09-20)

You are picking up work on the Best Bottles storefront (Next.js 16 + Convex + Tailwind v4),
a division of Nemat International. The owner you work for is **Jordan Richter**. Read this whole
file before touching anything. Everything here was verified on 2026-09-20 unless marked UNVERIFIED.

---

## 0. The task you are inheriting

Jordan approved this, verbatim: **"yes build it with the Sunburst body, oversized and clipped."**

Build the **component model for the 50 ml Empire (clear, 18-415) end to end in the LOCAL builder**,
so Jordan can click through it on localhost:

1. **One canonical body** for the bottle-and-glass, regenerated with GPT Image 2.5 **Sunburst**, generated
   slightly **oversized and then clipped to the TRUE outline** from the photograph (recipe in §6 — it is
   **untested**; prove it before relying on it).
2. **Each top taken once, as a shared component** (sprayer, lotion pump, reducer cap, dropper, bulb
   sprayer, tassel sprayer), seated on the body by a measured datum — not per-SKU kits.
3. **Cap-off = body + fitment without the cap.** No separate cap-off image is needed.
4. Local only. **Publish nothing. No production writes.** Show Jordan a before/after first.

This is a pilot of a new structure, not a patch. Do not widen it to other families until Jordan has
clicked through Empire 50 ml and said so.

---

## 0a. The quality bar — Jordan's words, 2026-09-20

Jordan, looking at the LIVE builder (100 ml Empire · Clear · Vintage Style Bulb Sprayer · White, Shiny Silver
Collar): **"This quality is looking very good. We need to follow a similar quality for all the fitments."**
Reference image: `docs/handoffs/assets-2026-09-20/quality-bar-empire100-bulb-sprayer-white.webp`.

That screenshot is the target for every fitment. It looks right for three specific reasons — reproduce these,
don't guess at "quality":

1. **The glass reads as glass.** The clear body is multiplied onto the stage (#208, live since 04:50Z). Before
   that fix the same bottle was an opaque white slab.
2. **The top is seated exactly.** This kit's stored body `bounds` are the actual glass, so
   `registerVintagePreview` has a true box to place the top against. (None of the Empire kits are among the 185
   whose bounds are wrong.)
3. **Body and top come from photographs at the same scale.** `MatrixClient` picks a Vintage Bulb Sprayer kit
   first as the body reference for bulb sprayers.

Where other fitments fall short today: tops seated off-centre (185 kits with wrong body bounds — Round 78,
Sleek 60, Boston 37); the bottle changing size between fitments (every fitment photographed at its own scale —
see `empire50-component-pilot.jpg`); white retouch marks exposed once the cap is off (Boston roller fixed; the
Empire copper spray pump still carries a white scribble above the cap); roller kits with no roller part; 64 kits
the builder rejects for `seatY`. One body + components seated on measured landmarks gives every fitment the
three conditions above by construction — that is the point of the task in §0.

---

## 0b. Pumps must be shown EXPOSED, overcaps as sidecars — and the sources already exist

Jordan, 2026-09-20, on the Perfume Sprayer finish tiles (100 ml Empire): **"These need to have the actual pumps
exposed, not the overcaps. The overcaps are going to be the sidecars."** Then: "how do we get all the fitments
there like the bulbs".

What is wrong today (verified on prod kits, picture: `public/reviews/builder-review-2026-09-19/empire-sprayer-parts-mislabelled.jpg`):
- `BuilderFinishImage` draws the kit's mechanism part for a Sprayer/Pump tile. Only **Copper** shows a pump,
  because only Copper's kit has a real `sprayer` AND an `overcap`.
- For Matte Gold / Matte Silver / Shiny Black / Shiny Gold / Shiny Silver at 100 ml, the part LABELLED `sprayer`
  **is the overcap cylinder** — there is no pump in that kit. At 50 ml the part labelled `overcap` is actually
  the **dip tube** and `sprayer` is the overcap. `family_part_map.py` assigns roles by geometry and got these wrong.
- Scale of it, across the 358 published Perfume Spray Pump / Fine Mist Sprayer / Lotion Pump kits:
  **91** have mechanism + overcap (right), **222 have only ONE top part** (pump hidden or mislabelled), 45 have no
  top. By family: Elegant 59, Diva 46, Circle 27, Empire 17, Sleek 15, Round 12, Square/Rectangle/Tulip/Slim 7,
  Grace/Flair/Royal 6.

Why, and the fix — **the photographer already shot what Jordan wants**
(picture: `public/reviews/builder-review-2026-09-19/empire100-capped-vs-uncapped-twins.jpg`):
- The master library holds **two PSDs per pump SKU**. BBUAT's folders name them: e.g. `11. GBEmp100SpryMtGl.psd`
  = **Capped**, `13. GBEmp100SpryMtGl.psd` = **Uncapped**. The uncapped twin has: background, the SAME body layer
  (697×1504), the dip tube, **the exposed pump in the right finish**, and the SAME overcap layer (332×589) standing
  beside the bottle. Kits were cut from the capped twin (correct for the plate), so the pump never made it in.
- **All 222 affected kits have a second PSD of the same name in the master.**
- The tool already exists: **`scripts/paperdoll/build_paired_psd_kits.py`** — "The capped PSD remains the plate
  and geometry authority. Layers from the uncapped PSD may supply an exposed fitment only after the identical
  body layer establishes the translation back into the capped composition… registered to the currently published
  plate hash… reassemble within the parity gate. This script never publishes."
  Args: `--batch --published-plates --catalog --recipes --output`. Read it and its two commits
  (`80ac2a5b`, `39a9b92f`) before running; it needs a recipes file.
- Once a kit has `sprayer` + `overcap`, the display is already handled: `BuilderImage` stands the overcap on the
  ground beside the bottle (Jordan's 2026-09-16 rule) and the finish tile draws the pump.
- This is the same "SAME_STEM_DIFFERENT_PHOTOGRAPH" twin pair the plate lane had to pin. Identify the twin by
  content (the uncapped one has one more layer, its body shifted left, the overcap low and to the right), never
  by the numeric filename prefix.
- Noticed: Copper's overcap part carries white retouch scribbles at its top corners (visible on bone). Same class
  as the Boston roller patch; `strip_retouch_patch.py` is the tool — it is safe on copper, NOT on white parts.

Any re-cut kit replaces parts on LIVE kits → before/after sheet for Jordan, then a ship phrase. For the component
pilot in §0, take the pump and overcap from the uncapped twin in the first place.

---

## 0c. SOURCE RULE — build components from the master COMPONENT LIBRARY first

Jordan, 2026-09-20: **"you should be using this: `BB-PSD-Files-Master/20. Caps`"**, **"and tassels:
`BB-PSD-Files-Master/21. Tassels`"**, and **"we should be building what we need from here if the layers and
images supply it."** This supersedes §0b's order of preference: **component library first; the uncapped twin
bottle PSDs only where the library does not supply the part.**

`/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master/20. Caps` — 140 PSDs, one per
component per finish, **foldered by neck finish and type**. This is the component library the builder needs;
it was already photographed. Full inventory: **`data/paper-doll/component-library-inventory.json`**
(sample: `public/reviews/builder-review-2026-09-19/component-library-sample.jpg`).

| neck | what the library holds |
|---|---|
| 18-415 | Sprayers ×6 (Cu, MtGl, MtSl, ShnBlk, ShnGl, ShnSl — **pump exposed, single clean layer**), Lotion ×8, Caps ×12 (incl. leather), **Ansp ×9** (bulb sprayer + its dip tube, 2550×3300), **Ansp Tsl ×9** (6000×4000), Droppers ×3, Reducer ×1, Diva rings |
| 20-400 | Roll-on caps ×6 (tall), short caps ×2, Droppers ×12 — **no bare roller** (so the Boston roller fix from the bottle PSDs stands) |
| 18-400 | Droppers ×6, caps, cap-with-wand |
| 17-415 | Roll-on caps ×10, Spray ×6 (**6 hidden layers — review**), Lotion ×3 |
| 15-415 | Sprayers ×5, caps ×2 |
| 13-415 | Sprayers ×8, caps ×4, roll-on caps ×9 (**33 hidden layers — review**), and **`13-415PlsticRollon` + `13-415MtlRollon`: the bare plastic and metal ROLLERS** — the part missing from ~90 roller kits (Flair, Rectangle, Royal, Sleek 8 ml, Tulip are all 13-415) |
| 8-425, 14 mm, vials | caps, heart caps with tassel/chain, vial wands |

`21. Tassels` — 253 per-SKU tassel-bottle PSDs in `Original Tassels` (110) and `Updated Tassels` (143).
**Jordan, 2026-09-20: "use Updated Tassels."** `Updated Tassels` is authoritative; do not use `Original Tassels`.

Coverage against the catalogue (category Component, prod, 2026-09-20): **109 of 153 component products have a
library PSD of the exact same name.** Many of the 44 others are the same part spelled differently —
`CP13-415SpryCuMt` (catalogue) ↔ `Spry13-415CuMt` (library), `CP18-415AnSpPnk` ↔ `Ansp18-415Pnk`,
`CP18-415AnSpTslGl` ↔ `AnspTsl18-415Gl`. **Those pairs need Jordan's confirmation** — only he promotes a name
pair (same rule as `data/paper-doll/alias-map.json`); prepare a confirmation sheet, don't assume. Genuinely absent:
press-fit caps, 22-400, 24-400, 13-425.

Things to respect when cutting from the library:
- Small canvases: 18-415 sprayers are 400×400 (pump ≈ 220×394 px). On the 1000×1100 builder canvas the Empire pump
  is ≈ 165×311 px, so this is a DOWNscale — fine. Check each before upscaling anything.
- Some layers run to the canvas edge (`Spry18-415ShnBlk` sits at y = −1, 400 tall): check for a cut top.
- Hidden layers exist (13-415 roll-on 33, 17-415 spray 6, reducer 1…). Hidden in Photoshop = excluded, and the PSD
  needs a look before use.
- Drop the full-canvas Background layer; composite the rest with adjustment layers applied, as the extractor does.
- Each component still needs a **seat datum** measured on solid alpha (where it meets the neck), and it must be
  LOOKED at on the stage colour `#eeebe5` — these were never QA'd cap-off either.

---

## 0d. DONE as a review sheet: library pumps on the Empire 50 and 100 ml (nothing published)

Jordan: "yes cut the pumps now." Script: `scripts/bottle-builder-pilot/empire_library_pumps.py`
(numbers in `dist/paper-doll/empire-library-pumps.json`). Sheets, TODAY vs LIBRARY PUMP + overcap sidecar, all six
finishes: `public/reviews/builder-review-2026-09-19/empire50-library-pumps.jpg`, `…/empire100-library-pumps.jpg`.

How it is built — reuse this pattern:
- **ART from the library** (`20. Caps/7. 18-415 Sprayers/Spry18-415<finish>.psd`): the one foreground layer, read
  from the LAYER (three extend 1–14 px above their canvas, so never crop to the canvas), keeping only the pump's own
  connected shape (Copper has stray white fragments beside it).
- **POSITION from the SKU's uncapped twin PSD**, not guessed: the twin's pump layer → capped PSD coordinates via the
  identical body layer → builder canvas via the kit's own plate registration. The library pump is scaled to that
  collar width and stood on that bottom-centre. Library scale is 0.75–0.90, i.e. always a downscale.
- **Independent check:** the library pump's top lands within **1–9 px** of the SKU's own photographed pump for ten
  of twelve; the two Coppers are +12 / +14 px (the library's Copper photograph is slightly shorter in proportion).
- **SIDECAR:** the twin's own overcap layer, stood on the baseline beside the glass. Copper's overcap carried a
  retoucher's white shards (~19k px) — stripped with `strip_retouch_patch`, **named for Copper only**; never run it
  on the silver overcaps, whose highlights are genuinely white.
- **Identify the twin by what it shows** — identical body layer size and a part standing beside the glass. NOT by
  folder (kits were cut from `31. Capped & Uncapped…/Capped/`, the twins are in the family folder), NOT by file
  number, NOT by layer count (Copper's capped file already contains its pump), and dedupe by layer geometry
  (one twin is filed in two places).
- Clear glass is multiplied onto `#eeebe5`. Every pump clears the canvas top (y = 74–93).

Not done: turning these into published kit parts (`sprayer` + `overcap`, correct labels). That replaces parts on
LIVE kits → it needs this sheet approved and a ship phrase. The same pattern should extend to the other 18-415
families (Elegant, Diva, Circle 50/100, Sleek, Round, Grace…) and, with their own library folders, to 15-415,
17-415 and 13-415.

---

## 1. Where things are

| | |
|---|---|
| Worktree (work HERE, do not `cd` to the repo root) | `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c` |
| Current branch | `claude/byb-component-pilot-2026-09-20` (based on the clear-glass fix branch, so localhost shows that fix) |
| GitHub | `asalastudio/best-bottles-website` — use the `gh` CLI (the GitHub MCP server fails to connect) |
| Staging site (reads PROD Convex) | https://best-bottles-website.vercel.app/matrix |
| Convex PROD (storefront reads this) | `https://precise-raccoon-123.convex.cloud` |
| Convex DEV (shared, `.env.local` points here) | `https://helpful-elephant-638.convex.cloud` |
| Master PSD library | `/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master` |
| Persistent memory (read `MEMORY.md` first) | `/Users/jordanrichter/.claude/projects/-Users-jordanrichter-Projects-Clients-Nemat-International-Best-Bottles-Website-02-20-2026/memory/` |
| Build outputs (gitignored, ~900 MB, **do not delete**) | `dist/paper-doll/` |

Most relevant memory files: `project_builder_architecture_findings_2026_09_20.md`,
`project_builder_reconciliation_2026_09_19.md`, `project_kit_lane_2026_09_19.md`,
`feedback_gpt_image2_enhancement_policy.md`, `project_gpt_image_2_5_evaluation_2026_09_09.md`.

### Working tree state right now
- `M .claude/launch.json` — **Jordan's uncommitted change. Never commit it, never revert it.**
- `.env.development.local` — a **temporary, gitignored** override I wrote (see §7). Delete it when done.
- A Next dev server is running on **port 3040** (pid 61864 at time of writing), started via the
  `next-dev-3040` launch config. Reuse it or stop it; don't start a second one on the same port.

---

## 2. State of production (verified)

- **1,724 kits on PROD, integrity clean** (`productKits:integrity`). Was 420 two days ago.
  - +683 on 09-19 (Elegant 203, Diva 129, Circle 109, Round 104, Boston 83, Empire 55) — cut 09-16, never published until then.
  - +621 on 09-19 (25 families, cut from the plates production actually serves). Jordan's words: "ok lets ship The 621 prepared kits".
  - 13 Boston Round roller kits **updated** 09-20 on his phrase "ship Boston Round corrected rollers 2026-09-20".
- **2,283 plates on PROD.** 2,168 are bottles (115 are Component products, which get no kit). **80% of plated bottles have a kit** (1,724 / 2,168); 444 do not.
- DEV has fewer kits: 7 families (Boston Round, Circle, Diva, Elegant, Round, Sleek, Tulip) were refused on
  dev because dev's plates are newer renders than prod's. That is correct behaviour, not a bug.
- **DEV Convex is behind main:** PR #201 added `productKits:forSkus`; it is deployed to PROD only. `/matrix`
  on main crashes against dev with *"Could not find public function for 'productKits:forSkus'"*.
  **Do not deploy to the shared dev backend** — that is Jordan's call.

### Pull requests
| PR | State | What |
|---|---|---|
| #182 | merged | 683 kits + tooling; conflict in `src/lib/bottle-builder/server.ts` resolved on main's structure |
| #199 | merged | blank Cylinder tiles — `slimBuilderBodies` ran twice and erased `chooserKit` |
| #200 | merged | release records for the 621 + two read-only diagnostic tools |
| #201, #202 | merged (another agent) | mobile blank tiles; 100 ml necks — introduced the CSS-cropped `<img>` tile |
| #204 | merged | tiles stretched ~2.4× (CSS crop had no letterboxing) |
| #206 | merged 2026-09-20 04:41Z (`847a1b4b`) | Boston rollers — published to prod on Jordan's ship phrase; script, record and sheets now on main |
| #208 | merged 2026-09-20 04:42Z (`8faaf5a6`) | clear glass drew as a white block — the multiply now lives on the outermost wrapper |

No PRs of mine are open. `main` is at `8faaf5a6` or later. **This pilot branch predates those two merges** —
rebase or merge `origin/main` into it before you build (expect no conflicts: it only adds files under
`scripts/bottle-builder-pilot/`, `docs/handoffs/` and `public/reviews/`, plus #208's own change it was based on).

Jordan merges, or tells you to. Do not merge on your own initiative.

---

## 3. How kits reach Build Your Bottle today (file map)

```
Convex productKits  (one row PER SKU: body + mechanism + cap, registered to that SKU's plate by plateSha256)
        │  productKits:forSku / forSkus          ← returns null if kit.plateSha256 != live plate front sha
        ▼
src/lib/bottle-builder/server.ts     loadBuilderFamily (unstable_cache 300 s) → loadBuilderBodies
                                     kitFor() = local overlay (BUILDER_LOCAL_KITS) else cachedKit
src/lib/bottle-builder/model.ts      configurationFromRow()  ← validates a kit; many ways to reject
                                     resolveBuilderConfigurations(), groupBuilderBodies(), previewParts()
src/lib/bottle-builder/payload.ts    slimBuilderBodies()  (runs TWICE by design; must stay idempotent)
src/lib/bottle-builder/preview-registration.ts   registerVintagePreview()  ← seats tops on ONE fixed body
src/lib/bottle-builder/preview-frame.ts          previewFrame(), layerCropStyle()
src/components/bottle-builder/BuilderImage.tsx   draws a tile / the stage (img crop path + SVG path)
src/components/matrix/MatrixClient.tsx           the 4-step UI; picks `preview` and `bodyReference`
src/app/matrix/page.tsx                          server entry; first paint = the open family only
src/app/api/bottle-builder/{families,kits,validate}/route.ts   kits route has CDN s-maxage=300
src/lib/bottle-builder/bodies.generated.json     hand-reviewed body webps (public/images/bottle-builder/bodies/)
public/images/bottle-builder/rollers/            separately made Cylinder roller assets
src/lib/products/closure-presentation-policy.json   assembled-only applicators (no exploded view)
```

There is **no family allowlist**: any family with one valid kit is enrolled. The live builder offers
**18 families**; 10–11 of them arrived with the 09-19 publish and **have never been reviewed in the builder**.

Two caches stack (CDN 5 min + `unstable_cache` per kit 5 min, stale-while-revalidate): after a publish,
allow ~10 minutes before judging the live site.

---

## 4. Why the builder feels broken — measured, not opinion

1. **Per-SKU kits, no component library.** Across 1,304 kits: **67 physical bodies carried as 1,166 distinct
   body images — 17.4 cut-outs of the same glass per bottle.** Empire 50 ml clear: 41 kits, 41 body images,
   17 pixel sizes, 20 different `seatY` values.
2. **The artwork was shot for CAPPED photos.** What sits under the cap was never QA'd: retouch cover patches,
   rollers fused into the glass, white studio ground inside glass layers, interleaved Photoshop layers.
3. **Every gate checks the ASSEMBLED image on WHITE** (`alpha_gate`, `parity` ≤ 6/255). By construction they are
   blind to what the builder reveals: cap off, on the bone stage. The stage is exactly **`#eeebe5`**
   (`.preview` in `src/components/bottle-builder/Builder.module.css`, which also sets `isolation: isolate` —
   so the stage itself is the backdrop any multiply blends against). My review sheets used `#EDE9E2`, a close
   approximation; use the real value.
4. **No shared scale or datum.** Each bottle fills its own 1000×1100 canvas (5–22 px/mm). `seatY` has three
   conventions. Boston 15 ml Clear is 4.8% wider than Amber/Cobalt (different photographs).
5. **The cap mismatch Jordan screenshotted** (Boston 60 ml Cobalt, gold cap off-centre): `registerVintagePreview`
   keeps one fixed body and maps the other SKU's top onto it using each body part's **`bounds`** — the alpha
   bounding box. Those are not the glass: **185 of 1,304 kits are off by >12 px** (Round 78, Sleek 60, Boston 37,
   plus 10 across Elegant/Royal/Vial), usually an invisible smear left by the white-ground matte. That kit
   assembles perfectly from its own parts; its stored box is centred ~70 px off the glass.
6. **Published kits that still don't reach the builder:** ~18/family roller kits with no roller part (Flair,
   Rectangle, Royal, Sleek, Tulip — those masters have two layers, glass + cap); and **64 kits with
   `seatY == baselineY`** (extractor takes the seat from the bottom of the first non-body part; a dip tube
   hangs to the foot). Every Cylinder kit uses `seatY == body.top`. **Not fixed** — a blanket correction
   changes framing of reviewed Boston/Empire kits. Tool: `scripts/paperdoll/correct_kit_seat_anchor.py`
   (dry-run by default). The extractor change sits in git stash `seat-anchor-proposal-2026-09-19`
   (sha `f1f50ae8…`). Apply by sha, never `git stash pop`.

**The recommendation Jordan agreed with:** one canonical body per (family, size, glass) + one image per
component per neck finish, each with a neck datum and real scale; the builder composes body + fitment + cap.
Per-SKU kits stay for the product pages, which is what they are good at. Add a builder-stage gate (cap off,
on bone) and a family allowlist.

---

## 5. The pilot so far (Empire 50 ml clear, `empire-50ml-clear-18-415`)

Script: `scripts/bottle-builder-pilot/empire50_component_pilot.py` — reads `dist/`, publishes nothing.
Output numbers: `dist/paper-doll/empire50-pilot.json`.

- 41 published kits. Canonical body chosen: **`LBEmp50LtnMtGl`** (cleanest body box). Datum on solid alpha
  (≥128): finish top y=303, centre x=497.5, finish width 101 px.
- Seating every kit's body on that neck datum: **body IoU median 0.9785, worst 0.9233**; foot offset median
  7 px, worst 27; width diff median 3, worst 11. By fitment: Lotion Pump 0.9996, Tassel 0.989, Spray Pump
  0.980, Bulb Sprayer 0.975, Dropper 0.959, **Reducer 0.938**.
  → **The neck-finish top is a poor landmark**: each body layer is cropped at a different height under its
  collar. **Glass diameter + baseline on SOLID alpha are the sturdier landmarks** (the existing code comment in
  `preview-registration.ts` says the same; its mistake is using polluted `bounds`). Use those for seating.
- Sheet: `public/reviews/builder-review-2026-09-19/empire50-component-pilot.jpg` — left of each pair = the SKU's
  own photograph (bottle changes size per fitment); right = canonical body + component (bottle never moves).
- **Known defect:** the tassel sprayer's tassel is clipped at the canvas edge — a 1000×1100 canvas is too small
  for hanging parts once re-seated. The component canvas needs margin.
- Noticed, not addressed: the copper spray-pump part carries a white retouch scribble above the cap (visible
  on bone). Same class of defect as the Boston roller patch.

### Sunburst body — results (one run, ~$0.06, 32 s)
Assets preserved at `docs/handoffs/assets-2026-09-20/`:
`empire50-canon-body.png` (truth, RGBA 1000×1100), `empire50-input.png` (what the model saw, 1008×1104 on
white), `empire50-sunburst-raw.png` (model output), `empire50-sunburst-fitted.png` (fitted + clipped).
Sheet: `public/reviews/builder-review-2026-09-19/empire50-sunburst-body.jpg`.

| | IoU vs truth | outline distance p95 / max |
|---|---|---|
| as generated (2.4% shorter, 1.3% narrower) | 0.9649 | 14.1 / 16.3 px |
| uniform fit | 0.9789 | 5.9 / 9.2 px |
| fit to true box (1.1% anisotropy) | 0.9873 | 3.6 / 6.4 px |

**It fails our gate** (policy: IoU ≥ 0.995, ≤ 4 px at 2080×2288 ≈ 2 px at this canvas). The glass itself is far
better than the source photo. **The model does not hold size — the outline must come from the photograph.**

Use a **symmetric boundary distance** (distance transform between outlines) as the deviation metric. A row-wise
left/right-edge metric explodes at the shoulder and is meaningless — I made that mistake first.

---

## 6. The recipe Jordan approved — UNTESTED, prove it first

"Outline from the photograph, glass from the model":

1. Truth silhouette `T` = solid alpha (≥128) of the canonical body part.
2. Generate with `gpt-image-2.5-sunburst`, `/v1/images/edits`, `background: transparent`, `quality: high`,
   `output_format: png`. **Sizes must be multiples of 16 and 655k–8.3M px**: pad 1000×1100 → **1008×1104** with
   white, crop the result back to 1000×1100. Key is `OPENAI_API_KEY` in `.env.local` (never print it).
   Edits calls can return **HTTP 403 "organization must be verified"** intermittently — that is an account gate.
3. Fit the output to `T`'s box (centre + baseline), then scale it **up a further 1–2%** so the generated
   silhouette ⊇ `T` everywhere.
4. **Clip alpha to `T`.** Clipping can only trim, never add — that is why step 3 must oversize. (In my run, plain
   fit-and-clip left gaps up to ~6 px where the generated glass was smaller than the truth.)
5. Gate: after clipping, IoU(T, result) must be ~1.000 and there must be **no transparent gaps inside `T`**
   (check `alpha ≥ 128` covers `T`). Also eyeball the interior: wall lines will be ~1–2% off the real ones,
   which should be invisible — confirm, don't assume.
6. Clear glass is composited with **multiply** onto the stage. A transparent-background output has an opaque
   interior; check how it reads both as multiply-on-bone and as plain alpha-on-bone before choosing.

Policy that applies (`feedback_gpt_image2_enhancement_policy.md`): model output is a **recreation** — shape
immutable, mandatory silhouette QA, failures are **re-run, never hand-fixed**. It is acceptable here only because
a component-model body needs **no pixel parity with any plate**. It must never be written into a per-SKU kit.

---

## 7. Running the builder locally

`.env.local` → DEV Convex, which lacks `productKits:forSkus`, so `/matrix` crashes. I wrote a gitignored
`.env.development.local` containing only `NEXT_PUBLIC_CONVEX_URL=https://precise-raccoon-123.convex.cloud` so the
local server READS production kits. No writes are made through it. **Delete that file to go back to dev.**
`NEXT_PUBLIC_CLERK_ENABLED=false` is already set in `.env.local`.

- Start/attach: the `next-dev-3040` config in `.claude/launch.json` (port 3040). Never run dev servers via bare Bash.
- URL: `http://localhost:3040/matrix?family=Empire`
- Vercel PR previews sit behind a login wall — you cannot verify there. Verify locally or on staging after merge.
- A dev server killed mid-write leaves corrupt `.next/dev/types/*.d.ts` that fail `tsc`: `rm -rf .next/dev/types`.
- Right after branching onto newer main, "Module not found" = run `npm install` (main added `next-intl`).

For the local pilot, the existing hook is `BUILDER_LOCAL_KITS` in `server.ts` (`kitFor()` → a staged `kits.json`
whose part URLs live under `public/local-kits/`; `model.ts` accepts `/local-kits/` URLs). Staging script:
`scripts/paperdoll/local-kit-overlay.mjs`. That hook injects **per-SKU kits**; a true component model will need
its own data path (suggestion in §9).

---

## 8. Rules — these are not optional

- **Never sign an approval.** Approvals are Jordan's. `scripts/paperdoll/reissue-kit-approval.mjs` without
  `--actor` PREPARES one (`approvedBy: "PENDING — Jordan Richter"`). With `--actor` you record HIS words, quoted.
  The auto-mode classifier blocks self-approval, correctly.
- **Nothing reaches production without a release-specific ship phrase from Jordan in chat**, after he has seen a
  same-zoom before/after. Approval in one context does not carry to the next.
- Every visual change needs a **same-zoom before/after in his hands** (`SendUserFile`), plus a metric.
- **Parity cannot judge anything under the cap.** If the work is cap-off, it has to be LOOKED at, on the stage colour.
- "0 Image unavailable" is **not** proof a tile is right. I shipped stretched bottles that way. Look at it.
- **Never run a white-keyed matte on white plastic** (`strip_retouch_patch.py` is for the steel-ball photo only;
  that file and `build_boston_roller_set.py` reached main with #206 — merge `origin/main` to get them here),
  and never on clear/frosted glass (`matte.py` says so itself).
- **Do not "fix" `alpha_gate`.** Its comment says "ink", its code tests `alpha > 0`, and the code is right — I
  changed it and reverted (4f4f4552 → cb814f47). White ground is invisible on white.
- Product identity comes from the **catalogue** (`applicator`, `family`, …), never from a SKU's spelling or a filename.
- Never fabricate a component. Scaling a real photograph of the same physical part to a measured landmark is fitting.
- Convex: dev is shared — additive writes only, never `--replace`; never `convex dev`/deploy from a worktree.
- Git: never `git add -A`; never commit `.claude/launch.json`; never bare `git stash`/`pop` (the stash stack is
  shared across worktrees — tagged push, apply by sha); branch before committing; commit/push only when asked or
  clearly part of the task; end commit messages with the `Co-Authored-By` line the harness gives you.
- `record-kit-release.mjs --dir` **overwrites**. Published releases own `docs/reviews/<fam>-kits-2026-09-19`.
- Build work lists from the **batch**, not from a previous step's output (Diamond's 41 rows were nearly lost that way).
- CI green ≠ Vercel green. Wait for both before any merge.

---

## 9. Suggested plan for the build (yours to improve)

1. **Prove the Sunburst recipe (§6) offline first.** Extend `empire50_component_pilot.py` or add a sibling. Deliver
   a sheet: truth | generated | oversized+clipped, with IoU and boundary distance. Re-run the model if it fails;
   don't hand-fix. Stop and show Jordan before wiring anything.
2. **Define the component data**, e.g. `src/lib/bottle-builder/components.pilot.json`:
   body `{ image, canvas, datum: { axisX, baselineY, glassWidth, seatY } }`; components keyed by
   `(applicator, finish/cap colour)` with `{ parts[], datum }` expressed relative to the body's landmarks.
   Seat by **glass width + baseline on solid alpha**, not by the neck-finish top, and never by `bounds`.
   Give the canvas margin for hanging parts (tassel).
3. **Local-only render path**, behind an env flag (e.g. `BUILDER_COMPONENT_PILOT=empire-50`), so production is
   byte-for-byte unaffected. Smallest touch: a branch in `BuilderImage`/`MatrixClient` that, for that one body,
   draws canonical body + component layers instead of kit layers. Keep #208's rule: the multiply lives on the
   OUTERMOST wrapper (any `transform` or `container-type` ancestor seals a blend).
4. **Verify in a browser**, cap-on and cap-off, every Empire 50 ml fitment; capture before/after at the same zoom
   against today's builder. Playwright MCP can save screenshots to a file; when scripting clicks, scope to
   `main button` — a bare `/^30 ml/` matches the navbar's capacity shortcut and navigates away.
5. Tests live in `tests/bottle-builder-*.test.ts(x)` (99 passing on the #208 branch). jsdom cannot lay out, and it
   **folds `calc()`** even in serialised style attributes — assert structure, parse both forms.
6. Checks before any PR: `npx tsc --noEmit` (bare — never filter `tests/`), `npx eslint <files>`,
   `npx vitest run tests/bottle-builder-*.test.ts tests/bottle-builder-*.test.tsx tests/bottle-builder.test.ts tests/builder-image-placeholder.test.tsx tests/mobile-bottle-builder.test.tsx`.

---

## 10. Open items Jordan knows about (not yours unless he says)

- Review the 10–11 families that auto-enrolled in the builder; decide on an allowlist.
- `seatY` convention (64 kits refused) and roller kits with no roller part (~90) — need a before/after + decision.
- 185 kits with body `bounds` that aren't the glass — a metadata correction would be a production write.
- Boston 15 ml Clear is 4.8% wider than Amber/Cobalt — asset normalisation, with a before/after.
- The clear-glass cut-out idea (model alpha as a SEED, snapped to the photograph's real edges) — could recover
  part of the 139 white-ground holds (69 of 73 measured are clear/frosted). Not built; one bottle tested: the
  model's mask clipped 4.2% of the real bottle.
- PDP backlog, 444 bottles without a kit: filename≠SKU 28 (cheap — a confirmation sheet for Jordan), placement
  never solved 53, interleaved layers 105, white ground 139, no separable parts ~65. Realistic ceiling ≈ 88%.
- His set-aside Footer edit: `~/Desktop/footer-dirty-change-2026-09-19.patch` — no longer applies (main rewrote
  the Footer to key-based entries); the top banner already says "$50 minimum".
- DEV Convex missing `productKits:forSkus`.
- Dev carries 24 `kit_stale_plate` rows (Cylinder/Spry); all 24 have a working kit on prod.

---

## 11. Useful read-only tools

```bash
# per family: bottles offered, kit-backed configs, tiles with nothing to draw (runs the REAL model code vs prod)
npx tsx scripts/debug/builder-chooser-probe.ts            # all families
npx tsx scripts/debug/builder-chooser-probe.ts Empire     # one family, per body

# why a published kit is rejected by the builder, check by check
npx tsx scripts/debug/builder-kit-dropouts.ts Empire Sleek

# production kit count + integrity (no auth needed for queries)
curl -s https://precise-raccoon-123.convex.cloud/api/query -H 'Content-Type: application/json' \
  -d '{"path":"productKits:integrity","args":{"cursor":null,"pageSize":500},"format":"json"}'

# what the live builder serves for one body
curl -s "https://best-bottles-website.vercel.app/api/bottle-builder/kits?family=Empire&bodyId=<bodyId>"
curl -s "https://best-bottles-website.vercel.app/api/bottle-builder/families"
```
`tsx` scripts must live under the repo (they import `convex/_generated/api`); they fail from `/tmp`.
Python: `/opt/homebrew/bin/python3` with `PYTHONPATH=scripts/paperdoll`.

Kit pipeline (for reference, not needed for the pilot): `assemble_plate_batch.py` (build the batch FROM the
published plates) → `reuse_solved_registration.py` → `solve_plate_registration.py --fine --coarse-scale 4`
(71 s/row → 9.6 s/row, validated bit-identical) → `split_batch_by_family.py` → `family_part_map.py` →
`build_master_kits.py` → `kit_review_sheet.py` → `reissue-kit-approval.mjs` → `publish-master-kits.mjs`
(dry-run by default; needs the ship phrase) → `record-kit-release.mjs`.

---

## 12. First message to send Jordan

Tell him, briefly: you have read the handoff; you will first prove the oversized-and-clipped Sunburst body on
the Empire 50 ml with a sheet and numbers; nothing will be published; and you'll show him before wiring it into
the local builder. Then do exactly that.

## 0e. Empire sprayer kits rebuilt with exposed pumps — PREPARED, not published (2026-09-20)

Eleven of the twelve Empire perfume-sprayer kits had no pump part at all: the capped PSD shows only the
cover, so the extractor filed the cover as `sprayer` (and, at 50 ml, the dip tube as `overcap`).
`scripts/paperdoll/build_empire_pump_kits.py` reads roles from geometry, adds the library pump
(`20. Caps/7. 18-415 Sprayers`) seated on the uncapped twin's pump footprint as `sprayer`, and files the
cover as `overcap` in its assembled position, so `BuilderImage.tsx`'s existing sidecar rule takes over.
`GBEmp100SpryCu` keeps its own photographed pump. Copper's cover loses the retoucher's white shards
(white-keyed matte on that one finish only). All twelve pass alpha and parity against the live plates.

- Batch: `dist/paper-doll/empire-pumps-2026-09-20/kits` (approval PENDING — Jordan)
- Sheets: `public/reviews/builder-review-2026-09-19/empire{50,100}-pump-kits-before-after.jpg`
  (`scripts/paperdoll/empire_pump_kits_sheet.py`)
- Record: `docs/reviews/empire-pumps-2026-09-20/`
- Prod dry-run clean: 12 plate hashes verified, 48 part objects. Ship phrase: `ship Empire exposed pumps 2026-09-20`
- Known, accepted: 4 kits have a 1–2 px pump sliver at the cover's anti-aliased edge (22–286 px); parity unaffected.

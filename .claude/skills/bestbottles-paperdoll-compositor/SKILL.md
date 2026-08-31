---
name: bestbottles-paperdoll-compositor
description: Use when compositing Best Bottles catalogue imagery from the layered Photoshop sources - running a neck-finish family (bottle + caps + rollers + sprayer + pump) onto the bone studio canvas, checking alignment and site coverage, and filing the result for Sanity upload. Triggers on "run the family", "composite the 17-415 set", "paper-doll batch", "next finish", or any request to produce or re-run catalogue product images from the PSD library.
---

# Best Bottles Paper-Doll Compositor

One family at a time, always in this order. Each step has a command and a gate.
Do not skip the gates: every defect this pipeline has shipped was caught by one
of them, and every one that reached the founder was a gate that had not been
written yet.

## Source hierarchy — check in this order

**1. Prepared assets FIRST.** `pipeline/aios-shopify-pdp-images/00-input/reference-flattened/`
holds 267 sets / 1,724 images already cut, cleaned and named to the graceSku
crosswalk: `{graceSku}__{websiteSku}__pdp-main__v001.png`, 750×1594 on white.
They cover **1,712 of 2,290 live SKUs (75%)**. The metal rollers here already
have the white retouch blotch removed — do not re-solve that.

**2. PSD extraction only for the gaps.** The remaining ~578 SKUs (Boston Round
123, Sleek 38, Tall Cylinder frosted 30, Tulip 29, Elegant frosted 28) have no
prepared asset and need layer extraction from the Original Photoshop Sources.

Always run a coverage check before extracting anything. Two full rounds were
spent rebuilding cleanup that already existed.

| what | path |
|---|---|
| prepared assets (source of truth) | `pipeline/aios-shopify-pdp-images/00-input/reference-flattened/` |
| PSD fallback | `~/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources/` |
| compositor | `pipeline/paper-doll/scripts/composite_psd_family.py` |
| site validator | `pipeline/paper-doll/scripts/validate_against_site.py` |
| alignment gate | `pipeline/paper-doll/scripts/audit_alignment.py` |
| dims per body | `pipeline/paper-doll/body-dims.csv` |
| page cache | `/tmp/bb_live_cache/` |
| output | `pipeline/paper-doll/canvas/<family>-<state>/` |

**Never composite from `pipeline/paper-doll/reference-images/`** — a copy with
28 extra generated files. **Never use anything under `composites/`** — those are
`CYL-UNK-*` derivatives of unresolved provenance.

## The loop — one command per family

```bash
python3 pipeline/paper-doll/scripts/run_family.py \
    --folder "17-415 Bottles/9. Clear  (Uncapped)" \
    --finish 17-415 --key CYL-9ML-CLR --validate-token Cyl9
```

It composites all three states, gates alignment on each, checks coverage against
the live site, writes `canvas/<key>-report.json`, and **exits non-zero if any
gate fails** — a bad family cannot quietly reach the catalogue. `--dry-run`
shows the steps without touching anything.

## 1 · Pull the bottle and its components

Identify the neck finish and its PSD folder. Colour subfolders hold the SKUs;
`(Capped)` and `(Uncapped)` are sibling folders of the same products.

```bash
python3 scripts/build_source_manifest.py --finish 17-415
```

Gate: the manifest's body count matches the folder, and no `composites/` paths
appear.

## 2 · Line it up — THE PLACEMENT RULE

**Layer position comes from `l.left` / `l.top`, never `im.getbbox()`.**
`getbbox()` returns coordinates inside the layer's own cropped image, so every
layer reads as (0,0) — that false reading caused most of this pipeline's
placement bugs before it was found.

With true offsets the catalogue's own convention decides everything:

| drawn | means | placement |
|---|---|---|
| **on the bottle axis** | fitted to the bottle (roller, sprayer actuator + collar, pump) | composite AT ITS TRUE POSITION — it is already correct |
| **beside the bottle** (dx ≫ 0) | removable, laid out for the shot (caps, overcaps) | anchor to the neck |

Never classify by width. A sprayer collar is 229 px against a 182 px neck, so a
width test called it a removable overcap and dropped the whole sprayer.

**Source per state (A2).** For `on`, use the `(Capped)` sibling folder: the cap
there is already drawn on the bottle axis by whoever made the original, so no
seat depth is needed. Seat depth is drawing-backed for only four finishes
(13-415, 15-415, 17-415, 18-415); everywhere else it is a 14 mm default, so a
drawn position is strictly better. `off` and `bare` come from `(Uncapped)`,
where the roller/sprayer/pump is visible rather than hidden under a cap.
Anything with no capped sibling falls back to anchoring and is reported.

A capped source puts EVERY layer on-axis, so the fitted/removable filter must
not run on it — keep its layers verbatim.

**Non-front views (A3).** The library mixes `*Side`, `*Depth`, `*Aerial` studies
in with the packshots (138 files, mostly in `Aerial and Side views - various
bottles/`). They composite happily and pass the gates as badly-framed fronts.
Filter by token and by that folder.

Three states, all three shipped:
- `bare` — glass only
- `off` — the fitted assembly (roller / sprayer / pump), no removable cap
- `on` — the removable closure

## 3 · Make sure it matches the site

```bash
python3 scripts/validate_against_site.py --family Cyl9
```

The PDP swatch strip is the authority on how many variants exist — the 9 ml
metal roll-on lists 10 caps. If the composited count is short, the gap is real:
either a missing PSD or a filter dropping a layer.

## 4 · Run the whole family

Only after a spot family passes steps 2–3. Capped-only, falling back to
uncapped where no capped source exists.

## 5 · Check alignment

```bash
python3 scripts/audit_alignment.py --dir canvas/17-415-on
```

Gates:
- foot line spread ≤ 10 px (all bottles stand on the same line)
- centre axis spread ≤ 12 px
- no composite reads > 18 levels brighter than the canvas at mid-body
  (that means glass was left opaque instead of transmitting)

Measure invariants only. Do NOT compare "body width" with a contrast mask —
a contrast mask cannot see transparent glass, and that produced a phantom
320 px spread on composites that were actually fine.

## 6 · File for Sanity

Name as `{websiteSku}__{state}.png`, 2080×2288, into
`pipeline/paper-doll/canvas/<family>-<state>/`. Publishing follows the
madison-hero-sync lane — **this skill does not push to Sanity, Shopify or
Madison.**

## Hard-won rules

**Per-glass keying.** Clear is white because it TRANSMITS; frosted is white
because it DIFFUSES. Keying both the same strips frosted of its body. Strengths:
clear 1.00, swirl 0.85, amber/cobalt/green 0.25, frosted 0.12, black 0.10.

**Glass token comes from the SKU PREFIX**, before the capacity digit.
`GBCyl9Roll**Blk**Dot` is a CLEAR bottle with a black cap. Matching anywhere in
the stem made six clear bottles render opaque.

**Never harmonise closures.** Silver, gold, copper and black ARE the product.
Normalising a matte-silver cap's white point blows its highlight rolloff and it
stops reading as metal. Harmonise glass only.

**Draw order is assembly order** — inserts before overs, or the roller paints
on top of its own cap.

**Search before you build.** The metal-roller white blotch, the studio rig, the
component meshes and the glass canon all already existed and were rebuilt from
scratch before being found. Check `reference-flattened/`, `paper-doll-3d/` and
Madison `tmp/` before writing extraction or cleanup code.

**Clean fused layers, don't drop them** (PSD fallback path only). Metal-roller
PSDs carry the roller and a flat white retouch card on one layer, 353 px against
a 253 px body. Dropping it loses the roller entirely. Keep the structured
component containing the darkest pixel. Prefer the prepared asset, where this is
already handled.

**No ground horizon.** The contact shadow grounds the bottle; a floor line reads
as an obstruction across the frame.

**Shadow is derived, never painted** — a squashed, blurred projection of the
bottle's own alpha footprint, so a shaped body throws its own shape.

**Read the layer stack before changing a filter.** Two rounds were lost guessing
at PSD structure; one `psd_tools` dump found the real answer immediately.

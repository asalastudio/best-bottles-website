# Best Bottles PDP Pipeline — Quick Reference

One-page map of every artifact built during the reference-locked PDP
rewrite. File paths are relative to the repo root
`/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026`.

## What the system does

Takes the Best Bottles catalog (2,285 SKUs across 23 families × 12
closure classes × 8 glass colors) and renders editorial-quality
2080×2288 product images for each, using a per-family + per-closure
prompt composer and a 19-check QA gate.

## Core artifacts

```
pipeline/image-gen/sku-lock/                          (sidecar config)
  README.md                                          schema + taxonomy
  schema.json                                        JSON Schema (draft-07)
  glass-behaviors/                                   §2 lighting per behavior
    clear.json
    colored_clear.json
    frosted.json
    swirl.json
    apothecary.json
    novelty.json
  families/                                          per-family defaults
    apothecary.json, boston-round.json, circle.json, cylinder.json,
    decorative.json, diamond.json, diva.json, dropper.json, elegant.json,
    empire.json, flair.json, grace.json, rectangle.json, roll-on-cap.json,
    royal.json, round.json, sleek.json, slim.json, spray-bottle.json,
    sprayer.json, square.json, vial.json
  families/_closures/                                per-closure overrides
    apothecary_stopper.json, atomizer.json, dropper.json, fine_mist_spray.json,
    lotion_pump.json, phenolic_cap.json, reducer.json, roll_on.json,
    screw_cap.json, vintage_bulb.json, with_overcap.json, with_tassel.json
  style-references/                                  (drop here after shoot)
    SHOOT_BRIEF.md                                   photographer's brief

pipeline/image-gen/grid-images/scripts/              (generator + QA)
  prompt_composer.mjs                                resolves sidecars → 4-section prompt
  generate_openai_grid_images.mjs                    main generator (--sku-lock default ON)
  qa_gate.mjs                                        15 manifest checks + 4 image checks
  pre_render_check.sh                                one-command pre-render sanity check
  test_composer.mjs                                  composer-only test, 16 fixtures
  EMPIRE_SMOKE_TEST.md                               step-by-step first live render
```

## Resolution order

For any job the composer reads sidecars in this order, each layer
overriding only the slots it sets:

1. `pipeline/image-gen/grid-images/scripts/prompt_composer.mjs` defaults
2. `families/<family>.json` — per-family geometry
3. `families/_closures/<closure-class>.json` — per-closure geometry + forbidden mutations
4. `families/<family>/<slug>.json` — per-SKU override (rare, long-tail only)
5. `glass-behaviors/<behavior>.json` — §2 lighting block

The composer also auto-infers `glassBehavior` and `glassColor` from the
job's `itemName` text when the catalog's color column is empty (every
CSV row currently).

## The four prompt sections

Every generated prompt has exactly:

1. **NON-NEGOTIABLES** — geometry, component stack, framing
2. **PHYSICAL SETUP** — camera, lens, lighting, background (from glassBehavior)
3. **STYLE TARGET** — aesthetic anchor (Aesop / Le Labo / Malin+Goetz)
4. **PRIORITIZED NEGATIVES** — 10 forbidden mutations, ranked

## Closure classification (12 classes)

```
apothecary_stopper  → glass stopper in neck, NO collar, NO sprayer
with_overcap        → pump + clear overcap DETACHED to the right
lotion_pump         → tall pump, NO overcap
fine_mist_spray     → white plastic actuator + nozzle face
vintage_bulb        → rubber squeeze bulb on polished metal collar
with_tassel         → vintage_bulb + decorative fabric tassel
roll_on             → flush cap with roller ball underneath
dropper             → rubber bulb + glass pipette extending down
reducer             → tall phenolic screw cap with insert
atomizer            → metal cap + soft squeeze bulb
phenolic_cap        → plain black phenolic screw cap
screw_cap           → plain screw cap (gold/silver/black, etc.)
```

## Daily workflow

```bash
# 1. Pre-render sanity check (no API spend)
bash pipeline/image-gen/grid-images/scripts/pre_render_check.sh \
  --family Empire --limit 5

# 2. If PASS, render for real (drop --dry-run)
node pipeline/image-gen/grid-images/scripts/generate_openai_grid_images.mjs \
  --family Empire --limit 5 --export-psd-refs \
  --output-root /tmp/sku-lock-empire-render

# 3. QA gate (manifest + images)
node pipeline/image-gen/grid-images/scripts/qa_gate.mjs \
  --manifest /tmp/sku-lock-empire-render/_generation-manifest.json \
  --raw-dir /tmp/sku-lock-empire-render/raw
```

Or for a custom slice (no Convex required):

```bash
# Build a dense jobs JSON from the CSV
node -e "/* see test_composer.mjs for fixture shape */" \
  > /tmp/my-jobs.json

# Pre-render check
bash pipeline/image-gen/grid-images/scripts/pre_render_check.sh \
  --jobs /tmp/my-jobs.json

# Render
node pipeline/image-gen/grid-images/scripts/generate_openai_grid_images.mjs \
  --jobs /tmp/my-jobs.json --output-root /tmp/render

# QA gate
node pipeline/image-gen/grid-images/scripts/qa_gate.mjs \
  --manifest /tmp/render/_generation-manifest.json \
  --raw-dir /tmp/render/raw
```

## Five-family rollout order

Per `pipeline/aios-shopify-pdp-images/README.md`:

```
Empire  →  Cylinder  →  Elegant  →  Circle  →  Diva
            (highest volume, run after Empire smoke test passes)
```

Then: Round, Sleek, Slim, Diamond, and the smaller families.

## QA gate summary

**Layer A — manifest checks (no image file):**
A01 promptSource = sku-lock-composer
A02–A05 all four prompt sections present
A06 no unresolved `{{vars}}`
A07 no empty "Material truth — ." lines
A08–A10 closureClass / glassBehavior / glassColor valid enum values
A11 behavior × color alignment (cobalt→colored_clear, etc.)
A12 capState matches closureClass expectations
A13 forbidden-applicator rule present in §4
A14 "tassel" in prompt when closureClass = with_tassel
A15 Apothecary closures properly forbidden

**Layer B — image checks (per rendered PNG):**
B10 exact 2080×2288 dimensions
B11 PNG format
B12 background color within Δ of expected bgHex
B13 product coverage 3–75% of pixels

**Exit codes:** 0 all pass, 1 any failures, 2 manifest missing.

## Known data sources

| Source | Location | Coverage |
|---|---|---|
| Local CSV | `data/grace_products_final.csv` | 2,285 rows, all SKU metadata |
| Convex (Codex) | `helpful-elephant-638.convex.cloud` | live product catalog |
| Reference images | `pipeline/image-gen/grid-images/reference/<family>/` | ~30 vetted PSD-derived PNGs |
| PSD masters | `pipeline/paper-doll/reference-images/` | full archive |

When Convex is unreachable, the generator falls back to the CSV.

## Background hex (known issue)

The legacy `generate_openai_grid_images.mjs` hardcodes `#EEE6D4` (line
42, `BONE` constant). The new pipeline uses `#F5F3EF`. Outputs are still
emitted at 2000×2200 (legacy size), but the new aios-shopify-pdp-images
pipeline emits at 2080×2288. The unification fix is queued.

## Status

| Artifact | Status |
|---|---|
| Sidecar schema + composer | Live in generator |
| 23 family defaults | Live |
| 12 closure-class overrides | Live |
| 6 glass-behavior lighting blocks | Live |
| QA gate (Layer A + B) | Live |
| Pre-render sanity check | Live |
| Empire smoke-test runbook | Live |
| Style-reference shoot brief | Live (photographer delivers → wire into family defaults) |
| Background hex unification | Queued |
| Per-SKU long-tail overrides | Queued (only if closure-class files don't fit) |
| Convex batch pipeline wiring | Queued (after first live render validates the prompts) |
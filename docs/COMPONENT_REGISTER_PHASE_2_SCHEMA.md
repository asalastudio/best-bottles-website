# Component register — Phase 2: schema proposal

**Status: PROPOSAL, awaiting Jordan's approval (2026-09-25).** Nothing in `convex/` has changed,
no Convex deployment has been touched, no data has been written. Phase 2 ends when the
decisions in §9 are made; only then does the schema land in `convex/schema.ts`.

Phase 1 (PR #255) produced `data/register/` — bodies, components and assemblies keyed by neck
finish and graceSku, with Jordan's rulings in `rules.json`. Phase 2 turns that register into
Convex tables that the anchor tooling (Phase 3), the renderer (Phase 4) and the 9 mL Cylinder
pilot (Phase 5) read from.

## 1. Inputs this proposal is built on

Approved on 2026-09-25:

- Convex `bodies` / `components` / `assemblies` are **loaded from the register**, never edited by hand;
  the register (CSV + `rules.json` in git) stays the source of truth.
- Components may be **non-products** (roller inserts, `415Reducer`, vial wands) as well as sellable SKUs.
- `productKits` / `productPlates` **stay** for the PDP and Build Your Bottle until the new renderer
  passes a pixel-diff parity gate on the pilot.
- Render canvas **2080 × 2288** (10:11, the locked hero frame); components stored at **native PSD
  resolution + px/mm**. The builder keeps drawing at 1000 × 1100 (also 10:11).
- Assets stay on **Vercel Blob** for the pilot; `storageProvider` already admits `"r2"` so the
  Cloudflare move is a field value, not a schema change.
- Pilot = **17-415 Cylinder 9 mL**.

From the brief: graceSku is canonical; one transparent base plate per body; fitments and caps are
separate layers placed at recorded anchors; components are never fused into a body image; no
AI-generated bottles; unclassifiable layers go to quarantine; no Sanity.

## 2. The model in one paragraph

A **body** is a physical bottle (family × capacity × neck, colour-agnostic). Each body has one
**body plate** per glass colour: the bare, cap-off glass as a transparent image at native resolution
with its px/mm and three anchors (closure axis, neck seat, foot). A **component** is a closure or
fitment (a product, or a library-only part) with one or more **layers**, each a transparent image at
native resolution with its own px/mm and one anchor: the point on the layer that lands on the body's
neck seat. An **assembly** is a sellable graceSku = one body plate + the specific component layers
that make that SKU (its *own* cap and fitment), plus the neck's full compatibility list for the
builder. The renderer (Phase 4) scales every image to a common px/mm, stacks layers by z-order,
and places the seat points on top of each other. Nothing is ever baked together.

## 3. Tables

Naming uses a `register` prefix so nothing collides with `productPlates`, `productKits`,
`plateFamilies` or the `catalogComponent*` modules (decision 9.1). Validators below are the
proposal; they reuse `plateAssetV` and `kitSlotV` already defined at the top of `convex/schema.ts`.

### 3.1 `registerBodies` — one row per physical body (97 today)

```ts
registerBodies: defineTable({
    bodyId: v.string(),                       // "[shape-]profile-<capacity>ml-<neck>"  e.g. cylinder-9ml-17-415
    builderBodyId: v.string(),                // mirrors builderBodyIdentity() in src/lib/bottle-builder/model.ts
    family: v.string(),                       // Cylinder, Boston, Empire, …
    shape: v.union(v.string(), v.null()),     // Swirl, Pillar, … when the family has more than one silhouette
    capacityMl: v.number(),
    neck: v.string(),                         // "17-415", "18-415", "20-400", "Ground", …
    category: v.string(),                     // Convex category the body was read from
    compatibilityClass: v.string(),           // glass-<neck> | plastic-bottle | metal-atomizer | aluminum-bottle | glass-jar | cream-jar | assumed-by-category
    classSource: v.string(),                  // "glass shares components by neck finish" | "jordan-2026-09-24" | …
    glassVariants: v.array(v.string()),       // canonical glass colours (CANONICAL_GLASS_COLORS)
    fitmentTypes: v.array(v.string()),        // fitment vocabulary the body is sold with
    dims: v.object({
        heightBareMm: v.union(v.number(), v.null()),   // bare glass — never the assembly
        diameterMm: v.union(v.number(), v.null()),
        widthMm: v.union(v.number(), v.null()),
        depthMm: v.union(v.number(), v.null()),
        confidence: v.union(v.literal("verified"), v.literal("high"), v.literal("low"), v.literal("none")),
        source: v.string(),
    }),
    representative: v.object({ graceSku: v.string(), websiteSku: v.string() }),
    status: v.union(v.literal("current"), v.literal("retired")),
    register: registerStampV,                 // { builtAt, snapshot, source, confidence }
})
    .index("by_bodyId", ["bodyId"])
    .index("by_neck", ["neck"])
    .index("by_compatibilityClass", ["compatibilityClass"]),
```

### 3.2 `registerBodyPlates` — one row per body × glass colour (≤ 5 per body; 5 for the pilot)

This is the table that removes the duplication: the pilot body carries **145 cap-off plates** today
(one per SKU) and will carry **5** here.

```ts
registerBodyPlates: defineTable({
    plateKey: v.string(),                     // `${bodyId}|${glass}`  e.g. "cylinder-9ml-17-415|Cobalt Blue"
    bodyId: v.string(),
    glass: v.string(),                        // canonical glass colour
    image: plateAssetV,                       // transparent bare glass, native resolution (url, key, sha256, bytes, width, height)
    thumb: v.union(plateAssetV, v.null()),
    pxPerMm: v.number(),                      // measured on this image; bodies.dims × pxPerMm must land on the anchors
    anchors: v.object({
        axisX: v.number(),                    // closure axis, plate px
        seatY: v.number(),                    // neck seat — the 2D BB_ATTACH_NECK
        baselineY: v.number(),                // foot
        shoulderY: v.union(v.number(), v.null()),  // top of the glass; used by hero sizing, optional here
    }),
    anchorStatus: v.union(v.literal("unmeasured"), v.literal("measured"), v.literal("approved")),
    anchorMeasuredBy: v.union(v.string(), v.null()),   // tool name + version, or a person, from Phase 3
    source: v.object({ library: v.string(), path: v.string(), psdSha256: v.union(v.string(), v.null()), layer: v.union(v.string(), v.null()) }),
    derivedFrom: v.union(v.string(), v.null()),        // productPlates.front.sha256 when cut from an existing cap-off plate
    storageProvider: v.union(v.literal("vercel-blob"), v.literal("r2")),
    revision: v.number(),
    importedAt: v.number(),
})
    .index("by_plateKey", ["plateKey"])
    .index("by_bodyId", ["bodyId"]),
```

### 3.3 `registerComponents` — one row per closure or fitment (176 today, 136 current)

```ts
registerComponents: defineTable({
    componentId: v.string(),                  // graceSku for products; "LIB-<neck>-<psdStem>" for library-only parts (decision 9.2)
    graceSku: v.union(v.string(), v.null()),
    websiteSku: v.union(v.string(), v.null()),
    sellable: v.boolean(),                    // false for roller inserts, reducers, wands
    type: v.union(                            // register vocabulary, one value per row
        v.literal("cap"), v.literal("roll-on-cap"), v.literal("faux-leather-cap"),
        v.literal("fine-mist-sprayer"), v.literal("vintage-bulb-sprayer"), v.literal("tassel-bulb-sprayer"),
        v.literal("lotion-pump"), v.literal("dropper"), v.literal("plug-applicator"),
        v.literal("roller-insert"), v.literal("reducer"), v.literal("wand"),
    ),
    neck: v.string(),
    finish: v.object({                        // the vocabulary the storefront already filters on (src/lib/catalogFilters.ts)
        capColor: v.union(v.string(), v.null()),
        capStyle: v.union(v.string(), v.null()),     // Roll-On | Pump | Spray | Dropper | Dot Cap | …
        trimColor: v.union(v.string(), v.null()),
        dotted: v.boolean(),
        rollerMaterial: v.union(v.literal("metal"), v.literal("plastic"), v.null()),
    }),
    itemName: v.string(),
    psd: v.union(v.null(), v.object({          // master COMPONENT library only (BB-PSD-Files-Master/20. Caps, 21. Tassels)
        library: v.string(), path: v.string(), stem: v.string(),
        sha256: v.union(v.string(), v.null()),
        canvas: v.object({ width: v.number(), height: v.number() }),
        match: v.union(v.literal("exact"), v.literal("alias-map"), v.literal("case-insensitive")),
    })),
    layers: v.array(v.object({                // one entry per PSD layer that draws; empty until Phase 3 cuts them
        slot: kitSlotV,                       // cap | overcap | sprayer | pump | roller | diptube | collar | bulb | tassel | reducer | pipette
        layerName: v.union(v.string(), v.null()),
        z: v.union(v.literal("behind-body"), v.literal("front")),   // diptubes and pipettes draw behind the glass
        image: plateAssetV,                   // native resolution, transparent
        image2x: v.union(plateAssetV, v.null()),
        pxPerMm: v.number(),
        anchor: v.object({ x: v.number(), y: v.number() }),          // the point on THIS layer that lands on the body's (axisX, seatY)
        anchorStatus: v.union(v.literal("unmeasured"), v.literal("measured"), v.literal("approved")),
        explodeIndex: v.number(),
    })),
    status: v.union(v.literal("current"), v.literal("retired"), v.literal("quarantine")),
    statusReason: v.union(v.string(), v.null()),
    storageProvider: v.union(v.literal("vercel-blob"), v.literal("r2")),
    revision: v.number(),
    register: registerStampV,
})
    .index("by_componentId", ["componentId"])
    .index("by_graceSku", ["graceSku"])
    .index("by_websiteSku", ["websiteSku"])
    .index("by_neck", ["neck"])
    .index("by_neck_type", ["neck", "type"]),
```

### 3.4 `registerAssemblies` — one row per sellable bottle SKU (2,312 today, 2,016 verified)

Two different lists live here and must not be confused:

- `compatible` — the neck's full interchangeable set (what Build Your Bottle offers; the 19 items
  every 9 mL Cylinder lists).
- `build` — **this SKU's own parts**: the cap and fitment the photograph shows and the customer
  receives. This is what the renderer draws. It is derived, not copied (see §8.2).

```ts
registerAssemblies: defineTable({
    graceSku: v.string(),                     // canonical key
    websiteSku: v.union(v.string(), v.null()),
    bodyId: v.string(),
    plateKey: v.string(),                     // `${bodyId}|${glass}` → registerBodyPlates
    neck: v.string(),
    glass: v.string(),
    compatibilityClass: v.string(),
    fitmentType: v.union(v.string(), v.null()),      // storefront vocabulary: Metal Roller Ball, Fine Mist Sprayer, …
    capColor: v.union(v.string(), v.null()),
    capStyle: v.union(v.string(), v.null()),
    assemblyType: v.union(v.literal("2-part"), v.literal("3-part"), v.literal("complete-set"), v.literal("component"), v.null()),
    compatible: v.array(v.string()),          // componentIds resolved from the Convex components list (excludedByRule removed)
    unresolvedListed: v.array(v.string()),    // listed SKUs with no component record — keeps the row honest
    build: v.object({
        parts: v.array(v.object({ role: kitSlotV, componentId: v.string() })),   // e.g. [{cap, CMP-ROC-MSLV-17415}, {roller, LIB-17-415-MtlRollon}]
        status: v.union(v.literal("resolved"), v.literal("partial"), v.literal("unresolved")),
        reason: v.union(v.string(), v.null()),
    }),
    status: v.union(v.literal("verified"), v.literal("candidate"), v.literal("exception"), v.literal("quarantine"), v.literal("retired")),
    statusReason: v.string(),
    excludedByRule: v.array(v.string()),
    legacy: v.object({                        // what exists today, for the parity gate
        productKitSha256: v.union(v.string(), v.null()),
        capOffPlateSha256: v.union(v.string(), v.null()),
    }),
    register: registerStampV,
})
    .index("by_graceSku", ["graceSku"])
    .index("by_websiteSku", ["websiteSku"])
    .index("by_bodyId", ["bodyId"])
    .index("by_plateKey", ["plateKey"])
    .index("by_neck_status", ["neck", "status"]),
```

```ts
const registerStampV = v.object({
    builtAt: v.number(),                      // build_register.py run
    snapshot: v.string(),                     // "convex-products-2026-09-24.json.gz"
    source: v.string(),
    confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
});
```

### 3.5 What deliberately gets no table

- **Rulings** stay in `data/register/rules.json` (git history is the audit trail). The loader
  applies them into `compatibilityClass`, `excludedByRule` and `build.status`.
- **Quarantine** is a status + reason on each table, not a table. The 49 review items from the
  23 Sep matrices stay in `data/register/quarantine.csv` for triage with Jordan.
- **Neck finishes** are strings validated by the loader against `rules.json.necks`; a lookup table
  adds nothing until thread geometry (pitch, bore) is stored, which is Phase 3+ if ever.

## 4. Coordinate contract (what Phase 3 measures and Phase 4 consumes)

- Every image is stored at its **native pixel size** with **its own `pxPerMm`**. There is no shared
  canvas at storage time.
- A body plate's `anchors` are in that plate's pixels. A component layer's `anchor` is the one point
  on that layer that must coincide with the body's `(axisX, seatY)`.
- The renderer picks the output px/mm from the canvas (2080 × 2288) and the body's locked shoulder
  sizing, scales each image by `target / pxPerMm`, translates so anchors coincide, and stacks by
  `z` then `explodeIndex`. Scale is mm-true by construction; a 17-415 cap from a 552-px PSD and a
  2,000-px body plate meet at the seat at the same physical scale.
- `anchorStatus` gates rendering: **nothing renders from an `unmeasured` plate or layer**, and the
  pilot renders only from `approved` (decision 9.5). This is the "quarantine unclassifiable layers"
  rule made mechanical.
- `bodies.dims.heightBareMm × pxPerMm` must equal `baselineY − shoulderY` within 2 %; the loader
  refuses a plate that fails it. Same ±2 % gate the family cards already use.

## 5. Loader and functions (built on approval, not yet)

- `convex/register.ts` — `upsertBodies`, `upsertBodyPlates`, `upsertComponents`, `upsertAssemblies`,
  each `{ writeToken, rows }` gated by `verifyWriteToken` (`BEST_BOTTLES_CONVEX_WRITE_TOKEN`),
  returning per-row `inserted | updated | unchanged | error` exactly like `productKits.upsertMany`.
  Reads: `bodies.list`, `bodyPlates.forBody`, `components.forNeck`, `assemblies.forGraceSku`,
  `assemblies.forBody`.
- `scripts/register/push-register.mjs --deployment dev|prod [--apply]` — reads the CSVs + `rules.json`,
  derives `build`, validates against the vocabulary in `src/lib/catalogFilters.ts`, prints a diff.
  **Dry-run by default; additive only; never `--replace`** (the shared-deployment rule).
- Assets: `registerBodyPlates.image` and `registerComponents.layers[].image` are written by the
  Phase 3 tooling to Vercel Blob under `register/plates/<bodyId>/<glass>/<sha>.png` and
  `register/components/<neck>/<componentId>/<slot>-<sha>.png`. The loader only records what exists.

## 6. What stays untouched, and the cut-over gate

`productPlates`, `productKits`, `plateFamilies` and every consumer of them (PDP, Build Your Bottle,
the catalogue cards, Grace) keep working unchanged. `registerAssemblies.legacy` records the kit and
plate each SKU uses today so the gate is checkable per SKU:

> For every pilot assembly with `build.status = resolved`, the Phase 4 render at 1000 × 1100 must
> match the existing kit composite within a pixel-diff threshold set in Phase 4, and the seat line
> must agree within 2 px. Only then does a consumer read the new tables — one consumer at a time,
> pilot family first.

## 7. Sizes and cost

| table | rows now | rows after pilot lands |
|---|---|---|
| registerBodies | 97 | 97 |
| registerBodyPlates | 0 | 5 (pilot), ≤ ~300 at full coverage |
| registerComponents | 176 | 176 + a handful of library-only parts |
| registerAssemblies | 2,312 | 2,312 |

Everything fits comfortably under Convex document and table limits; the largest row is an assembly
with a 19-item compatibility list.

## 8. Pilot readiness — what the register says about 17-415 Cylinder 9 mL today

### 8.1 Numbers

- 145 assemblies: 143 verified, 2 candidate. 5 glasses (Amber, Clear, Cobalt Blue, Frosted, Swirl).
- 19 distinct compatible components; **19 / 19 have a master-library PSD** (folders `12. 17-415 Roll on`,
  `13. 17-415 Spray`, `14. 17-415 Lotion`).
- 145 cap-off plates exist today (one per SKU) → 5 body plates after.

### 8.2 Own-part resolution (the `build` field) — 126 / 145 resolve, 19 blocked by data

Matching each assembly to its own cap by `(component.capStyle, normalised capColor, dotted)` resolves
**126 of 145 uniquely**. The 19 that fail are three Convex vocabulary defects, not modelling gaps:

- 6 rows say `capColor = "Black/Pink/Silver with Dots"` + `capStyle = "Tall"` where the component
  says `Black` + a dotted SKU (`GBCyl9MtlRollBlkDot`, `GBCyl9RollPnkDot`, …).
- Clear-glass rows where the glass colour leaked into `capColor = "Clear"` (`GBCyl9SpryBlk`, `LBCyl9LtnBlk`, …).
- `GBCylAmb9SpryTur` (Turquoise) vs component `CMP-SPR-CLR-17-415` whose capColor is recorded as `"Shiny"`.

These become `build.status = unresolved` with the reason spelled out, and stay out of the pilot render
until the Convex rows are corrected (Convex team hand-off, alongside the 96 empty component lists).

### 8.3 Register typing defects to fix in `build_register.py` before loading

- `Ltn17-415Blk / Gl / MattSl` are typed `roll-on-cap`; they are `lotion-pump` (capStyle already says Pump).
- `Spry17-415MattSl` is typed `tassel-bulb-sprayer`; it is a `fine-mist-sprayer`.

### 8.4 Blocker: there is no 17-415 roller insert in the master library

`20. Caps` holds roller inserts for 13-415 only (`13-415MtlRollon`, `13-415PlsticRollon`). The 17-415
folders hold caps, sprayers and pumps. **100 of the 145 pilot assemblies are roller balls** (50 metal,
50 plastic), and each needs a roller-insert layer under its cap. Options:

- **(a)** Cut the 17-415 metal and plastic roller layers from the existing per-SKU kits
  (`productKits.parts[slot = "roller"]`, derivation `psd-layer`) into two library-only components,
  `LIB-17-415-MtlRollon` and `LIB-17-415-PlsticRollon`. Known defect: the cobalt 9 mL metal roller
  layer carries a white fill (~62 % opaque) and cannot be the source.
- **(b)** Jordan cuts a 17-415 metal + plastic roll-on master into `20. Caps`, matching the 13-415 pair.

(b) is the clean answer; (a) unblocks the pilot this week.

## 9. Decisions needed before anything is created (the Phase 2 checkpoint)

1. **Table names** — `registerBodies / registerBodyPlates / registerComponents / registerAssemblies`, or bare `bodies / components / assemblies`?
2. **Library-only component key** — `LIB-<neck>-<psdStem>` with `graceSku = null` and `sellable = false`. OK?
3. **17-415 roller insert** — option (a) cut from kits now, (b) new master PSD, or both (a then b)?
4. **Unresolved builds** — the 19 vocabulary-blocked pilot rows wait for Convex corrections (recommended), or the loader's normaliser papers over them?
5. **Anchor gate** — pilot renders only from `approved` anchors; `measured` is visible in the lab only. OK?

On approval the order of work is: fix §8.3 in the register script → add the four tables + `convex/register.ts` →
`push-register.mjs` dry-run against dev → apply to dev → Phase 3 (anchor tooling) begins on the 5 pilot plates
and the 19 pilot components.

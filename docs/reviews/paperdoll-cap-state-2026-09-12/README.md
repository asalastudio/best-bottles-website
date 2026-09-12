# A blob count was holding 499 kits

## What was happening

`scripts/paperdoll/dedupe.py` decides whether a photograph shows a bottle with its cap
on or off by counting separate dark shapes in it. One shape means capped; more than one
means "the cap is off, sitting beside the bottle". The docstring says so plainly:
*"Two big blobs = cap beside bottle."*

That reads a one-piece bottle correctly. It cannot read a product that **is** several
pieces. An atomizer is three objects. An antique bulb sprayer with a tassel is five.
Those photographs came back labelled "cap off" although nothing was ever removed.

`family_batch.py` then asks for a capped, partial or unknown front source before it will
build a kit, finds only "off", and holds the product with
`source_preflight:no approved capped/front source`.

**499 kits were held this way, and the correct photograph was on disk the whole time.**

## Evidence

| check | result |
|---|---|
| The 499 hold for "no approved capped/front source" | all have a PSD in the master library, verified present on disk for a 120-SKU sample |
| Their stem's available cap states | `('off',)` for all 499, no exceptions |
| How that "off" was decided | blob count, between 2 and 9 shapes |
| Two-piece products whose kits DID build | 54, of which 31 were labelled "on" from **blob-count:1** |
| Overlap with the 550 plates sourced from the legacy website | 499 of 499 |

The dividing line is not the product, the photo quality, or whether a kit applies. It is
whether the object happened to photograph as a single connected shape.

The same misread pushed those products' **plates** onto the old website's images
(`bestbottles.com/images/store/enlarged_pics/*.gif`) because no front source could be
found in the master library either.

## The change

`demote_lone_blob_guess()`: when a stem's **only** source is an `off` state resting on a
blob count, record it as `unknown` instead. We have one photograph of this product and no
evidence about its cap, which is the truth. `build_plates.source_of` already accepts
`unknown` as a front source, so the product builds from the picture we actually have.

Deliberately narrow. Untouched:

- any stem that also has a real capped source — the label is harmless there (1,215 stems);
- any state resting on explicit evidence, a filename or a curated component folder, which
  outranks a guess and always did (16 stems).

## Dry run against the live library

Applying the function to `data/paper-doll/selection.json` as it stands today:

| | |
|---|---|
| Stems in the library | 2,801 |
| Stems relabelled `off` → `unknown` | 740 |
| SKUs on a relabelled stem | 664 |
| **Kits currently held that gain a front source** | **499** |
| SKUs with no plate that gain a front source | 162 |
| Live kits on a relabelled stem | 3 — must be re-verified after the rebuild |

By family, the 499: Round 108, Elegant 107, Circle 89, Diva 81, Empire 38, Diamond 30,
Atomizer 21, Sleek 8, and 17 across Slim, Grace, Aluminium and Royal.

`dry-run-diff.json` lists every stem and SKU; `held-kits-before.csv` is the full 499 with
family, capacity, colour, product group and the legacy URL each plate was built from.

## What this does NOT do

Nothing is rebuilt or republished here. This changes how a source is labelled the next
time `dedupe` runs. Rebuilding the affected plates and kits is a separate, reviewed step:
the 3 live kits above must be checked, and any new kit goes on a review card before it is
published, as every other asset does.

Rebuilding the 550 legacy-sourced **plates** is deliberately out of scope. Measured on the
21 Atomizers, the master PSDs are 1200 px wide against the plate's 1000 and carry about
15 % more edge detail — real but modest, and not worth the review load until a family
looks visibly soft.

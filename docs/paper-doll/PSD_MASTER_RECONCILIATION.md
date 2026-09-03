# PSD master-library reconciliation

Status: consolidation is feasible, but deletion is not yet safe.

## Source boundary

The only PSD source inspected or rendered for this audit was:

`/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master`

No PSD in a legacy library was opened, rendered, hashed, copied, moved, or used as product truth. The prior name-only audit artifacts were used only as a candidate list.

## Executive finding

The previous statement that 423 real SKUs were absent from the master was not correct. The 423 are distinct normalized filename keys, not 423 confirmed catalogue products. Stronger SKU normalization, catalogue matching, master-folder evidence, and a master-only visual sample reduce the current catalogue gap to one product:

- `LBRnd78LtnCu` — 78 ml clear Round bottle with copper lotion pump.

The candidate list contains two filenames for this product, one representing each cap state. The master has a 78 ml frosted copper-pump Round and a 128 ml clear copper-pump Round, but not the 78 ml clear product. Those are distinct products and cannot be substituted.

## Master measured live

| Measure | Count |
|---|---:|
| PSD files | 5,931 |
| Distinct filename-derived names | 3,059 |
| Directories | 492 |
| Size on disk | 20 GB |
| Capped views | 2,081 |
| Uncapped views | 978 |
| Unspecified views | 2,872 |
| Duplicate `(name, view)` groups | 1,422 |

The 3,059 distinct-name count supersedes the stale 3,050 count in the handoff. A fresh run of the master-only inventory reproduced 5,931 files and all view counts exactly.

## Reclassification of the 423 candidate keys

| Classification | Keys | Meaning |
|---|---:|---|
| Present in master under an alias | 311 | Same product/component is already represented; differences include `Mt`/`Matt`, `RollMtl`/`MtlRoll`, repeated ring-colour tokens, historical abbreviations, a `copy` suffix, or a parser-dropped numeric prefix. |
| Auxiliary view only | 54 | Measurement, depth, aerial, or side-view assets; these are not catalogue SKUs. |
| Circle 30 legacy configurations | 22 | No matching current catalogue SKU; do not promote these into the master as sellable products without a product-truth decision. |
| Tulip clear 5 ml vs 6 ml conflict | 25 | The master and current catalogue identify the clear Tulip as 6 ml; the candidate names say 5 ml. Do not merge across the capacity conflict. |
| Archival names unresolved | 9 | Four DOS-short Boston Round names, two descriptive plastic-bottle names, two non-catalogue Diva ring names, and one placeholder. None is a current catalogue SKU. |
| Current catalogue gap | 2 | Two cap-state filenames representing the single `LBRnd78LtnCu` product gap. |
| **Total** | **423** | |

Of the 423 candidate keys, 220 map to current catalogue identities in the on-disk 2,330-product production snapshot from 2026-09-02. Of those, 218 are represented in the master under defensible aliases. The remaining two are the capped/uncapped pair for the one Round product above.

## Master-only sample verification

Nine master PSD composites were opened across Bell, Circle, Cream Jar, Vial, Aluminum, Tulip, and Round families. The sample confirmed:

- Bell 12 and Circle 15 candidates are in the master with current `MtlRoll` ordering.
- The blue 3 ml cream jar is stored as `CJ3Blue`, while the catalogue spells it `CJBlu3`.
- The clear 1-dram vial is stored as `GBVial1DrmBlackCapSht`, while the catalogue omits `ial`.
- The aluminum candidate's doubled `l` is only a filename typo; the correctly named master PSD exists.
- The Circle 15 shiny-silver sprayer exists in the master with a `copy` suffix and should be canonically renamed before it is selected.
- The clear Tulip master family is explicitly 6 ml.
- The two nearest Round copper-pump masters are visibly the wrong glass/size combination for `LBRnd78LtnCu`.

This proves the master-side identities and the Round gap. It does not establish byte identity with any legacy PSD because those files were intentionally not read.

## Consolidation plan

1. Freeze the legacy libraries as read-only archives. Do not delete, ingest, or render from them during normal work.
2. Close the one live product gap using an authorized master source: create or recover capped and uncapped PSDs for `LBRnd78LtnCu`, or explicitly retire/correct the catalogue product. Do not substitute either nearby Round PSD.
3. Resolve the clear Tulip 5 ml versus 6 ml conflict using physical inventory, ERP/Shopify truth, or a measured bottle. Only one capacity should survive as the canonical identity unless both are proven distinct products.
4. Normalize the master in place around exact website-SKU basenames and explicit `Capped`, `Uncapped`, and `Additional Views` folders. Record historical aliases in a manifest rather than preserving filename drift.
5. Hash every member of the 1,422 duplicate `(name, view)` groups. Remove only byte-identical duplicates automatically; route non-identical duplicates to visual review and retain one canonical path plus the hash manifest.
6. Rebuild the inventory, selection, cross-reference, and plate manifests from the master only. The pipeline must refuse every other PSD root.
7. Re-render the known defective plates, run the source-lineage verifier, and require zero non-master, uncapped-front, or basename/SKU issues before any publish.
8. Make a checksummed offline archive of the legacy libraries, verify that it can be restored, quarantine the local copies for an agreed waiting period, and delete only after Jordan gives explicit approval.

Because the source boundary forbids reading legacy PSDs, copying from those locations into the master requires either a separate one-time authorization or replacement files supplied directly as approved master sources. This audit performed neither.

## Deletion readiness gate

Deletion is safe only when all of the following are true:

- `LBRnd78LtnCu` has an approved capped and uncapped master source, or is intentionally removed from the catalogue.
- The Tulip capacity conflict is resolved.
- The 54 auxiliary views and nine archival names have an explicit keep/discard decision.
- The master duplicate hash review is complete.
- Paper-doll inventory and render scripts are master-only.
- `scripts/paperdoll/verify.mjs` reports zero source-lineage failures on the rebuilt index.
- A checksummed, restorable archive exists.
- Jordan explicitly approves deletion.

Until then: consolidate the catalogue truth and pipeline around the master, but do not delete the legacy libraries.

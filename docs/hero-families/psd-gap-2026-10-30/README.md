# Catalog heroes from the PSD library, 30 Oct 2026

Fourteen SKUs the 30 Oct image audit found with no usable catalog image now have a
hero in `src/lib/products/catalog-heroes.json`. Each is a flattened master PSD on the
bone plate (1560 x 1716, #F5F3EF) with no generation, retouching or added shadow,
framed by the rule its group already uses. On the eight tassel bottles the dip tube, a separate
sharp layer behind the frosted glass in the PSDs, is diffused the way frosted glass scatters it,
so no line shows through, as on the approved frosted Circle bulb bottles. `approval.json` records the source files,
transform, production identity and sha256 of every image; `review-sheet.png` shows
all fourteen.

| SKUs | Rule |
| --- | --- |
| 8 frosted Circle 50 ml vintage-bulb bottles with tassel | Batch 3's sizing for the approved black-tassel sibling, from the same `21. Tassels/Updated Tassels` folder |
| GBElgFrst100RdcrMtSl | Elegant 100 ml: shoulder-to-foot 57%, foot on 91% |
| 8-425CpShortBlack, CP8-425TallBlack, CP18-415ShnBlkTall | Component box, as the approved caps |
| CPKeyChnGld, CPTslRed | Component box; identity inferred from the SKU names, group still held |

Status: awaiting Jordan's visual approval. Merging the pull request that adds them
releases them. Group cards do not change: release rows and earlier registry rows
still win, so each new hero shows only when its own SKU is the one pictured (a
selected finish, a Line items row, the cart). The one group that gains a card image,
`cap-closure-SPECIAL`, stays held off the catalog by `hasCatalogSourceHold`.

Regenerate with `python3 scripts/hero-families/psd-gap-heroes-2026-10-30.py <out-dir>`
(needs the Achive drive mounted, or `BB_PSD_MASTER_ROOT`).

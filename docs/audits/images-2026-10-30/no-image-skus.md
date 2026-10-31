# SKUs with no usable catalog image (triage, 30 Oct 2026)

The 30 Oct audit found 47 production SKUs whose card, Line items row and cart line
have no usable image: 34 with nothing at all and 13 with only a legacy
`www.bestbottles.com/images/store/...` GIF, which the storefront blocks on purpose
(`isBlockedProductImageUrl`). One of the 47 is `HMAC-TEST-ONLY`, an internal record
that needs no image, which leaves 46.

## What shoppers see today

- **25 are held off the catalog** (15 by group in `hasCatalogSourceHold`, 10 by SKU in
  `missing-hero-sources.json`). The press-fit cap group slipped through until this
  branch, because production files it as `cap-closure-PRESS-FIT`; the hold now
  matches without case.
- **21 are live options inside a pictured group.** The product page still draws them
  from the component register (checked: the red-tassel Circle 50 ml page composites
  frosted glass, red bulb and gold collar correctly). Only the SKU thumbnail is missing,
  so cards and Line items borrow a sibling's picture.

## Where an image can come from

Paths are relative to the PSD master library (`BB_PSD_MASTER_ROOT`, the Achive drive).
"Legacy GIF" means a 360x480 white-background shot already in
`public/images/store/enlarged_pics/`; the ones checked by eye match their product, but
they are below the bone-canvas standard and blocked by policy.

| SKU | Group | Shopper sees | Source found | Next step |
| --- | --- | --- | --- | --- |
| GBCrclFrst50AnSpTslGl, …TslIvyGl, …TslIvySl, …TslLvn, …TslMtSl, …TslPnk, …TslRed, …TslWht (8) | circle-50ml-frosted-18-415-antiquespray-tassel | option, PDP composites | Whole-product PSDs `2.  18-415 Bottles /30. Circle (Frosted) Glass 50ml/1. Circle (Frosted) Glass 50ml/42–50. <SKU>.psd` (see `data/paper-doll/circle-50-frosted-vintage-recovery.json`); legacy GIFs | Flatten each PSD onto the bone canvas as a catalog hero |
| CP8-425TallBlack | cap-closure-8-425 | option | `20. Caps/20.  8-245 Caps/5. CP8-425TallBlack.psd`; legacy GIF | Hero from PSD |
| 8-425CpShortBlack | cap-closure-8-425 | option | Legacy GIF only; look in `20. Caps/20.  8-245 Caps/` | Hero from PSD if present, else photograph |
| CP18-415ShnBlkTall | cap-closure-18-415 | option | `20. Caps/6. 18-415 Caps/2. CP18-415ShnBlkTall.psd`; legacy GIF | Hero from PSD |
| CP13-415CuSht, CP13-415GlMattSht, CP13-415SlMattSht, CP13-415GlSht, CP13-415SlSht | cap-closure-13-415 | option | `20. Caps/17. 13-415 Caps/` holds `CP13-415Gl.psd` and `CP13-415Sl.psd`; whether they are the short caps needs a look | Confirm short vs tall, then hero |
| CP13-415BlkShShtMtl | cap-closure-13-415 | held (SKU) | None found in the caps inventory | Check `17. 13-415 Caps`, else photograph |
| GBElgFrst100RdcrMtSl | elegant-100ml-frosted-18-415-reducer | option | Not inventoried (bottle libraries) | Check the Elegant frosted 100 ml folder |
| GBTallRect10MtlRollPinkDo | tall-rectangle-10ml-clear-13-415-rollon | option | Legacy GIF; bottle libraries not inventoried | Check the tall rectangle folder |
| OBagChGreen4x6 | gift-bag-0ml-mixed | option | Legacy GIF is the **5x8** bag (`OBagChGreen5x8.gif`) | Photograph the 4x6 bag |
| REF-CMP-PLUG-WHT-VIAL, REF-CMP-PLUG-BLK-VIAL | plug-applicator-0ml-mixed | option (group has no picture at all) | None | Photograph |
| GBATom5RedBurg, 13-415CAP4SpryCuMt, 13-415CAP4SprySlMt, 13-415CAP4SpryGlSh | fine-mist-sprayer-13-415 | held (SKU) | Sprayer library not inventoried | Check the sprayer PSDs |
| 18-415CAP4SpryMtGl, 18-415CAP4SpryShnBlk | fine-mist-sprayer-18-415 | held (SKU) | Sprayer library not inventoried | Check the sprayer PSDs |
| CMP-CAP-BDOT-17-415 (no website SKU) | roll-on-fitment-17-415 | held (SKU) | None | Check roll-on caps |
| RecloseableBags9x12 | packaging-supply-0ml-mixed | held (SKU) | None | Photograph |
| CP13-425Blk, CP13-425Wht | cap-closure-13-425 | held (group) | None in caps inventory | Check, else photograph |
| CapBlackPoly22mm-400 | cap-closure-22-400 | held (group) | None | Photograph |
| CP24-400BlkPls | cap-closure-24-400 | held (group) | None | Photograph |
| CJ5BlkCap, CJ5SlCap, CJ30BlkCap, CJ30SlCap, CJ40BlkCap, CJ40SlCap | cap-closure-PRESS-FIT | held (group) | None | Photograph, or crop from the cream-jar heroes |
| CPKeyChnGld, CPTslRed | cap-closure-SPECIAL | held (group) | None in caps inventory (tassel library has 253 files, not matched) | Check `21. Tassels` |
| Droppers1ozElg | dropper-17-415 | held (group) | None | Photograph |
| CPWhite1Oz | roll-on-fitment | held (group) | None | Photograph |
| PKG-BOX-BRN-4X4X4 | unknown-0ml-clear | held (group) | None | Photograph |
| PKG-BOX-WHT-WINDOW-SM | gift-box-0ml-clear | held (group) | None | Photograph |

`data/paper-doll/component-library-inventory.json` only covers `20. Caps` and
`21. Tassels`; the sprayer and bottle libraries need the drive mounted to search.

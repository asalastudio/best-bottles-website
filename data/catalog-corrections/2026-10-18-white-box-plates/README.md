# White-box product stages (18 Oct 2026)

The 18 Oct browser sweep found seven product pages on the main layout whose stage shows a flat photo inside its
own white box, and two Circle 30 ml pages where the glass reads as solid white. Nothing has been written yet:
Jordan approves the images and the run separately.

| File | What it is |
|---|---|
| `plan.json` | Per SKU: the page, whether the page opens on it, the old and new `productPlates.front`, the plate file, and its source with the checks it passed. Also the held pages and why. |
| `rollback.json` | The `front`, `revision` and `importedAt` each row held in the production export of 18 Oct, 23:37 PT. |
| `plates/` | The 11 new fronts, byte for byte what the script uploads (1000×1100 WebP, content-addressed). |
| `contact-sheet.jpg` | LIVE vs PROPOSED for every SKU, drawn as the stage draws a fallback photo (pearl canvas, 24/24/48 px inset). A red tab marks the variant a page opens on. |

## Where the white box comes from

The product page stage (`src/components/pdp/PdpStage.tsx`) draws the selected SKU's kit (`productKits`). Without
one it takes `pdpFallbackMedia` (`src/lib/products/pdp-redesign/fallback-media.ts`): a released Sunburst hero,
then the SKU's plate, `productPlates.front`. None of these SKUs has a kit or a released hero, so the stage shows
the plate. `build_plates.py` flattens each PSD onto white (all 2,283 published plates are 1000×1100 WebPs, and
every one sampled is opaque RGB), so on the page's pearl canvas the plate's white background is a visible box. The Heart plate is
also cropped: its tassel pushed the bottle off the left edge.

The field changed is `productPlates.front` only. Cap-off views, thumbnails, views and source lineage stay as
they are.

## The new fronts

Two sources, nothing generated:

- **Transparent plate (7): the live plate with its white made transparent.** Each comes from the SKU's master
  PSD, accepted only when its sha256 equals the plate row's `source.psdSha256` (the file the live plate was
  rendered from). It is composited without its full-canvas white background layer and placed with the live
  plate's own scale and offset, recovered by fitting. Laid over white, each reproduces its live plate to within
  0.13–0.93/255 (gate 6/255). Pure-white retouch paint standing apart from the product is dropped by alpha only:
  on white it was invisible, on pearl it would float beside the bottle (Boston: 14 pieces, 25,014 px, including a
  large white shard; the others under 120 px).
- **Bone-background plate (4): the photo the catalogue card already shows.** For these SKUs the catalogue card
  draws `public/images/catalog/bone-review/…` (`catalog-heroes.json`). The plate is that file, sha256 checked
  against the asset ledger, scaled from 1560×1716 to 1000×1100. Its bone ground (#f5f3ef) sits within a few
  levels of the stage's pearl (#f6f4f3), as `pdp.module.css` intends for a fallback photo.

| Page | SKU | Opens on | Old front | New front | Source |
|---|---|---|---|---|---|
| heart-4ml-frosted-8mm-tassel | GBHeartFrst4TslRed | yes | `1a4f9c19bf8b` | `aa16b3a7faa0` | catalogue hero (Sunburst-approved, release-3 lock); fixes the crop |
| aluminum-bottle-100ml-mixed-20-410 | Alu100mlSprayBlack | yes | `5394907887f8` | `d3d5f9d4e62f` | catalogue hero (prior release) |
| aluminum-bottle-500ml-mixed-20-410 | Alu500 | yes | `cd1d9d9a86a6` | `a5b4722a8f3c` | catalogue hero (prior release) |
| royal-14ml-clear-11mm | GBMtlCylGl | yes | `9c778b130b21` | `d96f9f62a8f3` | catalogue hero (prior release) |
| boston-round-15ml-cobalt-blue-18-400-dropper | GBBstnBlu15BlkDrpr | yes | `97abc7b374f8` | `21e776e247da` | master PSD `c7d203fd2f68` |
| vial-4ml-clear-13-425 | GBV1DrmBlackCapSht | yes | `3af2db78b0c4` | `57b674d6182d` | master PSD `903573252628` |
| elegant-30ml-clear-15-415-perfumespray | GBElg30SpryBlk | yes | `70bb9a1ada57` | `23de3629dfc9` | master PSD `909fde2f419f` |
| elegant-30ml-clear-15-415-perfumespray | GBElg30SpryShnSl | no | `28d9d0704ed8` | `187743d2a26e` | master PSD `0506132a6b49` |
| elegant-30ml-clear-15-415-perfumespray | GBElg30SpryShGl | no | `bcf2c8282a46` | `1a36cf0bdab2` | master PSD `39ef9f46594f` |
| circle-30ml-clear-15-415-perfumespray | GBCrcl30SpryMattSl | no | `0fcdbc4d49d4` | `e583034dd464` | master PSD `cbba3397a802` |
| circle-30ml-clear-15-415-perfumespray | GBCrcl30SpryShnGl | no | `bafa5c1ce88e` | `79ef323c3323` | master PSD `86a8d78fd53d` |

The last four are not the sweep's default view but sit on its pages: picking Shiny Silver or Shiny Gold on the
Elegant page, or Matte Silver or Shiny Gold on the Circle spray page, showed the same white box.

Things to look at on the sheet:

- **Royal** shows the bottle open with its stopper beside it, as the catalogue card does. If the assembled
  bottle is wanted instead, the same PSD cutout as the other seven is available (the master PSD is verified).
- **Aluminum 100 and 500 ml** sit smaller than today, at the catalogue card's framing. The 500 ml cap keeps the
  old site photo's rough edge.
- **Clear glass** (Vial, Elegant, Circle spray) stays as white as it is in the master PSDs, matching the kits
  already shown for their sibling variants. Only the box goes.

## Held

- **/products/circle-30ml-clear-15-415** (GBCrcl30GlCap, GBCrcl30SlCap) and
  **/products/circle-30ml-clear-15-415-perfumespray** (GBCrcl30SpryBlk, GBCrcl30SpryShSl). These pages draw a
  kit, and its body layer is opaque white inside the glass (alpha 255, RGB 253). So is the glass layer of the
  master PSDs the kits were cut from (`7. GBCrcl30GlCap..psd`, `1. GBCrcl30SpryBlk.psd`, hashes matching the
  rows). No transparent Circle 30 ml glass exists in `productKits`, `productPlates`, the builder bodies or the
  master. The only see-through Circle 30 photographs in the repo are the bone heroes of GBCrcl30GlCap and
  GBCrcl30SpryMattGl, which stand the cap beside the bottle, and the stage never reaches a hero while a kit
  exists. Fixing it needs new glass artwork (a re-matted body layer) or a stage rule, not a data correction.
  Every Circle kit (15, 30, 50, 100 ml) carries the same opaque glass, and clear Vial, Sleek, Elegant and Diva
  kit bodies are opaque near-white too (RGB 229–252); the Circle's large round face makes it the most visible.

## Effects elsewhere

`productPlates.front` is the plate wherever a plate is drawn. On a white surface the seven transparent plates look
exactly as before. The four bone-backed plates show a bone ground instead of white there, as some legacy-exact
plates already published on bone do. Thumbnails (240×240) are unchanged and stay white.

## Running it

Merge first: the production build deploys `productPlates:replacePlateFronts`. Then, with
`BEST_BOTTLES_CONVEX_WRITE_TOKEN` (production) and `BLOB_READ_WRITE_TOKEN` in `.env.local`:

```bash
node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod                     # dry run
node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod --apply             # upload + write
node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod --rollback --apply  # undo
```

The script stops with nothing written if any row no longer holds the plan's old front. It uploads only the
pending plates, checks each public URL (200, `image/webp`, length, CORS, one-year cache, sha256) before any row
points at it, and writes all rows in one all-or-nothing mutation. Product pages render per request, so the change
shows at once.

Rebuild the plates and plan (needs the master PSDs, or a mirror holding the same bytes, and a fresh export):

```bash
npx convex data productPlates --prod --format jsonl --limit 8000 > SNAPSHOT/productPlates.jsonl
npx convex data productKits --prod --format jsonl --limit 8000 > SNAPSHOT/productKits.jsonl
python3 scripts/catalog-corrections/2026-10-18-white-box-plates-build.py --snapshot SNAPSHOT --psd-root PSD_ROOT
python3 scripts/catalog-corrections/2026-10-18-white-box-plates-sheet.py --snapshot SNAPSHOT
```

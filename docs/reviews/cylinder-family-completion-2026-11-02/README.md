# Remaining Cylinder body and dip-tube review

One unchanged body source and canvas registration now serves each remaining physical bottle set. The new review covers 109 configurations across the 25 ml / 18-415, 28 ml / 16 mm, 50 ml / 16 mm, 50 ml / 18-415 and 100 ml / 18-415 sets. These are candidates, not a new production release.

Review: http://localhost:3010/reviews/cylinder-family-completion-2026-11-02/index.html

Drive library: https://drive.google.com/drive/folders/1fwXoPU9KjI8DSPjyeFyQREoAlRfD1yd1

## Confirmed product rules

- The imported 30 ml entry is the 25 ml, per Jordan's correction. `physical-profile-crosswalk.json` binds the two exact imported identities to the 25 ml master. Original catalog records and legacy evidence remain preserved. No live record was renamed or deleted.
- The 25 ml offers reducers, sprayers, lotion pumps, bulbs and tassels. No roller is assigned. Three imported dropper rows remain on the reconciliation list because they fall outside that confirmed set.
- Jumbo metal and plastic rollers belong to the 28 ml and 50 ml / 16 mm bottles. Their internal track fits around the glass rim, with no protruding lower plug. Each material now reuses its original PSD ball photograph at native housing offsets, replacing the earlier generated roller candidate. The same two roller masters and two cap sources serve both sizes. Component proportions are registered from the original artwork and legacy bottle measurements; they are not newly measured hardware dimensions.
- Bulb and tassel tops stay assembled while their finish colors change. The product page has no cap-off or exploded view control for these complete tops.
- Original PSDs, previous masters, shadows and approval bindings are preserved. Changed image bytes require their own visual approval.

## Inventory and open reconciliation

The current source query contains 507 rows: 504 glass configurations and three standalone plastic bottles. After the owner-confirmed 30-to-25 ml crosswalk, the glass inventory contains 18 physical profile/color master sets, with 18 body sources recovered.

The 504 glass rows comprise 362 existing approved recipes, 109 new review candidates and 33 holds. Holds comprise 27 tassel artwork/frame corrections, two imported 30 ml identities whose legacy metal-top/base assembly still needs reconciliation against the 25 ml correction, three imported 25 ml dropper variants outside the confirmed fitment set, and one pre-existing Tulip cap-label conflict. These holds are not marked complete. The separate historical 5.5 ml source remains recorded even though it is absent from this current orderable query.

The jumbo 16 mm assemblies remain catalog/PDP products. Their existing explicit exclusion from the standalone Bottle Builder is preserved; this batch does not change assortment or add compatible combinations by assumption.

## Tube and delivery changes

The 50/100 ml lotion tubes use the cleaned shared lotion material and compact connector. Sprayers retain their own mechanism source, and bulbs use a shaft without an invented pump chamber. Mechanism width stays fixed while the shaft length is registered to each bottle. Tips stop above the visible inner floor. Seated chambers receive source-specific glass attenuation; detached tubes retain their natural plastic appearance and remain connected to their head in exploded view.

Seventeen source images have four lossless WebP display sizes. All 68 encodes preserve alpha and visible RGB values against the corresponding resized reference. After the PSD roller substitution, the 640 px copies total 3,143,898 bytes, compared with 7,124,804 source bytes. These totals describe the asset set, not the download for one product. Master bodies, geometry and anchors do not change. This batch does not establish a two-second hosted load guarantee.

## Verification

- Registration and source-hash checks cover all 109 candidates, five shared body masters and eight over-rim roller configurations.
- Browser checks cover 102 desktop/mobile PDP states, including cap-on, cap-off and exploded where supported. Bulb and tassel controls are checked separately on desktop and mobile.
- The current Builder check covers 101 eligible exact recipes and four actual Builder pages. Eight jumbo roller configurations remain excluded under the existing catalog-only policy.
- Typecheck and scoped lint pass. The full suite passes 3,287 tests, with seven skipped.
- The required before/after measurement completed for 2,283 plates with zero measurement failures. Both ledger builds stop at the existing `GBCyl5BlkShSht` catalog-identity guard. The guard is not bypassed. Global ledger counts, publication status, indexed media and earlier approval bindings are not rewritten.

`validation-summary.json`, `registration-verification.json`, `browser-verification.json`, `builder-verification.json`, `display-verification.json` and the Drive receipt contain the separate evidence. A transient development hot-reload error was followed by a clean browser pass. The first Builder harness attempt compared optimized URLs incorrectly; its corrected source-normalization check passes without an application change.

## Reproduce and review

Download the source/review archive from the Drive folder into this checkout. It preserves the native bodies, generated component masters, unchanged source exports, exact before/after kit snapshots, local candidate recipes, display copies and browser captures. Large image files remain outside Git. The small tracked master index and exact-SKU CSV provide retrieval and action links.

The later `jumbo-roller-psd-match-2026-11-02` archive supersedes only the two generated roller candidates. It contains the original ball photographs, native registration, current recipes, and 48 desktop/mobile states. All eight bodies and caps and the other 101 recipes are unchanged. Its separate comparison is at http://localhost:3010/reviews/jumbo-roller-psd-match-2026-11-02/index.html.

Use the existing dependency installation:

```sh
node --import tsx docs/reviews/cylinder-family-completion-2026-11-02/prepare.mts
node --import tsx docs/reviews/cylinder-family-completion-2026-11-02/compile-review.mts
node --import tsx docs/reviews/cylinder-family-completion-2026-11-02/verify-registration.mts
node docs/reviews/cylinder-family-completion-2026-11-02/verify-browser.cjs
node docs/reviews/cylinder-family-completion-2026-11-02/verify-builder.cjs
```

The local review loader requires development localhost and `assetPreview=gpt13`. Hosted builds cannot load these optional candidate recipes. After visual approval, publication still needs exact-SKU hosted integration and preview verification. Vial work remains queued after Cylinder reconciliation.

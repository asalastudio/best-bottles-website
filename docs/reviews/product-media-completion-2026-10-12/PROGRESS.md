## 2026-10-14: Round 78 ml spray source batch

- Screenshot follow-up: removed the seated Round tube's gray cast by preserving native white highlights. Re-rendered all 108 offline layouts; 12 exposed and 24 bare Builder images are byte-identical, while 72 seated images changed. Fourteen focused tests and TypeScript pass. Final full-suite verification includes this correction.
- Twelve local candidates use the complete native Photoshop tube: six clear and six frosted spray finishes. Bottle geometry and seated hardware are unchanged; bottles remain empty.
- Fresh production metadata supplies the offline baseline; current development records accept all twelve exact source guards.
- Checked 36 offline PDP and 72 offline Builder layouts. Full suite with two workers: 3,136 tests passed, 7 skipped. TypeScript and changed-source lint pass.
- Browser, physical iPhone and owner visual acceptance remain pending. The custom review rasterizer does not establish full UI rendering parity.
- This batch is prepared for code review with publication disabled. No publication or backend writes. See [ROUND78-SOURCE-TUBES-LOCAL.md](ROUND78-SOURCE-TUBES-LOCAL.md).

## 2026-10-13 — seated Square tube feedback

- User rejected the Square 15 ml black-sprayer tube as appearing pasted onto the exterior.
- Removed the exposed-tube contrast boost from seated views in local PDP and Builder. Exploded retains its treatment; Builder enlargement remains a seated view.
- Rebuilt all 42 offline views (seven finishes, three views, two snapshots). 63 focused tests and TypeScript pass. Original pixels and registration unchanged.
- Browser verification and visual acceptance remain pending. Nothing published.
- Homepage creative research is paused while this product-media feedback is addressed. Three art directions were researched; no homepage replacement or generated hero has been delivered.

# Execution ledger — updated 13 October 2026

## Latest checkpoint — 13 October, tube audit and environment alignment

- One backlog now contains **69 issue/review records**. This is not 69 unique defects; grouped queues and existing technical causes overlap.
- All ten Diva ring combinations are prepared locally. The first four are owner-approved; six new assemblies await review. Both database payloads pass the ten exact local guards.
- Tube audit inventoried 1,260 production and 1,291 development candidate SKUs; all 442 tube/pipette URLs decoded. Fifty-five hero-layer entries have continuity flags; these are review candidates, not accepted or independently counted defects.
- Square 15 ml spray: intact source tube integrated locally for seven finishes and all supported views. The user approved the clearer lighting direction. The original source pixels carry a local contrast treatment; generated pixels with outline drift are excluded. Forty-two offline renders across two environment snapshots are saved; final assembly/browser acceptance is pending.
- Round 78, Empire 50 and the remaining flagged families are **not cleared**. Source layers exist; body-specific registration, length, material and supported-view review remain.
- Local uses development Convex. Fresh comparison found 96 production SKU keys absent locally and 2,194 primary URL differences among matching keys. URL drift is not a defect count. A controlled production-matched read-only preview baseline is still needed; no environment or data was changed.
- Boston's recovered 21 source combinations remain offline candidates; do not describe the whole set as integrated in the UI.
- Agent browser access was freshly denied by a saved permission; no bypass was attempted. Localhost remains running for manual checks. No publish, merge or production write.

See [DIP-TUBE-AUDIT.md](DIP-TUBE-AUDIT.md) and [DIVA-RINGS-LOCAL.md](DIVA-RINGS-LOCAL.md). The complete local evidence is under `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`.



**Updated 13 October 2026. In progress; not ready for final acceptance or release.** The directory retains its original 2026-10-12 session date. Evidence spans 12–13 October.

## What was implemented locally

1. Builder images recover after transient optimized/raw loading failures: one bounded delayed retry, connectivity recovery, and manual recovery on full previews. Thumbnail recovery does not introduce nested buttons or select an item.
2. Removed the decorative horizontal line behind PDP bottles. Registration and seating datums remain intact.
3. PDP controls honor the existing assembled-closure policy, label a flat fallback PHOTO, and select a supported view after SKU changes.
4. PDP Shopify photos retry their original URL after an optimizer failure before advancing to another image.

The branch is `codex/product-media-completion-2026-10-12`, based on the recovered main snapshot at commit `5c019e69002bb943d1cf55fe7e78745125bd1cd5`. The divergent original checkout and prior assets were preserved. No fixes have been merged, deployed, published to Blob, or loaded into production data during this run.

## One issue list

- [Searchable register](index.html)
- [Issue CSV](backlog.csv) and [structured issue data](backlog.json)
- [Every-record acceptance matrix](acceptance-matrix.csv)
- [67 offered Builder register exceptions](builder-register-exceptions.csv)
- [200 historical replacement approval candidates](replacement-approval-queue.csv)
- [Separate development image-gap list](development-image-gaps.csv)
- [Held artwork comparison](pilots/review.html)

The register has **63 records**, including grouped review queues and historical holds. This is not a claim of 63 independent customer defects. Exact SKUs and served configuration IDs are recorded separately per issue. Seven distinct technical defects are confirmed from source/tests/delivery: four local UI/loading fixes, one broken hosted group-hero reference, one local Boston pipette placement defect and one tassel adjustment-loss defect. Root causes of the remaining data gaps and reported visual faults still need verification.

## Current evidence, with denominators

| Measure | Finding | Boundary |
| --- | --- | --- |
| Production catalogue | 2,485 records / 2,482 nonblank unique website SKUs | Eligibility still needs final classification |
| Image coverage | 2,283 exact plates; 164 healthy remote-only; 38 source/assignment matching gaps | Does not certify visual identity or quality |
| 38 gaps | 30 named catalogue candidates; 3 identity decisions; 5 reference/retired/test records | Do not call all 38 missing customer images |
| Builder | 2,125 served configurations across 45 locally enumerated bodies | Live API responses matched local replay; independently enumerating deployment-only/cached bodies and rendered UI remains pending |
| Builder drawing exceptions | 67 offered configurations without a renderable register assembly | They may use legacy imagery; not 67 missing products |
| Register unresolved | 316 builds | Includes holds/retired/non-Builder scope; not a customer-defect count |
| Hosted media requests | 11,585 unique URLs checked; 11,584 decoded; 1 HTTP 404 | Plates, thumbs, kits, registered layers and group heroes; Shopify assignment is a separate measure; no visual acceptance |
| Legacy kits | 146 partial kits | Some roles/views may legitimately be unavailable; precedence must be checked |
| Development | 2,541 records; 73 matching gaps | Kept separate from production |

Shared assembled-policy exposure is 965 SKUs (922 served configurations), mirroring the renderer's policy including exact exceptions. Actual applicability requires a kit. This is potential exposure, not 965 witnessed failures. Flat-photo labeling also affects no-kit fallbacks.

Shopify audit: 1,041 assigned, 1,437 missing variant image, 3 unmatched, 4 duplicate-SKU records. These assignment states do not establish missing PDP images. Cart/checkout identity requires browser checks.

The broken group hero belongs to `cylinder-5ml-clear-13-415-rollon`. Its primary identity is `GBCyl5MtlRollBlkSh`. [Proposed data repair](proposed-data-repair.json) contains the exact before/after reference and rollback receipt. It has not been applied; visual identity and the actual fallback path remain gates.

## Artwork pilots: all held

Five image-editing candidates cover Round78 clear/frosted, Boston15 amber/cobalt, and a silver tassel-hardware detail. Prompts, source/output hashes, tool identity, dimensions and comparison evidence are in `pilots/`. The image tool did not expose the model version; no GPT-2.5 claim is made.

The first pass fails the accuracy gate: normalized Boston widths differ approximately 9–11% from the source assembly; other candidates have alpha-edge, tube, mechanism or hardware geometry concerns. These are finish studies, not approved replacement artwork. No generated candidate was installed in the component register or public asset paths. Pilot approval should follow geometry correction, not override known errors.

Source access was restored on 13 October. All 14 Boston source/reference hash checks matched, and seven hardware parts plus twelve pipette layers were re-extracted locally. A new isolated component edit remains held for contour and edge checks. See `SOURCE-RECOVERY-2026-10-13.md`; `pilots/master-lineage-check.json` retains the earlier unavailable-volume finding as historical evidence.

## Verification completed

- 46 tests passed across seven targeted Builder/PDP files, including failure-before/fix-after retry and view-control regressions.
- TypeScript check passed; `git diff --check` passed.
- Reconciliation validation passed: unique record IDs, served/replay identity sets, 30/3/5 gap split, 965 policy exposure, 12 held 13-425 records and four held Vial4 dropper records.
- Independent source review found no remaining actionable defect in the local UI fixes. Three audit-count/provenance findings were corrected; see REVIEW.md.

**Not completed:** local or production browser acceptance; catalogue-wide visual inspection; physical iPhone Safari/network recovery; exact cart-image identity; full independent legacy-catalogue reconciliation; owner pilot approval. Both local and production browser attempts were declined by the permission gate. No alternate access route was used to bypass those denials.

## PR and release sequence

1. Validate these shared fixes locally on desktop/mobile, including transient failure recovery and the exact reported pages. Reconcile against #368's overlapping PDP/Builder changes before release.
2. Correct and approve the three pilot families with mounted exact masters. Use preserved geometry/Blender if image editing cannot retain geometry. Then expand family work, with a contact sheet and every-combination browser matrix.
3. Review existing #341 → #342 → #343 drawing stack in that order. Source reconciliation now verifies seven new parts and 29 newly resolved assembly records; 26 are offered in the saved Builder census. A source-only combined-tree check passes 73 targeted tests. Original asset hashes and rendered appearance remain unverified; see DRAWING-STACK-REVIEW.md.
4. Keep #347 finish-image migration held. #368 is also a draft with overlapping source changes. #340 and #345 are merged, but that is not media release acceptance. Additional open drawing/factual work such as #296 and #354 must be reconciled against exact scope.
5. For each family, prepare CI evidence, approved hashes, publication/reference payload and rollback receipt. Ask for the user's explicit merge/publication/production-write approval only with a concrete reviewed release.
6. After approved release, repeat exact configuration checks against production. Close each issue only with live evidence.

Stages stay separate: built locally → browser verified → visually approved → PR/CI passed → merged → assets published → Convex/Shopify references loaded → deployed → verified live.

## What is needed next

Master source access is restored and verified. Agent browser permission remains denied even after the app update; Jordan authorized a manual browser-verification path. Complete source-faithful pilot corrections and recorded manual QA before requesting artwork approval. No approval to merge, publish or write production data has been assumed. Pricing, shipping, Grace and accounts remain outside this programme.


Evidence root: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`

## Additional reconciliation

See PDP-RECOVERY-REVIEW.md: the three Elegant15 Minaret omissions are media-path gaps, with identity/eligibility passing. PR #368 has a saved local CSS/recovery resolution with 54 passing targeted tests; it is not merged or applied to the remote PR.

## Boston15 placement fix

The 21 offline source assemblies exposed a pipette seating defect. The local fix restores six clear-glass dropper heads; 46 register tests pass. See [Boston15 placement review](BOSTON15-PLACEMENT-REVIEW.md). Browser verification remains blocked by saved permission settings.

## 13 October continuation: supported views and tassel root cause

Boston15 now has 27 supported offline stage renders across 21 source combinations; no detected clipping or movement between Cap On and Sidecar. See BOSTON15-STAGE-VIEWS.md. Browser verification remains blocked by the saved permission setting.

The tassel extraction defect is reproduced: omitted Photoshop adjustments produced gold hardware for four silver finishes. All four previous output pixel hashes match after their recorded cleanup. The saved census maps these to 104 served configurations, with four additional served Diva ring fallback paths kept separate pending their drawing review. The local extractor now holds adjusted photo cuts instead of silently approving the wrong colour. Replacement artwork is still pending. See TASSEL-ADJUSTMENT-REVIEW.md.

No merge, publication, production write or deployment occurred. Catalogue totals remain the saved audit counts, not a fresh live census.


## 13 October launch continuation and manual QA path

Jordan confirmed the client has answered none of the 51 cutover requests. The current ownership split preserves client-only decisions while engineering preparation proceeds. The 20 meeting-input packets overlap those requests and are not additional independent blockers. Fresh read-only GitHub and Linear receipts, all 53 historical launch actions with current tracker labels, and all 51 request ownership splits are preserved under `launch-continuation-2026-10-13` in the programme output directory.

The local preview restarted and reported Ready on localhost:3005; no page request was made. A 124-record Boston manual results sheet starts entirely pending. See LAUNCH-CONTINUATION-2026-10-13.md and MANUAL-BROWSER-CHECKLIST.md.

Two confirmed footer dead-anchor links were repaired locally: Help me choose opens Builder; Talk with Grace uses the existing shared chat control. TypeScript passes; manual interaction is pending. A fresh focused run passed 24 image-recovery/composition tests across five files.

Jordan manually ran the prepared black-tassel export script in Photoshop. The native full image and transparent closure export now exist under `source-recovery-2026-10-13/tassel-source-review/photoshop-native-pilot`. Photoshop 27.8.0 retained the adjustment layers; master and working-copy hashes remained unchanged. The hardware is silver with residual gold edge fringes. No broad batch was executed.

The authorized native image-generation edit produced `black-tassel-generated-pilot-v1.png`, with its prompt, hashes, validation and before/after comparison saved alongside the native export. The tool did not expose a model version. The candidate removes the visible gold tint but changes the silhouette: full-frame scale-normalized alpha-mask IoU is 0.9612 overall and 0.9252 in the hardware region, with output 1322×1190 versus source 2136×1925. These are diagnostic comparisons, not an acceptance threshold or approval. Edge artifacts and changed hardware contours keep this candidate held. No generated image was integrated into the register, published or approved. Next repair must preserve the native geometry while correcting the fringe; red, white and ivory/silver exports remain unfinished.

No merge, publication, production data load or deployment occurred. Work remaining on our side is not complete; client answers are not being used as a reason to stop independent repairs.

## 13 October: black tassel fringe corrected from native source

`black-tassel-closure-silver-fringe-v1.png` is complete locally. A deterministic colour correction on the native Photoshop PNG neutralizes 10,331 warm hardware pixels while preserving linear-light luminance within 8-bit rounding. This uses the native exported pixels, not the held generated candidate. The original 2136×1925 canvas, every alpha value and every pixel outside the recorded colour mask are byte-identical after saving and reopening. Registration displacement is zero. Both master PSD and working copy retain their recorded SHA-256 hashes.

The corrected head/collar and full component were inspected against the native export, including light and dark backgrounds. The gold fringe is removed without changing the outline. Source edge softness remains; no silhouette cleanup, resampling or texture replacement was applied. Script, correction mask, PNG, comparison and validation receipt are saved in `source-recovery-2026-10-13/tassel-source-review/photoshop-native-pilot/` under the evidence root above.

This finishes the black pilot's fringe correction. Owner visual approval, source exports for red/white/ivory-silver, exact assembly and browser verification, and approved release remain open. No register asset or live reference changed.

## 13 October: approved pilot extended to three silver finishes

Jordan approved the corrected black asset and authorized the same method for red, white and ivory/silver. All three native Photoshop 27.8.0 exports and deterministic fringe corrections are now complete locally. Separate native hardware and textile masks restrict the correction to exposed metal and protect every pixel containing textile ink.

| Finish | Hardware pixels corrected | Alpha changes | Textile pixel changes | Registration movement |
| --- | ---: | ---: | ---: | ---: |
| Red / silver | 5,059 | 0 | 0 | 0 px |
| White / silver | 5,066 | 0 | 0 | 0 px |
| Ivory / silver | 5,065 | 0 | 0 | 0 px |

Each image retains the 2136×1925 source canvas and exact alpha mask; pixels outside the correction mask are byte-identical. Master and working-copy hashes passed before/after checks. The separate ivory/gold master is unchanged. Agent review of full components and enlarged hardware on light and dark backgrounds confirms the residual gold is neutralized with the original geometry and textile colour preserved.

Evidence is under `source-recovery-2026-10-13/tassel-source-review/photoshop-native-family/`: three `*-closure-silver-fringe-v1.png` files, source/export receipts, scripts, masks, `family-validation.json` and `silver-tassel-family-review.jpg`. An initial logging-method error stopped after red; the corrected native batch exported all three successfully. The first-attempt receipt is retained.

Artwork production for these three requested components is complete locally. At this checkpoint owner review and integration remained pending; the next entry supersedes those statuses. The shared issue stays open; no register reference or live data changed.

## 13 October: all four approved and integrated locally

Jordan approved all four corrected source assets and authorized local integration, explicitly withholding publication. All 104 register-backed bottle combinations now resolve to the approved development-only assets through the shared PDP/Builder loader. Exact composition geometry and body-specific tubes are preserved. Offline checks cover 208 complete renders, 624 Builder stage/cover states, and all 104 PDP selection and finish-thumbnail mappings. No clipping was detected. Ten family sheets were inspected.

The contact review found a separate Empire100 Builder registration defect. The legacy body substitution was incorrectly applied to measured register kits. The source-preserving guard is fixed locally and covered by a regression; 48 focused tests and TypeScript pass. The issue inventory now contains 64 issue/review records and eight confirmed technical causes; these are not additive affected-SKU counts.

Browser access is still denied by the saved permission setting. Browser/device/cart-presentation checks, four Diva ring assemblies, broader Empire browser regression and release approval remain open. Four standalone sprayer records are separately classified. Nothing was published, merged, loaded or deployed. See [local integration evidence and gates](TASSEL-LOCAL-INTEGRATION.md).

## 13 October: four Diva tassel jeweled rings integrated locally

The four requested black, ivory/silver, red and white/silver Diva46 ring assemblies now use their own exact tassel PSD ring crops and the approved silver heads. Development-only composition preserves existing bottle, tube and head registration. Selectively recovered the ring placement rules from PR #343; no branch merge, catalogue import or publication occurred.

Offline evidence covers four exact PDP and Builder selections, eight complete renders, 24 Builder states and source hashes. No bounds failures. The ivory PDP selector collision is fixed: its ring choice previously resolved to the plain ivory SKU. All four labels now identify Jeweled Ring. The previous 104 non-ring selection checks still pass; 141 focused tests and TypeScript pass.

The backlog now contains 65 issue/review records and nine confirmed technical causes, not 65 independent customer-visible failures. Production ring records remain unresolved. Browser/device/cart-presentation verification and owner approval of the four new assemblies remain pending. The other six PR #343 ring builds and four standalone sprayer records are separate. See [Diva local evidence and gates](DIVA-RINGS-LOCAL.md).

## 13 October — Empire production-matched pilot

Eight Empire 50 ml lotion finishes now have local source-backed candidates, including the recovered white rectangular pump. 24 offline PDP renders, 48 Builder layout states and 18 focused tests completed. Empire PDP/Builder now replay an explicit production snapshot locally; catalogue cards remain development data. Browser and owner acceptance remain pending. No release. See /Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/empire50-production-pilot/STATUS.md. Catalogue execution index: /Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/family-execution-queue.csv.

Final pilot follow-up: the exact Empire catalogue-family filter now also replays captured production metadata and published card imagery. Global/mixed catalogue browsing remains development. Focused checks increased to 20; visual/browser acceptance remains pending.

## Bare-glass correction — supersedes tube-only acceptance scope

User identified the embedded reducer in the Empire body. Confirmed in source PSD body layers. Empire bare-master acceptance is now explicitly held. Draft 50 ml and 100 ml open-neck images generated but not integrated; geometry review pending. Standalone 18-415 reducer source recovered. Catalogue master inventory: 105 glass body/neck/colour keys, 96 existing plates and nine missing. These are scope counts, not defect counts. See /Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/bare-glass-masters-2026-10-13/README.md.

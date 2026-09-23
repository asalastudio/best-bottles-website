# Next five families: salvage before generation

## Latest checkpoint: Elegant approved and locked

Jordan approved the five background cleanups and instructed committing the approved Elegant images to a PR, then starting Boston Round. All 31 final files are locked in `docs/hero-families/elegant-2026-09-23/approval.json`; 26 remain byte-identical to the aligned approvals. Two 30 mL sprayers are still ungenerated and retain their previous registry fallback. PR #235 merged on September 23; this branch now includes current main. No deployment has occurred. Earlier pending-review statements below are historical.

## September 23 user direction supersedes salvage recommendation

After viewing all 33 Elegant images, Jordan requested regeneration of **all 33** with Sunburst 2.5. Use 15 mL Small, 30 mL Medium, 60 mL Large and 100 mL Extra Large; Extra Small is unused. The minaret must share the Small body target instead of its previous oversized appearance.

Recovered the later September 19 Elegant-specific locks from Madison's `hero-catalog-scale-plan-2026-09-22/src/lib/bestBottlesShoulderLock.ts`: shoulder-to-foot spans 39 / 43 / 47 / 57 percent, corresponding body aspects 1.358 / 1.381 / 1.253 / 1.517. Earlier September 7 metadata is used only to register existing input pixels, not choose the new targets. Four frosted vintage sources lack those historical landmarks; initial framing landmarks were visually measured on their exact thumbnails. These inputs still require final rendered-pixel validation.

Prepared all 33 input frames on 2080 × 2288 with a 91% glass-foot baseline, 32 catalog-mapped PSD merged composites, the exact user-reviewed legacy minaret reference, and the same clear/frosted reference files used by the approved four-family release. `elegant-regeneration-manifest.json` records hashes, prompts, geometry transforms and input roles. Master composite and framed-input contact sheets were visually inspected. Complete vintage assemblies remain intact; the minaret prompt requests its proportional copper cap as a sidecar using the exact matching bare 15 mL glass reference for the exposed neck.

Current checkpoint: user approved the four-size guide and explicitly instructed starting Elegant. **31 of 33 unique heroes have now been generated** with `gpt-image-2.5-sunburst` at native 2080 × 2288. Five rejected attempts were retained: one wrong rectangular silhouette and four clipped-tassel-fringe compositions. Their accepted replacements are selected in `output/imagegen/elegant-2026-09-23/active-manifest.json`; original receipts remain intact.

The exact uncapped master PSD for the two 30 mL matte-gold sprayers shows a black outlet insert. Jordan remembered a pale/white insert, so `GBElg30SpryMattGl` and `GBElgFrst30SpryMattGl` were held at that checkpoint. Jordan subsequently approved the existing/source nozzle color; both are ready to render, with execution deferred while the requested single frosted background test is reviewed. The 15 mL original has a pale insert, confirmed visually.

31 native images were visually inspected in full-family sheets and coordinate-marked shoulder/glass-foot crops. Whole-image uniform transforms register them to the approved 39/43/47/57 percent spans and 91 percent base; source pixels, hardware proportions and shadows remain together. Visual landmark uncertainty is recorded as 12 native pixels (less than 13 after transformation), not a claim of pixel-perfect segmentation. `aligned-exports.json` binds each derivative to its native SHA and transformation; `verified-native-landmarks.json` records the measured coordinates. All remain candidates awaiting Jordan's review. No product registry, live API, staging or production publication has occurred.

Rebuild aligned exports with `node scripts/hero-families/align-elegant.cjs`, then sheets with `node scripts/hero-families/build-elegant-review.cjs --aligned`. The generator is the existing `render-frosted-circle-round.py` manifest runner (default dry-run). Never rerun input preparation over the recorded prompts and hashes.

The lower sections retain the pre-regeneration salvage assessment as history, not the current requested scope.

Order: Elegant, Boston Round, Slim, Sleek, Diva. Branch `codex/next-five-family-review-2026-09-23` starts from reconciliation commit `b74897eb`; it depends on PR #235 and is not a claim that PR has merged.

## Evidence collected

- Re-ran plate measurements then the asset ledger: 2,283 indexed plates downloaded/measured, zero fetch or measurement failures. The dated ledger is a development-catalog snapshot, not live site proof.
- Read the public Convex family groups and Matrix rows without mutation. Coverage is recorded in `coverage.json`. There are 119 existing hero registry entries for 113 current groups: Elegant 33, Boston Round 29 entries / 23 groups, Slim 15, Sleek 21, Diva 21.
- All groups have an existing registry candidate. One Diva hero SKU (`GBDivaFrst46DrpGl`) was absent from the current Matrix response despite being present in the broader ledger. Hold identity reconciliation; do not fabricate a replacement or infer retirement.
- Saved original-byte SHA-256, decoded dimensions, source mapping, catalog identity and historical landmarks in `intake.json`. Existing image files were not changed. No image generation or publication occurred.

## Elegant first visual assessment

33 images were inspected in four same-canvas contact sheets: 15 mL (7), 30 mL (4), 60 mL (12), 100 mL (10). Compared with actual files in the September 22 Cylinder / Circle / Round / Empire pilot registries, not their older fallback registry rows.

- 16 clear images: reuse candidates, subject to source geometry, new export and alignment checks.
- 16 frosted images: regeneration candidates. Their comparatively opaque white, flat appearance differs from the approved frosted material reference. This is an assistant recommendation, not new user approval or a generation instruction.
- 1 clear image, `GBElg15MinarCu`: source hold. Its recorded source is a legacy website GIF, not a verified master PSD; its apparent body scale differs from other 15 mL examples. Preserve it while recovering source evidence.
- 32 of 33 recorded master PSD paths exist. File existence does not prove visual geometry or layer identity; exact composites still need inspection.
- All 33 existing image hashes match the historical September 7 alignment record. They are 1560 × 1716, not final 2080 × 2288 exports. Recover original full-resolution renders before choosing upscaling or regeneration.
- Historical measurements are not one coherent new lock: 15 mL recorded shoulders span roughly 45.29–52.01% canvas Y; 30 mL span 37.63–48.21%; 60 mL standard assemblies span 36.48–44.10%. Eight vintage assemblies have no historical shoulder/base coordinates. Check physical profile and master composites before selecting one target per shared body.

## Review surface

Run `node scripts/hero-families/audit-next-five.cjs` from this worktree. It writes thumbnails, capacity sheets and `index.html` to `output/next-five-salvage-2026-09-23`. Serve this directory locally; review started at http://localhost:3064/#elegant.

Contact sheets show original composition without additional transforms. Optional web guides display the fixed 91% base and hash-matched historical shoulder coordinates; they are explicitly not new approved targets. The other four families are inventoried but their visual salvage assessments remain pending.

## Original intake sequence (completed or superseded for Elegant)

1. Recover Elegant source composites and full-resolution originals; resolve the Minar source and eight vintage landmarks.
2. Establish proposed Elegant body locks per physical profile and capacity, preserving proportions and the 91% base, with sidecars and complete bulb/tassel/dropper assemblies following user policy.
3. Show the source comparison and salvage decision before regeneration. Then prepare a small reference-guided Sunburst 2.5 pilot using the same approved clear/frosted material photos and premium lighting treatment as the four completed hero families. Do not let a material reference replace the Elegant geometry.
4. Validate final 2080 × 2288 exports against identity, geometry, shoulder/base and component presentation. Approval binds to the new bytes. No production registry or API changes in this intake.
5. Continue Boston Round, Slim, Sleek, Diva in order. PDP/Builder component checks remain separate from hero appearance approval.

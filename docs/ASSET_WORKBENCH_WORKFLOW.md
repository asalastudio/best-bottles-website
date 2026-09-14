# Best Bottles family workflow — current direction, 2026-09-12

Jordan's September 12 instructions supersede the original handoff's blanket `familyId`-only render-group change. A family ID can contain distinct physical profiles. Never derive product identity, applicator or a physical profile from SKU spelling or a filename.

## Active priority — catalog plates, September 12

Jordan paused further kit work and selected Cylinder, the largest remaining catalog family, as the next plate batch. The default asset ledger now tracks all 28 plate-applicable families. Finish plates family by family; kits and heroes remain separate paused lanes. Preserve approved bytes, reuse existing master-source plates, and prepare same-zoom family comparisons for new plates and corrections. No new family release is authorized by the earlier Boston ship instructions.

The ledger refresh recovered 25 completed Boston rows that were incorrectly blocked by historical findings: 18 source mappings and seven sizing findings. Those findings remain in ledger history and are superseded only while the reviewed replacement, its exact master source, its locked standard, and every served view still match. Boston plate completion is 123/123. Before Cylinder sign-off, global completion was 288/2,312. Scope is not yet reconciled against all legacy storefront variants.

Jordan signed off on Cylinder's 373 eligible existing plates. The measured ledger at 2026-09-13T05:45:24.579Z records 373/443 Cylinder plates complete, with 63 reconciliation records and seven missing plates retained as explicit holds. Global completion is now 661/2,312; 431 are ready for review, 702 need reconciliation, and 518 need plates. All 1,909 indexed plate images were remeasured with zero download or measurement failures. This is recorded visual approval of existing indexed bytes, not a new release publication or a shared physical-height lock.

Complete bulb, tassel, dropper, reducer and atomizer tops are assembled swaps. Their cap-off views are not required. `src/lib/products/closure-presentation-policy.json` supplies the same catalog-applicator rule to the ledger, family contact sheets, desktop and mobile presentation. Genuine removable caps retain their paired views. No component identity is inferred from SKU spelling. The original Cylinder approval history is preserved; 18 bindings were updated to the identical approved assembled image after removing their unnecessary cap-off requirement. New image bytes still require a new review.

Jordan subsequently approved all 63 remaining existing Cylinder cap-on images and confirmed that all cylinders shown looked accurate. All 436 existing cap-on images now have exact-byte appearance approval in the same family decision history. The 373 full plate approvals are preserved independently. Seven records have no plate and are excluded from visual approval. Source, required cap-off, historical sizing and publication checks are not waived by cap-on appearance approval.

The workbench shows cap-on appearance approval separately from complete plates. The canonical family batch service accepts `scope: "cap-on-appearance"` with the current sheet token, decision revision and per-row `appearanceBinding`. It validates exact catalog identity, local image bytes, the current live image URL and served SHA before one atomic write. The appearance binding covers the cap-on view only, so later cap-off work does not send an unchanged cap-on back for appearance review. A changed cap-on or a newer correction request invalidates its appearance sign-off. Full plate approvals retain their separate required-view and technical checks.

Jordan identified the seven Cylinder “Needs a plate” records as duplicates/ghosts. Exact live lookups confirmed all seven carry retirement metadata and each maps to a distinct canonical product already holding an approved cap-on plate. The refreshed ledger at 2026-09-13T06:09:43.053Z now counts 436 active Cylinder records: 373 complete, 63 technical reconciliation, zero missing and zero awaiting appearance review. The seven retired copies remain in the raw ledger and visible duplicate register. Global plate counts are 2,305 active, 661 complete, 431 review, 702 reconcile and 511 missing. Existing sheet files, approval history and every image binding are unchanged. Evidence: `docs/reviews/catalog-plate-ledger-2026-09-12/cylinder-duplicate-validation.json`.

Reviewed duplicate records belong in `data/asset-ledger/plate-scope-dispositions.json`, outside the active plate denominator and contact sheet. Preserve the raw catalog rows and show the retired-to-canonical crosswalk in the workbench. Never filter by SKU spelling. Each disposition binds to the exact retired and canonical record fingerprints, Jordan's scope decision and captured identity evidence. The ledger refresh queries both exact records and checks retirement metadata, current catalog identity, the recorded product ID or alias relationship, and the canonical product's continued inclusion. Any drift or unavailable lookup returns the duplicate to an explicit reconciliation hold. This changes plate work accounting only; it does not delete products, transfer image approvals or publish assets.

For Cylinder cap-off recovery, Jordan approved the method of keeping the approved cap-on image for finish swaps and removing the cap to expose the roller. Prefer an existing exact uncapped master view; otherwise hide only a verified separable cap layer when the photographed roller and neck exist beneath it. A flattened photograph does not reveal hidden pixels, so do not invent the roller. Preserve cap-on-only switching if recovery remains unresolved, and keep the cap-off gap explicit. Plain screw-cap bottles reveal the glass opening, sprayers reveal their actual spray head, and assembled bulb/tassel/dropper/reducer rules remain unchanged.

The source audit in `docs/reviews/cylinder-capoff-recovery-2026-09-12/source-audit.json` retrieved 30 paired master source previews and one off-only source among the 63 technical holds. All 29 roller rows have uncapped master candidates (28 lack an indexed cap-off; one already has it). Four capped source files need layer inspection; 28 source mappings remain open, not proven absent. Four example cap-off source images were visually inspected and showed fitted rollers. These are original source previews, not newly aligned plates, approval transfers or publication. Source and sizing holds remain independent. The paired source gallery is `docs/reviews/cylinder-capoff-recovery-2026-09-12/index.html`. Jordan subsequently approved that gallery ("these look great. This is exactly what we needed"). `data/asset-ledger/cylinder-approved-capoff-sources.json` records 31 source sets and 61 shown source views, each bound to its master PSD hash, preview hash and exact catalog group. This approval excludes the four capped-only files and 28 unresolved source mappings, which were not shown as review cards. Reuse the accepted source views for plate preparation; do not ask for their unchanged source review again. Final normalized outputs still need their own byte-bound review and release instruction.

Jordan subsequently approved the final normalized Cylinder comparison at `/reviews/cylinder-capoff-final-2026-09-12/index.html`: “Aeverything looks great. Let's move forward.” `data/asset-ledger/cylinder-capoff-final-decisions.json` binds that approval to the immutable review packet and 52 new image files across 30 configurations, plus one retained pair. The technical review clears 25 paired configurations for the staged release. Five reviewed 9 mL rows retain historical sizing findings; one also has an existing cap-off alignment failure. The silver 30 mL sprayer source was found to be still capped and is explicitly excluded from cap-off completion. There are 29 actual new cap-off files, 22 master cap-on replacements and one held capped sample. The earlier source-gallery count is history, not proof that the sprayer has an uncapped view. Another 32 source rows remain open. All previous cap-on approvals and original source approvals remain intact.

Jordan gave the release-specific **ship** instruction for the 25 Cylinder pairs. All 25 were published to the development catalog used by localhost:3040, with zero publishing errors, skipped rows or duplicate identities. All 50 hosted view assets match the approved SHA-256 hashes; both SKU lookup forms resolve; all five family metadata records and unselected rows are unchanged. The refreshed ledger after indexing moved reconciliation from 63 to 38 and placed the 25 pairs in approval registration. Their existing visual approvals have now been registered against the current views, with all 827 earlier history entries preserved. The final measured ledger at 2026-09-13T07:23:19.385Z confirms **398/436 Cylinder plates complete**, **38 reconciliation holds**, zero review and zero missing; global completion is **686/2,305** (431 review, 677 reconcile, 511 missing). See `docs/reviews/cylinder-capoff-final-2026-09-12/README.md` and its ship records. No further approval or ship instruction is required for these unchanged 25 pairs. New small previews reuse the exact approved plate bytes; no thumbnail images were generated. Desktop/mobile cap-on/off and a 5 mL finish swap passed in the actual local UI. This media release is not a production website deployment. The 19 replaced fronts make 19 old kit plate-hash bindings stale; their parts and records remain intact for the deferred kit lane.

The next largest family after Cylinder is Elegant, with 290 catalog records. Complete Cylinder's outstanding technical reconciliation before calling its entire plate lane complete. Preserve all approved cap-on images, and do not ask Jordan to repeat their unchanged appearance review.

On September 13, Jordan asked to finish the 38 Cylinder holds. All 38 now have prepared cap-on/cap-off pairs in `docs/reviews/cylinder-final38-2026-09-13/prepared-v2.json`. Every pair passes body alignment (worst 3.1762/255, limit 12); 33 existing front files and four previously approved roller pairs are reused. The incorrect plastic black-dot roller cap-off is corrected. Six sprayer pairs use approved master sources, 24 plain short-cap views use four original master bare-glass layers, and three plastic flip-top cap-off photographs were recovered from exact legacy product pages. No component or shadow was fabricated. The 27 original legacy fronts remain accurately labeled and require explicit acceptance under the current master-based completion definition. The final sheet has one local batch-approval button with separate image and legacy-source acknowledgments; it does not publish. All 76 release views are staged with a successful read-only exact-SKU preflight. The measured ledger remains 398/436 complete and 38 reconcile until final review, release and indexing. Prepared-pair progress and the final sheet link now appear in the workbench. See that review folder's README for exact remaining release work; do not rerender the approved siblings or treat this preparation as ship authorization.

For this machine's ledger commands, use the existing image runtime at `/opt/homebrew/bin/python3` (prepend `/opt/homebrew/bin` to PATH). The separately installed Python.framework runtime lacks NumPy. Run plate measurement successfully before the ledger build; never bypass a failed measurement.

## One family at a time

1. Reconcile the ledger and current image bytes. Keep plates, kits and heroes separate. Count Sunburst completion by the full product-group inventory, not by image count. Preserve unmatched records and unresolved source/size findings.
2. Reconcile physical bottle profiles and exact source mappings. Use catalog group IDs until a reviewed physical crosswalk allows groups to share a standard. Tall and footed Rectangle are distinct profiles even when an old family ID is identical.
3. Confirm the current family's physical bottle standards, then complete its plate review. Kits and heroes are paused under the active priority above. Check the actual selected SKU, cap-off view, component swaps and desktop/mobile product experience. Obtain exact-byte visual approval and Jordan's release-specific “ship.”
4. Verify that release and repeat for the next family. Rerun measurement followed by ledger build after each step; explain expected movements. Stop on unexpected changes.

## A persistent bottle-size standard

`data/asset-ledger/bottle-standards.json` owns physical bottle standard records. Review-card feedback remains image-specific history and cannot overwrite a standard.

The key describes the actual bottle shape/profile and capacity. Membership is an explicit list of catalog product-group IDs; colors and compatible closures share the same bottle standard. Record neck differences or distinct profiles explicitly rather than merging them by a broad family name.

Keep physical dimensions separate from presentation dimensions. A value measured to the top of a fitment cannot be silently relabeled as glass height. A shared glass reference requires verified glass landmarks and a recorded reference image hash. Baseline, canvas and glass framing must be explicit for each asset presentation; kit parts inherit the plate's exact registration.

A standard has its own version, reference hash, target, measurement definition and Jordan's approval evidence. A changed image does not change that record. A new standard version requires a separate explicit decision and an impact report; it never silently rebuilds approved siblings.

### Workbench controls

The family selector above the standards filters both the reference cards and the plates/kits/heroes workspace. Select “Review [size] standard” to choose a reference, save a sizing request (presets or a custom percentage), and review a prepared comparison before locking. Reference-choice approval is separate from the shared height approval. Requests persist in `bottle-standards.json` and retain their reference hash, version, author, time and decision history. Saving a request never changes an active lock, another size, sibling image approvals, or published assets.

Jordan clarified the measurement on September 12: **full bare-glass height, from the glass bottom to the top rim, including neck and threads, excluding components**. Shoulder-based values and historical fitment heights are not interchangeable with this measurement. The catalog presentation baseline is 91%. Older plate registration uses a different canvas/baseline and requires explicit reconciliation; a hero-height lock does not silently rewrite plate or kit registration. Parts inherit the verified bottle coordinate system but still need their own physical scale, attachment registration and image approval.

Sizing options describe a relative uniform scale change, never a vertical stretch. A request such as “a little taller” can be saved with no numerical amount; it does not invent a target. Jordan subsequently selected +3% for 30 mL and confirmed 0% for 15/60 mL. A request queues work; it does not automatically run a renderer. Boston comparison preparation is now implemented in `scripts/asset-ledger/prepare-boston-standards.py`; applying locked standards across all family assets remains to be integrated.

Locking is disabled until a prepared review supplies verified master-source lineage, bare-glass identity, registered rim/base landmarks, the same-canvas before/after image hashes, bounds and physical-group checks. The capped Boston reference images do not expose the rim. Their exact master PSDs do contain isolated glass layers: Layer 4 for 15 mL, Layer 22 for 30 mL and Layer 6 for 60 mL. These were visually inspected and used to prepare bare-glass standards calibrated against the approved hero bodies. Typical visible-body alignment residuals are about 2 pixels; the recorded 95th-percentile residuals are 9–16 pixels on the 1560 × 1716 frame. This is documented calibration, not a claim that generated appearance is pixel-identical to the master.

The three prepared bare-glass comparisons use a fixed 91% baseline. 15 and 60 mL before/after bytes are identical; 30 mL uses exactly 1.03 uniform scale. The original hero images and shadows are untouched. Approval locks the exact bare-glass standard bytes, preserving the appearance reference separately. It does not replace the catalog hero or approve changed SKU images. `docs/reviews/boston-glass-standards-2026-09-12/` records source hashes, registration, transforms, affected SKU/group IDs and comparison assets. The approval service rechecks evidence when saving, rejects stale tabs and changed image bytes, and preserves the previous version when approving a revision.

Decisions can currently be saved only in the local development workbench. The endpoint rejects production and cross-origin requests; deployed staff views remain read-only. A ledger rebuild includes saved decisions, while refreshing the local page reads the current records directly.

The three Boston standards (15, 30 and 60 mL) are now locked at version 1 by Jordan's saved local review actions. 15/60 retain their size; 30 mL uses +3%. Each preserves its original Sunburst appearance reference separately from the approved bare-glass standard.

After locking, the workbench opens “Match Sunburst.” Its side-by-side browser preview uses the original appearance file at the measured uniform scale and fixed baseline; it creates no new image bytes or approvals and never edits shadows. It checks the active approval packet, source hashes, canvas and locked targets before displaying the preview. The 30 mL reference previews +3%; 15/60 preview unchanged. A later revision with missing or stale registration is held instead of compounding an earlier percentage. The 30 mL reference now has a saved final-image candidate and inline approval card. “Review final 30 mL image” opens its real before/after files and Approve/Needs changes controls. Feedback is stored in the existing hero-review library and appears in the next ledger build. Candidate bytes, the active standard, exact catalog membership and stale decision revisions are checked on save. Desktop/mobile product verification and release remain separate next steps.

`scripts/asset-ledger/bottle-standards.mjs` resolves explicit group membership and calculates a uniform geometry plan only for a locked standard with verified source landmarks. It rejects stale versions, incompatible measurements and clipping. This is a tested planning foundation, **not an integrated image-resizing pipeline**. Rendering integration and landmark verification remain work to complete before automatic normalization is claimed.

Prepare normalized original assemblies before enhancement. Check generated output against the standard and return drift to review. Code must never edit shadows. The Frosted prompt remains verbatim, with only the bottle's own input image.

## Current ledger meanings

The dashboard reports a development-catalog snapshot, not production verification. Green plate counts require current-byte measurement, an existing master PSD source, required views, no recorded source/size/integrity hold, and matching visual approval. Those checks are evidence for review; live catalog reconciliation and product-experience checks remain separate release requirements.

Current measurements use exact catalog-group cohorts conservatively. They are diagnostics, not approved glass landmarks. Earlier 174 size findings remain open even if a different cohort no longer flags them. Changing a ruler is not fixing an image.

Review-only SKUs, catalog records lacking SKUs, unclassified collections, and source holds remain visible. Unknown collection types cannot become hero approvals. Review assets are hashed; newer bytes cannot inherit older approval. Superseded r12–r14 cards do not supersede r15. Kit approval must also match the current plate hash.

The kit CSV remains a dated source; `ASSET_LEDGER_KIT_LEDGER` can select a reconciled replacement explicitly. New audit results must be integrated deliberately and identified in the ledger sources; running an audit elsewhere does not update this ledger automatically.

## The legacy site is the completeness authority — Jordan, September 13

Jordan's instruction: *"We have all the files we need on our desktop, and if you need
anything else, you can always scrape the assets from the current Best Bottles legacy
site. There's nothing that we cannot get right now. If it's not present in the Best
Bottles legacy site, then that means it doesn't exist."*

This was measured against the live site on 2026-09-14 rather than assumed.
**All 833 outstanding plate rows have a live legacy image. None are unobtainable.**
821 have a legacy product page; the other 12 have no page but their image files are
live at the standard paths. `Alu250mlSprayBlack` looked like the single exception and
was not: the legacy site sells it as `Alu250SpryBl` and serves its image as
`Alu250mlSprayblack.gif` with a lowercase b. That alias is now recorded in
`data/legacy/legacy-aliases.json` with the description evidence that established it,
never the spelling.

`scripts/asset-ledger/reconcile-legacy-assets.py` re-runs the check and writes
`data/asset-ledger/legacy-asset-reconciliation.json`, which the ledger build reads.
Every outstanding plan row now carries its `legacyAsset`, so a source hold reads as a
task with a known fallback instead of a dead end. Re-run it whenever the catalog or
the plan changes; it downloads nothing and publishes nothing.

Three rules govern its use:

- **The master PSD stays preferred.** Legacy files are 600x800 or 360x480 GIFs and the
  plate canvas is 1000x1100. A legacy image is a fallback where no master view exists,
  and it is recorded as a legacy source, never silently promoted to master lineage.
- **Identity still never comes from a SKU string, a filename, or a URL.** A legacy row
  matches through the exact SKU the legacy page prints in its own heading, or through
  an alias recorded with substantive evidence.
- **"Not on the legacy site" is a finding to bring to Jordan, not a licence to delete.**
  Several catalog records absent from the legacy sitemap are active Shopify products
  with master PSDs. Absence removes a product from scope only on Jordan's explicit
  scope decision, recorded in `data/asset-ledger/plate-scope-dispositions.json`.

The legacy sweep lane itself (`scripts/legacy/sweep_legacy_site.py`, `data/legacy/`)
was recovered from commit `67c62efb`; it had never been on main. Its catalogue snapshot
is dated 2026-09-02, so re-run its `catalog` and `expand` phases before relying on it
for scope rather than for assets.

## Release rules

The sole PSD root is `BB-PSD-Files-Master`. Preserve unresolved SKUs as holds and fabricate no components. Every visual change gets a same-zoom before/after with measurements. Approval binds to SHA-256; changed bytes return to review. Nothing is published without Jordan's “ship” for that named release. Never commit `.claude/launch.json`.

## Whole-image sizing clarification

Jordan explicitly authorized “sure resize whole image is fine” during this session. This permits one uniform transform of the existing complete photograph, including its original shadow, for this sizing correction. It does not authorize selective shadow edits, reconstruction, component fabrication or publication. The 30 mL candidate uses the original approved Sunburst pixels at 1.03 scale on the same 1560 × 1716 canvas; 15/60 originals and standards remain intact. The earlier generated edit attempt was rejected for canvas/framing drift and is not a review candidate. A future faithful image needs resizing only; regeneration is reserved for actual fidelity defects.

## Matching capped and uncapped views

Jordan confirmed during Boston source recovery: wherever a cap-off view exists, the exact bottle/component configuration must also have its matching cap-on view. Two cap-off files are one view, even if one sits in a folder named Capped. Classify the actual pixels, retain duplicate file lineage, and keep an unmatched view as an explicit hold. An assembled photograph that hides a roller cannot establish the hidden roller identity on its own; a shared capped image needs an explicit catalog/source crosswalk supported by the matching exposed assembly.

Original source approval remains separate from pair completeness, normalized plate approval, kit approval and release. A newly recovered counterpart is a new byte-bound review candidate. Show it beside the original counterpart at the same zoom, preserve approvals for unchanged assets, and return completed plates as a family contact sheet.

## Dropper presentation rule — Jordan, September 12

Droppers remain assembled when a customer changes finish swatches. Use the exact selected configuration’s assembled photograph or a fully reassembled, validated kit. Do not offer exploded or cap-off dropper views, remove only a bulb/collar from the image, or fabricate an exposed glass pipette. The approved glass standard and registration stay fixed. The absence of an isolated pipette is not an assembled-presentation defect; a complete exposed dropper is not required for this mode. Historical separated-part previews remain evidence only and are excluded from the normal dropper review. Other applicators retain their existing view capabilities. Plate, assembled-kit validation, kit approval and release remain separate; this rule does not approve or publish candidates.

## Boston roller presentation rule — Jordan, September 12

Metal and plastic roller inserts in these Photoshop assemblies are cropped below the seating edge. Keep the insert installed in the glass. Allow a verified exact-configuration cap-off photograph (or validated seated body/roller stack with only its removable cap removed); do not expose the insert as a floating exploded component or fabricate its lower plug. Disable full exploded mode for Boston roll-on configurations, including restored session modes. Finishes and roller materials still resolve the exact catalog configuration. This does not remove the need to verify metal versus plastic imagery or assembled kit parity. Historical exploded previews stay as evidence, outside the normal review.

## Preservation and final Cylinder approval — September 13

Jordan saved approval for all 38 final Cylinder pairs, with explicit legacy-source
acceptance, at 2026-09-13T15:09:47.734Z. The approval and all 76 staged views are
frozen in docs/reviews/cylinder-final38-2026-09-13/approved-lock.json. No further
review of these unchanged bytes is required. The family remains 398/436 complete
until the named release is authorized, indexed and verified. Boston remains
123/123 complete in the development snapshot. Code, approvals, source records,
comparison images and otherwise-ignored release outputs are preserved under the
Boston/Cylinder PR and docs/releases/boston-cylinder-2026-09-13/. A Git commit
or merged PR does not by itself move development media into production.

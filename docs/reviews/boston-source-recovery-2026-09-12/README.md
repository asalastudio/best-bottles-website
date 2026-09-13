# Boston Round missing-source recovery

Recovered original merged PSD previews for all 33 currently unplated catalog configurations: 5 at 15 mL, 8 at 30 mL and 20 at 60 mL. There are 50 candidate source views. Jordan subsequently approved the 33 displayed original source sets in the Codex conversation. This approval is separate from finished plates and applies only to the recorded bytes. No source PSD or existing plate was modified.

Each candidate is located using image links returned on the exact recorded product page, with both the page heading and Item Name required to match the catalog SKU. Product identity comes from explicit catalog fields and the page record, never from parsing SKU strings or filenames. Candidate filenames are only lookup keys. The two misleading legacy URL slugs were checked against their returned exact SKU and product description.

All preview pixels come from BB-PSD-Files-Master via the original merged preview. No layers were changed and no shadow processing, resizing, generation or production upload occurred. Product-page GIFs are comparison references only.

The supplied uncapped folder contains 137 PSDs; 74 have byte-identical copies in the master. The supplied Original Photoshop Sources folder contains 128 PSDs; all 128 have byte-identical copies in the master. Across the two supplied folders, 24 of the 33 configurations have a byte-identical recovered candidate. The remaining 9 have candidates elsewhere in the master. Differences in the other local files remain unresolved; none were promoted into master or used to overwrite master artwork. See local-folder-comparison.json and coverage.json.

## Review

Open http://localhost:3040/team/asset-ledger?preview=1&view=sources. Size filters show the exact product reference beside the recovered master preview. This is a recovery gallery, with no approval or publication action.

The next production step is to verify each source and its view, register it to the correct locked physical glass standard, and prepare the missing plates on a separate review sheet. Existing approvals must not be inherited by newly rendered bytes. Cap-off completeness still requires a separate check; 33 candidates does not mean 33 complete two-view plate sets.

## Preserved approval state

The 62 plate approvals remain in boston-plate-contact-decisions.json. Its SHA256 at verification is a3310df6fbfffa4db44ce8f098557f95d0dd7181c4adda87186dc1414cd4f320. The agent recorded Jordan's explicit approval of the 33 original source sets in boston-source-approvals.json; no new finished-plate approval was granted. No release was published.

## Cap-on / cap-off reconciliation

Jordan clarified that every cap-off image needs the matching cap-on image. Visual inspection found 15 existing pairs, 2 duplicated cap-off sets and 16 assembled-only source sets. The duplicate sets are GBBstn2ozMtlRollBlk and GBBstn2ozRollShnBlk. Folder labels were not accepted as view evidence.

Another master PSD supplies the capped view for those two visible assemblies. Its companion plastic cap-off image is pixel-identical to the previously approved plastic source. The metal and plastic cap-off images have identical glass and cap pixels; only the exposed roller region differs, with difference bounds (199,132)-(417,312). The cap layer is identical in both PSDs. Exact catalog descriptions specify the same 60 mL clear Boston bottle and shiny black cap. The recovered capped source is shown as a new review candidate for both SKUs; no hidden roller identity is asserted from the capped pixels alone. No cap was fabricated or moved.

The two new capped-view candidates remain unapproved. The original 33 source approvals remain valid; the 62 finished plate approvals and final-image/kit/release gates are separate. The gallery presents the new cap-on and approved cap-off on equal-size viewports using their original equal-size source canvases.

A single exported PNG had an inaccurate manifest hash caused by two concurrent exports generating different ICC profile timestamps. Decoded image pixels and the master PSD were identical. The already-served preview was preserved, its actual hash was recorded, and export serialization now prevents duplicate overwrites. See preview-hash-correction.json. No image was re-rendered to repair the record.

## Final source decision

Jordan reviewed the recovered capped views and explicitly confirmed that the 33 original source sets, cap-on/cap-off pairs and droppers look complete. The two new pairs are now approved against exact master and preview hashes in pair-approvals.json. Runtime validation shows 33 approved original source sets, 17 matched capped/uncapped pairs, 16 assembled dropper source sets and zero pending recovered capped views. This supersedes the pending-pair notes above.

The next task is to prepare the 33 currently missing plates, preserve the 62 approved plates, and resolve the remaining 28 existing plate records before a completed Boston contact sheet. Kit completeness, normalized geometry, final image approval and publication are not established by this source decision.

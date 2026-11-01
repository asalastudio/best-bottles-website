# APPROVED: Cylinder 9 ml clear, black sprayer, revision 3

The accepted 9 ml clear body is combined with the native Photoshop sprayer and collar, plus the GPT dip-tube master approved on November 1. The user approved revision 3 with “perfect” on November 1. The active 9 ml view uses the approved reference-matched milky mechanism; the earlier approved tube remains preserved as its own master. A two-image GPT material-cleanup pilot is available for the white actuator and black collar. The local review has an original-Photoshop toggle and cap-off, cap-on, exploded and bare-body views.

Review: http://localhost:3010/reviews/cylinder9-psd-fitments-2026-11-01/index.html

Approved master folder: https://drive.google.com/drive/folders/1zb0-C5B-35rTgLy9OPLkUYQpTRQQpTGc

Preserved review batch: https://drive.google.com/drive/folders/1UUCxu73O-1jbY8sNViwSms2CQ9X-tu7S

## Approved sources

- `BB_Cylinder_9ml_17-415_Clear_BODY_v04_APPROVED.png` is an exact copy of the fixed-edge v04 body the user accepted. Its native pixels, rim, shape and registration are unchanged.
- `BB_DipTube_GPT_Master_v01_APPROVED.png` is the original built-in GPT image-generator output the user approved for reuse. It is preserved byte for byte. The exact model version is not exposed by the built-in generator.
- `approval.json` records the user's statements, file hashes and approval scope. Revision 3 is approved for this 9 ml clear / black assembly. Other products still require per-bottle fit checks.

## Fitment provenance and cleanup

The preceding review used Blender sprayer and collar images. Their hashes matched `data/register/blender-9ml/measurements.json`. This batch recovers 12 native Photoshop layers across six 17-415 sprayer finishes, with source PSD hashes, layer names and extraction indexes in `psd-provenance.json`. Only the black-collar assembly is integrated and visually checked in this pilot. A historical black-sprayer CDN asset no longer matched its recorded byte hash, so the native PSD files were used instead.

The white actuator and black collar were then edited with the built-in GPT image generator. Their raw outputs and prompts are preserved. The raw actuator's outline aspect drift is +0.126%; the raw collar's is +4.415%. The raw collar is therefore unsuitable as a direct geometry replacement.

The registered SVG layers uniformly place the new material inside clip paths derived from the original Photoshop silhouettes at alpha >=200. This uses the photographic source to control the outer geometry and attachment coordinates. It does not stretch the generated material horizontally. Pixels outside the original outline, including stray white matte, are removed. Highlights inside the component remain. Native PNG exports are 992 x 1208 for the actuator and 1204 x 1028 for the collar. This is a generated material enhancement within the source outline, not proof of additional measured physical detail.

The user liked the generated finish. The registered assembly is approved in revision 3. `edge-verification.json` reports zero nontransparent pixels outside either original outline. Coverage inside the source silhouette is 99.44% for the actuator and 99.99% for the collar. Dark, neutral and checkerboard screenshots are included.

## Reusable tube and fit

`tube-layer.mjs` retains the earlier approved master and length-adaptation method. After seeing the assembly, the user supplied a product photograph showing a longer milky pump housing below the collar. `BB_17-415_Pump-and-Tube_Reference-v02_REVIEW.png` is a new built-in GPT generation based on that photograph. `pump-reference.png` preserves the source. The mechanism is approved for this assembly. Other product assignments still require compatibility and fit checks.

`tube-reference-layer.mjs` powers the current review. Longer versions extend only a straight tube section. Shorter versions trim the shaft and reposition its original end detail. The housing and shaft width stay fixed. The 27 mm, 52.3 mm and 100 mm length studies use one display scale.

The current 9 ml presentation uses a nominal 1.4 mm tube diameter and 52.3 mm visible mechanism-to-tip length. The housing begins 12.2 mm below the rim, immediately under the collar, and the tip ends 5.5 mm above the exterior base. These are visual presentation targets inferred from the photograph, not manufacturer-certified tube dimensions. The mechanism is milky polypropylene with a slender naturally bent tube. Compatibility with other pump housings must be checked before reuse.

The user requested a flush collar-to-shoulder contact line. The final collar lift is 0.7 mm relative to the PSD's historical rim anchor. Its lower boundary is within 0.04 mm of the body's shoulder reference at source row 480, with no movement of the body itself. This corrects the earlier 1.5 mm lift, which exposed a small gap. The translucent mechanism remains visible beneath the collar. See `seating-v03.json`.

In assembled views the mechanism is behind the transparent glass layer; in exploded view it moves with the sprayer. This is image compositing, not a new optical ray-tracing simulation. The clear overcap is the previously approved v6 asset and follows the raised external head in cap-on mode.

## Verification and limits

Eight desktop/mobile states passed image loading, uniform body sizing, stable body placement, visible-part frame bounds and horizontal-overflow checks. Two length-study checks passed constant-width checks. Approved body and tube hashes are unchanged. See `browser-checks.json`, `edge-verification.json`, the product-size screenshots and `tube-length-studies.png`.

All other bodies should be assessed against the accepted clear body's material quality while retaining their own measured geometry, approved size-curve target and family exceptions. This batch does not approve or update the rest of the catalog, the other five sprayer finishes, normal PDP assignments or the standalone builder. The review uses an isolated local iframe over the actual PDP. Production and database records are unchanged.

## Recovery

Restore the local review with `node docs/reviews/cylinder9-psd-fitments-2026-11-01/restore.mjs --apply`. The restore script verifies every manifest entry before copying any runtime file and backs up conflicting existing files. `archive-verification.json` records a successful restore into a fresh temporary directory and archive CRC/hash checks.

## Final approval

The user approved the exact revision 3 assembly after the collar contact line and milky mechanism were corrected. `assembly-v03-approved.json` locks five asset hashes and the registration settings. The earlier approved tube master, raw generations, original Photoshop layers and previous review evidence are preserved. This approval does not deploy the assets or approve other colors and sizes.

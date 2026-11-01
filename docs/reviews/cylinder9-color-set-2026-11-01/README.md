# Cylinder 9 ml / 17-415 shared masters, November 1

The selected library version is 77bb10d2a151. It contains five fixed bottle bodies and shared component layers. Amber and Cobalt Blue material revision 4 were accepted by Jordan: “Yes, use those. That looks much better.” Earlier versions remain preserved.

Local review: http://localhost:3010/reviews/cylinder9-color-set-2026-11-01/index.html?glass=amber&finish=gold

Actual product: http://localhost:3010/products/cylinder-9ml-amber-17-415-finemist?sku=GBCylAmb9SpryGl

Builder: http://localhost:3010/matrix?family=Cylinder&sku=GBCylAmb9SpryGl

Family Drive folder: https://drive.google.com/drive/folders/1sA98vHrYW07HtsEywivMjMVPPwN-kP3v

## Selected artwork

The final Amber and Cobalt Blue use darker glass absorption and broad, natural studio-light reflections. Their material guides include Jordan's Boston Round examples and later darker references. Frosted uses the supplied soft satin reference, with a clear threaded neck and a transition at the shoulder. Swirl uses the same fixed outer geometry, with one pattern layer.

The built-in GPT image generator produced nine selected color/material layers through 18 total edits. Its exact model version is not exposed. This batch is not described as a verified Sunburst API run. Two red alternatives, three later material transfers, and two successive Amber/Cobalt refinements are retained. The selected red follows the satin anodized-metal example and Jordan's “yes.”

All body materials retain the approved native 743 x 2116 coordinate frame and fixed outer silhouette. An eight-pixel material bleed fills narrow edge gaps within the silhouette. Surface reflections and internal glass detail are generated, so silhouette registration is distinct from dimensional certification. The Clear source remains byte-identical.

Collars use one smooth cylinder contour to remove the inherited PSD cutout notches. Native 1204 x 1028 dimensions and physical placement anchors remain fixed. The shared actuator received alpha-edge cleanup without altering its solid interior RGB. Original source artwork is preserved in before-edge-cleanup/. No new actuator, mechanism or overcap generation was needed.

The approved Clear body, original Black/White components, mechanism, clear overcap and existing 5 ml sources were checked against their saved SHA-256 values. See preserved-sources.json.

## Shared local integration

canonical-library.json and src/lib/products/cylinder9-master-index.json identify the exact immutable PNG URLs, dimensions, sizes and SHA-256 hashes. The runtime lives in public/local-kits/cylinder9-masters-2026-11-01/. Each glass color has exactly one body URL across all 145 9 ml / 17-415 catalog configurations.

PDP and Builder consume the same kits.json through the existing local component-kit reader. Builder chooser, live preview and product-specific entry links use those bodies. The catalog loads the same exact-SKU kit through a localhost-only endpoint. Its finish-selection path takes precedence over old baked-photo swaps, so a collar change keeps the selected master body.

Thirty fine-mist combinations use the shared actuator, six collars, one clear overcap and one fitted mechanism/tube. Their fit and scale follow the accepted Clear/Black revision 3 assembly. The tube presentation targets remain 1.4 mm nominal outside diameter, 52.3 mm visible length and 5.5 mm clearance above the external base. These are approved visual alignment targets, not manufacturer tube specifications. Colored glass hides internals when assembled and reveals them in exploded view; Clear keeps the accepted visible internals.

Other 9 ml component configurations reuse the same five body masters with their existing hardware. Their body identity is checked across all 145 records. The 180 visual checks below apply specifically to the 30 fine-mist combinations; they do not constitute new visual approval of every roller or lotion-pump assembly.

The current review iframe displays the actual product page without replacing its artwork. review-isolated-v01.mjs preserves the earlier isolated comparison method. The contact-sheet gallery is a separate material/combination overview.

These integrations are development-only and disabled on Vercel. No production database writes, media uploads, merge or deployment were performed.

## Verification and recovery

actual-pdp-checks.json: 180 actual product-page checks, covering 30 SKUs, three views and desktop/mobile. All passed: correct body URL, fixed body position and size, loaded parts, no cropped part boxes, no page overflow and correct tube visibility.

cross-surface-checks.json: all 30 catalog collar selections retained their exact body/collar URLs and SKU link; all five glass colors followed the product-page CTA into the corresponding gold-sprayer builder configuration. No browser errors occurred.

The focused unit suites cover master integrity, all 145 records, production/host gating, catalog legacy behavior, register assembly and builder framing. TypeScript is checked separately. verification.json records the final commands and results.

Fourteen native masters are saved individually with dimensions/version/status in their file labels. drive-native-receipt.json verifies their names, sizes and family-folder placement. Local hashes are retained alongside the Drive metadata; metadata verification is not a remote-content hash comparison.

The full Drive ZIP includes raw generations, editable SVGs, source evidence, prompts, before/after images, current native masters, runtime files and a SHA-256 manifest. source-code/ contains the integration code for inspection; Git/PR #382 preserves the integrated application. Run node restore.mjs --root /path/to/checkout --apply from the extracted package to restore the local review and native-kit runtime. It checks every package file before writing and backs up conflicting destinations. archive-verification.json records a restore into an empty temporary directory and ZIP integrity/hash checks.

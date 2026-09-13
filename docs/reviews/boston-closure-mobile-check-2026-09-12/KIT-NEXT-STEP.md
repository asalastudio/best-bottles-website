# Boston kits: reuse and interaction checks

The local product preview currently displays complete plate images. A cap-off photograph is still a plate. It is not evidence that independently swappable kit parts are live.

The current workbench catalog contains 123 Boston configurations, all covered by 62 approved indexed plates or 61 prepared candidates. This is coverage of the current workbench catalog, not a new certification of legacy catalog completeness. Existing records do not offer every finish in every material, color, and size; do not create combinations to fill a rectangular matrix.

There are zero live Boston kits. The existing kit inventory contains 25 candidates, 65 holds, and 33 rows awaiting an indexed plate. All 25 candidates record the current indexed plate hash; 21 correspond to plates preserved in this review, and four correspond to newly corrected plate candidates. Recheck those four against the proposed new geometry before reuse. Reuse still requires source, alpha-edge, registration, component-role, visual, and current-byte checks.

Kits can retain the registered glass layer while changing an actual photographed cap, roller, or dropper. They enable controlled component transitions and cap removal. Preloading and decoding are also required for a smooth experience; more layers do not automatically mean a faster page. Maintain the complete plate as a fallback until the correct kit is ready.

The existing product UI accepts Grace commands for exact SKU, listed cap option, roller material, and cap-on/off state. Those commands use the same product selection logic as the picker. Kits improve rendering; they do not define valid combinations or prices. A complete spoken Grace conversation remains a separate verification task.

Next production sequence: save the finished-plate batch review for the exact candidate bytes; reuse and revalidate the existing kit candidates; create missing kits only from verified master parts; show a kit comparison against its corresponding plate, including exploded and cap-off states; verify swatches, rapid changes, mobile rendering, and Grace commands; then obtain kit approval and release-specific ship. Plate and kit approvals remain separate. No status or publication changes were made during this check.

Code inspection confirms a separate rendering integration is required: `ConfiguratorPdp` prefers the exact plate except for exploded/missing states, and `MobileProductPdp` suppresses kit layers when the corresponding plate is decoded. Publishing a kit alone will not enable layer-based swatch transitions. Enable and validate that behavior in a local kit pilot, with the plate retained as fallback, before claiming the interaction is complete.

The Grace frontend command hook was exercised separately: matte-gold metal roller selected the exact catalog variant GBBstn1ozMtlRollonMattGl (Grace alias GB-BSR-CLR-30ML-MRO-MGLD), and a cap-off command loaded its recorded cap-off image SHA-256 979b668e105d8c24fa101fa4fc5ffc4b760b72424d0e46e82433b65e2a1331ca. See `grace-hook.json`. This did not test speech recognition, the conversational model, or production deployment.

Mobile verification completed: all 69 current Boston roll-on configurations across six size/color groups resolved distinct catalog SKUs and loaded their corresponding plate. All six groups passed cap-off viewing and had no horizontal overflow or JavaScript page errors at 390 × 844. Dropper and short-cap variants were inventoried, but were outside this roll-on interaction test. Ledger before/after stayed at 62 approved plates, 61 prepared candidates, zero saved candidate approvals, 33 indexed gaps, zero live kits, and 23 complete Sunburst groups.

## Closure finish photo correction

The local PDP now uses an explicit catalog crosswalk for 69 Boston roll-on variants and six existing 20-400 cap thumbnails. Gold/Black no longer fall back to color dots. Identity uses exact catalog records and compatible component links, with Black reconciled against assembly photos; no SKU parsing was added. Desktop and 390px mobile show six decoded photos with no page overflow. TypeScript and 16 existing finish/rail tests passed. All 69 exact catalog mappings resolve; changed group or finish fields are rejected. See finish-review.html, closure-photo-crosswalk.json, finish-photo-check.json and finish-counts.json. No source image bytes, asset approvals, kit availability or publication state changed.

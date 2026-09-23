# Elegant background cleanup — 2026-09-23

User scope: clean the five flagged backgrounds and keep the other 26 unchanged.

Completed locally. Five candidates in `output/imagegen/elegant-2026-09-23/background-cleanup/v2/` have been visually checked and passed background-patch checks. User approved the finished versions on September 23. Locked delivery hashes are in `docs/hero-families/elegant-2026-09-23/approval.json`. Not published.

- GBElgFrst60AnSpGl
- GBElg15Gl
- GBElg60SpryMtGl
- GBElgFrst60DrpGl
- GBElgFrst100AnSpTslGl

All five remain 2080 × 2288. No spatial transform was applied during cleanup; existing shoulder and 91% glass-foot positions are retained. Masked bottle/hardware interiors are byte-identical. The narrow antialias boundary was refined against the old backdrop. Local shadow residuals retain their shape and falloff on the corrected bone background; this does not imply unchanged shadow RGB values.

All five fixed empty-background patches measure exactly sRGB #F5F3EF in each finished image. These patches exclude products and floor shadows. All 31 original aligned export hashes still match. The candidate manifest selects 26 original paths and five finished paths; it does not modify the original aligned manifest.

No image-generation API calls were used for this cleanup.

## Review and lineage

- Review: http://localhost:3065/background-cleanup/v2/
- Five outputs and original hashes: `background-cleanup/v2/cleanup-exports.json`
- Checks: `background-cleanup/v2/qa.json`
- Full 31-image candidate selection: `background-cleanup/v2/merged-family-exports.json`
- Mobile comparisons: `background-cleanup/v2/comparison-1.png`, `comparison-2.png`
- Scripts: `scripts/hero-families/cleanup-elegant-backgrounds.cjs` and `review-elegant-background-cleanup.cjs`

The initial files directly under `background-cleanup/` are rejected v1 scratch outputs (halos/striping); only v2 is selected. The earlier API background test remains rejected and is not selected.

The family still has two ungenerated 30 mL sprayer rows: GBElg30SpryMattGl and GBElgFrst30SpryMattGl. Their source nozzle color is approved. This five-image cleanup did not generate them.

# Cylinder 9 ml approval and builder handoff, October 31

Local review only. No live assets, catalog data or production deployments changed.

Jordan approved the Clear 9 ml fine-mist appearance, the shared clear overcap, and the improved frosted treatment. The overcap is checksum-locked in approval.json and a regression test. Original sources and rejected candidates remain preserved.

The swirl seated tube crop contained a second glass pattern. Its replacement now sits behind the unchanged glass plate in Sidecar and Cap On. The existing narrow mechanism is visible in Exploded. The same registration reaches the builder through assembledKit.

Start Building now includes the current SKU. The server resolves that exact current configuration and opens the Finish step with body, glass, fitment and finish selected. Only the selected body carries its full options on first paint. Reloads retain the entry; unavailable SKUs show an explanation without substituting another product.

Verification:
- 30 fine-mist variants across five glass colors and six finishes, with 90 PDP view checks: images loaded, stable body bounds, one approved overcap, no broad swirl overlay, correct tube stacking.
- Desktop and mobile product-to-builder clicks, changed finish, reload, and invalid SKU handling passed.
- Current builder inventory: 19 families, 45 body choices, 2,125 configurations. Exact-SKU selection round-trips for every configuration. No body API errors or missing chooser bodies.
- 2,098 configurations have full kits (2,058 register-backed, 40 older published kits). 27 have no layered kit. Those are listed in builder-media-gaps.csv; media presence is not visual approval. Six of these also lack their own complete product photo. Do not sign off the entire builder on the strength of these checks.

Evidence is in outputs/catalog-model-repair-2026-10-31/component-review-9ml/renders/: family-90-checks.json, family-contact-sheet.png, deep-link-browser.json, builder-current-inventory.json and builder-coverage.json. Before screenshots remain in the sibling before/ directory. The native Blender overcap scene remains renders/empty-overcap-alpha-v6.blend.

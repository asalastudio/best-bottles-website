# Approved Boston Round and Diva hero release

The user approved and locked all 29 Boston Round and 21 Diva heroes on September 23. This release preserves the exact selected 2080 x 2288 PNG bytes: 47 new Sunburst 2.5 renders plus three reused Boston pilots. The approval file records final hashes, exact SKU/group identity, source hashes, material references, measured framing and publication eligibility. Original API renders and source inputs remain in the ignored local image workspace.

All 50 heroes are eligible for exact-SKU catalog activation using the existing `NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22` flag. The former hold on `GBDivaFrst46DrpGl` was resolved on September 23 after live Shopify verification and restoration of the missing production Convex records. It maps to gold frosted variant `56214700523812`; the clear silver record was corrected separately. The approved PNG bytes are unchanged. Flag-off and Cylinder-only lookup behavior are unchanged. PDP/component layers are not replaced.

Boston uses 42/45/52% shoulder-to-foot spans at 15/30/60 mL. Diva uses 40/47/57% spans at 30/46/100 mL, measured from the closure seat at the cap/glass junction. The glass-foot target is 91%. Complete assemblies and original shadows were uniformly scaled and translated; there was no independent hardware stretch or product recoloring. Source landmark measurement uncertainty is approximately two preview pixels. All final exports have been visually reviewed; no strong-content clipping was detected in the outer 24-pixel band.

All 50 images passed background sampling (95th-percentile maximum channel deviation no greater than 2 from sRGB bone #F5F3EF in reviewed empty regions). Shadows, transparent glass and antialiasing are intentionally excluded. This is not a claim that every background pixel is identical. Guide lines appear only in review sheets.

This is a committed catalog candidate, not a production deployment. Elegant's 31-image release remains in PR #236; its two 30 mL matte-gold sprayers are still outstanding. Sleek is next, with 21 existing source images and approved 5/8/30/50/100 mL shoulder targets.

Rollback: remove the Boston/Diva release import and spread from `catalog-heroes.ts`, leaving all prior families and original registries intact.

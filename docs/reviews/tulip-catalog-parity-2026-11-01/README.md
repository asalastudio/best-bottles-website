# Tulip catalog and product-page parity

The live 6 ml Clear Tulip Matte Gold catalog card used the approved hosted glass and component layers, but the separate SVG renderer omitted trimBottomPct. Its full dip-tube raster therefore extended through the inner glass floor despite the corrected recipe. The source images were current; catalog rendering did not apply the approved crop.

CylinderMasterPreview now consumes stageLayout for its sidecar assembly, just as the product page does. SVG clip paths carry the same permanent tube trim and baseline limit. Opacity, amber blending, component placement, detached-overcap artwork and reviewed canvas frame come from that shared layout. No bottle or component image was regenerated, resized or replaced.

Three component regressions reproduced the missing clip before the change and passed afterward. They verify the clear Matte Gold and Shiny Black tubes stop at the approved interior floor, the amber tube retains its crop and multiply treatment, and there is one tube. Targeted regression checks, TypeScript and lint passed. Production-before evidence records the approved image URLs with no clip-path; local browser evidence records the corrected visible crop.

This correction extends PR #383. Hosted preview verification and full CI on the new head are required before merge. Existing 3.3/4 ml publication evidence belongs to the earlier commit until rechecked on this head. No production deployment is claimed by this README.

# Regenerated clear 2 ml vial body

Jordan requested regeneration of the clear bottle shown in the localhost preview. The built-in Image Generation tool used the corrected, source-extracted clear body as its only reference and produced `clear-2ml-vial-body-candidate-v1.png`, a 1196 × 1315 RGBA PNG. The complete generation prompt is in `prompt.txt`.

The generated PNG is copied unchanged into the local kit assets. Its outside alpha is transparent. The visible silhouette width-to-height ratio differs from the source by -0.476% at a shared alpha threshold of 128. That comparison checks overall proportions, not every thread or manufacturing dimension. The stage applies one uniform scale and translation, matching the source's vertical span, centerline and baseline. No pixel resampling, stretching, masking or source overwrite was performed during integration.

The local preview now uses this body for both `GBVialClr2mlWhtCap` and `GBVialClr2mlBlackCap`. Their corrected PSD cap layers remain in place. Open:

http://localhost:3010/products/vial-2ml-clear-8-425?cap=white

Browser verification passed for both caps in Sidecar, Cap On and Exploded views. Every checked image loaded, and desktop and 390 px mobile views have no horizontal overflow. Visual inspection confirms that both caps sit over the neck in Cap On. After the navigation fix, the regular localhost URL uses the regenerated body. Both exact SKUs are explicitly enabled in the local manifest; the setting persists in the checkout’s local environment file. Production still uses published artwork.

This is an uncommitted local review update. User visual acceptance, production kit publication and catalog-hero replacement remain separate. Production is unchanged. `kits-before-regeneration.json` preserves the preceding PSD-only overlay; `kits-with-generated-body.json` records the new local overlay. Re-running the original `prepare.py` restores the PSD-only candidate, so retain this generated-body overlay when reproducing the current preview.

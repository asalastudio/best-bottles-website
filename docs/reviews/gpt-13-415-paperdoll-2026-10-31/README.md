# 13-415 Photoshop sprayers and GPT body composition pilot

The local preview reuses the eight Photoshop fine-mist sprayers selected on the Sleek 5 ml page across 126 listed 13-415 sprayer configurations. It combines recovered GPT bodies with separate body-length dip tubes and the existing Blender metal/plastic roller assemblies, including their complete plugs.

Open `http://localhost:3010/reviews/gpt-13-415-paperdoll-2026-10-31/index.html`. Each of the 238 configurations links to an actual product page with `assetPreview=gpt13`; that selection follows glass changes and Start Building into the standalone builder. Normal product navigation retains its previous kit. The server refuses this pilot outside development on a loopback host, and always refuses Vercel.

## Scope and provenance

- 18 body/color masters across 15 body designs, one source per identity across finishes.
- 143 configurations are 5 ml Cylinder clear/cobalt, Sleek clear or Tulip amber, including caps, sprayers and both rollers.
- Cylinder 5 ml uses the existing revision-3 GPT appearance candidates, registered at the measured body height. These are not newly generated Sunburst images and are not a replacement approval for measured v19 geometry. Their material fidelity still needs owner review.
- The other 16 body/color sources are recovered GPT masters. Their original files remain unchanged.
- Sprayer and overcap pixels are the existing PSD component images. Existing neck axes and physical component scale register them to each body.
- New transparent Blender tube layers use a 1.1 mm outer diameter, 0.7 mm bore, slight 1.2–1.6 mm bend, and a tip 3.5 mm above the exterior base. These are visual estimates derived from registered bottle heights, including an assumed internal floor, not manufacturer measurements. Clear-glass refraction is approximated by layer compositing.
- Roller exports preserve the original ball, housing and full plug geometry. The 8.19 mm ball remains round. The flange position is measured from evaluated exported geometry, avoiding the earlier linked-object transform offset.
- The broad Circle 15 ml readiness hold remains in place. This local sprayer preview applies its recorded 44.625% target and passes detached-component clearance at fixed body scale. Other Circle applicators need separate review.

No 5 ml lotion-pump configuration is listed. Two catalog groups returned no variants: Cylinder 5.5 ml and Rectangle 10 ml. Pillar's legacy URL says 17-415 while current catalog/register data say 13-415; the route is preserved and its identity needs confirmation. No product or compatibility was invented to fill these gaps.

## Verification

- 714 computed states: 238 SKUs × cap-off, cap-on and exploded. No image outside the canvas, body movement between states, missing/disconnected tube, or tube extending below the glass.
- 222 browser states: 37 representative configurations at desktop and mobile widths, each in three views. This covers every body/color/applicator combination and all eight selected PSD finishes. Two initial Chrome protocol timeouts passed on bounded retry. No page errors remained.
- Six exact-SKU PDP-to-builder handoffs passed, including clear/cobalt, metal/plastic rollers, Sleek and Tulip. Preview responses are uncached and do not mutate baseline cached kits.
- 38 focused tests, full TypeScript check, targeted lint and `git diff --check` passed. No production build was run over the active development server.
- All 109 recovered source masters still match their locked file hashes. Source-file integrity and technical layout checks do not constitute final visual approval.

The browser screenshots, before/after kits, per-SKU provenance, CSV, layout results, source-preservation check and render metadata are in `evidence/`. The all-body contact sheet was captured after image decoding completed.

## Restore and reproduce

The manifest verifies every packaged file before restoration. Run from the repository root:

```sh
node docs/reviews/gpt-13-415-paperdoll-2026-10-31/restore.mjs
node docs/reviews/gpt-13-415-paperdoll-2026-10-31/restore.mjs --apply
```

`--root /path/to/checkout` can restore into a different checkout. Existing conflicting public files are backed up under `outputs/catalog-model-repair-2026-10-31/checkpoint-restore-backups/` before replacement. This package was restored and checksum-verified in a new empty directory.

Source recipes are preserved as evidence. The snapshot/build TypeScript files are stored as `.ts.txt` so repository-wide TypeScript checks do not compile workstation audit utilities. To rerun, place them temporarily at the repository root, where their relative source imports resolve. Restore `evidence/snapshot.json` as the recipe's `snapshot.json` input. Recipes reference preserved historical masters and studio helpers; the package's runtime images and manifest can be restored without Blender or API access.

The native working scenes remain in `outputs/catalog-model-repair-2026-10-31/13-415-gpt-paperdoll/renders/` and are included in the additive Drive backup. They are omitted from Git because they total about 858 MB. Production data, production media assignments, domains and credentials are unchanged.

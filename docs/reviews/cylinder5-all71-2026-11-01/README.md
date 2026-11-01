# Cylinder 5 ml: all 71 configurations

The 71 existing clear and cobalt 5 ml Cylinder configurations now use the same two registered GPT revision-3 body images through normal localhost product pages and the bottle builder. No preview query flag is required. This is a local composition review; final material approval and production release remain separate.

Open http://localhost:3010/reviews/cylinder5-all71-2026-11-01/index.html for the saved-versus-current comparison, SKU selector, three component views, exact product links and exact builder links. The linked proof gallery contains six contact sheets captured from the actual product pages.

## Coverage

| Configuration | Clear | Cobalt | Total |
| --- | ---: | ---: | ---: |
| Pour bottle with cap | 10 | 10 | 20 |
| Metal or plastic roll-on | 18 | 18 | 36 |
| Fine-mist sprayer | 8 | 7 | 15 |
| Total | 36 | 35 | 71 |

The read-only catalog snapshot matches these 71 exact SKUs. No missing color, finish or product was invented. Inventory files contain every SKU, original route, body source, source hash, component provenance, scale target and review state.

## Shared artwork and fit

- Clear body: `cylinder5-clear-candidate-v3.3d366e116958.png`.
- Cobalt body: `cylinder5-cobalt-candidate-v3.c51b7b6df61f.png`.
- One registration per glass color is shared across all compatible caps, rollers and sprayers. The recorded 36.5% shoulder-span target, 91% baseline, body box and neck/seat anchors are retained.
- Sprayers, overcaps and caps retain their existing Photoshop component pixels. Metal and plastic rollers retain the existing Blender ball, housing and complete plug. The full plug becomes visible in exploded view.
- Fine-mist configurations reuse the separate Cylinder-length tube mechanism with a small natural bend. Its 1.1 mm outer diameter, 0.7 mm bore and assumed interior clearance are visual estimates from the earlier pilot, not new manufacturer measurements. Glass/tube optics are approximated by layers, not a physical ray-traced assembly.
- No new image generation or Blender rendering occurred in this batch. The separate 9 ml built-in-generator candidate is not used for any of these 5 ml bottles.

The old measured body and previous kits are preserved in the comparison and evidence. These revision-3 bodies remain appearance candidates. This integration does not reclassify them as visually approved or overwrite the measured source masters.

## Verification

- 213 computed component states passed: 71 SKUs in cap-off, cap-on and exploded views.
- 426 browser states passed: every SKU and view at 1440 px and 390 px viewport widths. Checks cover exact SKU selection, image loading, fixed body frame, component bounds, one correctly attached tube per sprayer, tube tip above the base, one roller layer and exact builder deep links.
- Six first-pass navigation or image-loading timeouts passed on one bounded retry with settled navigation. The original failures are preserved in `evidence/browser-first-pass.json`; final results contain no failures or page errors.
- All 71 desktop builder entries passed. Checks were scoped to the main preview, rather than the finish picker. All 71 screenshots show the desktop 436 × 856 px preview region. Builder API parts, anchors and glass-sizing records match the PDP source for all 71 SKUs.
- Six phone builder checks passed, one per glass/applicator group, including the expanded preview.
- All 71 configurations were visually scanned in the six contact sheets. Individual pour, metal/plastic roller and spray captures were inspected at larger size. This is technical and composition QA, not owner approval of glass fidelity.
- The 11 focused local-kit/builder tests passed, as did TypeScript, targeted lint and the diff whitespace check. No production build was run over the active development server.

Full-resolution state captures are in the Drive ZIP under `evidence/screenshots/`; their individual SHA-256 values are recorded in `evidence/capture-checksums.json`. The contact sheets, results, runtime files and reproducible check scripts are retained in Git. The screenshot named `builder-main-stage.png` is an earlier diagnostic probe and is not used as a passing desktop capture.

## Restore

The runtime files are deliberately packaged under `files/public/`, rather than directly activated in a fresh checkout. From the repository root, verify and restore them with:

```sh
node docs/reviews/cylinder5-all71-2026-11-01/restore.mjs
node docs/reviews/cylinder5-all71-2026-11-01/restore.mjs --apply
```

Use `--root /path/to/checkout` to restore elsewhere. The script verifies every manifest entry before writing, backs up conflicting files, and verifies each destination hash. The current localhost checkout already has these files restored. Removing only this batch's activation JSON restores the earlier local selection; the source images remain preserved.

The shared loader reads the batch only in development and refuses all local overrides on Vercel. The package's `defaultPdpSkus` lists these exact 71 SKUs. Without the restored activation file, a new checkout keeps its prior behavior. Review routes and all local kits are excluded from deployment uploads.

## Shared archive

[Best Bottles / Bottle Master Library / Cylinder / this review batch](https://drive.google.com/drive/folders/1eYeVNwiFC3o46G8A79txXw2_9DoPB47K) contains two separately labeled registered masters, the SKU CSV, this report, the checksum manifest and the complete review ZIP. Names identify family, 5 ml size, 13-415 neck, glass, revision and review status. Remote file names, sizes and parents are verified in the committed receipt. Prior family folders and approved masters remain intact.

Changes remain on the checkpoint branch and PR #382. No merge, deployment, production media assignment, database mutation or domain change was performed.

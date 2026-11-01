# Cylinder 5 ml: separate layer fidelity tests

Three built-in image-editor edits compare the current clear glass body, matte-gold fine-mist sprayer and matte-gold overcap with enhanced candidates. Open http://localhost:3010/reviews/cylinder5-layer-fidelity-2026-11-01/index.html to inspect individual images and the assembled cap-off, cap-on and exploded views.

| Layer | Original pixels | Candidate pixels | Native height gain | Opaque outline aspect change |
| --- | --- | --- | ---: | ---: |
| Clear body | 914 × 1721 | 914 × 1721 | 1.00× | +0.24% |
| Matte-gold sprayer | 525 × 976 | 919 × 1711 | 1.75× | -3.91% |
| Matte-gold overcap | 214 × 396 | 922 × 1706 | 4.31× | -3.31% |

The hardware candidates have smoother photographic reflections and finer surface detail. They also changed their outline proportions, so they are not direct replacements for registered components. The body output is not a resolution upscale and still has low-alpha artifacts above the rim and beneath the base. Retain the current assigned artwork while these candidates are reviewed.

The assembly comparison uses CSS to align each candidate's alpha-at-128 bounding box with the source box. The canvas target, baseline and connection locations are held fixed in that comparison. Bounding-box alignment does not certify internal contours, thread geometry or nozzle accuracy. Original dip tube and backdrop layers remain unchanged. No candidate was assigned to any of the 71 product pages or the builder.

The built-in tool's exact model version is not exposed. No external paid API or model substitution was used. `prompts.json` preserves the three exact edit instructions. `references/` retains the original files and material reference; `source-inventory.json` records URLs, hashes, original dimensions and stage boxes. Full native tool outputs are the three `*-enhanced-v01.png` files. Nothing was resampled or sharpened with code. The review's CSS placement changes are explicit and separate from the untouched PNG outputs.

Six browser checks passed: three component states at 1440 px and 390 px viewport widths. All images decoded, with no horizontal overflow or browser errors. Desktop side-by-side output was visually inspected. These checks establish a usable comparison, not final appearance approval.

The runtime comparison is packaged under `runtime/public/reviews/`. From the repository root, verify and restore with:

```sh
node docs/reviews/cylinder5-layer-fidelity-2026-11-01/restore.mjs
node docs/reviews/cylinder5-layer-fidelity-2026-11-01/restore.mjs --apply
```

The restore script checks hashes and backs up conflicting files before copying. `--root /path/to/checkout` restores into another checkout. The current local copy is already available. The review is excluded from deployment uploads; no production data, active body assignments or component-kit source was changed.

The individual candidates and complete package are saved in [Best Bottles / Cylinder / Layer fidelity v01](https://drive.google.com/drive/folders/1xxIfDrFCvGvfsQDXUaRvH90xdWf3Y2lv). This is a review folder, separate from approved masters.

# Family silhouettes — pencil set

Fine-art graphite drawings of the eight bottle families, one accent colour
(muted gold #C5A065 on the finish/closure). Intended as ACCENTS — mega-menu
tiles, search panel tiles, service strips — never in place of product
photography on the hero, product cards, PDP or configurator.

- Reference = `public/assets/homepage/family-*.webp` (shape authority, edits endpoint).
- Model `gpt-image-2.5-sunburst`, quality high, 1024×1536. Prompt in `prompt.txt` — style only, no geometry talk.
- `node scripts/family-silhouettes/generate.mjs [--only cylinder,round] [--quality medium]`
  (needs `OPENAI_API_KEY`; refs are cached as PNG in `public/assets/homepage.png-cache/`, gitignored).
- Web derivatives: `public/assets/sketches/family-<slug>.webp` (800×1200). PNG masters are
  gitignored; the 2026-09-13 set is parked in `.local-assets/sketch-masters/2026-09-13/` in the
  main checkout.
- Review sheet: `public/assets/sketches/_contact-sheet.jpg` (reference left, sketch right).

Set v1 generated 2026-09-13, awaiting Jordan's approval. Known note: Boston Round's amber and
cobalt bodies render as graphite under the one-accent rule.

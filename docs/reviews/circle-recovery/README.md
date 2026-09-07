# Circle shoulder targets and matte correction

All 27 latest saved requests use glass base to shoulder, with the contact baseline at 91%:
15 mL 37%; 30 mL 43%; 50 mL 47%; 100 mL 54%.

These are image-frame percentages, not certified physical millimeters. The latest 100 mL request supersedes 52%. Original artwork and earlier feedback remain preserved. Geometry is changed only by a uniform complete-assembly transform. The 50 mL clear tassel needs the largest increase; its full accessory arrangement remains within the canvas.

`alignment-and-matte-report.json` records the applied transforms, original hashes, source landmarks, candidate hashes and significant artwork bounds. `saved-shoulder-feedback.json` preserves the user's requests and history. `shoulder-landmarks.json` contains the final visually inspected source landmarks. The estimator writes a separate provisional file and must not overwrite reviewed measurements. The 15 mL landmarks were measured on existing artwork; the other landmarks were compared with master PSD body layers. The 50 mL tassel required a refined source-registration width of 696 pixels rather than the initial estimate of 734.

Thirteen larger clear bottles receive a deterministic correction of near-neutral white photographic matte over the glass body region. The broader mask avoids the prior elliptical mask's white fringe and treats legacy white around the tube. Existing dark glass outlines, colored hardware and exact exposed bone pixels remain identical. No new shadows, geometry generation, or hardware reconstruction. Frosted and 15 mL colors remain unchanged.

Verification: `scripts/verify-circle-corrections.py` checks original/candidate hashes, 27 shoulder targets/baselines/artwork bounds and 13 pixel comparisons. The catalog integration tests cover all 391 registered images. The user subsequently approved the corrected Circles and requested local UI integration. That approval is recorded in the revision report. The family remains available for catalog review and has not been published.

The permanent project worktree replaces the temporary folders lost at restart. Local review collections are independent of the Next.js server and preserve their feedback across restarts. To recreate this collection from committed assets:

```sh
node tools/hero-review/import.cjs --id circle-aligned-matte-v2-2026-09-07 --title 'Circle · applied shoulder targets and matte correction' --manifest docs/reviews/circle-recovery/aligned-review-input.json --public-root public --link-assets
node tools/hero-review/server.cjs --port 3011
```

If the collection already exists, use it; do not reimport over its feedback. The original sizing collection remains separate. Python correction scripts use Pillow, NumPy and psd-tools in a local environment, excluded from Git. `prepare-circle-corrections.py` always reads immutable original URLs, so repeat runs do not compound the color adjustment.

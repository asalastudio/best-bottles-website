# Remaining neck reference sheets — 23 September 2026

The [two-page, 17 × 11 in print catalog](remaining-neck-groups-mini-catalog-17x11.pdf) contains:

1. [16 mm Jumbo Roller](16mm-jumbo-roller-neck-matrix-17x11.pdf): 28 and 50 mL Cylinder glass, plastic and metal roller-ball assemblies, and black and white caps.
2. [20-410 Aluminum](20-410-aluminum-assembly-reference-17x11.pdf): current 65, 100, 120, 250, and 500 mL assembled aluminum rows, grouped by the head shown on each exact source page.

Each page is also available as a 5100 × 3300 px [16 mm PNG](16mm-jumbo-roller-neck-matrix-300dpi.png) or [20-410 PNG](20-410-aluminum-assembly-reference-300dpi.png).

The [16-row audit](audit-current-rows.csv) records the exact catalog row, source page, issue, interpretation, and proposed correction. [Site verification](agent-reach-site-verification.csv), saved [source-page captures](site-pages/), and the [image-source manifest](source-manifest.json) support the sheets. The PDFs use exact master PSD composites and Best Bottles product images. The 100 and 500 mL legacy GIFs had their green backgrounds removed for legibility. Component heads shown on the aluminum page are crops from assemblies or the master archive; they are not represented as separately sellable SKUs.

## Findings

- **16 mm:** Eight current Convex bottle rows match their exact Best Bottles product pages and 16 mm neck. The eight combinations are two sizes × two ball materials × two cap colors. All eight `components` lists are empty, and the export contains no standalone 16 mm roller or cap rows. The sheet confirms sold assemblies; it does not invent standalone part identities or assert that a loose roller insert is sold separately.
- **20-410:** Seven rows are typed `Aluminum Bottle`; the eighth, `Alu250SpryBl`, is typed `Component` despite its [exact Best Bottles page](https://www.bestbottles.com/product/Cylinder-shaped-matte-aluminum-250ml-bottle-black-sprayer) selling a complete 250 mL bottle with black sprayer. Six other aluminum rows list this whole bottle as their component. The generated `Alu250mlSprayBlack` row also points to the `Alu250SpryBl` source page, so the 250 mL identity needs reconciliation before a catalog edit.
- The exact aluminum product pages identify **20-410**. Some local master thumbnail filenames contain `24-410`; the PDF does not use those filenames as fit evidence. Shared neck nomenclature alone does not prove that an assembled pump or sprayer can be swapped among every aluminum body.

The source-page verification has 15 exact SKU matches and one wrong product link (`Alu250mlSprayBlack` → `Alu250SpryBl`). These are **identity and component-list errors**, not proof of physical misfit. No Convex data was changed while producing these review sheets.

The legacy 100 and 500 mL aluminum product images are lower resolution than the PSD assets and may look softer on a close print inspection. Their silhouettes and source identities were preserved.

## Recommended catalog sequence

1. Resolve the canonical 250 mL aluminum product identity, preserving any order, image, and variant references.
2. Remove the whole 250 mL product from the six unrelated component lists; attach a part only after its independent SKU and exact assembly relationship are verified.
3. Define 16 mm plastic insert, metal insert, black cap, and white cap identities or a clear assembly-BOM model, then associate the eight exact sold assemblies. Keep the two roller materials distinct.
4. Re-export these threads and confirm the eight Jumbo lists and six aluminum component lists no longer carry the recorded errors.

The captured catalog read was from the Convex development action endpoint on 23 September 2026. Website pages were read by Agent Reach via Jina Reader; the row-level URL and capture SHA-256 are recorded in the verification CSV. The source images were extracted from `BB-PSD-Files-Master` and two exact legacy product GIFs. Run `collect_current.py`, `verify_site_agent_reach.py`, `prepare_sources.py`, `write_audit.py`, and `build_print_sheets.py` in sequence to refresh evidence and rebuild; combine the single-page PDFs with `pdfunite`.

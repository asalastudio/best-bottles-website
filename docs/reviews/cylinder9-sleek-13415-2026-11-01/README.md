# 9 ml Cylinder / 13-415 and Sleek 5 / 8 ml review

Current status: Jordan explicitly approved the exact 144-configuration visual batch on November 1. `visual-approval.json` pins the recipes and source hashes. Four individually labeled approved body copies are verified in the canonical Cylinder and Sleek Drive Approved masters folders. Production activation remains separate. The original candidate packets remain preserved.

The requested batch contains 144 configured catalog SKUs: 9 ml Cylinder Clear (36), 9 ml Cylinder Frosted (36), Sleek 5 ml Clear (36), and Sleek 8 ml Clear (36). Each body/color has eight fine-mist sprayers, eighteen metal/plastic roll-ons, and ten pour-cap variations. All 144 exact SKUs were matched against current read-only production catalog responses.

These are the existing registered candidate masters, with no new image generation or changes to the original image bytes. The tall Cylinder pair retains the existing generated material candidates. Sleek retains its recovered master material. Source outlines, glass scale, anchors and baseline are preserved. Shared 13-415 PSD sprayers, complete level roller plugs, polished short/tall gold and silver caps, matte/dotted finishes, and native ribbed-cap exceptions are reused by exact component identity. The frosted seated tube retains 16% opacity and multiply blending; its exploded view retains the natural plastic material.

Source verification checked 41 local assets and 248 component uses against approved 5 ml component hashes, preserving native ribbed artwork. Existing registration tests passed. Browser verification passed 144 representative product-page states across desktop/mobile, cap-off/cap-on/exploded and six component/finish examples per body. All 144 builder kit recipes matched and four actual builder deep links passed. No new production record, media index or approved-kit manifest was changed for this batch.

Review page: http://localhost:3010/reviews/cylinder9-sleek-13415-2026-11-01/index.html

The interactive page exposes all 144 configurations and 432 layouts and includes a twenty-four-assembly same-scale review sheet. This is a candidate visual review, not production sign-off or a claim that all 864 possible desktop/mobile states were individually browser-tested. Production release remains separate from visual approval of these exact body/material sources.


Reproduce the review from the repository root:

```sh
node docs/reviews/cylinder9-sleek-13415-2026-11-01/prepare.cjs
node --import tsx docs/reviews/cylinder9-sleek-13415-2026-11-01/build-review.mts
```

Run `verify.cjs` with the existing localhost server on port 3010, then `verify-builders.cjs` for API and builder checks. `export-review.py` packages the generated review plus existing verification screenshots into portable offline ZIPs. Generated scope, screenshots and portable HTML remain outside this commit; source media and source kit definitions are already tracked. The ZIPs are in Drive.

- [Cylinder candidate archive](https://drive.google.com/drive/folders/1hMb8YmZRoYvRLR026wGPjQe1P7gUNP-V)
- [Sleek candidate archive](https://drive.google.com/drive/folders/1LL9WXaaSLH_eAs5F_XtPcpHPCr9c0pxy)
- [Same-scale review sheet](https://drive.google.com/file/d/1sOl3zgWgL6gyRmpXfrEr0l1N0pNL_Uqt/view)

Each family folder contains two individually labeled registered body SVGs and a self-contained 72-configuration review packet. File sizes and parent folders were read back after upload. Legacy remote ribbed-cap URL identifiers are treated as opaque identifiers; each archived payload records its actual SHA256. Local registered-source byte hashes remain verified.

Release boundary: these 144 recipes remain candidates. This commit adds review evidence and reproducible tools only, with no production media-index or approved-recipe changes.

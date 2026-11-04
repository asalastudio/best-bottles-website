# PR 388 hosted verification

The changed media pass hosted verification on commit `3f8fd269b1183ac44fe7a72b29251fb455efcfb3`. The Vercel preview is READY and GitHub CI / verify passed for that commit. No source code was changed during this check.

The preview served all 456 registered recipes exactly as committed. All 57 recipes changed by this PR were available in the preview. Desktop and mobile Chrome checks covered 122 catalog selections, 103 product-page states, four additional bookmarked Tulip checks and thirteen actual builder pages. Eight SVG paint comparisons confirmed that the plug treatment changes the chamber without changing the narrow tube or image geometry. Thirteen source assets, including the existing Tola photograph, passed byte-hash checks. Screenshots were visually inspected as well.

The checks cover the 2 ml clear/amber pair, Tall Cylinder 9 ml 13-415 cap alignment, Footed Rectangle 10 ml roll-on heroes, clear Tulip 6 ml and Sleek 8 ml plug transmission, the assembled-only Tola 6 ml and the Rectangle 9 ml product layout and color choices. The separate Sleek 8 ml replacement-glass and Rectangle 9 ml generated-image candidates remain local and unapproved. Hosted Rectangle 9 ml still uses the existing photographs, including their older background treatment; this pass does not approve replacement artwork.

## Preview data limit

The builder returned 429 of 452 eligible registered configurations. The four small 12 mm sprayer recipes intentionally have no standalone builder entry. Twenty-three baseline short-cap choices are missing only in the preview dataset: six amber Tulip, five clear Tulip, six Sleek 5 ml and six Sleek 8 ml. None is a recipe changed by this PR. Their recipes are byte-for-byte unchanged from the base branch, the inventory loader was not changed, and all twenty-three options and matching recipes were confirmed on the existing production deployment. This is recorded as a separate preview-data reconciliation task. The missing preview choices are not counted as tested preview UI states.

The reviewed media scope is ready for owner merge approval. This result does not certify the whole catalog or remove the separate preview-data follow-up. Line-item and customer-portal audits are outside this verification scope.

## Access and release state

The owner-approved one-hour preview link was revoked after testing; a fresh request no longer grants access. The temporary local access file was removed. An unintended standalone authentication-probe project was deleted and its removal confirmed by a 404 lookup. Best Bottles production remains on commit `59d00aa7732879dd40b8e58fcc64e255b847d33f`. No production records or images were changed, and no merge or deployment was performed.

`HOSTED_VERIFICATION.json` gives the result and exact coverage. `inventory.json` records all API checks; `scope-coverage.json` and `preview-gap-baseline.json` identify the unchanged preview gaps. The remaining directories hold browser evidence and screenshots. Verification scripts require the exact preview origin and a private access file supplied at runtime. No access token, cookie or credential is included in this package.

The full evidence package is archived in Best Bottles / Bottle Master Library / Hosted Verification - PR 388 - 2026-11-02 - Media and Product Pages. The tested Git commit is kept unchanged; the report is linked from PR #388 so saving screenshots does not trigger another application build.

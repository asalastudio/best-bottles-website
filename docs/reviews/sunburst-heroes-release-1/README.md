# Sunburst heroes — release 1 (2026-09-10)

32 catalogue heroes repointed at their Sunburst 2.5 renders. These are the images Jordan approved in the
hero-review library on 2026-09-10 (visual sign-off, each locked by image hash in `approved-lock.json`),
indexed into the storefront's catalog registry the same way the Round premium heroes were.

| family | rows |
|---|---:|
| Atomizer | 13 |
| Decorative | 8 |
| Bell | 3 |
| Dropper | 3 |
| Tool | 2 |
| Vial | 2 |
| Apothecary | 1 |

**What moved, together:** `src/lib/products/catalog-heroes.json` (url + identity framing for the 32 rows) and
`docs/reviews/catalog-complete-hero-release-2026-09-07.json` (url + sha256 + framing), plus the 32 PNGs under
`public/images/catalog/bone-review/<sku>.<sha12>.png`. Previous renders are left in place, unreferenced.

**Framing is identity for these rows.** The Sunburst images carry the 91 % baseline and the centring in
their pixels, so the shared catalogue nudge is not applied on top.

**Checks before writing:** hash equals the approved hash; 1560×1716; all four corners exactly bone
`#F5F3EF`. Then `tests/catalog-approved-heroes.test.ts` (396 assertions: bytes vs manifest, framing,
size, corners, hero resolution) — green.

**Skipped:** `GBBell10RollBlkDot` — approved, but it is a new product group with no registry row; adding
the row (group slug, variant) is a follow-up, not a repoint.

**Rollback:** `registry-rollback-2026-09-10.json` holds every `from` (url, manifest sha256, framing);
restoring those undoes this release. Reproduce with `node scripts/publish-sunburst-release-1.mjs`.

This is an indexing step. It changes what the storefront renders on its next build; it touches no
Shopify, Convex or hosted media.

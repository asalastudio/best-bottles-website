# Product Slug Fix — "nemat-internation" Anomaly

## Problem

Some product URLs ended with `nemat-internation` (e.g. `/products/elegant-15ml-frosted-size-13-415-nemat-internation`). This came from source data where `neckThreadSize` contained `"Size: 13-415 Nemat Internation"` (truncated from the Master Sheet).

## Fix Applied

### Sanity (Product Overrides)

6 `productGroupContent` documents were updated to use clean slugs:

- **Before:** `elegant-15ml-frosted-size-13-415-nemat-internation`
- **After:** `elegant-15ml-frosted-13-415`

Run again if needed:

```bash
node scripts/fix_nemat_internation_slugs.mjs
```

### Convex (Catalog / Product Groups)

The Convex migration fixes `productGroups` slugs and `products` neckThreadSize:

```bash
# Fix product group slugs
npx convex run migrations:fixNematInternationSlugs

# Fix product neckThreadSize values (paginated)
npx convex run migrations:fixNematInternationNeckThreadSize
```

**Diagnostic:** To check if Convex still has bad slugs:

```bash
npx convex run migrations:listNematSlugs
```

If this returns `[]`, Convex has no slugs containing "nemat" — either already fixed or never had them.

## Alignment

The PDP merges Sanity content by matching `slug.current` to the Convex product group slug. Both must use the same slug:

- **Convex** `productGroups.slug` → used in catalog links and URL
- **Sanity** `productGroupContent.slug.current` → must match exactly

If you still see `nemat-internation` on live URLs:

1. Run `npx convex run migrations:listNematSlugs` — if it returns items, run `fixNematInternationSlugs`
2. Ensure you're hitting the production Convex deployment (check `CONVEX_DEPLOYMENT` or linked project)
3. Clear CDN/cache and redeploy if needed

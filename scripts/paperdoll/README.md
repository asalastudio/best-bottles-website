# Paper-doll plates: index, store, pipeline

The product page shows one finished photograph ("plate") per SKU, cap on and
cap off. The bytes live on a public Vercel Blob store; the only thing the page
consults is the `productPlates` table in Convex, one row per SKU, whose
existence is its readiness. There is no draft, release or ready flag.

```
PSD libraries ──inventory.py──▶ data/paper-doll/inventory.json      (audit trail, committed)
                └──(tokens, dedupe, xref, build_*)──▶ dist/paper-doll/…   (git-ignored)
dist/ or legacy manifests ──publish.mjs──▶ Blob objects + productPlates rows
                                    └──verify.mjs──▶ zero index issues, or it exits 1
```

## Commands

| step | command | needs |
|---|---|---|
| inventory | `python3 scripts/paperdoll/inventory.py` (`--no-hash`, `--limit N`, `--library original\|bbuat`, `--out DIR`) | psd-tools, Pillow |
| naming tests | `python3 scripts/paperdoll/tests/test_naming.py` | |
| publish (dry run) | `node scripts/paperdoll/publish.mjs --from dist/paper-doll/legacy [--family <familyId>]` | `NEXT_PUBLIC_CONVEX_URL` |
| publish (write) | `… --apply` | + `BLOB_READ_WRITE_TOKEN`, `BEST_BOTTLES_CONVEX_WRITE_TOKEN` |
| verify | `node scripts/paperdoll/verify.mjs [--sample 40] [--all-urls] [--strict]` | `NEXT_PUBLIC_CONVEX_URL` |
| prune rows | `node scripts/paperdoll/prune.mjs --orphans` / `--sku A,B` (`--apply` to delete) | write token for `--apply` |

`set -a; source .env.local; set +a` before any of them. Which deployment they
touch is decided by `NEXT_PUBLIC_CONVEX_URL` alone; production needs the
production write token (`npx convex env get BEST_BOTTLES_CONVEX_WRITE_TOKEN --prod`).

## Rules the tooling enforces

- **Keys are content-addressed**: `plates/<familyId>/<websiteSku>/<sha256>.front-<on|off>-<w>x<h>.webp`.
  Nothing is ever overwritten or deleted in the store; a re-render is a new key
  and a row patch. `prune.mjs` removes index rows only.
- **A row is written only after** the object is uploaded and its public URL
  answers `200`, `image/webp`, the right length, `access-control-allow-origin: *`
  and a one-year cache.
- **Orphans are refused**: a SKU no product document carries is uploaded but not
  indexed (`--allow-orphans` overrides). Duplicated catalogue SKUs are indexed
  and reported; they are the products table's defect, not the index's, and
  `verify.mjs` lists them without failing (fail them with `--strict`).
- **One row per SKU** is enforced inside the serializable `upsertMany`;
  `integrity` audits it, plus orphan rows, grace-SKU disagreement, URL host
  allow-list and missing fronts.
- `familyId` is `<family>-<capacityMl>ml-<color>-<neck>` from product-group
  fields (`diva-46ml-frosted-18-415`), never a folder name.

## Store

Vercel Blob store `best-bottles-plates` (public) on the `asalabrand` team,
connected to `best-bottles-website` for the **development** environment only:
the site never needs the token, the importer does. Public host:
`yzy7l20k4yt6znzz.public.blob.vercel-storage.com`, pinned in
`next.config.ts` `images.remotePatterns`.

> Gotcha (Vercel CLI 53): `vercel blob create-store` ends by pulling the
> project's development env into `.env.local`, **overwriting** it. Back
> `.env.local` up first, or restore it from the main checkout afterwards.

## Legacy builders

`build_cyl9_plates.py` (9 mL from the 26-layer kit) and
`build_family_plates.py` (Diva, Cylinder 50 from PSDs) now write to
`dist/paper-doll/legacy/<family>/` (git-ignored); `publish.mjs --from
dist/paper-doll/legacy` maps their folder names to family ids. They are
superseded by the pipeline stages as each lands (`build_plates.py` etc.).

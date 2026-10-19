# Legacy /images/store mirror

The catalogue still links product photos, plates and kit thumbnails at
`https://www.bestbottles.com/images/store/...`. Today the legacy PHP host serves them.
When `www.bestbottles.com` points at this app, the same URLs are answered here, so the
files live in `public/images/store/` at the same paths, byte for byte.

Collected 17 October 2026 from production Convex (`products`, `productPlates`,
`productKits`; the other catalogue and register tables hold none) plus two source
files: 350 files, 10.0 MB, all downloaded with HTTP 200. 2,274 of 2,485 products
reference at least one of them.

- `manifest.json` records each file's path, legacy URL, size, SHA-256 and real format.
- 292 files are PNG data under a `.gif` name. The legacy host serves them the same way
  and browsers display them; the bytes are kept unchanged.
- The asset ledger's `sourcePath` and `sourceUrl` fields are provenance text, not
  displayed images, and are not mirrored.
- `tests/legacy-store-images.test.ts` checks every file against the manifest and fails
  if runtime source links a legacy image that is not mirrored.

## Refresh before the DNS cutover

Run this while the legacy host still answers, so references added since 17 October are
picked up. Existing files are re-hashed and left alone; new ones are downloaded.

```bash
npx convex data products --prod --limit 10000 --format jsonl > /tmp/products.jsonl
npx convex data productPlates --prod --limit 10000 --format jsonl > /tmp/plates.jsonl
npx convex data productKits --prod --limit 10000 --format jsonl > /tmp/kits.jsonl
node scripts/legacy/mirror_legacy_store_images.mjs /tmp/products.jsonl /tmp/plates.jsonl /tmp/kits.jsonl
```

After cutover, `https://www.bestbottles.com/images/store/enlarged_pics/CP13-415WhtSht.gif`
should return 200 from Vercel. Moving the references to Blob storage (PR #347 does this
for 93 finish thumbnails) can follow later without breaking these URLs.

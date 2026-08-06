# Production Deploy — 2026-08-05 (Step 1 of 4)

Deployed the dev state (Grace consistency fixes + full OpenAI migration) to production.

## Live and verified

**Convex** — `npx convex deploy` → `precise-raccoon-123`. Verified on prod:
`getPriceStats("Boston Round")` returns exact truth (`GB-BSR-CLR-15ML-BLK-S` @ $0.42).

**Vercel** — deployment `dpl_8kmrbYDSKscGzabhrr9U2e4mtDVR`, READY, aliased to
`https://best-bottles-website.vercel.app`.

Endpoint verification on the live alias:

| Check | Result |
|---|---|
| Homepage / catalog / PDP | 200, real content (catalog 440 KB) |
| `/api/openai/realtime-token` | mints `clientSecret`, `gpt-realtime-2.1`, voice `marin` |
| `/api/elevenlabs/signed-url` | **404** (deleted) |
| `/api/elevenlabs/server-tools` | **404** (deleted — closes the April unauthenticated hole in prod) |
| `/api/voice` (EL TTS proxy) | **404** (deleted) |
| `/api/voice/transcribe` | 405 on GET = alive, now OpenAI `gpt-4o-mini-transcribe` |
| `/api/grace/tools` → `getPriceStats` | exact per-SKU prices |
| `/api/grace/tools` → `getCatalogStats` | **2,330 / 352** |

## Prod data reconciliation

`migrations:reconcileProductGroups` (dry-run → apply, batched):
- Deleted 4 empty groups: `vial-3ml-clear-13-425`, `vial-3ml-cobalt-blue-13-425`,
  `cylinder-9ml-clear-18-400`, `cylinder-9ml-clear-18-400-glasswand`.
- Corrected 3 drifted `variantCount`s — prod had *more* drift than dev:
  `fine-mist-sprayer-13-415` 9→12, `fine-mist-sprayer-18-415` 6→8,
  `circle-50ml-frosted-18-415-antiquespray` 9→18.
- **Prod stats now equal the products table exactly (2,330 / 352)** — the
  2,330-vs-2,320 split is resolved.
- Log: `docs/reviews/prod-reconcile-applied-2026-08-05.log`.

## Fixes required to make the deploy possible

1. **`getPriceStats` had no client implementation** — I added the tool spec without the
   `GraceProvider` implementation, and the Realtime adapter fails closed on any declared
   tool lacking one ("Missing Grace tool implementation"), crashing the storefront at
   mount. Implemented + added a CI contract in `tests/grace-hardening.test.ts` asserting
   every declared spec has a client implementation.
2. **Pre-existing build break on this branch** (paper-doll WIP): incomplete draft previews
   (`storefrontReady: false`) were passed where a storefront-ready family is required.
   Narrowed at the boundary in `src/app/products/[slug]/page.tsx` — incomplete drafts now
   render no canvas; also dropped a `paperDollPreview` prop the component no longer takes.
3. **Added `.vercelignore`.** Deploys were uploading the whole working tree —
   **27,928 files / 26.2 GB**, over Vercel's 15,000-file cap (silent CLI exit), and the
   tgz retry then died extracting 26 GB on an 8 GB build machine. Excluded `pipeline/`
   (36 GB of Madison PSDs), `data/`, `docs/`, `reference_images/`,
   `Best-Bottles-Orphan-urls/` — all verified unreferenced by app code and build config.
   Result: **243.5 MB / 9,233 files**, build succeeded in ~5 min.

## Open items

- **`HMAC-TEST-ONLY` is still in prod** (`kd7aabgrwr6htvg78v844dd67984jqry`). The delete was
  blocked by the permission classifier — needs Jordan's approval. 10 stale pre-rename SKUs
  (`GB-CIR-FRS-50ML-ASP-01..09`, `GB-CYL-CLR-25ML-SPR-SBLK`) also remain.
- **This deployed the uncommitted working tree**, including in-flight paper-doll work.
  Nothing is committed yet — review before committing.
- Env: `GRACE_TOOLS_WEBHOOK_SECRET` not yet set on Vercel (the `ELEVENLABS_WEBHOOK_SECRET`
  fallback is carrying it); `ELEVENLABS_API_KEY` still present and now unused.

## Next (steps 2–4)

2. Re-run `scripts/grace_catalog_coverage_audit.mjs` against **prod**.
3. Fix the 8 unreachable edge groups on dev, redeploy.
4. Run both LLM batteries against prod (`scripts/grace_consistency_battery.mjs`,
   `tests/grace-navigation-battery.live.test.ts`).

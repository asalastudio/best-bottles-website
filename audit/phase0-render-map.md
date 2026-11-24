# Phase 0 — Parts render map (read-only discovery)

Repo: `asalastudio/best-bottles-website` @ `17c74fba` (GitHub clone; the Mac path `~/Projects/Clients/Nemat-International/...` was not reachable from this cloud session, so local drift is unchecked).
Date: 2026-11-24. No code, data or assets were changed.

## 1. Surfaces × files × data × assets

| | Catalog grid | PDP (live = "redesign") | Bottle builder |
|---|---|---|---|
| Route | `/catalog`, `/catalog/[family]`, `/catalog/application/[application]` | `/products/[slug]` → `redesignApplies()` `page.tsx:159` | `/matrix` (`/build-your-bottle` 301s here) |
| Component chain | `CatalogClient.tsx:224` `ProductGroupCard` / `FocusedProductCard.tsx:95` → `CatalogCardPreview.tsx` → `ProductCardImagePreview` / `CylinderMasterPreview` | `PdpRedesignPage.tsx:497` → `PdpStage.tsx:263-391` (classic fallback: `ProductDetailClient` → `ConfiguratorPdp` / `ProductImageGallery`) | `MatrixClient.tsx:83` (<1099px `MobileBuilder.tsx:49`) → `BuilderImage.tsx:37` → `preview-layout.ts` / `preview-registration.ts` |
| Data source | `lib/catalogServer.ts:190` → Convex `products.searchCatalog`, `getCatalogGroupVariantPreviewData`, `getCatalogGroupPrimarySkus`; client `productPlates.forSkus`; static `catalog-heroes*.json` (413+ rows) | Convex `products.getProductGroup`, `productKits.forSkus`, `productPlates.forSkus`, `registerStage.forSkus`; repo `approved-component-kits.ts`, `*.generated.json` | `lib/bottle-builder/server.ts` → Convex `matrix.getFamilyRows`, `matrix.listFamilies`, `products.lookupSku`, `productKits.forSkus`, `productPlates.forSkus`, `registerStage.forSkus` |
| Layer / image fields | `productGroups.heroImageUrl`, `products.imageUrl` / `imageUrlCapOff`, `productPlates.thumb/image/imageCapOff`, master kit `layout.parts` | `productKits.parts[].image.url` (+`slot`, `zOrder`, `bounds`, `anchors`), `registerAssemblies`, `productPlates.front/frontCapOff` | `kit.parts[].image.url`, `bodyImage.url`, `finishComponent.imageUrl`, generated `bodies/fitments/rollers/*.generated.json` |
| Compositing | Mixed: flat hero PNG (most), SVG `<image>` stack for Cylinder masters, multiply cap-swap composite | Stacked abs-positioned `<img>` + CSS translate %; zIndex = sorted `zOrder` index (`stage.ts:369,490`) | SVG `<image>` per layer; sort by `zOrder` (`model.ts:527`), register `placement.zIndex` |
| Neck anchor | `stageLayout(kit,"sidecar")` % boxes | `kit.anchors {axisX, neckAxisX, seatY, baselineY, pxPerMm}`; one frame per glass | Same anchors; per-body `StageDatum` (`register/stage-kit.ts:29`); closures re-seat at `seatY + 8%` body height |
| Canvas | 10:11 card | 1000×1100 kit/plate (`pdp-capacity-standards.json`) | 1000×1100 |
| Backdrop (actual) | Bone `#f5f3ef` (+ off-tones `#f8f6f2`, `#efe2d0`) | Bone family: `#f5f3ef`, `--pdp-canvas #f6f4f3`, per-body walls `#f4f3f2`; 3D `#a29383` | Bone `#f5f3ef` |

Unused paths: the Sanity `paperDollFamily` and `PaperDollImage.tsx` (only mentioned in a comment). The `products.paperDoll{Body,Fitment,Cap,Roller}Url` fields are written by `convex/paperDoll.ts` but read by no surface. The r3f 3D viewer (`Bottle3DViewer.tsx`, GLBs in `/public/models`) only mounts on classic-PDP slugs that miss the redesign gate, and only when the shopper opts in.

## 2. Compatibility (neck → fitments/caps)

- Lives in `convex/matrix.ts:113-237`. It reads the `fitments` table by `threadSize`, then runs `selectBestFitmentRule` → `resolveCompatibleComponents` (`convex/componentUtils.ts:218,324`).
- Inputs beyond that: the 13-415 reviewed set and exact witnesses in `catalog-component-links.json`.
- Each row carries a `resolution` of `unknown`, `fitment_rule` or `bottle_listed`.
- The builder enforces the rules by **hiding** anything that doesn't qualify (`model.ts:122,229,474,493`). Out-of-stock finishes are shown disabled. Every option is a real assembly SKU with a `shopifyVariantId`.
- `compatibleFinishComponent` matches the neck with a **substring** check (`model.ts:158`). That is a Phase 1 test target.
- **No metal-atomizer or crimp rule exists anywhere.** The legacy CSV has 23 "Metal Atomizer" rows (12 × 5 ml, 11 × 10 ml), matching the rule; nothing in code enforces it.

## 3. Asset store (brief vs repo)

- **Brief:** layers are on Cloudflare.
- **Repo:** every live layer and plate is on **Vercel Blob** (`yzy7l20k4yt6znzz.public.blob.vercel-storage.com`). There are also some `/local-kits/` and `/images/register/` paths in the repo, plus `cdn.shopify.com` heroes.
- **Cloudflare R2** (`R2_MASTERS_BUCKET`, `.env.example:80`) is a *private masters archive* only. `storageProvider: "vercel-blob" | "r2"` exists on `productPlates`, `productKits` and `registerComponents`, but R2 isn't an allowed host in `next.config.ts`.
- **Path convention:** rows are keyed by `sku` (= websiteSku) with `graceSku` looked up, never derived. `familyId` = `<family>-<capacityMl>ml-<color>-<neck>`. Assets carry `url`, `sha256`, `width` and `height`.
- Phase 1 needs one listing pass to confirm the Blob path pattern.

## 4. Early risks to test in Phases 1–2 (not yet findings — no evidence captured)

1. **PDP stale cap:** redesign layer keys are stable (`stage.ts:483`), and there's no onLoad gate (only `onError`, `PdpStage.tsx:339`). On a cap swap the old image can stay visible until the new one loads. The classic page gates on decode.
2. **Builder deep link/reload:** the selection isn't written to the URL or storage. Only `?family&shop&sku` is read, so reload loses a build unless it entered via `sku`.
3. **Builder races:** there's no AbortController. Hooks rely on an `active` flag, per-URL de-dupe, and keys that include url:attempt.
4. **Scale:** it is applied in several places.
   - Baked into hero PNGs, plus a per-row `framing.scale` (0.79–1.006).
   - `catalog-scale.generated.json` (98 bodies, "catalog-curve"), gated by a readiness file.
   - Hard-coded constants in `CylinderMasterPreview.tsx:80-87` and `CatalogCardPreview.tsx:201,223`.
   - The scale skill calls the scale card a "proposal" until approved, so the brief's "compressed relative scale" policy needs a named source to judge against.
5. **Backdrop rule conflict:** the brief says hero and configurator should be warm charcoal. The code uses bone everywhere, and no charcoal stage token exists. Either the rule or the code is out of date.
6. **Neck substring match** (`model.ts:158`): it could pair 13-415 parts with e.g. a 113-415 string, or with "18-415" vs "18-400" variants. Needs a unit test.

## 5. Blockers for Phases 1–2

This session's network allowlist **refuses** every host the audit needs:
- `precise-raccoon-123.convex.cloud` (prod) and `helpful-elephant-638.convex.cloud` (dev)
- `www.bestbottles.com`
- `best-bottles-website.vercel.app`
- `yzy7l20k4yt6znzz.public.blob.vercel-storage.com`
- `cdn.sanity.io`

Shopify needs the Shopify connector (available here) or Admin API access. Options: allow these hosts on this environment, or run Phases 1–2 on your machine.

## 6. Existing tooling to reuse (instead of a new script from scratch)

- `scripts/audit-pdp-layer-coverage.mjs`
- `scripts/paper-doll/audit-storefront-family.mjs`
- `scripts/audit_builder_readiness.ts` (+ `scripts/lib/builder-readiness.ts`)
- `scripts/audit_convex_grace_sku_truth.mjs`
- `scripts/audit_shopify_sku_mapping.mjs`
- `scripts/audit/size-consistency/`
- `scripts/register/phase4/parity_gate.py`
- About 60 vitest suites for kits, register and builder.

CI (`.github/workflows/ci.yml`) runs tsc, lint, vitest and build. It has no Playwright or network audits.

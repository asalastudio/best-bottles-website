# Best Bottles — Launch Readiness Audit

**Date:** 2026-07-29
**Branch:** `audit/launch-readiness-2026-07-29`
**Scope:** Everything except product imagery. Verified against **production** Convex (`precise-raccoon-123`) and the **live** Shopify store (`bestbottles-1580.myshopify.com`).

Every number below was measured, not estimated. Raw data: `data/audits/launch-readiness-2026-07-29/`.

---

## Bottom line

The site is structurally sound: it builds, typechecks, all 296 tests pass, catalog integrity is clean (0 duplicate SKUs, 0 orphans), and Grace's catalog retrieval is 36/36 green.

**Three things stop us from taking money correctly today, and none of them are images:**

| # | Blocker | Impact | Owner |
|---|---|---|---|
| 1 | **377 SKUs 410 at checkout** — Shopify products are DRAFT/unpublished | 16% of catalog unbuyable | Boss / Shopify |
| 2 | **Advertised volume discounts aren't honored** — site quotes less than Shopify charges | 2,252 SKUs | Boss decision |
| 3 | **Every lead goes into a black hole** — no email/notification on form submit | 100% of quote requests | Us + Boss |

Plus: **Grace text mode is dead in production** (invalid API key — 2-minute fix).

---

## P0 — Must fix before launch

### 1. 377 SKUs cannot be purchased (HTTP 410 at checkout)

The site decides "you can buy this" purely from whether a `shopifyVariantId` exists. That is not sufficient — if the parent Shopify product is **DRAFT or unpublished**, Shopify refuses the sale.

**Proven, not assumed:**

```
DRAFT   GB-RND-FRS-78ML-RDC-MSLV  → /cart/53343606112548:1  → HTTP 410 Gone
ACTIVE  (control)                 → /cart/53343616598308:2  → HTTP 302 → real checkout
```

Full sweep of all 2,313 SKUs that carry a variant ID:

| Result | Count |
|---|---|
| Genuinely sellable | **1,932** |
| DRAFT + unpublished → 410 | **377** |
| Variant missing from Shopify entirely | **4** |
| No Shopify variant at all (quote-only) | **17** |

**Not purchasable, total: 398 of 2,330 SKUs (17%).**

Spread across 13 families — this is not one bad batch:

```
Elegant 77 · Round 48 · Diva 43 · Sleek 36 · Slim 36 · Circle 34
Cylinder 24 · Empire 24 · Sprayer 15 · Atomizer 12 · Grace 12 · Diamond 12 · Lotion Pump 7
```

**The question for the boss:** are these 377 intentionally held back (discontinued, not yet launched), or did they simply never get published? That answer decides whether we publish them in Shopify or leave them as quote-only.

**Done on this branch:** the storefront no longer sends anyone to a dead checkout. Added `products.shopifySellable`, synced from Shopify, and `isCheckoutReady()` now treats it as a veto. Blocked SKUs fall back to **Request a Quote** instead of a 410. Full list: `data/audits/launch-readiness-2026-07-29/shopify-blocked-skus-prod.json`.

**Remaining action:** publish the products in Shopify (their call), then run the sync.

---

### 2. We advertise volume discounts Shopify does not honor

The PDP renders a volume ladder with an explicit savings promise. Shopify's cart permalink charges the **flat 1-piece price**.

**Proven with a real checkout** (corrected 2026-07-29 — see note below):

```
GB-DVA-CLR-46ML-T-06
  Tier says:         $7.46/ea at 12+   → $89.49 for 12
  Shopify charged:   $7.85/ea (1pc)    → $94.20 for 12
```

> **Correction.** My first test used quantity 10 on `PKG-BOX-WHT-4X4X4`. That was
> the wrong threshold: products carry a `priceTiers` field (added in #57 on
> 2026-07-20) whose real breaks are **1 / 12 / 144 / 600 / 3000**, not 10. Only 53 SKUs have a genuine 10-unit break; **2,252 break at 12**, so
> `webPrice10pc` is largely vestigial. Re-tested at the correct 12-unit threshold
> above — the conclusion is unchanged, but this is the sound evidence.

- **2,252 of 2,330 SKUs** render this ladder.
- Most gaps are 2–10%, but **34 SKUs advertise 25–98% off**. The worst, `CMP-CAP-PNK-18-415`, shows $4.25 → $0.08 (98% off) — near-certainly a data error, and a disaster if anyone ever honored it.
- The **cart was compounding it**: the cart subtotal applied tier pricing too, so the cart total didn't even match the Shopify total.

Quoting a price you don't charge is a trust and consumer-protection problem, not a cosmetic one.

**Done on this branch:** added `src/lib/volumePricing.ts` as the single source of truth. Until Shopify volume rules exist, the cart subtotal uses the price Shopify will actually charge, and the PDP ladder is labelled honestly:

> **Volume Pricing · By Quote** — 1+ $6.40 ea · 12+ $6.08 ea
> *Volume rates are confirmed on a quote — online checkout is billed at the $6.40/ea rate.*

The tiers stay visible (they're real quote pricing, and the sales team honors them), but nothing now claims the discount applies online.

**The decision for the boss:** either (a) configure Shopify quantity rules so the tiers are real online — we're on Shopify **Plus**, so this is available — then flip `NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT=true`; or (b) keep volume as quote-only and ship as it now stands. Either way, **the 34 suspect prices need a human pass** (`suspect-tier-pricing-prod.json`).

---

### 2b. The real volume ladder is far deeper than the site shows

Production holds a `priceTiers` array on **2,305 of 2,330** products, last synced
2026-07-20, with breaks at 1 / 12 / 144 / 600 / 3000 plus case-quantity multiples
(up to 15,840 units). Example:

```
GB-SLM-BLK-5ML-ATM-BLK-T
  1     $2.25      144   $2.03
  12    $2.14      600   $1.91      3000  $1.76
```

The PDP renders only the 1 / 10 / 12 slice, so the site **under-sells the actual
B2B pricing** — a distributor ordering 3,000 units sees no indication that the
price drops 22%. The ladder was loaded in #57 with an accuracy gate (tier-1 unit
price had to match `webPrice1pc`), so the data is trustworthy; it simply isn't
surfaced.

**Decision needed:** show the full ladder on the PDP (and make Shopify honor it),
or keep volume strictly to quotes.

### 3. Quote and contact form submissions notify nobody

`convex/forms.ts` writes every submission — quote, sample, contact, newsletter — into the `formSubmissions` table and stops there.

- No email integration exists anywhere in the codebase (no Resend, SendGrid, Postmark, Nodemailer, Slack webhook — confirmed by search).
- The only reader is `listByType`, an `internalQuery`, which **cannot be called from any UI**.
- No dashboard surfaces it. Not even the executive hub.

So today, a quote request is invisible unless somebody manually opens the Convex dashboard.

This compounds P0-1 and P0-2: the quote path is the designated fallback for all 398 unsellable SKUs *and* for all volume pricing. It's now the primary conversion path — and it's unmonitored.

**Needed:** an email/Slack notification on submit, plus somewhere for the team to read submissions. Requires a decision on destination address and provider. Not built on this branch — it needs their input on where leads should land.

---

### 4. Grace text mode is down in production

All 50 eval cases return `INFRA_ERROR`; customers get *"I ran into an unexpected issue."*

Root cause confirmed: the `OPENAI_API_KEY` on the **prod Convex deployment** returns **401 Incorrect API key** from OpenAI. The key in `.env.local` is also invalid.

```bash
npx convex env set OPENAI_API_KEY sk-... --prod
```

**Important:** Grace's *retrieval* layer is healthy — catalog tools 36/36, `getCatalogStats`, `searchCatalog`, `getFamilyOverview`, `getBottleComponents`, `checkCompatibility` all pass, and ElevenLabs voice + signed-url are OK. It is only the text LLM call that's broken. Voice mode is unaffected.

---

## P1 — Should fix before launch

### 5. A test artifact is a live, indexable product page

`/products/webhook-test-hmac` renders publicly as **"HMAC integration test"**, and it's in the sitemap. Its SKU `HMAC-TEST-ONLY` is *checkout-ready* — a customer could buy it.

### 6. Four dead product pages

These groups have zero variants but render a live PDP with a phantom price and a "1 VARIANT" badge:

```
vial-3ml-clear-13-425
vial-3ml-cobalt-blue-13-425
cylinder-9ml-clear-18-400
cylinder-9ml-clear-18-400-glasswand
```

They degrade to "Request a Quote" rather than crashing, but they're dead ends — and all five pages (with #5) are in the sitemap being served to Google.

Deleting production Convex records is destructive, so I've left that to you. Recommend deleting the test group outright and deciding whether the 4 vial/cylinder groups should be repopulated or removed.

### 7. Grace's product count disagrees with the catalog

Grace reports **2,320** variants; the catalog actually holds **2,330**. `getCatalogStats` sums `productGroups.variantCount`, which has drifted from reality:

```
fine-mist-sprayer-13-415                 declared  9 → actual 12
fine-mist-sprayer-18-415                 declared  6 → actual  8
circle-50ml-frosted-18-415-antiquespray  declared  9 → actual 18
+ 4 empty groups still declaring 1 variant each
```

This is the catalog/Grace misalignment you flagged. Fix is a `variantCount` recount — but note the standing interlock: **never run `productGroupsRebuild --apply` until `buildGroupSlug` is reconciled**, or you get 194 duplicates.

### 8. Three groups are browsable but entirely unbuyable

`cylinder-25ml-clear-18-415-finemist`, `aluminum-bottle-250ml-clear-20-410-finemist`, `cream-jar-5ml-amber` — every SKU inside is blocked. Three more are partially blocked (`fine-mist-sprayer-13-415` 9/12, `fine-mist-sprayer-18-415` 6/8, `circle-50ml-frosted-18-415-antiquespray` 9/18).

---

## P2 — Worth cleaning up

- **Stale "Made in USA" claims.** `convex/knowledge.ts` asserts *"All products are sourced and warehoused domestically in the USA"* and *"our entire supply chain is domestic."* These are **not currently live** (the text agent builds its prompt only from `gracePrompt.ts`), but they'd activate the moment anyone re-seeds `graceKnowledge`. Given Made-in-USA claims are FTC-regulated, these should be corrected or deleted — worth confirming the actual sourcing truth with the boss.
- **Shipping threshold contradiction.** `knowledge.ts` says free shipping over **$199**; the site banner and PDP say **$99**. Same latent-not-live status. `src/app/example/page.tsx` also shows $199 (noindexed demo page).
- **`/collections` 404s.** Only `collections/boston-round-30ml` exists, and nothing links to it. Either build the index or remove the route.
- **Soft-404 on unknown products.** `/products/anything-invalid` returns **HTTP 200** with a "Product Not Found" body. It is correctly `noindex`, so SEO damage is limited, but it should return a real 404.
- **Canonical domain unconfirmed.** Sitemap and canonicals emit `https://www.bestbottles.com` — which memory records as the *legacy* PHP site. Needs an explicit confirmation that launch = cutting that domain over to this app.
- **Local env inconsistency.** `.env.local` has `CONVEX_DEPLOYMENT=dev:helpful-elephant-638` but `NEXT_PUBLIC_CONVEX_URL` pointing at **prod**. Convex CLI writes to dev while the app reads prod — an easy way to "fix" something invisibly.

---

### 9. Every Shopify variant has zero weight

**0 of 2,309** variants carry a weight, and all are flagged `requiresShipping: true`.

Carrier-calculated rates (FedEx/UPS live rates) cannot price a parcel with no weight —
customers would see no shipping option, or a wrong one. Flat-rate shipping is unaffected,
which may be why this has gone unnoticed.

Convex already holds the data: `bottleWeightG` on 2,168 products and `caseWeightG` on
2,035, making **2,164 of the 2,309** fixable by a push rather than by re-measuring. The
remaining ~145 have no weight anywhere and need real measurements.

Blocked on the boss: carrier choice, flat vs live rates, box sizes and packing weight,
and the free-shipping threshold ($99 on the site vs $199 in `knowledge.ts`). See
`docs/BOSS-CHECKLIST-2026-07-29.md`.

We also cannot read the store's shipping configuration — the Admin token lacks
`read_shipping`, so delivery profiles and rates are unverifiable from here.

---

## Security

- ✅ `/api/elevenlabs/server-tools` is now properly guarded (same-origin or `x-webhook-secret`), and `ELEVENLABS_WEBHOOK_SECRET` **is** set in Vercel production. The hole noted in earlier sessions is closed.
- ⚠️ **Key rotation is still outstanding.** The prod Convex `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are readable via `npx convex env list --prod`, and per project history live ElevenLabs and Shopify Admin tokens are in git history. Since the OpenAI key must be replaced anyway (P0-4), rotate the whole set in one pass.

---

## What's green

| Check | Result |
|---|---|
| Production build | ✅ passes |
| TypeScript | ✅ clean |
| Test suite | ✅ 296/296 |
| Catalog integrity | ✅ 0 dupes, 0 orphans, 0 missing SKUs |
| Grace retrieval matrix | ✅ 36/36 |
| Grace voice + tools | ✅ all healthy |
| Checkout smoke (42 SKUs, every family + price tier) | ✅ 42/42 |
| Mixed cart (buyable + quote-only) | ✅ correctly drops quote lines |
| 1-piece price parity vs Shopify | ✅ 0 mismatches in 150 sampled |
| Core routes | ✅ all 200 except `/collections` |

Inventory is **untracked** on all 2,313 variants in Shopify, so stock levels never block a sale. That's a deliberate setup, not a bug — worth confirming it's intended.

---

## Changes on this branch

| File | Change |
|---|---|
| `convex/schema.ts` | `shopifySellable` + reason + checked-at on `products` |
| `convex/products.ts` | `setShopifySellabilityBatch` (write-token guarded), `getCheckoutBlockedCount` launch gate |
| `src/lib/checkout.ts` | `isCheckoutReady()` now vetoes on `shopifySellable === false` |
| `src/lib/volumePricing.ts` | **new** — single source of truth for whether tiers are honored |
| `src/components/CartProvider.tsx` | cart subtotal uses the charged price; sellability propagates |
| `src/app/products/[slug]/ProductDetailClient.tsx` | PDP uses the shared guard; honest volume-pricing copy |
| `tests/shopify-sellability.test.ts` | **new** — 12 regression tests |
| `scripts/audit_launch_readiness.mjs` | **new** — checkout/price/image coverage |
| `scripts/audit_group_checkout_integrity.mjs` | **new** — group→SKU FK integrity |
| `scripts/audit_checkout_smoke.mjs` | **new** — live checkout across families/tiers |
| `scripts/audit_price_parity.mjs` | **new** — Convex vs Shopify price parity |
| `scripts/audit_shopify_sellability.mjs` | **new** — full sellability sweep |
| `scripts/sync_shopify_sellability.mjs` | **new** — dry-run-by-default Convex sync |

All audit scripts are **read-only**; the sync script is dry-run unless `--apply`.

---

## To apply the checkout fix

The schema change is additive and safe, but it touches production, so it's staged rather than applied:

```bash
CONVEX_DEPLOY_KEY=<prod-key> npx convex deploy -y
```

```bash
CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/sync_shopify_sellability.mjs --apply
```

Then confirm the launch gate reads zero:

```bash
npx convex run products:getCheckoutBlockedCount --prod
```

## To re-run the whole audit

```bash
CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_shopify_sellability.mjs
```

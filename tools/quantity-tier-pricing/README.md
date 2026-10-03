# Quantity-tier pricing candidate — NOT installed or ready to activate

This directory contains a pure Rust pricing core, a local JSON runner, an input query validated against Shopify Functions `2026-04`, and regression fixtures. It is **not** a Shopify CLI scaffold, Wasm function, or storefront integration. No app identity, credentials, OAuth scopes, deployed checkout behavior, live metafields, prices, discounts, or inventory are changed. The frontend volume-pricing flag remains untouched.

## Why this candidate

Best Bottles reports Shopify Plus. Shopify's [Cart Transform API](https://shopify.dev/docs/api/functions/2026-04/cart-transform) supports `cart.transform.run` / `lineUpdate` fixed unit prices, with a documented quantity-based pricing example. This matches the approved September 25 instruction to show and charge tiers as prices. An [automatic Discount Function](https://shopify.dev/docs/api/functions/latest/discount) is another quantity-aware mechanism, but needs a discount node and combination policy; no automatic discounts are currently installed. [Native B2B quantity pricing](https://shopify.dev/docs/storefronts/headless/hydrogen/cookbook/b2b) requires company/buyer-context catalog pricing and therefore does not cover this site's anonymous checkout. A fixed draft-order override is not a substitute for quantity-aware repricing and is not implemented here.

The host runtime, not this pure core, must rerun the calculation after every quantity change. Local tests prove recomputation is stateless; they do not prove hosted checkout execution. Both Storefront and the existing wholesale path require live-quantity-edit tests in a permitted test environment before rollout.

## Trust and pricing contract

`custom.bb_volume_tiers` is a proposed merchant-owned **variant** JSON metafield. Only a server/admin-authorized publisher may write it. It binds the exact Shopify variant ID, USD currency, schema version, source revision, and sorted integer-cent ladder. Fixtures use synthetic Shopify IDs and the published rounded unit rates for `GBElg15MtlRollSlSh`; no fixture may be uploaded as real merchant data.

The core aggregates split lines by variant ID, never across variants. It emits the selected fixed unit price on every invocation, including the base tier after a quantity decrease. It does not trust cart attributes or incoming price amounts. Invalid configured ladders, unsupported currency/selling plans, inconsistent split-line data, duplicate lines, or quantity overflow return errors. The Shopify adapter must surface those errors as run failures and activation must use `blockOnFailure=true`; returning an empty operation list on error would silently overcharge.

An absent metafield means the variant is outside the staged rollout and gets no operation. Therefore the storefront **must** compare promised server-resolved tier prices with the actual Shopify cart costs before redirect; missing/stale metafields or bypass fallbacks cannot silently proceed. A nonempty sourceRevision provides traceability, not proof of freshness. Authoritative rollout membership and the complete ladder revision must be verified by the data publisher/parity guard, not only the currently selected unit price: a stale ladder can agree at 60 and diverge when checkout quantity changes to 144. The eventual function configuration must enforce that revision/coverage contract throughout checkout; the current candidate has no active manifest and cannot establish freshness. Cross-currency pricing is intentionally unsupported until an explicit rounding/conversion contract is tested.

The legacy site publishes pack totals that differ from rounded-unit multiplication. This candidate implements the current approved rounded-unit PDP calculation; source precision/pack reconciliation remains an explicit release check, not an invented new discount.

## Checks performed

- `cargo test --locked --manifest-path tools/quantity-tier-pricing/Cargo.toml`: 15 tests pass. The boundary test includes 1, 11, 12, 13, 60, 143, 144, 145, 287, 288, 289, 1439, 1440, 1441.
- A mutation replacing highest-applicable tier selection with the first/base tier makes five tests fail. Correct implementation restored and rerun.
- `cargo run --locked --manifest-path tools/quantity-tier-pricing/Cargo.toml < tools/quantity-tier-pricing/fixtures/elegant-60.json`: JSON output matches the expected `lineUpdate` operation, unit price `0.84` (60 × $0.84 = $50.40).
- Shopify skill `validate.mjs --file .../cart_transform_run.graphql --api functions_cart_transform --version 2026-04`: valid. This validates the GraphQL input, not Wasm ABI or app TOML.

Rust was installed only under `/tmp/bb-rustup` and `/tmp/bb-cargo` for these checks; no shell profiles/system toolchain configuration changed. To reuse it on this host, prefix cargo with `RUSTUP_HOME=/tmp/bb-rustup CARGO_HOME=/tmp/bb-cargo /tmp/bb-cargo/bin/cargo`.

## Actual next access boundary

The existing site Admin token belongs to **Custom Checkout Fields**, client ID `263dbfc06a14354a223d453bbf70e91f`, developerType `MERCHANT`. It owns no Functions and lacks transform scopes. The checked-in **Best-Bottles-Website** client ID `6f0226c25c5b57d89c5cffb4a5e89e13` does not resolve in the connected store. Do not replace that ID or reuse/expand existing credentials blindly. [Functions can only be activated by their owning app](https://shopify.dev/docs/api/functions/latest).

Target store: **bestbottles-1580.myshopify.com**. Recommended new recipient: a dedicated developer-owned extension-only app named **Best Bottles Tier Pricing**, subject to the owner's confirmation of its developer organization. Its eventual minimum new store scope is **`write_cart_transforms`** (includes read). Variant metafield writes can use the existing site's already-granted `write_products` scope in a separate approved data-publishing action; the dedicated function app does not need new orders, customers, inventory, discounts, or draft-order permissions for this design. [Scope documentation](https://shopify.dev/docs/api/usage/access-scopes).

### Exact first approval/handoff wording

> May I create a dedicated extension-only Shopify app named **Best Bottles Tier Pricing** in the Best Bottles owner's developer organization and use Shopify CLI to scaffold its Rust `cart.transform.run` extension for **bestbottles-1580.myshopify.com**? Please identify/confirm that developer organization in the CLI. This step authenticates to Shopify, sends the app name/configuration and creates the developer app/local scaffold. It does **not** install the app on the store, grant store scopes, write tier data, or activate checkout pricing. The existing **Custom Checkout Fields** credentials stay unchanged.

Commands after that approval, in a new dedicated app directory (not the stale root config):

```sh
CI=1 SHOPIFY_CLI_FORCE_AUTO_UPGRADE=0 SHOPIFY_CLI_NO_ANALYTICS=1 shopify app init --template none --name "Best Bottles Tier Pricing" --organization-id "$CONFIRMED_SHOPIFY_ORGANIZATION_ID" --path /Users/jordanrichter/Documents/Codex/2026-10-01/task/best-bottles-tier-app
# After the owner confirms the organization and the returned app identity:
CI=1 SHOPIFY_CLI_FORCE_AUTO_UPGRADE=0 SHOPIFY_CLI_NO_ANALYTICS=1 shopify app generate extension --template cart_transform --flavor rust --name best-bottles-volume-tiers --path /Users/jordanrichter/Documents/Codex/2026-10-01/task/best-bottles-tier-app
```

The parent must obtain the owner-confirmed developer organization ID and set CONFIRMED_SHOPIFY_ORGANIZATION_ID before the noninteractive command. It is intentionally not populated here. An authentication prompt is also an approval boundary; do not substitute an invented organization ID or silently configure credentials. Once the registered app ID is known, bind the core into the generated SDK types/query, run CLI schema/typegen/build and Wasm fixtures, and review the exact app configuration before requesting installation.

### Later, separate approvals (not requested or granted now)

1. **Install/access:** “May I install **Best Bottles Tier Pricing** [insert the verified new client ID] on **bestbottles-1580.myshopify.com** with only **`write_cart_transforms`**, allowing that app to read/create/update its cart-transform rules? This grants checkout-pricing capability but does not by itself activate our transform.” The app owner must approve OAuth/install; credentials are not copied into chat or silently configured.
2. **Tier data:** show an exact audited variant-ID/metafield diff and ask permission to write only `custom.bb_volume_tiers` using existing **Custom Checkout Fields** `write_products` permission. No product base-price/stock changes. Separate action, even though no scope expansion is needed.
3. **Activation:** after an isolated test-store proof and server/frontend parity integration, show the exact owning app ID, function handle/ID, version/hash, rollout variants and rollback, then request `cartTransformCreate` with **`blockOnFailure=true`** for the named store. This immediately affects checkout pricing and is a distinct approval. [Activation docs](https://shopify.dev/docs/api/admin-graphql/latest/mutations/carttransformcreate). Do not run `shopify app deploy` from this skill workflow.

## Remaining implementation after access

Generate the actual extension through CLI, map errors to real function failures, and test Wasm execution including its instruction budget. Build an audited tier-metafield publisher with dry-run output. Update cart pricing/hydration and the server minimum to the same authoritative ladder, read Shopify line costs before redirect, and prevent permalink/wholesale fallbacks bypassing the guarantee. Coordinate changes to `portal/wholesaleCheckout.ts` with the security owner. Preserve wholesale tax behavior. Verify hosted quantity edits across boundaries and mismatch/error states without placing an order. Only then remove the temporary pricing policy gate.

This preserves the original pricing task at the actual new-access boundary. It is not a claim that the customer-facing mismatch is fixed.

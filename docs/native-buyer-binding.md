# Purchase-only buyer binding (not activated)

## Dependency and scope

Branch `codex/native-buyer-binding` starts from PR355/account-foundation `30d0283b40824575effba472159aa429bdca3222` and merges PR351/native pricing `df7ccae58998d0d9c3ca9807cb5b775aad7dc8ae` at `3dd71a16674872f42bd2832bb224de774e8c4fbe`. PR355 itself requires PR352 `cb9687320d32a4d3d781b62fb03c17b1cc21a853`. This is a clean isolated stack; none of those held changes is assumed deployed.

No route, server action, page, sender, auth provider or payment policy is activated by this change. `createServerBuyerBindings` is an unmounted server-only composition requiring explicit configuration AND a reviewed Customer Account session reader. It can supply PR351's `loadAccess` dependency only after the release gates below. No price/stock/catalog data or legacy checkout path changes.

## Trust boundary

- One immutable tuple: Clerk instance/user/org, Shopify shop/customer/company/contact/location. Ordering-only role and assignment IDs, Clerk membership/verified-email IDs are recorded; email text and access tokens are not stored.
- Staff proposal and review run the existing Best Bottles staff gate before and after provider reads. A customer's Clerk `org:admin` is not that gate. Subject identifiers supplied by a reviewer are selections only: the server fetches the target Clerk user, verified primary email, active membership and Shopify relationship. No automatic email lookup/creation/linking.
- Proposal starts `proposed`, never grants access. Review re-reads provider evidence and compares the exact proof and proposal version. The transactional review cannot overwrite a concurrent review or revocation. Revocation is terminal; a revoked row reserves its customer until a separately reviewed migration. Same proof proposal retries are idempotent, without resurrecting revoked access.
- The trusted Next server uses the existing portal write credential for Convex reads/writes, matching the existing portal authorization architecture. Browser callers receive neither the credential nor arbitrary scoped Convex access. `args` and `returns` validators constrain every new endpoint; lookups use indexes and unique results. These are not standalone JWT endpoints and must never be exposed as an unauthenticated proxy.
- A customer cannot be simultaneously claimed by another user/org/instance in the same shop. Legacy numeric/GID customer associations owned by another organization block proposal, approval and purchase reads. No `portalAccounts.shopifyCustomerId` or customer/order/address/certificate data is written. Staff reads remain available to revoke when a new legacy conflict appears.
- Every price/checkout access resolution rechecks Clerk membership/user state/verified email, Shopify customer/contact/company/location and the exact `Ordering only` assignment. Unknown/admin roles, missing/ambiguous relationships, unverified email, incomplete role pagination, provider failure, expired/future/stale evidence all fail closed. This narrow first implementation supports one customer and location per subject, not broad multi-company access.
- Staff approval and matching verified emails are insufficient to buy. A required auth-owner dependency must read the current buyer's own server-held Customer Account session and freshly query its customer and authorized company/contact/location. The result must match the complete binding and have a usable token and fresh proof. No Admin impersonation, browser-supplied token or email-only fallback exists.
- Before returning access, reread the server viewer and binding version/state. PR351 repeats `loadAccess` before cart creation. Provider reads use a 30-second evidence window starting before the first read; Shopify fetch has a 10-second timeout and no cache. External permission changes after a check are not atomically locked; Shopify remains the final authority at cart/checkout.

## Production Clerk cutover gate

The live site's currently observed Clerk host is a development `*.clerk.accounts.dev` instance. Do NOT enroll those development identities. Both server composition and backend proof validation reject development hosts. The production composition requires matching `pk_live_` host, `sk_live_` mode, enabled Clerk and exact shop environment.

Parent dashboard evidence confirms a production Clerk application exists but is awaiting setup: production keys/first user, Google custom OAuth credentials and domain CNAME verification are incomplete. Proposed staging domain `thecat.company` was not in the current Vercel project's complete alias list. No production hostname, DNS, OAuth credentials, env changes, user migration or production binding is approved/implemented here. Clerk application keys and Google OAuth client credentials are distinct.

After domain/provider/environment cutover is separately approved and verified, resolve fresh production user/org/membership/email IDs through personal sign-in. Never copy development IDs into the production binding. Existing portal records keyed by bare development Clerk IDs need a separate explicit migration plan; this table does not migrate them.

## Exact later write/release plan

1. Review/merge prerequisite stack and this code. Deploy matching Convex schema/functions and frontend only after release approval, keeping all new consumers unmounted/disabled. No code-only draft PR approves deployment.
2. Complete separately approved production Clerk/Customer Account integration. Implement and test the required server session reader and the independently chosen order/payment policy. Do not use test/dev identities or mint sessions as a substitute for personal authentication.
3. Re-read production identity and Shopify ownership/ordering-only role. Present the exact tuple and staff actor for action-time approval. Approved `propose` inserts one proposed row only; `review` approves that exact immutable row/version after fresh evidence. No portal account/customer-data link is part of either operation. No seed command is included.
4. Run a synthetic/isolated integration test, then separately approved personal buyer QA. Verify missing session/revocation/org switching and contextual price/cart/checkout parity. Do not complete an order. Inventory reduction is a separate blocker, never permission to change quantity/stock.
5. Enable the reviewed pilot consumer only after those gates. Keep data/context failure paths blocked; do not fall back to anonymous or legacy org-wide customer checkout.

## Rollback

Before activation there are no live rows or consumers to undo. Revert this commit and prerequisite merge only on this isolated branch, not shared PR branches. After an approved release, disable the consumer first; staff may revoke the exact row/version without Shopify being available. Keep the table and audit timestamps through rollback; do not delete claims or migrate customers automatically. Reassignments, additional locations and Clerk migrations need a new reviewed data plan. No Shopify data rollback is needed because this code only reads Shopify.

## Verification limits

Fixtures use the verified Shopify pilot IDs with synthetic Clerk identities/emails and synthetic tokens. They prove code behavior, not production ownership. Official Shopify 2026-04 schema validation passes for the read-only ownership query (`read_customers`, `read_companies`). Tests cover transactional conflicts, scope isolation, stale review, revocation, legacy conflicts, provider truncation and authenticated-session mismatch. Production Clerk/Customer Account session QA and live Convex deployment are deliberately not performed. Local `convex codegen` requires deployment configuration and was not given live credentials; the new API type entry follows the existing generated declaration and is checked by TypeScript.

API reference: https://shopify.dev/docs/api/admin-graphql/2026-04/objects/CompanyContact
CLI read-only production status guidance: https://clerk.com/docs/cli

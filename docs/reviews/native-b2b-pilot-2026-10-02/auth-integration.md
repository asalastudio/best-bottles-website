# Pilot authentication and HTTP integration

Status, October 2: the separately approved isolated Shopify company/catalog pilot is provisioned and its contextual price ladder verified through Admin API. This does **not** establish authenticated Storefront, PDP, cart or hosted-checkout parity. No production routing or authentication settings have been changed by this draft.

## Existing path and missing boundary

`getPortalViewer` in `src/lib/portal/server.ts` reads Clerk `auth().userId/orgId`, gated by `NEXT_PUBLIC_CLERK_ENABLED`. `ensureShopifyCustomerForOrg` links an organization's billing customer; it does not establish the current person's Shopify Customer Account identity. `portalAccounts` has no company/contact/location or Customer Account token fields. No Customer Account OAuth exchange, token session or authorized-location resolver exists in this checkout branch. Local configuration inspection found Clerk and Shopify Admin credentials present, but no Customer Account client/session configuration; values were not printed. This does not establish what is configured in Shopify/Clerk dashboards or Vercel.

The current wholesale route attempts a customer-based draft order and then anonymous checkout. Neither path carries the native company-location context. It remains unchanged here while the portal/security owner coordinates the replacement. A Clerk session, organization billing email, tax-exempt flag, browser location ID or the new company assignment is insufficient by itself to create a Customer Account access token.

Public discovery was successfully read without authentication or changes:

- `https://bestbottles-1580.myshopify.com/.well-known/openid-configuration`
- `https://bestbottles-1580.myshopify.com/.well-known/customer-account-api`

The issuer is `https://shopify.com/authentication/73994207524`; the discovery response provides authorization/token/logout/JWKS URLs and S256 support. The advertised customer GraphQL endpoint currently ends in `/account/customer/api/2026-10/graphql`. Discover these endpoints at runtime and validate the configured store/issuer; do not assume this public response identifies an existing client ID or client secret.

## Prepared code and exact mounting contract

`createNativeB2bPilotHandler` composes the native pricing/cart service with a strict HTTP boundary. It is **not mounted** at a Next route, and neither PDP nor cart calls it yet. Suggested isolated path: `POST /api/shopify/b2b-pilot`, with JSON `{ action: "prices" | "checkout", companyLocationId, lines: [{ variantId, quantity }] }`.

The mounting code must supply all of these trusted dependencies; none has an anonymous or permissive default:

1. Server-only pilot configuration: disabled by default; exact approved Clerk user/org, company/contact/location, variant enrollment, and HTTPS preview origin. Resolve the real Clerk IDs after the user's own sign-in; never infer them from email. Keep private pilot IDs out of browser configuration and public fixtures.
2. `readViewer`: the verified Clerk server session. The handler checks this before lookup and again before cart creation.
3. `loadAccess(selectedLocationId)`: a server-owned Customer Account session bound to that Clerk user/org, with expiry checks and a fresh Customer Account API read of the actual customer/contact and permitted locations. Match the pilot's approved Shopify customer as well as company/contact/location. Return pending/revoked/unavailable when applicable. The handler independently pins the returned Clerk/company/contact/location IDs. User selection is only a request and must match both fresh authorization and the pilot allowlist.
4. `assertOrderAllowed`: the verified wholesale order policy. Native ordering access does not approve a reseller certificate or settle account-versus-each-order review. Do not use the test fixture's no-op callback in mounting code.

The handler rejects foreign/missing origins, malformed JSON, forged price/token/approval fields, unenrolled variants and other buyers/locations. Both response paths are private/no-store. Checkout re-verifies price, quantity and native buyer context through the service. Any failure returns an explicit error, with no draft/permalink/anonymous fallback and no quantity reduction. The HTTP composition tests use synthetic identity and mocked Shopify responses; they are not browser evidence.

## Smallest authentication configuration review

First inspect the existing Customer Account API client settings in Shopify's Headless channel using authorized Admin UI. Public discovery and the available Admin queries do not reveal the application's client registration. Request access to that settings screen if it is not already available. Do not create a replacement client without checking.

Use the existing compatible Customer Account client if available; otherwise review creating/configuring a confidential server client for this preview. Required values are its Customer Account client ID, client secret (if confidential), registered redirect URL and allowed origin, plus a dedicated server session encryption/storage configuration. These are not the Admin API token or the Clerk publishable/secret keys. Proposed application configuration names: `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET`, `SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI`, `SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET`, and a server-only `SHOPIFY_B2B_PILOT_ENABLED=false`; these names are a design proposal, not implemented environment switches.

The current PR351 branch preview origin was verified from Vercel's PR comment:

`https://best-bottles-website-git-codex-native-b2b-pricing-asala.vercel.app`

Proposed callback, requiring implementation plus exact registration approval:

`https://best-bottles-website-git-codex-native-b2b-pricing-asala.vercel.app/api/shopify/customer-account/callback`

Use scopes `openid email customer-account-api:full`; implement state/nonce verification, authorization-code exchange, token validation, secure server-only session storage and expiry/refresh/logout handling before enabling the handler. An OAuth client secret must remain server-side. The callback must be bound to the initiating Clerk user and organization, not just an email match.

**No Clerk identity-provider reconfiguration is necessary merely to keep Clerk and add a separate Shopify customer sign-in.** Shopify-native customer sign-in can supply the Customer Account token while Clerk continues to protect the portal. Federating Shopify customer authentication to Clerk through a Plus OIDC identity provider is a separate convenience/configuration project requiring its own reviewed client/callback/activation diff. Do not bundle shop-wide IdP activation into this pilot.

No OAuth configuration, credential transfer, token exchange, global login setting, `checkoutToDraft` policy, certificate approval or tax exemption was performed in this preparation. The pilot location's observed `checkoutToDraft:false` remains unchanged; it does not resolve the application order-policy question.

## User-selected location verification without an order

After auth configuration and session implementation are reviewed, the user signs into Clerk and Shopify personally. Query the token's customer and allowed company locations; display only safe company/location labels intersected with the pilot allowlist. The user selects the approved location. Verify the server-resolved customer/contact IDs against the private pilot record and record only redacted identity evidence.

On the isolated preview, use the native `prices` response for both PDP and cart at quantity60, then use the `checkout` response for the hosted handoff. All three must show $0.84/set and $50.40 merchandise total. Test11/12,143/144,287/288,1439/1440 where inventory and the confirmed order policy permit; test higher quantities in an approved fixture if live stock prevents them. Repricing must happen when quantities cross boundaries in either direction. Stop before payment/order submission. Do not enter a card before required approval.

If Shopify reduces60 to50, stop and report the availability conflict separately; preserve the requested60 and do not change stock. If access, catalog or policy is missing/revoked, the isolated route must block, not fall back. Verify sign-out and location/organization switching as well as resumed carts before any global route migration. An existing Shopify browser session alone does not give this application a usable Customer Account token without the registered OAuth flow.

Sources: [Customer Account authentication and client setup](https://shopify.dev/docs/api/customer/latest), [headless B2B buyer and cart context](https://shopify.dev/docs/storefronts/headless/bring-your-own-stack/b2b), [optional Clerk/Shopify OIDC integration](https://clerk.com/docs/guides/development/integrations/platforms/shopify).

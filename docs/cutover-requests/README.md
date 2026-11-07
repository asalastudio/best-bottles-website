# Best Bottles cutover requests

The form Best Bottles fills in before www.bestbottles.com switches to the new site: domain and DNS, payments, shipping and FedEx, QuickBooks, sales tax, catalog, and who receives which email. 51 requests, 26 of them needed for launch.

- **Live form:** https://claude.ai/artifact/ScK99Dz3LU5RVgkwQpy61u (private; share it from the page's Share menu before sending it to anyone).
- **Form source:** [cutover-requests.html](cutover-requests.html). It is the published page with the platform's wrapper removed.
- **Answers:** [ANSWERS.md](ANSWERS.md) to read, [answers.json](answers.json) for scripts. Both are generated; never edit them by hand.

## How answers move

People answer on the live page. Each answer is saved in the page's own database, collection `answers`, one document per request code, shaped `{ v, note, by, at }`. Only Claude's artifact tools can read that database, so the repo copy is refreshed on request, never automatically. Ask any Claude session to "sync the cutover answers"; the steps are in [the project skill](../../.claude/skills/bestbottles-cutover-requests/SKILL.md).

[scripts/cutover_answers_report.mjs](../../scripts/cutover_answers_report.mjs) reads the request list from the form source itself, so the record and the form can never disagree. It replaces any run of 9 or more digits with "[number removed]", because the form asks people not to type account, card or permit numbers and some will anyway. ZIP+4 codes are kept.

## Rules that keep answers attached

- **Never rename a request code** (S-3, QB-5, ...). Answers are stored under the code.
- **Never reword an option someone has already picked.** A choice is stored as the option's exact wording; a reworded option leaves the saved answer orphaned. The sync flags such answers with "not one of the form's current options".
- Adding a new request with a new code is safe. So is rewording a question or its explanation.

## What each request changes

| Requests | What the answer changes |
|---|---|
| G-1 Google Analytics | Install the GA4 tag. The site has no Google Analytics tag today. |
| G-2, G-3 Search Console, Bing | Submit `src/app/sitemap.ts` and check `src/app/robots.ts` on launch day. The old verification codes are already in `src/app/layout.tsx`. |
| G-4 Google Ads and Shopping | Re-point ads and any Merchant Center feed before cutover. Nothing in the repo yet. |
| G-5 Sign in with Google | Needs the Clerk production instance and a Google OAuth client owned by Best Bottles. Production still uses Clerk development keys. |
| D-1, D-2 Domain and DNS | Point www at Vercel and set `NEXT_PUBLIC_SITE_URL`; `src/lib/seo.ts` requires https://www.bestbottles.com for production. Keep the MX, SPF and DKIM records (email runs through GoDaddy's secureserver.net). |
| D-3, D-5 Old site and its orders | Back up the legacy PHP site and keep it reachable for rollback; finish old card holds in the old provider. Legacy URL redirects are PR #162 against `src/proxy.ts`. |
| D-4 Launch date | Sets the cutover window. |
| P-1 to P-4 Payments | Shopify admin settings: payment provider, manual or automatic capture, the 7-day rule, staff logins. No code. |
| S-1, S-2, S-4, S-5, S-9 Rates and services | Shopify delivery profiles: remove the $0 Economy rate, choose rate type, markup, FedEx services and countries. |
| S-3 FedEx account | Connect FedEx in Shopify's carrier settings on the general profile. Today it is only on the "Shipping - Test" profile. |
| S-6 Ship-from address | Fill in the Shopify location address, which has no street or ZIP today. |
| S-7 Boxes and packing | With product weights, lets live rates work. All 2,635 variants weigh 0 lb in Shopify; Convex holds weights (`scripts/apply_case_weight_corrections.mjs`), and `scripts/audit_shipping_readiness.mjs` checks the result. |
| S-8, S-11, S-12 Freight, protection, rate app | Freight threshold and quote path, insurance and signature defaults, and whether a rate app such as ShipperHQ is allowed. |
| S-10 Labels | Labels printed in Shopify write tracking onto the order, which the portal shows (`convex/shopifySync.ts`). |
| QB-1 to QB-13 QuickBooks | Configure the connector (MyWorks recommended, tested against Webgility). QB-5 and QB-6 build the item match from the product codes held in Convex. |
| QB-14 Past orders | One-time import of order history into the portal; Shopify orders use `scripts/backfill_portal_orders.mjs`. |
| T-1 to T-3 Sales tax | Shopify tax registrations; then the certificate workflow (`convex/certificateWorkflow.ts`, `convex/resaleCertificates.ts`), whose Shopify tax-exempt writes are switched off until tax is configured. |
| C-1, C-3 Product facts and availability | Catalog data in Convex. |
| C-2 Draft products | `scripts/activate_shopify_drafts.mjs`. |
| C-4 Spanish review | `messages/es.json`. |
| N-1 Who receives which email | Lead notifications: `convex/forms.ts` saves contact, sample and quote requests and emails nobody today. Certificate notifications: `convex/certificateNotifications.ts`. |
| N-2 Sender address | A sender on bestbottles.com, authorized in DNS (D-1). |
| N-3 Portal accounts | Invitation flow in `convex/portalAccountFoundation.ts` and `convex/portalAuth.ts`. |

# Portal account foundation and production reconciliation

## Observed cause

A successful Clerk session with an active organization did not provision Convex.
`portalAccounts` could only be inserted through the staff provisioning mutation.
The buyer's missing-profile screen therefore did not establish a failed Clerk
login or a missing Shopify customer. Buyer denial on `/team` remains correct.

## Authority and implemented behavior

| Data | Authority | Behavior in this change |
| --- | --- | --- |
| Signed-in user, selected organization, membership | Clerk | Fresh paginated membership read before idempotent pending-profile creation on portal entry |
| Account number, tier, manager, membership date | Staff-managed Convex profile | Absent until staff supplies real values; no invented defaults |
| Certificate review / exemption sync | PR352 workflow | Unchanged; profile creation never approves exemption |
| Shopify customer/company/contact/location access | Shopify | No mapping inferred from a company name or shared billing email; no new access granted |
| Address entered in portal | Convex | Atomic local save and versioned reconciliation intent; billing stays local |
| Customer/company default address | Shopify | Writer disabled on this save path; no default address overwrite |
| Existing order address and shipment truth | Shopify / scoped order projection | No change here; owned by the separate order-truth work |

`profileStatus=complete` means the staff fields have been filled in. It is **not**
wholesale purchase approval, tax exemption, or native Shopify buying permission.
Older accounts without the status retain their existing behavior. A new pending
profile cannot implicitly create/link a Shopify customer via the legacy checkout
identity helper. This PR does not activate a new checkout gate or native B2B route.

Account creation is lazy at the first authenticated portal visit with an active,
currently verified Clerk organization. It is not a Clerk signup webhook: a user
without an organization must select/create their real organization first. Server
reads keep their existing credential/tenant guards. Staff listing paginates real
Clerk organizations and staff saves verify the selected organization still exists.

## Effective pending-profile permissions

A pending record has `taxExempt: false` and no assigned account number, tier,
manager, membership date, billing email or Shopify customer. It grants no Clerk
role, team access, Shopify role, catalog assignment, customer token or exemption.
The existing authenticated organization-scoped portal reads, local draft editing,
certificate submission and local address saving remain available. Certificate
submission is a request for staff review, not approval. Shopify draft submission
requires the identity helper, which returns `account_review_required` for a
pending profile even if it already carries a legacy customer ID.

This is not a global wholesale purchase-approval gate: the pre-existing public
checkout can still fall back to anonymous checkout. Filling staff profile fields
marks them complete, not purchase-approved. Global checkout approval and native
buyer-session activation remain separate release work; do not claim pending
profiles close that existing checkout gap.

## Stack dependency

This account-only diff is based on PR352's `cb9687320d32a4d3d781b62fb03c17b1cc21a853`,
which includes merged main/PR344 and the customer-declared certificate-expiration
work. It remains stacked on PR352 to preserve the guarded certificate status
projections and account/action components it extends. A base of merged PR344 alone
would omit that certificate workflow. No account changes belong in PR352 itself.

## Address reconciliation

Each address save verifies current Clerk membership and compares the form's
expected organization with the server session. This check is scoped to provisioning
and address saves; it does not claim universal membership-revocation protection
for other portal actions. The form also carries an expected address version and a
stable request ID. Convex atomically enforces the version and stores a payload
fingerprint receipt. A → B → delayed retry A and concurrent stale edits cannot
replace B. Billing edits advance the address version as well; shipping revisions
advance only when a new shipping snapshot is needed.

Identical normalized retries retain one shipping revision. Changed shipping creates
a new snapshot and supersedes the prior unsent intent. Billing-only changes do not
create shipping revisions. The current intent starts `awaiting_identity` or
`awaiting_review`; explicitly linking an existing customer advances only the
current unsent intent to review, idempotently. No state in this implementation
claims `synced`, sends Shopify writes, or retries remote writes. Both customer and
staff pages expose the pending/unverified status.

Superseding an unsent intent removes its full address/contact payload in the same
transaction, retaining minimal revision, actor and target metadata. Retry receipts
contain a request-salted payload hash and audit metadata, never raw address fields.
Only the current account and current pending intent retain the shipping address.
No bulk production purge or scheduled retention job runs in this PR. Before a
sender or cleanup job is enabled, approve a bounded metadata retention period
(proposed: 30 days for superseded intents and retry receipts), audit requirements,
and a deletion dry run. Never reset the monotonically increasing account version;
it continues to reject stale forms even after old receipts are eventually removed.

This intentionally replaces the prior best-effort default-address mirror, which
could overwrite Shopify and returned apparent success when no customer existed.
Before activating any sender, review the exact target (customer address versus
company-location address), intended overwrite policy, and current remote address.
A subsequent dispatcher must atomically claim the current revision, compare the
reviewed remote baseline, fence uncertain outcomes, verify readback before marking
synced, and never replay superseded revisions. No background worker is enabled by
this PR. The unused legacy helper is not proof of an active sync service.

The address mutation now requires its concurrency envelope. Backend/frontend must
be released together after approval; forms rendered before that release must be
reloaded. This PR performs no deployment or migration.

## Concrete production repair packet — not executed

An already-authorized staff member can open `/team/portal-accounts`, select the
actual Clerk organization, and supply the approved business fields. Do not grant
the buyer staff privileges to do this. After deployment of this change, opening
the portal creates only a pending profile; it does not fill in approved values.

Before any production linkage/migration, collect and review:

1. Exact production Clerk organization ID and intended buyer user ID, verified by
   current membership. Do not use an organization display-name match or dev keys.
2. Exact Shopify shop/customer/company/contact/location IDs and current ordering
   role relationships, read from Shopify. Compare verified buyer identity and
   existing Convex claims; stop on duplicates or conflicts.
3. Whether the legacy org billing-customer relation is appropriate. Native B2B
   needs a per-buyer company/location relation; one billing customer per org is
   not sufficient evidence of buyer permission. Do not repurpose it silently.
4. The exact proposed Convex mapping rows and before/after values, plus explicit
   client approval for the production migration. No guessed identity links.
5. A separate address proposal with current remote value, target type/ID and
   intended value. No bulk overwrite or modification of historical orders.

Native B2B session activation still needs the approved Customer Account/OIDC
configuration described in the separate pilot handoff. No token/client creation,
Shopify permission grants, production migration, tax approval, real order,
merge, or deployment is part of this PR. PR351 remains separate.

## Contract for order-truth and future private Grace tools

Take Clerk org/user exclusively from authenticated server context. Read the
protected account/mapping there, and scope every order read to the organization.
A pending profile, matching email, display name, or legacy billing customer alone
must not become a native company-location access grant. Until reviewed native
bindings and current Shopify authorization exist, return an explicit unavailable
state. The existing order upsert/read projection is owned by the order-truth PR;
this branch changes no order fields or normalization. Grace UI/tools are unchanged.

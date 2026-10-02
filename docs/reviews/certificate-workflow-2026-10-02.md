# Reseller certificate workflow — inactive integration proposal

Base: security PR344 `c7c3faac` (includes released Grace #345). Separate feature branch; do not merge it ahead of the security patch or deploy a stale Convex tree.

## Behavior

Customers upload a PDF/PNG/JPEG up to 15 MB via a ten-minute, one-use upload ticket issued after Clerk user/active-org authentication. The new Convex HTTP action binds the stored blob to that ticket's owner. A server action retrieves only that owned document, bounds bytes read, and parses the PDF or decodes the image before recording verification. Submission and approval both require the verified binding and existing storage metadata. File IDs, filename extensions and client MIME declarations are insufficient. PDF parsing establishes structural readability, not legal validity, absence of malware, or text legibility. Encrypted, empty, malformed, oversized and excessive-page PDFs are rejected; image decode has a pixel cap.

Existing documents have no verified ownership binding. They remain available in history; pending legacy submissions need a new verified upload before approval. There is no automatic claim, backfill or deletion of historical documents. Existing stored file URLs remain bearer URLs; this change does not revoke or migrate them. The HTTP upload capability is transient, scoped to one file, and contains no service credential; tickets are hashed at rest. Failed-upload cleanup only removes an unregistered blob just created by that same HTTP request.

Customer overview/account/tax pages and Team Hub account displays derive checkout status from certificate approval, expiry and a confirmed Shopify sync marker. The old portalAccounts.taxExempt boolean is no longer used as proof for these displays. Approved-but-unsynced is explicit. A formerly synced but lapsed certificate requires checkout reconciliation, not an unsupported assertion that Shopify is now taxable. Staff can filter the review queue from an account link and open historical supporting documents. Visible pages refresh on focus/30-second intervals while no form is focused.

Review actions return safe success/failure messages. Approval is separate from checkout sync. A durable sync attempt fences concurrent retries and review changes. Successful retries set the same desired Shopify exemption and then persist the receipt; already-synced repeats do not write again. Lost persistence acknowledgement after a successful external write retains the attempt for reconciliation rather than re-approving or falsely declaring success. No stale lease takeover is automated. A read-only reconciliation plan identifies expired/revoked synchronized certificates and distinguishes accounts with a newer active approval before any future revocation.

Lifecycle events are inserted atomically with submission/review/sync transitions. Their stable certificate/event/audience keys deduplicate retries. The outbox records pending/blocked/sending/sent/failed, attempts, retry time and provider receipt. Templates are plain text, link to authenticated pages, and omit permit numbers, attachments and document bearer URLs. Approval email wording never implies confirmed checkout exemption. Failed email cannot roll back approval. A timeout/unknown post-send receipt requires provider reconciliation; a future adapter must honor the stable idempotency key.

## Explicitly inactive

- `CERTIFICATE_TAX_WRITES_ENABLED = false`: production approval saves the review decision but does not call Shopify or provision a Shopify customer. The retry action reports activation is required. Synthetic tests explicitly inject mock adapters and opt in only to those mocks.
- `CERTIFICATE_NOTIFICATION_POLICY.enabled = false`: no transport/provider adapter, sender, staff recipients, customer recipient policy, scheduler or dispatch route is activated. The delivery engine is tested with injected mocks only.
- No expiry/revocation schedule, new cron, automatic cleanup, migration, real approval, real Shopify tax write, or email send was performed or activated.
- No environment variables or service credentials were added/read/changed. The existing server credential protects the new private functions. New tables are code/schema proposals only until an explicitly coordinated deployment.

## Required configuration decisions and smallest live fixture

Before activation, identify an existing authorized email provider supporting idempotency, verified From address/domain, approved staff recipient list or ownership mapping, and whether customer mail goes to the verified billing contact, submitter, or both. The proposed injectable policy supports explicitly selected billing-contact delivery; it defaults to no recipient. No inbox is guessed from account-manager names and no reviewer email is substituted for a customer. Provider setup, credentials, sender/domain settings, and outbound testing need exact approval.

One isolated TEST Clerk org with a customer and staff viewer, a dedicated TEST portal account/billing inbox, a one-page synthetic PDF stamped NOT A REAL CERTIFICATE, a verified owned test-recipient inbox and a Shopify test customer/store target are sufficient for the first live flow. Approve the exact org, recipient, customer/store IDs, reversible fixture cleanup, permitted review transitions, and permitted tax-write window before exercising them. Never put fake certificate status on the real Tarife account. Failure/retry tests can stay entirely synthetic.

Activating expiry reconciliation needs a separately approved cadence, dry-run reviewed target list, Shopify read-back/receipt reconciliation, exemption-code preservation policy, newer-approval checks and rollback. No actual revoke operation is implemented or scheduled here. Old `expireLapsedCertificates` remains unscheduled and now refuses to run through an in-flight sync.

## Validation

Synthetic integration covers owner-bound HTTP upload and PDF parsing, cross-org rejection, ticket replay, missing supporting documents, review/checkout separation, failed sync retry, repeated sync idempotency, all four account-data projections, outbox event uniqueness, notification transport retry with stable keys and canonical recipients, uncertain sync receipt, and read-only expiry planning. Separate browser tests cover stale upload completion, oversized replacement and focused-form refresh. Parser tests cover real generated fixtures and malformed/type/size failures. All service calls in these tests are mocks or in-memory Convex operations.

Verification completed locally: 312 test files passed (2 skipped), 2,842 tests passed (7 skipped), including the final server-authorization regressions. `tsc --noEmit`, the production webpack build (including TypeScript, all 61 static pages and sitemap generation), changed-file ESLint (zero errors; existing/generated-file warnings only), and `git diff --check` passed. The build used placeholder Convex/website values and Clerk disabled; it did not exercise live authenticated integrations. Generated sitemap and Next type-reference changes were restored. Synthetic token/document markers were absent from generated browser assets.

Implementation references: pdf-lib PDFDocument.load and page APIs https://pdf-lib.js.org/docs/api/classes/pdfdocument ; Sharp metadata/decode https://sharp.pixelplumbing.com/api-input/ .

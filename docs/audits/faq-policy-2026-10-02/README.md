# Approved FAQ policy parity — 2026-10-02

Jordan designated https://www.bestbottles.com/faq.php the sole approved current FAQ on October 2, 2026: “As of now, this is the correct FAQ page that's relevant and the only current FAQ page we should have until we sort out the rest of it”. This change aligns published answers; it does not authorize checkout, payment, tax, catalog, or fulfillment configuration changes.

## Provenance

- Live HTTPS GET retrieved on 2026-10-02 at 16:58:35 UTC. The HTML itself has no reliable last-modified date; “verified” means retrieval date, not a claim about when the business changed a policy.
- Original bytes (lossless gzip; SHA-256 below is for decompressed HTML): [`legacy-faq.html.gz`](legacy-faq.html.gz), SHA-256 `a91b5b436e285ac9afb0e612fbee86f18c352ffac704957d96ab0a5f463bebbd`.
- Base: current `origin/main` fetched for this task, `008097682467abdd665354f7c0d870c09b6aa98e`.
- Branch: `codex/faq-policy-parity-2026-10-02`, isolated local checkout. Policy-file ownership reserved with the coordinating task before editing. The coordinator flagged `src/lib/grace/realtimeInstructions.ts` as a possible overlap with PR #350. A read of #350 at head `84a47f73feec3de85e4e6a2c59c37c72b7d6e574` found no current overlap among the policy files. Recheck at integration time and preserve its retrieval/navigation rules alongside this expanded policy lookup rule; do not overwrite either branch wholesale.
- Authority is the legacy FAQ, not the newer Shipping & Returns page, historical Grace documentation, other linked legacy policies, model memory, or a checkout implementation.

## Canonical contract and consumers

`src/lib/faqPolicy.ts` contains topic IDs, customer questions/answers, matching keywords, source-question provenance, date, authority, gaps, and shared response guidance. It has no server/client/Node dependencies, so both Next and Convex import it directly.

| Surface | Contract path |
| --- | --- |
| Resources visible FAQ and FAQPage JSON-LD | `FAQ_POLICY_ENTRIES`; packaging guidance remains a separate section and is excluded from FAQ structured data |
| Shipping & Returns | Subset of the same entries, including refunds, missing items, and ambiguities |
| Sample inquiry page | Same sample eligibility and emailed-invoice answer |
| Realtime | Existing `getPolicy` → `toolGatewayServer.executeGraceServerTool` → `policyCorpus.buildPolicyToolResult` → shared entries |
| Fallback | `/api/grace/chat` → `convex/grace.askGrace` → `buildSystemPrompt({ channel: "text" })` → `buildFaqPolicyPrompt()` |
| Browser prompt endpoint | `buildSystemPrompt()` → same generated policy block |

The fallback still has its existing six catalog tools; it does not receive instructions to call a nonexistent `getPolicy`. No gateway/catalog/navigation implementation or tool definition changed. Follow-up review also removed the remaining blanket system-fit guarantee and unverified decoration quantity minimums, allowed requested sample-email item codes only from verified `websiteSku` values in every prompt mode, and removed the sample form success branch's unsupported 1–2-business-day response promise. A DOM regression submits the actual sample page through the real FormPage success branch; only the persistence boundary and site chrome are mocked. Prompt policy duplication and conflicting sample upsell/guarantee claims were removed. Non-policy retrieval, channel capability, and navigation instructions remain in place.

## Source verification matrix

Line numbers refer to the decompressed HTML snapshot (`gzip -dc legacy-faq.html.gz`). The shared answers summarize the source rather than claim to be verbatim quotations.

| Contract topics | Source lines | Verified terms |
| --- | --- | --- |
| ordering, minimum-order, samples | 494–508 | Online orders; $50 excluding shipping; verified-business exception via emailed item codes, invoice, PayPal/phone card payment |
| stock | 512–522 | ETA when available; temporary stockouts and manufacturer discontinuation possible |
| international-shipping, canada | 532–556, 730–740 | Worldwide; UPS economy/priority; some US priority mail; 1–2 weeks for most economy orders after full payment; duties/taxes/brokerage buyer responsibility; Canada ground brokerage caveat |
| payments | 568–578 | Major cards, PayPal, cleared business checks, registered billing address for prepaid/gift cards; some wires; USD |
| international-payment | 720–726 | Card charged when ready for shipment, specifically in international-payment answer; PayPal transfers funds |
| sales-tax | 582–592 | Published California-only tax language and CA resale license email/fax; applicability/configuration not verified |
| pickup, contact | 754–756, 902–926 | Call at least 1 day ahead, pickup 10:30am–3:00pm; separate office hours Mon–Fri 9:30am–5:30pm PST; address and phone/email/fax |
| shipping-options, lead-times | 760–794 | UPS service levels/USPS, ZIP/weight/service charges, generally ≤40 lb boxes, tracking; domestic 2–3 business days processing + 1–5 transit; Sep–Dec processing up to 4–5 business days |
| same-day | 804–820 | Call before 11:00am PST, no email, mandatory $15; international/personalized/weekend/holiday exclusions and some large/oversize/special-order items |
| delivery-address, signature | 824–834 | Credit-card billing-address provision; refused/incorrect-address 15% restock; published optional $3 signature and delivered-package liability |
| returns, refund-timing | 844–870 | Goods back within 15 days, unused/same condition, 15% restock, buyer return freight, non-refundable shipping/handling/rush, packing list/tracking/safe packing, personalized excluded, no international returns; inspection usually 3 business days, refund processing 7, posting additional 2–10 |
| damaged-defective | 874–878 | Claims within 7 business days, photos/description or phone initiation, retain products/original packaging, assist carrier claims |
| missing-items | 882–886 | Check separate components/all cartons; notify within 48 hours; 6–8-business-day investigation; confirmed missing item refund/replacement at no cost |
| order-changes | 890–892 | Email name/order number/confirmation; attempt only if unshipped; 1–3-day processing statement |

## Ambiguities retained, not silently reconciled

1. The general damage/defect paragraph includes **missing** products under seven business days. The specific missing-item answer requires **48 hours**. Both answers preserve the discrepancy; neither Grace channel should tell a missing-item customer to wait seven business days. Damage/defect claims are not shortened to 48 hours.
2. Shipping says **2–3 business days** plus transit and seasonal processing; order changes says most orders process within **1–3 days**, without “business.” Both appear together in relevant answers. No new universal dispatch promise is substituted.
3. **PST** is the source's label for cutoff/office hours. No PST→PDT conversion is inferred. Pickup itself specifies neither timezone nor “business day”; those restrictions are not added.
4. Same-day ordering generally asks for a phone call although the general ordering answer requests online-only ordering. The contract distinguishes these specific arrangements.
5. Source return-list formatting oddly places eligibility instructions beneath “Returns and exchanges are not available for the following items.” The retained requirements follow the explicit unused/same-condition, received-within-15-days instructions and personalized/international exclusions. No new clearance/decorated exclusion or authorization requirement is invented.
6. The source contains tariff-code tables and a request to verify appropriate codes/country rates. This scoped contract does not classify goods or replicate tariff advice; unrepresented questions route to the source/team. The full source remains available in the snapshot and linked FAQ.

## Business/configuration review queue — no configuration changed

- **Order minimum:** code inspection finds `ORDER_MINIMUM = 50` in `src/lib/checkout.ts` and enforcement in `src/app/api/shopify/resolve-variants/route.ts`. This agrees with the general minimum. The verified-business sample exception is a separately emailed/invoiced process, not an automatic checkout bypass. No bypass was added.
- **Payment/capture:** the published checks/wires/PayPal options and international delayed card capture must be compared with Shopify provider/capture settings by the payment owner. This task did not inspect or mutate live provider settings and cannot certify parity. Grace attributes these statements to the FAQ and refers discrepancies to the team.
- **Tax/resale:** California-only tax copy may differ from current business obligations or configured checkout calculations. Preserve it as attributed FAQ text; do not alter tax settings, resale authorization, or make a tax determination.
- **Address/signature/rush:** published card billing-address shipping, optional $3 signature, and $15 same-day arrangements require operations/checkout review. Do not infer that the new checkout exposes/enforces them.
- **Sample form:** the site inquiry form remains available; its copy now states the approved emailed-invoice process. A form submission does not establish business verification, invoice payment, or entitlement to a sample order.
- **Historical content:** `docs/grace_knowledge_faq.md`, past eval/session records, training notes, and SEO planning documents are historical context, not policy authorities. Runtime policy answers in this scope use only the shared contract. Sanity-authored product editorial FAQ blocks were not remotely edited or certified.

No merge, deployment, Convex push, live model evaluation, checkout attempt, production write, or provider-setting change is part of this PR. The Convex skill's push/smoke recommendation is superseded by the explicit no-deploy/no-live-mutation instruction; local compile, integration-level tests, and production build are the verification boundary.

## Verification

See `verification.md` for commands, counts, results, and any remaining limitations at the reviewed head. Parity tests exercise rendered page copy and JSON-LD, the actual Realtime policy executor, shared browser/text prompt generation, source evidence hash, critical values, topic routing, and the fallback's real API/action wiring and catalog-only tool set.

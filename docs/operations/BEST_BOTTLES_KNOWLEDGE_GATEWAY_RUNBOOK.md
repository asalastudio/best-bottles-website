# Best Bottles Knowledge Gateway Runbook

## Purpose

The Knowledge Gateway gives storefront Grace, authenticated employees, executives, and future ChatGPT surfaces one permission-aware product brain. OpenAI handles conversation and orchestration; it does not replace Best Bottles' source systems.

Production readiness requires all automated gates plus live OpenAI and Convex checks. A structural retrieval pass is not proof that every SKU relationship is semantically correct.

## Source ownership

| Information | Canonical source | Gateway rule |
| --- | --- | --- |
| SKU, price, stock, family, capacity, color, neck thread, compatibility | Convex | Always use an authorized live catalog tool. Never answer from model memory or File Search. |
| Editorial copy and Paper Doll assets | Sanity | Use approved published content; configuration claims must still agree with Convex fitment truth. |
| Commerce identity and checkout eligibility | Shopify | Cart actions are proposals until explicit customer confirmation. |
| Public policies | Public OpenAI vector store | Available to public and authenticated roles. |
| Internal operating documents | Internal OpenAI vector store | Employee, support, executive, and admin only. |
| Executive documents | Executive OpenAI vector store | Executive and admin only. |
| Conversation and reasoning | OpenAI | Server-selected model, authorized tools only, `store: false` for employee Responses calls. |

The 9 mL `13-415` and 9 mL `17-415` Cylinder groups remain separate. Grace may broaden or compare the neck-thread constraint only when the customer explicitly asks.

## Access boundaries

- `public`: public documents, catalog/compatibility reads, navigation proposals, and confirmation-gated cart proposals.
- `customer`: public access plus the signed-in customer's own projects.
- `support` and `employee`: public product truth plus approved internal documents and correction submission; no customer-project or executive-trace access.
- `executive`: employee access plus aggregate Grace Operations and executive documents.
- `admin`: all defined scopes. State-changing business operations still require explicit tool-specific authorization and confirmation.

The browser never supplies an authoritative role, scope, organization, actor, or model. Clerk and server policy derive them.

## Required environment names

Set values in the relevant Next.js/Vercel and Convex server environments. Never commit values.

```text
NEXT_PUBLIC_CONVEX_URL
OPENAI_API_KEY
OPENAI_KNOWLEDGE_ROUTINE_MODEL
OPENAI_KNOWLEDGE_COMPLEX_MODEL
OPENAI_KNOWLEDGE_EXECUTIVE_MODEL
OPENAI_PUBLIC_KNOWLEDGE_VECTOR_STORE_ID
OPENAI_INTERNAL_KNOWLEDGE_VECTOR_STORE_ID
OPENAI_EXECUTIVE_KNOWLEDGE_VECTOR_STORE_ID
BEST_BOTTLES_CONVEX_WRITE_TOKEN
NEXT_PUBLIC_CLERK_ENABLED
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
TEAM_HUB_ALLOWED_EMAILS
EXECUTIVE_HUB_ALLOWED_EMAILS
```

`BEST_BOTTLES_CONVEX_WRITE_TOKEN` must match in the Next.js server and Convex server environments. Use separate secrets per environment.

## Rotate and verify OpenAI access

1. Create or rotate the project key in the OpenAI project that owns Best Bottles usage.
2. Replace `OPENAI_API_KEY` in the approved local secrets manager and deployment environment. Do not paste it into chat, tickets, screenshots, shell history, or documentation.
3. Update the Convex server environment only while legacy Convex OpenAI actions remain active.
4. Restart the local or deployed Next.js runtime so it loads the new key.
5. Verify the Realtime token endpoint by checking only HTTP status, model, voice, and whether a short-lived client secret is non-empty. Never print the secret.
6. Verify `/api/knowledge/chat` with an authenticated employee request and confirm a request ID plus source citation is returned.
7. Confirm the resulting Grace Operations trace has a rate-card version and `rawContentStored: false`.

An `invalid_api_key` response is a release blocker. Do not bypass it or describe the deployment as production-ready.

## Verification commands

Run the deterministic gateway and repository checks:

```bash
npm run test:knowledge-gateway
npx vitest run
npm run lint
npm run build
```

Run live catalog checks separately with the intended Convex deployment selected:

```bash
npm run test:catalog:integrity
npm run test:grace:matrix
```

Interpret the results separately:

- catalog integrity validates structure and required invariants;
- the Grace matrix validates retrieval behavior;
- product-truth reconciliation validates semantic SKU, neck-thread, and compatibility correctness;
- live OpenAI checks validate credentials, model access, Responses, Realtime, and persistence.

## Grace Operations metrics

Current dashboard coverage is explicitly limited to the authenticated employee/internal Responses runtime. Public storefront Realtime traffic is not included until Realtime usage and tool traces are wired into the same minimized operations contract.

- **Estimated spend:** effective-dated token and File Search rates attached to minimized traces.
- **Successful answers:** successful employee/internal Responses traces divided by all recorded employee/internal Responses requests in the trailing 30 days.
- **Request volume:** recorded employee/internal Responses requests in that window.
- **P95 latency:** the 95th-percentile end-to-end response duration.
- **Tool calls:** authorized employee/internal Responses tool executions recorded without payloads.
- **Pending corrections:** explicit employee corrections awaiting human review.

Grace Operations never shows raw prompts, audio, conversation transcripts, customer payment details, or provider credentials.

## Controlled correction review

1. Review `knowledgeCorrections` entries whose status is `pending`.
2. Use the stored answer `requestId`, bounded answer excerpt, and source IDs to locate the exact response evidence; then confirm the claim against its canonical source and any supplied HTTPS citation.
3. Classify the approved change as a Convex/Sanity data correction, an approved document revision, or a prompt/evaluation case.
4. Apply the change through the owning system's normal reviewed workflow.
5. Re-run the relevant product-truth and gateway tests.
6. Mark the correction accepted or rejected only after review. Ordinary conversation never trains or mutates Grace automatically.

## Incident behavior

- **OpenAI outage or credential failure:** keep catalog browsing and ordinary site navigation available; show the generic Grace-unavailable message; do not expose provider errors; pause AI release claims.
- **Convex outage:** do not make product, price, stock, neck-thread, or compatibility claims. Grace must say live product truth cannot be verified.
- **Shopify outage:** allow product research but stop checkout mutations; retain confirmation-first cart proposals and direct customers to a safe follow-up path.
- **Retrieval/vector-store outage:** continue live catalog tools; do not improvise policy answers; label the missing approved source and escalate to a human.
- **Trace persistence outage:** do not fail an otherwise verified customer answer, but surface the operations-data gap and investigate before using dashboard rates for decisions.

Never paste secrets, raw customer data, private supplier records, payment information, raw audio, or full conversation content into incident tickets, documentation, or correction notes.

## Verification record — 2026-08-03

- Knowledge Gateway suite: 57 tests passed.
- Full repository suite: 442 tests passed and 1 intentionally skipped.
- ESLint: 0 errors; 39 existing warnings.
- Production build: passed.
- Live catalog integrity: 2,330 products, 356 groups, no duplicate Grace SKU, missing Grace SKU, or orphan group reference.
- Grace retrieval matrix: 36 of 36 cases passed.
- Live 9 mL Cylinder isolation: `13-415` returned 6 groups and `17-415` returned 15 groups; neither result contained a mixed neck thread.
- OpenAI credential: blocked by `invalid_api_key`; Realtime and Responses production readiness must not be claimed until rotation and re-verification.
- Approved document retrieval: public, internal, and executive vector-store IDs are not yet configured.
- Grace Operations live aggregate: code and schema pass locally, but the production Convex deployment does not yet contain `knowledgeOperations:getKnowledgeOperationsSummary`. The Executive Hub must show `Not connected` until an authorized deployment is completed.
- Production employee chat check: an unauthenticated request correctly returned 403. An authenticated live employee check remains pending after the OpenAI key is rotated and Clerk access is available.

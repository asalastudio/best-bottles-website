# Best Bottles Knowledge Gateway Design

**Date:** 2026-08-03

**Status:** Approved direction; Phase 1 specification awaiting written review

**Branch:** `codex/best-bottles-knowledge-gateway`

**Base:** `codex/family-page-v3-cylinder` at `f90bf46`

## Objective

Create one governed Best Bottles intelligence layer that serves:

- public Grace on the storefront;
- authenticated customer and project support;
- internal employee product and operating questions;
- executive analysis and Grace-operations monitoring; and
- a later ChatGPT app through the same authorized tools.

OpenAI provides reasoning, conversation, voice, and tool orchestration. It does not become the product database. Convex remains the canonical structured product and compatibility source, Sanity remains the editorial and Paper Doll content source, and Shopify remains the commerce and checkout source.

## Scope Decomposition

The complete system contains three separately releasable projects:

1. **Phase 1 — Shared Knowledge Gateway and employee chat foundation.** Define one request context, permission model, tool registry, Responses API adapter, knowledge retrieval boundary, trace contract, controlled-correction intake, and internal chat route. Reuse the existing Grace Workspace as the first employee interface.
2. **Phase 2 — ChatGPT/MCP surface.** Expose the approved read tools through an authenticated remote MCP server or Secure MCP Tunnel. It reuses Phase 1 authorization and never queries Convex directly.
3. **Phase 3 — Support and executive operating integrations.** Add authenticated customer/order lookups, approval-gated service actions, live executive metrics, and controlled-learning review screens.

This specification covers Phase 1. Later phases depend on its contracts but are not prerequisites for releasing the shared brain to internal users.

## Considered Approaches

### A. Hybrid source-of-truth gateway — selected

Convex serves exact product facts, fitment, filters, and catalog counts. Sanity and approved documents serve editorial knowledge. Shopify serves checkout identity and sellability. OpenAI chooses and calls authorized tools and explains their verified results.

This provides current product truth, exact thread isolation, reusable interfaces, and centralized authorization.

### B. Upload the entire catalog to an OpenAI vector store

This is simpler initially but unsuitable for exact SKU identity, live pricing, stock, and 13-415 versus 17-415 compatibility. A copied catalog also becomes stale. Vector search remains useful for policies, training material, and operating documents, but not as the product system of record.

### C. Separate brains for Grace, support, employees, and executives

This permits independent prompts but duplicates tool logic, permissions, corrections, and evaluations. The assistants would eventually disagree. Separate experiences should instead share the same gateway while receiving different capabilities and instructions.

## System Architecture

```text
Storefront Grace   Customer portal   Employee Workspace   Executive Hub   ChatGPT app
       |                 |                  |                   |              |
       +-----------------+------------------+-------------------+--------------+
                                          |
                           Best Bottles Knowledge Gateway
                    request context | authorization | tool registry
                    response adapter | traces | corrections | budgets
                       /                  |                  \
              Convex structured     Document retrieval      Sanity/Shopify
              product truth         policies and SOPs       content/commerce
```

No consumer receives unrestricted database access. Every tool invocation passes through the same server-owned context, permission check, parameter validation, projection, and trace boundary.

## Canonical Sources

| Information | Canonical source | Retrieval method |
| --- | --- | --- |
| Product identity, SKU, family, color, capacity, applicator, neck thread | Convex | Deterministic catalog tools |
| Fitment and compatible components | Convex | Exact thread and bottle compatibility tools |
| Refine state and visible page context | Storefront application | Signed/current request context |
| Product editorial copy and Paper Doll family content | Sanity | Read-only server tools |
| Cart, checkout identity, sellability, and later order state | Shopify or its validated mirror | Server tools with explicit action policies |
| Policies, SOPs, training, and approved internal playbooks | Approved document corpus | OpenAI File Search or a replaceable retrieval adapter |
| Conversation traces, feedback, corrections, and cost summaries | Convex | Dedicated operational records |

The product catalog is never bulk-injected into an OpenAI prompt or treated as vector-search truth.

## Request Context

Every response and tool call receives a server-created `KnowledgeRequestContext`:

```ts
type KnowledgeSurface =
    | "storefront"
    | "customer_portal"
    | "employee_workspace"
    | "executive_hub"
    | "chatgpt_app";

type KnowledgeActorRole =
    | "public"
    | "customer"
    | "support"
    | "employee"
    | "executive"
    | "admin";

type KnowledgeRequestContext = {
    surface: KnowledgeSurface;
    role: KnowledgeActorRole;
    actorId: string | null;
    organizationId: string | null;
    conversationId: string;
    projectId: string | null;
    refineState: GraceRefineState | null;
    requestId: string;
};
```

The browser may provide page and Refine context, but it cannot choose its role, scopes, actor, or organization. Those values are derived server-side from Clerk and the current route.

## Authorization Model

Phase 1 uses explicit scopes rather than prompt-only role instructions:

- `catalog.read`
- `compatibility.read`
- `public_knowledge.read`
- `cart.propose`
- `navigation.propose`
- `customer_project.read.self`
- `customer_project.write.self`
- `internal_knowledge.read`
- `executive_metrics.read`
- `correction.submit`
- `trace.read`

### Surface capability matrix

| Surface | Default role | Capabilities |
| --- | --- | --- |
| Storefront Grace | Public | Public catalog, compatibility, public policies, navigation, confirmation-gated cart proposals |
| Customer portal | Customer | Storefront capabilities plus the authenticated organization's own projects |
| Employee Workspace | Employee/support | Catalog, compatibility, approved internal knowledge, correction submission; no unrestricted customer PII in Phase 1 |
| Executive Hub | Executive | Employee capabilities plus aggregate Grace and cost metrics; raw conversation content is excluded by default |
| ChatGPT app | Derived from authenticated user | A subset of the same scopes; no independent authorization logic |

Read tools may execute automatically after authorization. Any state-changing tool requires both an authorized scope and an explicit user confirmation token tied to the request. Phase 1 does not add refunds, price overrides, order mutations, supplier writes, or outbound messages.

## Shared Tool Registry

Create one registry that owns tool name, description, schema, required scopes, risk class, surface availability, and handler. OpenAI Realtime, the Responses API, and later MCP schemas are generated from this registry instead of maintained as separate lists.

```ts
type KnowledgeToolDefinition = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    requiredScopes: readonly KnowledgeScope[];
    risk: "read" | "propose" | "write";
    surfaces: readonly KnowledgeSurface[];
    execute: (
        context: KnowledgeRequestContext,
        parameters: Record<string, unknown>,
    ) => Promise<KnowledgeToolResult>;
};
```

The initial registry wraps the already implemented Grace tools:

- `searchCatalog`
- `getFamilyOverview`
- `getBottleComponents`
- `checkCompatibility`
- `getCatalogStats`
- `getProductBySku`
- `setCatalogRefinements`
- `setPaperDollSelection`
- `showProducts`
- `compareProducts`
- `proposeCartAdd`
- `navigateToPage`
- `listGraceProjects`
- `proposeProjectSave`

UI-only tools remain available only on surfaces that can render their payloads. The internal text route receives structured citations and action proposals rather than attempting browser actions server-side.

## OpenAI Runtime

### Voice

Public Grace continues to use `gpt-realtime-2.1` with Marin through the existing short-lived client-secret and WebRTC adapter. Voice uses the shared registry projections and does not gain internal scopes.

### Text

New internal and customer-service text interactions use the Responses API through a server-only adapter. The default routing policy is:

- routine catalog and policy questions: `gpt-5.6-luna`;
- complex compatibility, quoting, or multi-source support reasoning: `gpt-5.6-terra`;
- exceptional executive synthesis: `gpt-5.6-sol`, explicitly selected by the server policy rather than the user prompt.

The first implementation may begin with one configured text model while preserving the routing interface. The model never receives a permanent API key, unrestricted tool credentials, or all catalog rows.

Responses use `store: false` for employee and support surfaces. Conversation continuity is stored in Best Bottles systems, with only the bounded context required for the current turn sent to OpenAI.

## Document Knowledge

Define a replaceable `KnowledgeRetriever` interface. The OpenAI File Search implementation may index only approved documents carrying access metadata:

```ts
type KnowledgeDocumentAudience = "public" | "customer" | "employee" | "executive";

type KnowledgeDocumentRecord = {
    sourceId: string;
    title: string;
    audience: KnowledgeDocumentAudience;
    version: string;
    approvedAt: number;
    expiresAt: number | null;
};
```

The corpus begins with public policy and approved internal operating documents. Catalog JSON, raw customer records, secrets, supplier credentials, private payment data, and unreviewed corrections are excluded.

Every document answer includes source identifiers. When retrieval produces no approved source, the assistant says it cannot verify the answer and offers a human escalation or a product-tool search as appropriate.

## Internal Employee Experience

Phase 1 upgrades the existing `/grace-workspace` experience rather than creating a parallel application. Authenticated Best Bottles employees receive an employee mode with:

- typed product and compatibility questions;
- source labels distinguishing Convex product truth from policy documents;
- structured product results and safe links;
- a visible notice when live product truth cannot be verified;
- a correction action for incorrect or incomplete answers;
- a clean new-conversation control; and
- no exposure of provider configuration, raw prompts, or unrestricted internal records.

The public drawer remains customer-focused. Surface and role are obvious in the header so employees cannot mistake an internal answer for a public response.

## Controlled Corrections

Phase 1 captures corrections but does not permit self-training or automatic catalog changes.

```ts
type KnowledgeCorrection = {
    conversationId: string;
    messageId: string;
    actorId: string;
    surface: KnowledgeSurface;
    category: "product_truth" | "compatibility" | "policy" | "behavior" | "missing_knowledge";
    correction: string;
    sourceUrl: string | null;
    status: "pending" | "accepted" | "rejected";
    createdAt: number;
};
```

Accepted corrections become one of three reviewed changes: a Convex/Sanity data correction, a versioned document update, or a prompt/evaluation case. Nothing is learned silently from ordinary conversation.

## Trace and Cost Contract

Each response produces a privacy-minimized operational trace:

```ts
type KnowledgeTrace = {
    requestId: string;
    conversationId: string;
    surface: KnowledgeSurface;
    role: KnowledgeActorRole;
    model: string;
    startedAt: number;
    completedAt: number;
    status: "success" | "no_match" | "tool_error" | "model_error" | "blocked";
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    audioInputTokens: number;
    audioOutputTokens: number;
    estimatedCostUsd: number;
    toolCalls: Array<{ name: string; durationMs: number; status: string }>;
    sourceIds: string[];
};
```

Raw audio, permanent credentials, cart payment data, and complete customer prompts are not stored in the trace. The Executive Hub consumes aggregates such as spend, cost per successful answer, p50/p95 latency, tool success, no-match rate, handoff rate, correction rate, and Grace-assisted cart or project events.

Pricing is configured in a versioned rate table with effective dates. A trace retains the rate-card version used for its estimate so historical cost reports remain explainable when OpenAI pricing changes.

## Data Flow

1. A user enters a request on an approved surface.
2. The server derives actor identity, organization, role, surface, and scopes.
3. The request is normalized with current page, project, and Refine state.
4. The server selects a permitted model and generates only the authorized tool schemas.
5. OpenAI requests a tool when live or retrieved information is necessary.
6. The gateway re-authorizes the tool call, validates parameters, queries its canonical source, and returns a compact projection with provenance.
7. OpenAI creates an answer grounded in those results.
8. The application renders citations, products, or a confirmation-gated proposal.
9. The gateway records a minimized trace and optional explicit feedback.

For 9 mL Cylinder searches, active `13-415` and `17-415` constraints remain authoritative. A model cannot remove or combine them without the customer's explicit broadening language already enforced by the Refine contract.

## Failure Behavior

- **Invalid OpenAI credential:** Return a typed service-unavailable result and expose a configuration alert in Grace Operations. Do not fall back to ungrounded model memory.
- **OpenAI timeout or rate limit:** Retry only safe idempotent model calls within a bounded policy, then offer a human or typed retry. Tool writes are never retried automatically.
- **Convex or Shopify unavailable:** Do not state product, price, stock, compatibility, or checkout facts. Return a verification-unavailable message.
- **Document retrieval unavailable:** Continue with deterministic product tools when relevant; do not fabricate policy answers.
- **Unauthorized tool:** Record a blocked trace, return no sensitive data, and answer with the nearest permitted capability.
- **No exact product match:** Preserve active constraints and ask whether the user wants to broaden a specific dimension.
- **Cost ceiling reached:** Stop optional model escalation, use the configured economical model, or request explicit executive approval for continued exceptional processing.

## Security and Privacy

- OpenAI, Convex administrative, Shopify administrative, and Sanity write credentials remain server-only.
- Clerk-derived identity and organization boundaries are rechecked at every sensitive tool call.
- The browser cannot assert roles or scopes.
- Employee and support Responses calls use `store: false`.
- Tool output is minimized to the fields needed for the answer.
- Prompt injection in documents cannot grant permissions or change tool policy.
- State-changing operations require server authorization and explicit confirmation.
- Logs redact secrets, payment data, and unnecessary customer PII.
- Public, internal, and executive document corpora are logically separated even if one retrieval provider is used.

## Verification Contract

Phase 1 cannot ship until it passes:

1. Unit tests for role-to-scope resolution and denial by default.
2. Registry tests proving every tool declares schemas, scopes, surfaces, and risk.
3. Parity tests proving Realtime and Responses expose the same canonical catalog read tools.
4. API tests proving the browser cannot elevate its role or organization.
5. Product tests proving Convex remains the only source for SKU, price, stock, and fitment claims.
6. Refine tests proving 9 mL 13-415 and 17-415 remain separated.
7. Retrieval tests proving employee-only documents never reach public surfaces.
8. Correction tests proving submissions remain pending and never mutate catalog truth.
9. Trace tests covering token, audio, tool, latency, source, status, and versioned cost fields without raw secrets.
10. Existing 394 passing tests and the Grace live retrieval matrix.
11. A live OpenAI credential check for both Realtime client-secret creation and one Responses call.
12. Production build, lint, and mobile smoke checks.

The current invalid OpenAI API key is an explicit deployment blocker, not a reason to weaken or bypass these checks.

## Phase 1 Release Sequence

1. Add shared context, scope, authorization, registry, result, and trace types.
2. Wrap existing catalog and compatibility handlers in the shared registry without changing their customer-visible results.
3. Generate OpenAI Realtime tool schemas from the registry and prove parity.
4. Add the server-only Responses adapter with `store: false` and configurable model policy.
5. Add authenticated employee text-chat API and connect `/grace-workspace` employee mode.
6. Add approved document-retrieval boundary and citations; leave file ingestion manual and review-gated.
7. Add pending correction intake.
8. Add trace and cost estimation records plus Executive Hub aggregate contract.
9. Run automated and live acceptance checks.

## Out of Scope for Phase 1

- Bulk uploading the product catalog to OpenAI
- Fine-tuning a model on changing product facts
- Automatic catalog, policy, or prompt changes from feedback
- Refunds, credits, price overrides, order mutations, supplier writes, or outbound communications
- Raw customer-conversation viewing in the Executive Hub
- Full CRM, ERP, warehouse, or supplier integrations
- Publishing a ChatGPT app or MCP server
- Removing the temporary ElevenLabs rollback path before OpenAI passes production acceptance

## Success Criteria

Phase 1 is successful when an authenticated employee can ask a product or approved-policy question in the existing Grace Workspace and receive a source-labeled answer through the same authorized product tools used by public Grace; public users cannot access internal documents or scopes; every request emits a costed operational trace; explicit corrections enter a review queue; and the 9 mL neck-platform boundary remains exact.

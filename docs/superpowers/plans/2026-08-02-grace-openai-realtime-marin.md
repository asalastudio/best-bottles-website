# Grace OpenAI Realtime + Marin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ElevenLabs' agent layer with OpenAI Realtime and Marin while preserving all existing Grace tools and adding Refine inheritance, Paper Doll control, quotes, portal projects, and conservative proactive guidance.

**Architecture:** OpenAI `gpt-realtime-2.1` runs Grace's live typed and spoken session over WebRTC. Strict tools call provider-neutral Best Bottles handlers; Convex remains authoritative and the application executes navigation, UI, cart, form, quote, and project effects behind confirmation boundaries.

**Tech Stack:** Next.js 16, React 19, OpenAI Agents SDK 0.14.2, OpenAI Realtime API, Convex, TypeScript, Vitest, Puppeteer.

## Global Constraints

- Production voice is `marin`; live model is `gpt-realtime-2.1`.
- `OPENAI_API_KEY` remains server-only; browsers receive short-lived Realtime credentials.
- OpenAI never receives all 2,300 SKUs; catalog facts come from compact Convex tool results.
- Active catalog refinements remain in force until the customer explicitly asks to broaden them.
- 9 mL Cylinder 13-415 and 17-415 remain separate unless explicitly compared.
- Cart, quote submission, form submission, checkout, and durable project writes require explicit intent or visible confirmation.
- `docs/executive-hub/` is unrelated user work and must never be staged.

---

### Task 1: Realtime configuration and client credentials

**Produces:** OpenAI provider configuration and a rate-limited server endpoint that returns a short-lived Realtime client secret configured for Marin.

- [ ] Write failing tests for provider parsing, fixed model/voice values, missing-key behavior, and upstream failures.
- [ ] Verify the tests fail because the Realtime configuration and endpoint do not exist.
- [ ] Upgrade `@openai/agents` to `0.14.2`; add provider configuration and the credential endpoint.
- [ ] Run the focused tests, type check, and commit.

### Task 2: Provider-neutral tool registry and gateway

**Produces:** Strict OpenAI tool definitions for every current Grace capability and provider-neutral execution of Convex-backed tools.

- [ ] Write failing tests that inventory all existing tool names, validate strict argument schemas, and prove the legacy route and Grace route return equivalent results.
- [ ] Verify the tests fail against the current ElevenLabs-only gateway.
- [ ] Extract provider-neutral handlers, add `/api/grace/tools`, and leave `/api/elevenlabs/server-tools` as a temporary compatibility alias.
- [ ] Run focused tests and commit.

### Task 3: OpenAI Realtime conversation adapter

**Produces:** A `GraceConversationAdapter` supporting connect, disconnect, typed messages, contextual updates, interruption, transcripts, lifecycle events, and tool execution.

- [ ] Write failing adapter tests using an injected session factory.
- [ ] Verify lifecycle, transcript, reconnect, text-send, context-send, and interrupt cases fail before implementation.
- [ ] Implement the adapter with `RealtimeAgent`, `RealtimeSession`, WebRTC, `gpt-realtime-2.1`, and Marin.
- [ ] Run focused tests and commit.

### Task 4: Refine inheritance and Paper Doll controls

**Produces:** `GraceRefineContext`, deterministic constraint merging, explicit broadening detection, and compatible Paper Doll selection actions.

- [ ] Write failing tests for URL-to-context parity, constraint preservation, explicit broadening, and 13-415/17-415 isolation.
- [ ] Write failing tests for accepted and rejected Paper Doll layer changes.
- [ ] Implement Refine context with the existing `CatalogFilters`, `SortValue`, and `ViewMode` types; add `setCatalogRefinements` and `setPaperDollSelection`.
- [ ] Run focused tests and commit.

### Task 5: Full interaction parity and safe mutations

**Produces:** OpenAI-driven navigation, presentations, comparison, build kits, shortlists, forms, cart proposals, and checkout without bypassing confirmations.

- [ ] Write failing tests for the complete 25-tool inventory and approval boundaries.
- [ ] Move current client tool implementations behind the provider-neutral registry and connect `GraceProvider` to the OpenAI adapter.
- [ ] Preserve visible messages, streaming text, rich actions, analytics, reconnect behavior, and typed fallback.
- [ ] Run focused tests and commit.

### Task 6: Expanded quote, project, and proactive workflows

**Produces:** Verified RFQ assembly, authenticated durable project tools, and silent contextual prompts.

- [ ] Write failing tests for quote line validation, confirmation before submission, portal ownership, project saves, and non-speaking proactive prompts.
- [ ] Add quote preparation and submission tools using existing `formSubmissions.rfqLineItems`.
- [ ] Add authenticated project creation/save tools using `graceProjects`; guests continue using carts and shareable shortlists.
- [ ] Add contextual visual suggestions only when Grace opens, a search returns no results, or a fitment choice is incomplete.
- [ ] Run focused tests and commit.

### Task 7: Integration, rollout, and cleanup gate

**Produces:** Feature-flagged OpenAI rollout with verified catalog, UI, mobile, and rollback behavior.

- [ ] Add end-to-end coverage for configuration, navigation, cart confirmation, quote review, project saving, interruption, reconnect, and typed/voice parity.
- [ ] Run unit tests, Grace retrieval matrix, Grace orchestration E2E, product-truth audits, lint, type check, and production build.
- [ ] Verify preview behavior in desktop and mobile layouts with OpenAI selected and ElevenLabs rollback selected.
- [ ] Update environment documentation and operational notes; keep ElevenLabs dependencies until seven stable production days have elapsed.
- [ ] Review the full diff, stage only scoped files, and create the final verified commit.

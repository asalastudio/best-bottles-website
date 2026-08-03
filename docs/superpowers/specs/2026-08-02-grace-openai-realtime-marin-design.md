# Grace OpenAI Realtime + Marin Design

**Date:** 2026-08-02  
**Status:** Approved direction, implementation-ready after written-spec review  
**Branch:** `codex/grace-openai-realtime-marin`

## Objective

Move Grace's live typed and spoken conversation from ElevenLabs to OpenAI Realtime while preserving Grace's identity, catalog accuracy, page awareness, client-side product actions, and B2B purchasing behavior.

The production voice is **Marin**. The live model is **`gpt-realtime-2.1`**. Convex remains the catalog source of truth, and Grace must inherit the customer's exact Refine state until the customer explicitly asks to remove or broaden a constraint.

## Selected Approach

Use one OpenAI Realtime provider implementation for voice and typed messages. One live session is active at a time: voice mode uses WebRTC audio with transcripts, while typed-only mode requests text output. A short-lived client secret is issued by the Best Bottles server.

This is preferred over two alternatives:

1. **OpenAI reasoning plus ElevenLabs speech:** preserves the existing Eleanor voice but keeps a second provider and an additional realtime stage.
2. **Separate OpenAI text and speech pipelines:** provides more component-level control but recreates transcription, response streaming, speech synthesis, turn detection, and interruption handling that Realtime already provides.

The existing ElevenLabs implementation remains temporarily selectable through a provider flag for rollback. It is not extended with new behavior and will be removed after the OpenAI path passes production acceptance checks.

## Architecture

```text
Browser microphone or typed message
        |
        v
Grace OpenAI Realtime session
gpt-realtime-2.1 + Marin + WebRTC
        |
        | structured tool call
        v
Provider-neutral Grace tool gateway
        |
        v
Convex catalog and compatibility queries
        |
        v
Verified compact tool result
        |
        +--> Grace's spoken/text response
        +--> Existing Grace product cards and UI actions
```

## Components

### 1. Realtime session credential endpoint

Add a server-only endpoint that uses `OPENAI_API_KEY` to create a short-lived OpenAI Realtime client secret. The response contains no permanent API key.

The voice session configuration fixes:

- model: `gpt-realtime-2.1`
- voice: `marin`
- audio output with text transcripts for the visible conversation
- Grace's approved instructions and voice-mode brevity rules
- server voice activity detection and interruption behavior

The browser uses the short-lived credential to establish WebRTC directly with OpenAI.

### 2. OpenAI conversation adapter

Create an adapter whose public interface matches the narrow conversation operations currently used by `GraceProvider`:

- connect and disconnect
- send a typed user message
- send a contextual page update
- expose connection and speaking/listening states
- emit user transcripts
- emit streaming and final Grace text
- execute approved client tools
- stop current speech when requested

`GraceProvider` continues to own the visual conversation state, rich actions, cart confirmations, navigation, forms, and analytics. Provider-specific lifecycle code moves behind the adapter. Switching between voice and typed-only mode restarts the provider session while retaining the visible local conversation.

### 3. Provider-neutral tool gateway

Rename the current ElevenLabs-specific browser tool proxy to a Grace-owned endpoint. Preserve the old endpoint as a temporary compatibility alias during migration.

The gateway keeps the existing rate limiting, input normalization, Convex calls, compact result projections, no-match safeguards, product-truth warnings, and UI payloads. No OpenAI or ElevenLabs service receives all 2,300 SKUs.

### 4. Canonical Refine state

Extend `PageContext` with a structured catalog refinement object rather than relying only on free-form URL text. It contains the active values supported by the catalog, including:

- family
- category
- capacity
- neck thread
- glass color
- applicator
- cap or finish
- search term
- sort mode

Every catalog search tool call receives this state. The tool gateway merges requested criteria with active refinements by default. A constraint is removed only when the customer's request contains an explicit broadening intent such as “show other sizes,” “any color,” or “broaden this search.”

The 9 mL Cylinder thread boundary remains strict: 13-415 and 17-415 are never merged unless the customer explicitly asks to compare thread platforms.

### 5. Grace identity and prompt

Grace remains the Best Bottles packaging concierge. The migration changes the transport and voice renderer, not her identity or business rules.

The Realtime instructions reuse the canonical Grace constitution and add voice-specific rules:

- concise spoken answers
- natural pronunciation of capacities and neck threads
- no spoken SKU strings unless the customer explicitly asks
- product claims only from tool results
- one useful next question when clarification is needed
- explicit confirmation before cart or form submissions

Typed and spoken Grace use the same tools and truth rules so the two modes cannot drift into different catalog behavior.

## Data Flow

1. The customer opens Grace.
2. The browser requests a short-lived Realtime client secret from the Best Bottles server.
3. The browser starts a WebRTC session with `gpt-realtime-2.1` and Marin.
4. `GraceProvider` supplies the current page, product, cart, browsing, and structured Refine context.
5. For any catalog, compatibility, price, stock, or product-count claim, Grace calls a tool.
6. The provider-neutral tool gateway queries Convex and returns a compact verified result.
7. The same result drives Grace's answer and any visible product cards or navigation action.
8. Analytics record connection timing, first response timing, tool latency, interruptions, errors, and conversions without storing secrets.

## Failure Behavior

- If Realtime cannot connect, Grace remains usable in typed mode through a provider-neutral fallback route built on the existing Convex `askGrace` implementation.
- If microphone permission is denied, the UI explains that voice is unavailable and keeps the typed composer active.
- If a Convex tool fails, Grace does not invent an answer; she states that live product information could not be verified.
- If a session disconnects unexpectedly, the client offers a reconnect while retaining the local visible conversation.
- During rollout, a provider flag can return the storefront to the existing ElevenLabs session without a code rollback.
- Once OpenAI is stable and the rollback window closes, ElevenLabs routes, environment variables, packages, scripts, and documentation are removed in a separate cleanup commit.

## Security

- `OPENAI_API_KEY` remains server-only.
- The browser receives only a short-lived Realtime client secret.
- Tool execution is routed through Best Bottles endpoints with existing rate limits and validation.
- Permanent provider credentials and Convex administrative credentials are never exposed to the browser.
- Tool schemas restrict arguments, and Convex remains authoritative for availability, fitment, pricing, and product identity.

## Verification

The OpenAI path must pass:

1. Type checking, linting, and production build.
2. Existing Grace retrieval matrix and product-truth audits.
3. Existing Grace end-to-end orchestration tests.
4. Voice-specific checks for microphone permission, first response, interruption, reconnect, and stopping speech.
5. Typed-versus-spoken parity on the same catalog questions.
6. Cylinder regression cases that prove 9 mL 13-415 and 9 mL 17-415 remain separated.
7. Refine inheritance cases that prove Grace preserves active constraints until the customer explicitly broadens the search.
8. Mobile Safari and mobile Chrome checks over a normal cellular connection.

## Rollout

1. Add the OpenAI provider behind `NEXT_PUBLIC_GRACE_PROVIDER=openai|elevenlabs`; keep ElevenLabs as rollback only during the migration window.
2. Run the existing Grace catalog evals plus the new Realtime/refinement tests locally and in preview.
3. Enable OpenAI Realtime for internal users and measure connection, first-response, tool, and interruption performance.
4. Enable OpenAI Realtime for production traffic after accuracy and mobile behavior pass.
5. Remove ElevenLabs after the agreed stability window; do not maintain two evolving Grace implementations.

## Out of Scope

- Redesigning the Grace drawer or executive dashboard
- Changing Convex product truth or Paper Doll compatibility rules
- Building uncontrolled self-learning
- Replacing Grace's controlled-correction and evaluation system
- Loading the full catalog into the model context
- Removing ElevenLabs before the OpenAI path passes acceptance checks

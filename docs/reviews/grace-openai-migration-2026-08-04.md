# Grace — Full OpenAI Migration + Navigation Battery — 2026-08-04

Jordan's decision: ElevenLabs is out entirely; everything runs Convex ↔ OpenAI direct
(latency + no intermediary). This session executed the excision and the first
navigation-accuracy battery.

## ElevenLabs excision (complete, dev)

- **GraceProvider.tsx**: `useConversation`/`@elevenlabs/react` removed; OpenAI Realtime
  (`gpt-realtime-2.1`, voice Marin, WebRTC via `@openai/agents/realtime`) is the only
  provider. `getGraceProvider`/`GraceProviderId` deleted from `openaiRealtimeConfig.ts` —
  no rollback switch remains.
- **Routes deleted**: `/api/elevenlabs/{signed-url, conversation-token, server-tools,
  webhook/[tool]}` (server-tools deletion permanently closes the April unauthenticated
  endpoint), plus `/api/voice` (ElevenLabs TTS proxy, zero consumers — Realtime streams
  audio directly).
- **`/api/voice/transcribe` rebuilt on OpenAI** `gpt-4o-mini-transcribe` (Navbar voice
  search). Same rate-limit contract (`route: "voice-transcribe"`).
- **`/api/grace/tools` auth**: canonical secret is now `GRACE_TOOLS_WEBHOOK_SECRET` with
  `ELEVENLABS_WEBHOOK_SECRET` fallback until Vercel envs are renamed.
- **Deps removed**: `@elevenlabs/react`, `convex-elevenlabs` (lockfile synced, −22 pkgs).
- **Retired**: `scripts/grace_agent_config.json` + `apply_grace_agent_config.mjs` (the
  ElevenLabs agent brain). Durable contracts from its tests were retargeted to the OpenAI
  tool specs (`src/lib/knowledge/toolSchemas.ts`). `.mcp.json` was already gone.
- **Tool parity**: `getPriceStats` added to the OpenAI tool specs, knowledge-tool registry
  (CATALOG_READ), and gateway dispatch — voice/chat now has the same price authority as
  the Convex text agent. Battery re-verified via live gateway call ($0.42 15ml Boston
  Rounds, exact SKUs).
- **Verification**: 513/516 vitest pass (3 pre-existing paper-doll failures from in-flight
  branch work, untouched); tsc clean apart from those; live probes: realtime-token mints
  clientSecret, gateway getPriceStats exact, deleted routes 404.

## Navigation-accuracy battery — 5/5 PASS

`tests/grace-navigation-battery.live.test.ts` — gated by `GRACE_LIVE_BATTERY=1`, drives
the exact Realtime brain (GRACE_REALTIME_INSTRUCTIONS + GRACE_OPENAI_TOOL_SPECS) with
real gateway execution; navigation/display tools stubbed + recorded; slugs graded
against Convex `getProductGroup`.

| Probe | Result |
|---|---|
| Exact product request → real slug | PASS (showProducts, self-verifying) |
| 9ml clear cylinder roll-on page | PASS — navigated to verified slug |
| "Filter to cobalt blue fine mist sprayers" | PASS — `setCatalogRefinements` with canonical buckets (`finemist`, not the label) |
| Nonexistent product (10ml Boston Round) | PASS — refused navigation, no fabricated confirmation |
| "What page am I on?" (PDP context) | PASS — answered from page context, zero re-navigation |

Run: `GRACE_LIVE_BATTERY=1 npx vitest run tests/grace-navigation-battery.live.test.ts`
(needs OPENAI_API_KEY + NEXT_PUBLIC_CONVEX_URL).

## "Eyes" audit — getCurrentPageContext

The sight system is real and well-built: context is rebuilt per route (PDP: name, family,
capacity, color, neck thread, applicator types, caps summary from variants, price, primary
SKU; catalog: category/family/search + full Refine state; cart items + total; Paper Doll
platform lock; browsing history), signature-diffed, and pushed to the session on every
meaningful change. The live battery confirmed she actually uses it.

**Gaps found:**
1. **Workspace/portal pages are blind.** Only pdp/catalog/cart/contact/home get structured
   context; portal/workspace routes fall through to a bare `Page: /path` line. This is the
   main blocker for "surface in the workspace."
2. **Passive by design.** Context notes say "wait for them to ask"; realtime instructions
   forbid proactive audio. Fine — but there is no "logical next step" signal in the context
   block for Grace to use *when engaged*. A per-page-type NEXT-STEP hint (PDP → fitment
   check/sample offer; cart → compatible accessories; catalog+refine → narrowing guidance)
   is the cheap, high-leverage salesmanship lever.
3. Page-level, not element-level: she can't see which products are actually in the
   viewport on a catalog page. Acceptable for now.

## Remaining (not done here)

- **Prod deploy** of all of this + run `migrations:reconcileProductGroups` on prod.
- **Vercel/Convex env cleanup**: remove `ELEVENLABS_*` (after renaming the tools secret to
  `GRACE_TOOLS_WEBHOOK_SECRET`); confirm `OPENAI_API_KEY` in Vercel prod.
- **ElevenLabs account teardown** (Jordan): delete agent, revoke API keys — settles the
  July secrets-incident rotation debt for those keys.
- `.env.local` cruft: `ELEVENLABS_*` + `NEXT_PUBLIC_GRACE_VOICE_PROVIDER` unused now.
- **Salesmanship round**: workspace page-context coverage + NEXT-STEP hints per page type
  + tone pass with Jordan.

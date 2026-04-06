# Critical Security Fixes — Phase 1

## Context
The codebase audit identified 3 critical security issues that should be fixed before anything else:
1. **Webhook verification fails open** when `ELEVENLABS_WEBHOOK_SECRET` env var is missing
2. **No rate limiting or input validation** on cost-incurring API routes (TTS, STT)
3. **Missing env var validation at startup** — app boots silently with broken config

Clerk auth IS already installed and the middleware exists at `src/proxy.ts` (not deleted — the git status shows `src/middleware.ts` was deleted, which was the old location). The middleware already protects `/portal(.*)` routes. The public-facing API routes (voice, signed-url, etc.) are intentionally public since they serve the storefront — but they need rate limiting and input validation.

## Scope — What we're fixing NOW

### Fix 1: Webhook fail-open → fail-closed
**File:** `src/app/api/elevenlabs/webhook/[tool]/route.ts:19`
- Change `if (!WEBHOOK_SECRET) return true;` → `if (!WEBHOOK_SECRET) return false;`
- This is a 1-character change with massive security impact

### Fix 2: Input validation on cost-incurring routes
These routes are legitimately public (storefront users aren't authenticated), but need input guards:

**`src/app/api/voice/route.ts`** — TTS proxy
- Add max text length (2000 chars) before sending to ElevenLabs
- Prevents quota abuse via giant text payloads

**`src/app/api/voice/transcribe/route.ts`** — STT proxy
- Add max file size check (10MB)
- Add MIME type whitelist (audio/*)

**`src/app/api/portal/grace/chat/route.ts`** — Portal chat
- Add max message length (2000 chars)
- This route is ALREADY behind Clerk middleware (portal routes are protected in `src/proxy.ts:6`)
- But add `requirePortalViewer()` call as defense-in-depth

### Fix 3: Env var validation at startup
**File:** `next.config.ts`
- Add validation block for required env vars at build time
- Required vars: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SANITY_PROJECT_ID`
- Warn-only vars (optional features): `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`

## What we're NOT touching (and why)
- **signed-url, conversation-token, server-tools routes**: These are public storefront endpoints called by the Grace voice widget. Adding auth would break the chat for anonymous visitors. Rate limiting requires infrastructure (Redis/Upstash) — separate task.
- **shopify/resolve-variants**: Public storefront checkout flow. Rate limiting is the right fix, not auth.
- **paper-doll/render**: Public product configurator. Same — rate limiting later.

## Files to modify
1. `src/app/api/elevenlabs/webhook/[tool]/route.ts` — line 19
2. `src/app/api/voice/route.ts` — add text length check after line 44
3. `src/app/api/voice/transcribe/route.ts` — add file size + MIME check after line 37
4. `src/app/api/portal/grace/chat/route.ts` — add message length + auth check
5. `next.config.ts` — add env validation block
6. `src/app/error.tsx` — stop suppressing the error object (log it)

## Verification
1. `npm run build` — confirm no build errors, env validation works
2. Manual test: webhook route returns 401 when secret is unset
3. Manual test: TTS route rejects text > 2000 chars with 400
4. Manual test: STT route rejects files > 10MB with 413
5. Manual test: Portal chat rejects messages > 2000 chars with 400

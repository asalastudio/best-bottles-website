# ElevenLabs Setup Checklist

Use this checklist to verify your ElevenLabs configuration for Grace.

## 1. API Key (convai_write permission)

**Current status:** The API key is still returning "missing permission convai_write".

**Fix:**
1. Go to [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)
2. Create a **new** API key
3. When creating, look for **Conversational AI** or **convai_write** permission — enable it
4. Copy the new key into `.env.local` as `ELEVENLABS_API_KEY`
5. Update `.cursor/mcp.json` → `ElevenLabs.env.ELEVENLABS_API_KEY` with the same key
6. Restart dev server: `npm run dev`

## 2. Agent (Grace)

**Verify in [elevenlabs.io/app/agents](https://elevenlabs.io/app/agents) or [elevenlabs.io/app/conversational-ai](https://elevenlabs.io/app/conversational-ai):**

- [ ] Agent name: **Grace**
- [ ] **Main Goal** filled in (e.g. "Help customers find glass bottles and packaging for beauty, fragrance, and wellness brands")
- [ ] **Voice** selected
- [ ] **Website** (optional): `https://bestbottles.com` or your live URL
- [ ] **Chat only** toggle: OFF (so voice works)
- [ ] Agent ID matches `.env.local`: `agent_2301kcnp9c2xevws975dvmzwtf1h`

## 3. Client Tools (optional, for product search)

If you want Grace to show products, compare, add to cart, etc., configure these tools in the agent:

| Tool            | Parameters                          | Purpose                    |
|-----------------|-------------------------------------|----------------------------|
| showProducts    | `query`, `family?`                  | Display product cards     |
| compareProducts | `query`, `family?`                  | Side-by-side comparison   |
| proposeCartAdd  | `products[]`                        | Add to cart with confirm  |
| navigateToPage  | `path`, `title`, `description?`     | Open links                |
| prefillForm     | `formType`, `fields`                | Prefill forms             |

The app defines these in `GraceElevenLabsProvider.tsx` — the agent just needs to know they exist.

## 4. Plan / Subscription

- [ ] Conversational AI is enabled on your ElevenLabs plan
- [ ] You have available minutes (Free: 15 min, Starter: 50 min, etc.)

## 5. Local Config

- [ ] `.env.local` has exactly one `ELEVENLABS_API_KEY` (no duplicates)
- [ ] `ELEVENLABS_AGENT_ID=agent_2301kcnp9c2xevws975dvmzwtf1h`
- [ ] `NEXT_PUBLIC_GRACE_VOICE_PROVIDER=elevenlabs`
- [ ] Dev server restarted after any env change

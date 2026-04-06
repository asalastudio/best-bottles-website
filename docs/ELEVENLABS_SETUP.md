# ElevenLabs Conversational AI Setup

This guide explains how to connect the Grace AI assistant to ElevenLabs for voice conversations.

## Overview

- **Grace** is the Best Bottles AI assistant (text + voice).
- **ElevenLabs** powers the voice experience via WebRTC (low latency).
- When a user taps the mic, the app fetches a conversation token from our API, then connects to ElevenLabs via WebRTC (API key stays server-side).

## Environment Variables

Add these to `.env.local`:


| Variable                           | Required | Description                                                                                      |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `ELEVENLABS_API_KEY`               | Yes      | Your ElevenLabs API key (from [Profile → API Keys](https://elevenlabs.io/app/settings/api-keys)) |
| `ELEVENLABS_AGENT_ID`              | Yes      | Your Conversational AI agent ID (from [Agents](https://elevenlabs.io/app/conversational-ai))     |
| `NEXT_PUBLIC_GRACE_VOICE_PROVIDER` | No       | Set to `elevenlabs` (default) or `openai` to switch providers                                    |


**Note:** `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` is no longer required. The app uses the conversation token flow, which only needs `ELEVENLABS_AGENT_ID` on the server.

## 1. Create an ElevenLabs Account

1. Go to [elevenlabs.io](https://elevenlabs.io) and sign up.
2. In **Profile → API Keys**, create an API key and copy it into `ELEVENLABS_API_KEY`.

## 2. Create a Conversational AI Agent

1. Go to [Conversational AI](https://elevenlabs.io/app/conversational-ai).
2. Create a new agent or use an existing one.
3. Configure the agent:
  - **Name:** e.g. "Grace"
  - **Voice:** Choose a voice that fits your brand.
  - **Prompt:** Paste the **canonical system prompt** from the section [Agent system prompt (canonical)](#agent-system-prompt-canonical) below. Register the **dynamic variables** listed there in the agent so placeholders resolve.
  - **Client tools:** The app passes these via `useConversation` in `src/components/grace/GraceProvider.tsx`:
    - `showProducts` – display product cards
    - `compareProducts` – side-by-side comparison
    - `proposeCartAdd` – add to cart with confirmation
    - `navigateToPage` – open links or navigate
    - `prefillForm` – prefill sample/quote/contact forms
4. Copy the **Agent ID** (e.g. `agent_xxxxx`) into `ELEVENLABS_AGENT_ID`.

## 3. Configure Agent Tools (Optional)

For product search and catalog actions, the agent needs to know about our tools. The app defines **client tools** in `GraceElevenLabsProvider.tsx`; these run in the browser and call our `/api/elevenlabs/server-tools` route to fetch data from Convex.

If your agent was created from scratch, add tool definitions in the ElevenLabs dashboard that match:

- **showProducts** – `{ query: string, family?: string }` – Show product cards for a search.
- **compareProducts** – `{ query: string, family?: string }` – Show a comparison of products.
- **proposeCartAdd** – `{ products: Array<{ itemName, graceSku, quantity?, webPrice1pc? }> }` – Propose adding items to cart.
- **navigateToPage** – `{ path: string, title: string, description?:, autoNavigate?: }` – Navigate or show a link.
- **prefillForm** – `{ formType, fields }` – Prefill a form.

The server-tools route maps to Convex: `searchCatalog`, `getFamilyOverview`, `getBottleComponents`, `checkCompatibility`, `getCatalogStats`.

## 4. Verify the Connection

1. Restart the dev server: `npm run dev`
2. Open the site and click the Grace floating trigger (bottom-right).
3. Click the microphone to start a voice conversation.
4. You should see "Connecting..." then "Listening" when connected.
5. Speak a question (e.g. "What Boston Round bottles do you have?").

### Troubleshooting


| Symptom                                         | Fix                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| "Failed to get ElevenLabs connection"           | Check `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in `.env.local`. Restart the dev server.                                               |
| "ElevenLabs API key or Agent ID not configured" | Ensure both env vars are set and not empty.                                                                                                 |
| Connection times out                            | Check firewall/network. ElevenLabs uses WebRTC; ensure outbound connections to api.elevenlabs.io and livekit.rtc.elevenlabs.io are allowed. |
| No voice response                               | Confirm the agent has a voice selected and the prompt is configured.                                                                        |
| Tools not working                               | Ensure the agent’s tool names and parameters match the client tools in `GraceElevenLabsProvider.tsx`.                                       |


## 5. API Routes


| Route                                    | Purpose                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/elevenlabs/conversation-token` | Returns a WebRTC conversation token (keeps API key server-side). |
| `GET /api/elevenlabs/signed-url`         | Returns a signed URL for WebSocket (fallback).                   |
| `POST /api/elevenlabs/server-tools`      | Proxies tool calls (e.g. `searchCatalog`) to Convex.             |


## 6. Switching Providers

To use the original OpenAI Realtime voice instead:

```bash
NEXT_PUBLIC_GRACE_VOICE_PROVIDER=openai
```

Then restart the dev server.

---

## Agent system prompt (canonical)

**The canonical system prompt now lives in `[docs/ELEVENLABS_SYSTEM_PROMPT.md](./ELEVENLABS_SYSTEM_PROMPT.md)`.** Copy the block between the triple-backtick fences in that file into **Conversational AI → your agent → System prompt** (or the main prompt field). In the same agent, add **dynamic variables** with these exact names (including leading underscores): `_product_name_`, `_page_type_`, `_page_path_`, `_page_url_`, `_grace_sku_`, `_neck_thread_`, `_product_family_`, `_applicators_line_`, `_caps_summary_`, `_catalog_category_`, `_catalog_search_`, `_catalog_families_`. See [Example dynamic variable values](#example-dynamic-variable-values-pdp--catalog-test-fixture) for a copy-paste test fixture.

The site also sends **contextual updates** (full session block: page, cart, recent browsing) when the shopper navigates or changes filters while Grace is open. You do not configure those in the dashboard—they arrive as conversation context automatically.

> **Note:** The old inline prompt block that was here has been moved to `ELEVENLABS_SYSTEM_PROMPT.md`. The version below is kept only as a historical reference — **always use the canonical file.**

```
# (DEPRECATED — see docs/ELEVENLABS_SYSTEM_PROMPT.md for the current version)
# Previous short prompt — replaced 2026-04-06

# Personality

You are Grace, the packaging concierge at Best Bottles — a premium packaging supplier for perfume, fragrance, and personal care brands. Best Bottles is a division of Nemat International; we sell the same glass and systems we use in our own retail products. You are warm, knowledgeable, and efficient. You speak like a trusted B2B advisor: professional, clear, and never pushy.

# Voice and length

Keep replies short for voice: prefer one or two sentences, then one follow-up question unless the customer asks for detail. Do not use markdown, bullet lists, or asterisks in spoken replies. Do not read internal SKU codes aloud unless the customer explicitly asks for a product code; use natural product descriptions (family, size, color, applicator).

# Session snapshot (dynamic variables)

These values refresh when a new conversation starts and reflect the shopper’s URL at that moment. They may be empty when not applicable (e.g. not on a product page).

- Page type: {{_page_type_}}
- Full URL (path and query, truncated if long): {{_page_url_}}
- Path only: {{_page_path_}}
- On a product detail page: primary SKU for tools {{_grace_sku_}}, family {{_product_family_}}, neck thread {{_neck_thread_}}
- Applicator types available on this product line: {{_applicators_line_}}
- Cap and closure variety on this line (from catalog variant data — heights, styles, colors): {{_caps_summary_}}
- On the catalog: category filter {{_catalog_category_}}, search {{_catalog_search_}}, families filter {{_catalog_families_}}

Use this snapshot so you know where the shopper is without asking them to repeat the URL. If applicator or caps lines are empty, they may be on a non-PDP page or data is still loading — use tools to confirm.

# Live context (automatic)

The website may send additional contextual updates during the conversation when the customer navigates or changes filters. Treat those updates as the current truth for page, cart, and browsing.

# Tools and truth

Never invent product names, SKUs, prices, thread sizes, or stock. For catalog facts, compatibility, and closures, use your tools (for example: search the catalog, get bottle components for a SKU, check compatibility by thread size, read current page context). Compatibility is driven by **neck thread** (finish): matching thread specification is required for physical fit.

When a customer asks what caps, closures, sprayers, or applicators work with a bottle, use **getBottleComponents** with the correct bottle SKU. The tool returns groups by type (for example: Short Cap, Tall Cap, Sprayer, Lotion Pump, Roll-On Cap). If several types appear, mention each distinct type — do not merge them into one generic “cap.”

# Policies (brief)

Order minimum is fifty dollars before shipping, with no unit minimum. For sample exceptions, direct businesses to the sample program via sales when relevant.

# Boundaries

Do not reference competitor retailers as if we sell through them. Focus on packaging and wholesale ordering on bestbottles.com.
```

### Example dynamic variable values (PDP + catalog test fixture)

Use these in the ElevenLabs UI when you need **sample defaults** for testing the prompt (e.g. “Test variables” or playground). The live site still sends real values at session start.

Register `**_product_name_`** as well — the app always sends it (PDP `displayName`, or `our collection` when not on a product).


| Variable             | Example value                                  |
| -------------------- | ---------------------------------------------- |
| `_product_name_`     | `9 ml Clear Cylinder Fine Mist Spray Bottle`   |
| `_page_type_`        | `pdp`                                          |
| `_page_url_`         | `/products/cylinder-9ml-clear-17-415-finemist` |
| `_page_path_`        | `/products/cylinder-9ml-clear-17-415-finemist` |
| `_grace_sku_`        | `CYL-9ML-CLR-17-415-FINEMIST`                  |
| `_neck_thread_`      | `17-415`                                       |
| `_product_family_`   | `Cylinder`                                     |
| `_applicators_line_` | `fine mist sprayer, lotion pump, roll-on`      |
| `_caps_summary_`     | `black, white, silver`                         |
| `_catalog_category_` | `Glass Bottle`                                 |
| `_catalog_search_`   | `cylinder`                                     |
| `_catalog_families_` | `Cylinder`                                     |


**Production note:** On a real PDP session, `_applicators_line_` and `_caps_summary_` are built from Convex (canonical applicator names; caps summary from variant cap height/style/color). `_catalog_`* fields are usually **empty** on a PDP; they populate on `/catalog?...`. This table is a **combined fixture** for dashboard testing.
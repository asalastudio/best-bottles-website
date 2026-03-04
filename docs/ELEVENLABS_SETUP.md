# ElevenLabs Conversational AI Setup

This guide explains how to connect the Grace AI assistant to ElevenLabs for voice conversations.

## Overview

- **Grace** is the Best Bottles AI assistant (text + voice).
- **ElevenLabs** powers the voice experience via WebRTC (low latency).
- When a user taps the mic, the app fetches a conversation token from our API, then connects to ElevenLabs via WebRTC (API key stays server-side).

## Environment Variables

Add these to `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes | Your ElevenLabs API key (from [Profile → API Keys](https://elevenlabs.io/app/settings/api-keys)) |
| `ELEVENLABS_AGENT_ID` | Yes | Your Conversational AI agent ID (from [Agents](https://elevenlabs.io/app/conversational-ai)) |
| `NEXT_PUBLIC_GRACE_VOICE_PROVIDER` | No | Set to `elevenlabs` (default) or `openai` to switch providers |

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
   - **Prompt:** Describe Grace’s role (Best Bottles packaging expert, helpful, concise).
   - **Client tools:** The app passes these via `useConversation`:
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

| Symptom | Fix |
|--------|-----|
| "Failed to get ElevenLabs connection" | Check `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in `.env.local`. Restart the dev server. |
| "ElevenLabs API key or Agent ID not configured" | Ensure both env vars are set and not empty. |
| Connection times out | Check firewall/network. ElevenLabs uses WebRTC; ensure outbound connections to api.elevenlabs.io and livekit.rtc.elevenlabs.io are allowed. |
| No voice response | Confirm the agent has a voice selected and the prompt is configured. |
| Tools not working | Ensure the agent’s tool names and parameters match the client tools in `GraceElevenLabsProvider.tsx`. |

## 5. API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/elevenlabs/conversation-token` | Returns a WebRTC conversation token (keeps API key server-side). |
| `GET /api/elevenlabs/signed-url` | Returns a signed URL for WebSocket (fallback). |
| `POST /api/elevenlabs/server-tools` | Proxies tool calls (e.g. `searchCatalog`) to Convex. |

## 6. Switching Providers

To use the original OpenAI Realtime voice instead:

```bash
NEXT_PUBLIC_GRACE_VOICE_PROVIDER=openai
```

Then restart the dev server.

# Grace Audit Baseline

## Scope

This baseline captures how Grace currently works in the Best Bottles codebase so audit results can be mapped back to the correct runtime path instead of guessing.

## Runtime Surfaces

- Main site shell: `src/app/layout.tsx` mounts Grace globally.
- Shared UI wrapper: `src/components/MegaMenuLayoutWrapper.tsx` renders the persistent Grace surfaces.
- Main customer experience: `src/components/GraceElevenLabsProvider.tsx` and `src/components/GraceSidePanel.tsx`.
- Portal-only chat: `src/components/portal/GraceWorkspaceChat.tsx`.
- Voice session bootstrap: `src/app/api/elevenlabs/signed-url/route.ts`.
- ElevenLabs server-tool proxy: `src/app/api/elevenlabs/server-tools/route.ts`.
- Text-mode reasoning and tool loop: `convex/grace.ts`.

## Core Runtime Flow

### Text mode

1. Customer types into the Grace side panel.
2. `GraceElevenLabsProvider` sends the message to `api.grace.askGrace`.
3. `convex/grace.ts` builds the system prompt, loads `graceKnowledge`, and runs the Anthropic tool loop.
4. Claude can call Convex tools including:
   - `searchCatalog`
   - `getFamilyOverview`
   - `getBottleComponents`
   - `checkCompatibility`
   - `getCatalogStats`

### Voice mode

1. Customer starts voice in the Grace panel.
2. `GraceElevenLabsProvider` requests a signed URL from `src/app/api/elevenlabs/signed-url/route.ts`.
3. ElevenLabs runs the live session and can call client-side tools.
4. Client-side tools can call `src/app/api/elevenlabs/server-tools/route.ts`, which proxies back into Convex.
5. If voice fails, Grace falls back to text mode in the same panel.

## Sources Of Truth Grace Actually Uses

Grace is primarily Convex-driven at runtime.

- `products`
  - Product name, family, color, size, applicator, thread size, embedded compatible components, pricing, stock.
- `productGroups`
  - Group slug, display name, family, aggregated pricing, applicator bucket, and `groupDescription`.
- `fitments`
  - Thread-size compatibility matrix.
- `graceKnowledge`
  - Prompt knowledge blocks for policy, selling guidance, brand positioning, and factual constraints.

Sanity is not Grace's main runtime knowledge source today.

- Product pages use Sanity for editorial overrides and blocks.
- Grace search quality is mostly affected by Convex data, especially `productGroups.groupDescription`.
- Editing Sanity alone will not reliably improve Grace answers unless the relevant Convex fields are updated too.

## Important Runtime Files

- `convex/grace.ts`
  - Primary retrieval and reasoning layer.
- `convex/schema.ts`
  - Runtime enum definitions, indexes, and data model constraints.
- `convex/products.ts`
  - Lower-level catalog helpers and audit utilities.
- `convex/migrations.ts`
  - Large body of data repair and normalization logic.
- `src/components/GraceElevenLabsProvider.tsx`
  - Voice lifecycle, text fallback, page context injection, client tool behavior.
- `src/app/api/elevenlabs/server-tools/route.ts`
  - Server tool bridge from ElevenLabs into Convex.
- `src/app/api/elevenlabs/signed-url/route.ts`
  - Voice-session bootstrapping and failure surface.
- `src/components/Navbar.tsx`
  - Secondary voice-search path outside the main Grace panel.

## Baseline Observations

- Grace has strong tool support for product search and fitment lookup.
- The main side panel is the most capable Grace surface.
- Portal Grace is materially simpler than main-site Grace.
- Product detail pages provide useful page context to Grace, but page-specific editorial content is still partially decoupled from Grace runtime.
- Several audit and migration scripts already exist, but not all of them are safe at current dataset scale.

## Baseline Risks To Carry Into The Audit

- Vocabulary drift between prompt guidance, schema enums, and stored data.
- Search behavior depends heavily on exact applicator strings.
- Product-detail compatibility may differ depending on whether Grace uses embedded `products.components` or `fitments`.
- Audit tooling itself is partially brittle for large datasets.
- Voice, text, and portal entry points do not yet guarantee identical behavior or acceptance criteria.

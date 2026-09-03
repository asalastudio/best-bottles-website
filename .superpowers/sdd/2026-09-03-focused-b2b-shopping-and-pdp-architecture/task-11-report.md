# Task 11 — Grace Context Beside Focused Shopping

## Plan and critique

Implemented the approved side-drawer model without introducing a third PDP column. Grace now chooses push or overlay from the remaining measured content width, retains a persistent provider state across close/reopen and route changes, and receives the canonical finder/PDP context needed to ground recommendations.

The main design risk was treating a wide viewport as proof that the PDP still had room after the drawer opened. The replacement uses the drawer's resolved CSS-clamp width and a 920 px safe two-panel minimum. This means a 1399 px viewport with a 480 px drawer overlays instead of leaving a 919 px PDP workspace. The UI still uses the same two-panel PDP shell underneath the drawer; it does not add a third grid track.

## RED / GREEN evidence

### RED

Before production changes:

```text
npx vitest run tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts tests/grace-catalog-navigation.test.ts
```

Result: exit 1. The new 1399/480/920 layout assertion received `push` under the old 1100 px breakpoint, the available-width assertion had no value, and the new shopping-context suite could not import the absent `pageContextEvents` module. These failures named the missing behavior rather than a test fixture problem.

### GREEN

```text
npx vitest run tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts tests/grace-catalog-navigation.test.ts tests/graceRefineState.test.ts tests/responsive-shell-contract.test.ts
```

Result: exit 0 — 5 files, 31 tests passed.

```text
npx tsc --noEmit
npx eslint src/lib/grace/pushLayout.ts src/lib/grace/pageContextEvents.ts src/components/grace/GraceLayoutShell.tsx src/components/grace/GraceChatDrawer.tsx src/components/grace/GraceProvider.tsx src/components/GraceContext.ts 'src/app/products/[slug]/ProductDetailClient.tsx' tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts
git diff --check
```

Result: all exit 0; changed-file lint had no warnings or errors, and the diff has no whitespace errors.

## Measurement and responsive behavior

- Drawer CSS remains `clamp(400px, 30vw, 480px)`; the matching resolver yields its actual pixel width for the current viewport.
- `availableContentWidth = max(0, viewportWidth - drawerWidth)`.
- Push requires an open, eligible shopping route and `availableContentWidth >= 920`; otherwise Grace is an overlay with a backdrop and zero content inset.
- The provider observes `document.documentElement` with `ResizeObserver` plus window resize and publishes one surface decision to both `GraceLayoutShell` and `GraceChatDrawer`; the shell exposes `--grace-content-inset` in pixels. It no longer uses the old 1100 px breakpoint.
- Homepage/editorial and non-shopping pages stay overlay-only. `/catalog`, family and application finder routes, and `/products/*` are eligible when the measured width is safe.
- Mobile remains a full-width overlay that does not reserve tab-bar/page space.

## Context event schema and lifecycle

`bestbottles:pdp-context-change` has the privacy-safe payload:

```ts
{
  websiteSku: string;
  application?: string;
  glass?: string;
  rollerMaterial?: "metal" | "plastic";
  finish?: string;
  pageUrl: string;
}
```

`ProductDetailClient` dispatches this only when the resolved SKU/options signature changes. The provider listens for it, scopes it to the active PDP, and merges it into `PageContext.pdpSelection`. Finder context uses `parseBrowseContext` through `buildGraceFinderContext`, preserving entry mode, family, application, capacity, roller material, and the exact current result URL. No chat text, messages, customer identity, or other sensitive values are accepted by the event schema.

Grace recommendation routing now keeps broad results in their finder and routes only a verified exact product slug to its PDP.

## Conversation reset audit

- Close invokes only `closePanel`; messages, browsing context, filters, and PDP configuration persist.
- Navigation does not call the reset path; provider state persists above pages.
- `resetConversation` clears messages/session-local state and is called only from the drawer's explicit New Chat handler.

## Constraints and concerns

- Preserved Task 8's responsive two-panel shell and Task 9's URL-authoritative variant selection; no product data, Convex calls, or deployment actions were changed.
- The drawer width calculation intentionally mirrors the current CSS clamp. If the CSS width expression changes later, update `resolveGraceDrawerWidth` in the same change so layout math and visual width remain identical.
- A variant without a real website SKU does not emit a fabricated substitute; this keeps the exact-website-SKU contract truthful.

## Fix round 1 — shared authority and stale PDP events

### RED

Added regression tests, then ran:

```text
npx vitest run tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts
```

Result: exit 1. The tests found that no shared viewport resolver existed, the shell and drawer each resolved a surface independently, stale query and prefix-related PDP events overwrote the active page context, and an unchanged selected SKU did not re-dispatch after its URL changed.

### GREEN

- `GraceProvider` is now the sole `ResizeObserver`/window-resize owner. It uses `document.documentElement.clientWidth` (with `innerWidth` only as a zero-width fallback), resolves the drawer and surface once, and provides that immutable decision to both consumers. This makes a 1400 px `innerWidth` / 1399 px layout viewport select one overlay decision: backdrop on, zero inset, overlay drawer.
- The obsolete exported CSS-clamp constant was removed; the resolved width function is the remaining authoritative calculation.
- `ProductDetailClient` derives the current pathname/query URL reactively and includes it in the selection signature. Therefore unchanged options with a changed URL dispatch a current event.
- The provider updates its current URL ref during render, accepts only an event whose full route/query equals that URL, and clears stale event state after route/query changes. `mergePdpContextChange` independently requires exact pathname and URL equality, rejecting both stale queries and prefix-related product slugs.

```text
npx vitest run tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts tests/grace-catalog-navigation.test.ts tests/graceRefineState.test.ts tests/responsive-shell-contract.test.ts tests/pdp-stage-modes.test.ts tests/cylinder-v3-acceptance.test.ts tests/focused-pdp-purchase-panel.test.ts tests/pdp-discovery-sections.test.ts tests/pdp-relations.test.ts
```

Result: exit 0 — 10 files, 74 tests passed.

`npx tsc --noEmit`, changed-file ESLint, and `git diff --check` also exit 0.

### Existing unrelated test concern

The requested wider PDP command also ran `tests/focused-pdp-layout.test.ts`; it has two existing source-contract failures in untouched `src/components/products/ConfiguratorPdp.tsx` (`pdp-closure-rail` and `purchase={` expectations). The Task 8 report already identifies that suite's source-contract drift as deferred work. No Task 11 file touches that component, so this fix round preserves the behavior and records the failure rather than changing unrelated PDP layout code.

# Cart checkout clarity

Scope: the approved minimum/CTA/navigation clarification only. Stacked on PR #348, `codex/cart-recovery-approved-caps`, exact base `688370a400a99ac579fcaf9c0419e5923b3c961e`. Do not merge until Jordan explicitly approves. No production deployment or activation is authorized.

## Behavior

- Checkout remains primary and uses the unchanged `isCheckingOut || !minimum.met` disabled condition. `checkoutMinimum` and all checkout, quote, stock, pricing and wholesale policy code remain unchanged.
- Both cart surfaces show the remaining amount, minimum and **checkout-ready** subtotal directly beside Checkout. The button references the live, atomic status notice with `aria-describedby`.
- Quote-only value is explicitly excluded. Currency amounts use the existing `RegionProvider` formatter; converted estimates explain the fixed $50 USD minimum and USD checkout.
- The drawer's quieter Continue shopping button closes it, preserving the current route and focus behavior. Continue building appears only on the actual matrix page.
- Cart-page return links preserve the last browsing path and allowlisted structured browsing parameters in tab-scoped session storage. Free-text search, nested `from` URLs, unknown/auth/tracking parameters, unsafe parameter values, and all fragments are omitted. Existing stored returns are sanitized on tracker mount; hash-only changes intentionally have no effect. Only known internal shopping routes pass validation, including localized paths. External/auth/API/cart paths, control characters and encoded path tricks are rejected. Missing/unavailable storage falls back to `/catalog` (localized when applicable). No browser-history back redirect is used.
- A small scroll-containment change keeps the drawer footer reachable on short mobile screens with long quote/currency explanations.

## Validation

- Full suite: **303 files passed, 2 skipped; 2,766 tests passed, 7 skipped**.
- Focused tests after return-URL hardening: **82 passed**, including PR #348 cart recovery, minimum, readiness and existing wholesale fallback tests.
- Changed-file lint: clean. Full lint: **0 errors, 87 existing warnings**.
- Browser component fixture: 390×844 and 320×568; disabled minimum explanation, quote/currency state, scrollable footer, Continue shopping close, and keyboard focus wrap checked. Fixture stubs cart services and site chrome; it is not a live/authenticated Shopify checkout test.
- Exact-head CI/build results are recorded in the PR; historical results for d8081126 do not establish results for a later head. On the user's machine, default TypeScript resolution stalled reading unrelated iCloud-backed parent `Documents/node_modules`; a separate `/tmp` validation copy avoids that unrelated dependency tree.

## Explicit dependencies and limits

#348 owns cart persistence/recovery after checkout departure. This diff does not edit `CartProvider` or duplicate its fix. #346 and #349 pricing approaches are excluded. The reported PDP $59 → cart $62 and Shopify stock 100 → 50 remain separate unresolved work. Existing wholesale approval behavior is preserved, not newly validated against live services.

Follow-up recommendations, deliberately outside this patch: directly editable quantity input; larger drawer quantity/remove touch targets with item-specific accessible labels; review/undo for removal. No paid orders, inventory, address, authentication settings, live data changes, merge or production deployment were performed.

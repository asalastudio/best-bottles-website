# Homepage Upgrade Reference Lock

## Brief

Designing the Best Bottles homepage and Grace companion for beauty, fragrance, wellness, and packaging buyers on responsive web.

- Goal: Move customers from visual family recognition to application-led product discovery with fitment help always available.
- Tone: Premium, precise, tactile, and commercially clear.
- Risk: Replacing an effective branded hero with a generic redesign, or burying family/application entry points under oversized marketing sections.
- Must remember: Keep the existing full-width, Sanity-managed hero intact. Begin the new hierarchy immediately beneath it.
- Constraints: Existing type, palette, photography, Next.js/Sanity stack, real catalog routes, and persistent Grace context.

## Refero research summary

- Primary direction: NGLORA / Aesop-inspired apothecary retail — sharp rectangular surfaces, warm parchment, charcoal, disciplined serif/sans roles, specimen-like product imagery, and little to no shadow.
- Secondary structure: Subset — image-led, contained editorial merchandising with flat cards, compact density, and direct product/category labels.
- Hero discipline: entire studios — let a full-bleed image carry the first viewport while utility UI recedes.
- Footer pattern: AVNIER — dark utility footer with a compact service strip, clear link columns, newsletter/contact affordance, and a restrained legal rail.
- Companion pattern: Shop collection screen — persistent right-side workspace leaves the shopping surface available; Best Bottles adapts this as a true desktop push layout rather than a floating card.

## Reference lock

- Preserve: Current full-width homepage hero, existing Cormorant/Inter hierarchy, bone/obsidian/champagne palette, real bottle photography, sharp or 3px-max surfaces, and compact lower-page rhythm.
- Borrow only: Option 2's asymmetric editorial family mosaic and AVNIER's service-strip/footer hierarchy.
- Role rules: Muted gold remains an interaction/label accent; obsidian owns primary actions and the footer; serif is reserved for brand and display headings; product imagery remains the primary visual carrier.
- Media strategy: Keep the current Sanity hero and photographic family cards. Use the approved pencil-and-watercolor system only for application education and editorial collection stories, anchored to real Best Bottles product references. No fabricated photorealistic products or replacement hero.
- Reject: Split hero, rounded card grids, broad gradients, decorative shadows, generic lifestyle art, hidden application choices, and a floating Grace bubble after Grace is opened.
- Token commitments: Bone/warm-white page bands; obsidian text/footer/actions; champagne hairlines; muted-gold tertiary links; 0–3px radii; no card shadows; restrained motion only for reveal, hover crop, and drawer transition.

## Decision ledger

| Decision | Source | Role | Why |
| --- | --- | --- | --- |
| Keep the existing hero unchanged | User-provided current-site screenshot | Locked first viewport | It already carries the brand and is explicitly approved. |
| Use a large Cylinder tile beside two smaller family tiles and a wide Boston Round tile | User-selected Option 2 composition + Subset | Family merchandising | Creates recognition and gives Cylinder the strongest commercial priority without showing SKU noise. |
| Place application paths directly after families | User brief + Option 3 | Navigation | Matches how buyers describe dispensing needs and preserves the legacy hierarchy. |
| Use flat, sharp surfaces and thin rules | NGLORA | Core component treatment | Feels like precise packaging commerce and aligns with the existing design tokens. |
| Make Grace a full-height right push workspace on desktop | User brief + Shop collection pattern | Companion interaction | Keeps product browsing visible and preserves conversational/page context during navigation. |
| Add service strip, four compact link groups, direct contact/newsletter, and legal rail | AVNIER footer screen | Footer hierarchy | Turns the footer into useful navigation and reassurance instead of dead-end branding. |

# Prompt — Best Bottles UI design system

Paste into Claude Code / Claude Design at the repo root.

---

Build the UI design system for the Best Bottles storefront. This is a
**refinement and extraction**, not a rebrand: the incumbent visual identity
is correct and stays. The job is to give it structure, then raise the craft
to the level of the best B2B packaging suppliers in the world.

## Product truth

Best Bottles is a division of Nemat International (Union City, CA) selling
glass bottles and closures **B2B** — to brands, fillers and contract
manufacturers, not consumers. ~2,285 SKUs across ~360 product groups.

What makes a buyer succeed here is not desire, it is **certainty**:

- Will this closure fit this neck? (17-415, 18-415, 13-415 … fitment is the
  single most consequential fact on the site, and getting it wrong costs a
  customer a production run.)
- What does it cost at *my* volume? (5-tier price ladders, case quantities
  like "214 units/case", quote-based pricing above tier 2.)
- Can I see the exact combination I am buying? (a live 3D configurator on
  eligible families; photographic galleries elsewhere.)
- Can I get a sample, a quote, and a reorder without friction? (there is a
  logged-in B2B portal with orders, tracking, documents and drafts.)

So the design system must be built for **specification density and
confidence**, not lifestyle marketing. Most surfaces are *Operate* mode —
catalogue, PDP, portal — where scanability, consistency and trustworthy
data presentation outrank expression. Home and campaign pages are
*Persuade*. Brand lives in precise detail, not decoration.

## Stack

Next.js 16.2 (App Router) · React 19.2 · Tailwind **v4** (no config file —
tokens live in `@theme` inside `src/app/globals.css`) · Framer Motion 12 ·
CVA + clsx + tailwind-merge already installed · Convex backend · Clerk auth
· Sanity CMS · React Three Fiber for the 3D configurator.

## The incumbent visual world — preserve exactly

Already defined in `@theme`; treat as authority:

```
obsidian   #1D1D1F     bone       #F5F3EF     linen      #FAF8F5
muted-gold #C5A065     champagne  #D4C5A9     travertine #EEE6D4
slate      #637588     ash        #9A9590     ink        #2C2C2E
parchment  #ECE5D8     warm-white #FDFBF8     gold-dim   #8B6F42
```

Type: Inter (`--font-sans`) + EB Garamond (`--font-serif`). Warm, quiet,
gallery-like. shadcn semantic tokens are already mapped onto these
(`--color-primary` → muted-gold, etc.). **Do not introduce a new palette,
new brand fonts, or a new visual language.**

## What I measured — the actual debt

Do not re-derive this; it is current as of 2026-08-31.

1. **848 arbitrary Tailwind values** across `src/components` + `src/app`.
   The type scale is being invented inline: `text-[10px]` ×116,
   `text-[11px]` ×85, `text-[13px]` ×57, `text-[12px]` ×49, `text-[9px]`
   ×31, `text-[14px]` ×24, `text-[15px]` ×22 — seven ad-hoc micro sizes
   where `@theme` defines none. This is the single biggest reason the site
   reads as unstructured.
2. **Three letterspacings for one pattern:** `tracking-[0.18em]` ×29,
   `[0.2em]` ×17, `[0.25em]` ×17.
3. **The uppercase eyebrow label appears 109 times across 37 files** and
   has no component. It is the site's most-repeated element.
4. **The primitives layer exists but is unused.** `src/components/ui/`
   holds 10 files (button, card, badge, table, separator, progress …) yet
   there are **185 raw `<button>` elements** and exactly **1 file** imports
   the shadcn Button.
5. **Four files carry the system:** `ProductDetailClient.tsx` (2,581
   lines), `GraceProvider.tsx` (2,240), `CatalogClient.tsx` (2,168),
   `HomePage.tsx` (973). PDP and catalogue are monoliths.
6. **No PRODUCT.md and no DESIGN.md.** The visual system is real but
   undocumented, so every new surface re-invents it.
7. **9 raw `<img>`** remain against 19 files on `next/image`.

## Build this

1. **Complete the token layer** in `@theme`. Add what is being faked
   inline: a type scale that actually covers 9–15px (the B2B spec-table
   range) with semantic names, a letterspacing scale, spacing/radius/shadow
   scales, and motion tokens (durations + easings) matching the Framer
   Motion usage already in the code. Every token needs a comment saying
   what it is for.
2. **Codemod the arbitrary values onto tokens.** All 848. Where a value has
   no token, decide whether it needs one or should snap to the nearest —
   do not add a token per one-off.
3. **Build the missing primitives and adopt them.** At minimum: `Eyebrow`
   (the 109-instance label), `SpecTable` / `SpecRow` (the fitment and
   dimension blocks — this is the B2B heart of the PDP), `PriceLadder`
   (tiered volume pricing), `Swatch` / `SwatchRow` (colourway + trim
   pickers), `StatusPill`, `SectionHeader`, `Field`. Convert the 185 raw
   buttons to the CVA Button, extending its variants rather than adding
   one-offs.
4. **Decompose the four monoliths** into composed sections. `ProductDetailClient`
   should read as a page assembled from named blocks (gallery, buy box,
   fitment, compatibility, specs, related), each independently testable.
5. **Write DESIGN.md** documenting the system — tokens, primitives,
   patterns, the two modes, and the rules for adding a surface. Then
   PRODUCT.md for product truth.
6. **A `/design-system` route** rendering every token and primitive in every
   state, so drift is visible rather than discovered in production.

## Constraints

- **Do not touch the 3D lane.** `Bottle3DViewer.tsx`, `ProductStage.tsx`,
  `src/lib/materials/*`, `public/models/*` are governed by a separate
  render design system with locked, approved material values.
- Do not change product data, pricing, fitment logic or copy that asserts
  fact. Ask before rewriting any claim.
- No new dependencies without justification — CVA, clsx and tailwind-merge
  are already there.
- Preserve every existing route and behaviour; this is refactor + extract.
- Accessibility is not a phase: visible focus states, ≥4.5:1 body contrast
  (check muted-gold on linen and ash on warm-white — both are suspect),
  real labels on the 96 aria-labelled controls, keyboard paths through
  catalogue filters and the configurator.

## Acceptance

- Zero arbitrary type/tracking values in `src/components` and `src/app`.
- Raw `<button>` count in the double digits or lower, all justified.
- No file over ~600 lines in `src/app` or `src/components`.
- `/design-system` renders every token and primitive; a changed token
  visibly propagates there and across the site with no hand-editing.
- A new PDP section can be built from primitives with no new CSS.
- Lighthouse a11y ≥ 95 on home, catalogue and a PDP.

## Order of work

1. `/impeccable init` → PRODUCT.md, then `/impeccable document` → DESIGN.md
   from the incumbent code.
2. Token layer + `/design-system` route (nothing visual changes yet).
3. Primitives, built against real usages.
4. Codemod arbitraries → tokens, in reviewable batches by directory.
5. Decompose PDP, then catalogue.
6. `/impeccable audit` and `/impeccable polish` on home, catalogue, PDP,
   portal.

## Decide before starting

- **Density:** the current PDP is generous and gallery-like. Professional
  buyers comparing 40 SKUs may want a denser, more tabular catalogue. Is a
  compact/comfortable density switch in scope, or is one density correct?
- **Serif range:** EB Garamond currently carries product titles. Should it
  extend into editorial and section headers, or stay product-only?
- **Portal vs storefront:** one system with two densities, or a shared
  token layer with a distinct portal skin?

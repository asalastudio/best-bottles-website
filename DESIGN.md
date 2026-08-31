---
name: Best Bottles
description: Premium packaging commerce and operational truth, beautifully contained.
colors:
  obsidian: "#1D1D1F"
  bone: "#F5F3EF"
  muted-gold: "#C5A065"
  slate: "#637588"
  champagne: "#D4C5A9"
  linen: "#FAF8F5"
  travertine: "#EEE6D4"
  parchment: "#ECE5D8"
  warm-white: "#FDFBF8"
  ash: "#9A9590"
  ink: "#2C2C2E"
  gold-dim: "#8B6F42"
  executive-field: "#111216"
  executive-panel: "#18181B"
  executive-rule: "#27272A"
  status-positive: "#34D399"
  status-watch: "#FBBF24"
  status-risk: "#FB7185"
typography:
  display:
    fontFamily: "var(--font-eb-garamond), ui-serif, Georgia, serif"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  brand:
    fontFamily: "var(--font-cormorant), var(--font-eb-garamond), ui-serif, Georgia, serif"
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  square: "0px"
  sm: "0.25rem"
  md: "0.375rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.muted-gold}"
    textColor: "{colors.obsidian}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.5rem"
  card-storefront:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.obsidian}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
  card-executive:
    backgroundColor: "{colors.executive-panel}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.square}"
    padding: "1rem"
---

# Design System: Best Bottles

## Overview

**Creative North Star: “The Material Ledger”**

Best Bottles combines the tactile refinement of premium packaging materials with the exactness of a commercial specification sheet. The public storefront is warm, luminous, and product-led. Internal operating surfaces may become denser and darker when that improves scanning, but they retain the same serif authority, material gold, fine rules, and direct language.

The Executive Signal Board is an Operate-mode extension—not a replacement for the storefront identity. It uses an obsidian field and square, compact panels to make profitability, pipeline, supply, and CEO decisions legible in under five minutes.

**Key Characteristics:**

- Warm material neutrals with one restrained brass-gold accent.
- Editorial serif hierarchy joined to precise Inter utility text.
- Product truth, compatibility, source status, and exceptions stated explicitly.
- Flat, bordered surfaces; depth comes from tonal layering rather than decorative shadow.

## Colors

The storefront palette moves from bone through linen, travertine, parchment, and champagne. Obsidian supplies authority; muted gold marks action and emphasis without becoming ornamental.

The Executive Hub uses `executive-field`, `executive-panel`, and `executive-rule` only on trusted operating surfaces. `status-positive`, `status-watch`, and `status-risk` communicate semantic state and must always be accompanied by text.

**The Truth Before Color Rule.** Color never carries a source, risk, or availability state by itself. Write the status, coverage, and recovery path.

## Typography

EB Garamond is the editorial display voice, Cormorant is reserved for the Best Bottles brand mark and selected display moments, and Inter carries navigation, controls, specifications, prices, metrics, and body copy.

- **Display:** EB Garamond, 600, tight but no tighter than `-0.02em`; page and family titles.
- **Title:** EB Garamond or Inter according to context; serif for authority, sans for operational subheads.
- **Body:** Inter, 400, 1.5 line height; keep explanatory copy within roughly 65–75 characters per line.
- **Label:** Inter, 600, 10px with `0.14em` tracking; measurement and status metadata only. On dark surfaces use contrast-safe text (`zinc-400` equivalent or brighter).

## Layout

Public pages use warm full-width fields with centered content containers and responsive product grids. Spacing follows an 8px base rhythm with 12, 16, 24, and 32px steps.

The Executive Hub uses a compact desktop rail, a maximum content width near 1540px, and a 12-column grid. Its first row is intentionally unequal: performance receives five columns, future revenue four, and CEO attention three. On mobile, all panels stack; the CEO decision queue moves ahead of supporting operations. Date-range controls retain the layout but show explicit not-connected states when a source is unavailable.

## Elevation & Depth

The system is flat by default. Fine borders and controlled changes in neutral tone establish hierarchy. Wide ambient shadows are reserved for overlays and drawers that must separate from the page; operational cards do not combine shadows with borders.

## Shapes

The storefront uses a restrained 6px default radius for familiar controls and cards. Executive measurement panels are square, echoing ledgers, sample trays, and packaging specification sheets. Pills are limited to compact badges or statuses. Focus rings remain visible and use muted gold or the semantic ring token.

## Components

### Buttons

Primary storefront actions use muted gold with obsidian text. Executive action buttons may use brass-gold with custom dark ink. Hover changes tone rather than adding glow; keyboard focus uses a two-pixel visible ring.

### Cards and containers

Storefront cards use linen or warm white, champagne borders, and modest radii. Executive cards use `executive-panel`, graphite rules, square corners, 16–20px padding, and tabular numerals. A colored top rule is allowed only when paired with a written state.

### Navigation

Public navigation favors clear product taxonomy and generous touch targets. The Executive Hub uses a compact rail on desktop and an accessible Sheet on mobile. Unavailable lanes are visibly disabled and never presented as dead links.

### Detail sheets

Sheets preserve the originating context and expose source, timestamp, coverage, evidence, owner, and next action. Radix focus return and Escape dismissal are required.

## Do's and Don'ts

### Do

- **Do** preserve warm material neutrals and exact product language on customer-facing pages.
- **Do** distinguish source-backed, directional, stale, not-connected, and error states in words.
- **Do** show missing data honestly; never calculate a trend from a differently scoped fixture.
- **Do** preserve keyboard focus, 44px mobile targets where practical, and readable metadata contrast.

### Don't

- **Don't** apply the Executive Hub’s dark density to the public storefront by default.
- **Don't** use generic ecommerce vanity metrics as substitutes for packaging sales, inventory, supplier, customer, or margin truth.
- **Don't** use heavily rounded dashboard cards, decorative glow, gradient text, or shadow-heavy containers.
- **Don't** mix unlike physical platforms or neck finishes in a single product truth record.

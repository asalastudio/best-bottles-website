# Focused B2B Shopping and Split PDP Architecture

**Date:** 2026-09-03  
**Status:** Approved for implementation
**Implementation base:** `codex/restore-pdp-image-pipeline` at `3df2b635`  
**Working branch:** `codex/focused-pdp-shopping-architecture`

## 1. Decision

Best Bottles will use one catalog truth system behind four deliberately separate customer surfaces:

1. a family-first finder;
2. an application-first finder;
3. a focused, two-panel product details page (PDP);
4. the dedicated Order Matrix, presented to customers as **Build a Bottle** with the subtitle **Product Compatibility Matrix**.

Grace remains a persistent assistant across those surfaces. On supported desktop widths Grace pushes the page inward without replacing it. On smaller screens Grace opens as an overlay.

The finder does not replace the PDP. The matrix does not replace the finder. The PDP does not become a catalog-wide configurator. Each surface has one job.

The governing interaction principle is:

> Remember what the shopper already told us, show useful results immediately, and never require the shopper to choose the same thing twice.

## 2. Why this architecture

Best Bottles serves several buyer modes that cannot be compressed into one linear wizard without creating unnecessary friction:

- repeat buyers who know a website SKU;
- wholesale buyers who know a family, such as Cylinder;
- formulation-led buyers who know an application, such as Roll-On;
- technical buyers comparing bottle, neck, and component compatibility;
- newer buyers who need Grace to translate an intended use into catalog terminology.

A single hero configurator would make the common purchase path carry the complexity of the entire catalog. A mandatory wizard would slow down informed buyers and create backtracking. The approved architecture keeps the common path shallow while preserving a powerful comparison surface for advanced work.

### Approaches considered

#### A. Focused surfaces over shared product truth — selected

Family and application finders narrow the catalog. An exact product group opens a focused PDP. The matrix handles multi-component comparison. Grace helps at every point.

This creates the clearest boundaries, supports direct URLs and repeat ordering, and avoids forcing every customer through the same sequence.

#### B. One catalog-wide PDP configurator — rejected

This would expose roll-ons, sprayers, pumps, droppers, reducers, caps, sizes, glass finishes, and component finishes in the main buy box. It increases the risk of invalid combinations and makes an exact product page feel unresolved.

#### C. Mandatory step-by-step finder — rejected

A rigid Application -> Capacity -> Material -> Family sequence looks orderly but adds clicks, hides products before input is complete, and makes correction feel like going backward. The approved finder retains the logical order but treats each choice as an optional, reversible filter.

## 3. Experience model

### 3.1 The easiest path depends on buyer intent

| Buyer intent | Primary route | Expected destination |
|---|---|---|
| Knows the SKU or product name | Search or account reorder | Exact PDP |
| Knows the bottle family | Homepage family tile or navigation | Family finder |
| Knows the application | Homepage applicator tile or navigation | Application finder |
| Needs technical comparison | Build a Bottle | Product Compatibility Matrix |
| Needs guidance | Grace | Contextual finder, matrix, or exact PDP |

No route is treated as a prerequisite for another. A direct PDP remains fully usable.

Discovery is temporary; the resolved product identity is durable. Once a buyer has found
the right product, its canonical PDP URL must remain stable, shareable, bookmarkable, and
recoverable through exact SKU search or existing account reorder behavior. Returning buyers
must not be forced back through the finder.

### 3.2 Shared context contract

The family finder, application finder, Grace, and catalog use one serializable browse context:

```ts
type BrowseContext = {
  entryMode: "family" | "application" | "search" | "grace" | "matrix";
  family?: string;
  application?: string;
  capacity?: string;
  capacityBand?: string;
  rollerMaterial?: "metal" | "plastic";
  glassColor?: string;
  neckThread?: string;
};
```

This is a conceptual contract, not permission to create a competing local taxonomy. Values must use the existing canonical catalog vocabulary and URL normalization helpers.

The context must be represented in the URL whenever it affects the visible results. It survives navigation back from a PDP, browser refresh, and opening or closing Grace.

## 4. Family-first finder

### 4.1 Entry

Example:

`Homepage -> Cylinder Bottles -> /catalog/cylinder`

The page knows the family is Cylinder. The customer must never be asked to choose Cylinder again.

### 4.2 Page structure

The family page contains:

1. family identity and representative imagery;
2. verified application cards available for that family;
3. a live result area containing exact product groups;
4. compact, optional refinements relevant to the selected application;
5. a secondary link to Build a Bottle for advanced comparison.

Clicking **Roll-On** updates the route context to `family=Cylinder` and `application=rollon`, updates the result area in place, and moves focus to the results heading. It does not send the customer to a generic page where Cylinder must be selected again.

### 4.3 Refinement behavior

Once an application is selected:

- show matching Cylinder products immediately;
- expose only relevant refinements, such as Capacity and Roller Material for Roll-On;
- preserve the application cards as easy scope switches;
- update results without an Apply button;
- never silently substitute another family or application;
- link each exact result directly to its PDP.

If a chosen refinement leaves only one exact product group, the page still shows that result and does not auto-navigate. The customer remains in control.

## 5. Application-first finder

### 5.1 Entry

Example:

`Homepage -> Choose Your Applicator -> Roll-On`

The application is already Roll-On. The application selector may remain visible as a quick scope switch, but it is not a required first step.

The intended canonical route is a dedicated application surface such as:

`/catalog/application/roll-on`

Existing catalog query parameters remain valid inputs and can redirect or resolve into the same view. The implementation plan will preserve existing indexed and shared URLs.

### 5.2 Page structure

The Roll-On finder contains:

1. the selected application and concise use guidance;
2. optional Capacity and Roller Material controls;
3. a persistent selection summary;
4. live results grouped by bottle family;
5. exact product-group cards inside each matching family;
6. result count, sort, and clear-refinement actions;
7. Grace and Build a Bottle escape hatches.

Results are visible before the customer touches a filter. Selecting Capacity or Roller Material narrows the visible families and exact product groups in place.

### 5.3 Results are families with purchasable detail

The heading may say **Available bottle families**, but a broad family tile alone is not enough for a wholesale decision. Each matching family section must expose its exact purchasable product groups so the customer can proceed directly to a PDP.

Each exact result card should contain, when supported by catalog truth:

- approved product image;
- family and exact capacity;
- glass color or available color count;
- application and application-specific material;
- neck finish;
- stock or lead-time status;
- pack or case quantity;
- starting price and price per unit;
- direct PDP action.

The customer must not need to open a family card merely to discover the available size, thread, stock, or price.

### 5.4 Roll-On inventory example

The current fitment evidence supports these broad Roll-On family groupings:

| Capacity range | Candidate families |
|---|---|
| 4-6 mL | Cylinder, Sleek, Tulip |
| 8-10 mL | Sleek, Cylinder, Swirl, Rectangle, Queen |
| 12-15 mL | Bell, Royal, Rectangle, Flair, Square, Elegant |
| 30-60 mL | Cylinder, Boston Round |

This table is design evidence, not a runtime allowlist. The current grouped export and fitment evidence disagree on some identities, including Circle, Queen, Swirl, Bell capacity, and large Cylinder capacity naming. Runtime results must therefore come from reconciled live product groups and compatibility rules rather than a hard-coded family array.

## 6. Finder interaction rules

### 6.1 Progressive refinement, not a wizard

Application, Capacity, and application-specific material may be visually ordered, but the controls must not behave as numbered mandatory steps.

- No Next button.
- No Apply button for the primary finder controls.
- No separate page transition per selection.
- No hidden results until all fields are complete.
- No reset when switching one facet.
- No forced selection of dimensions that are not important to the buyer.

### 6.2 Availability-aware controls

Every filter option is calculated against the current result set.

- Valid options remain selectable and may show result counts.
- Impossible options are disabled with an accessible reason or omitted when they add no explanatory value.
- Out-of-stock products may remain discoverable when they are still legitimate catalog products, but their status must be explicit.
- A product that is not checkout eligible must not masquerade as purchasable.

### 6.3 Zero-result recovery

If a URL or restored state produces no result:

1. state that the exact combination is unavailable;
2. identify the narrowest conflicting refinement when possible;
3. offer one-click removal of that refinement;
4. show the closest truthful alternatives without silently changing the active filters;
5. offer Grace for fitment help.

### 6.4 Navigation memory

Returning from a PDP restores:

- the selected filters;
- result ordering;
- expanded family group;
- scroll position when practical.

## 7. Focused split PDP

### 7.1 Boundary

The PDP represents one exact purchasing intent, for example:

`9 mL Clear Cylinder Roll-On Bottle`

It is not where the customer chooses among Roll-On, Fine Mist Spray, Lotion Pump, Dropper, Reducer, and Antique Bulb. Those are alternate product intents and belong in the finder or the lower alternatives section.

### 7.2 Desktop composition

The primary workspace remains the approved two-panel layout:

- **Left:** a visually dominant product stage.
- **Right:** a compact purchase and configuration panel.

The target proportion is approximately 60-65% stage and 35-40% purchase panel at full width, adjusted responsively around actual content width rather than viewport width alone.

The stage uses the approved product plate or catalog image by default. Supported modes appear in a compact dock beneath it:

- Photo or Configure;
- 3D View;
- Exploded View;
- Dimensions.

A mode is shown only when the corresponding approved asset or data exists. Missing modes do not produce placeholders. Diva 46 remains photo-only because it has no approved 3D body.

### 7.3 Purchase panel hierarchy

The purchase panel presents:

1. family breadcrumb and product identity;
2. exact SKU;
3. capacity, material, neck finish, and selected application;
4. availability and fulfillment state;
5. price per unit and relevant case or pack pricing;
6. only the options valid within this product intent;
7. direct numeric quantity;
8. Add to Cart, Request Sample, or Request Quote as supported;
9. contextual Ask Grace action.

For a Roll-On PDP, valid primary options may include glass color, roller material, cap finish, pack quantity, and order quantity. Choosing a different real variant may navigate to or replace the underlying sibling product URL while preserving the visible stage state.

There is no decoration selector because the catalog does not offer decoration as a product option.

There is no application-type row in the primary purchase panel.

### 7.4 Lower PDP content

Content follows the buying workspace in this order:

1. **Also available in these sizes** — same family and same application, with the current size marked;
2. **Other ways to dispense** — clearly labeled alternative product intents;
3. **Compatible components** — verified supplementary or replacement parts;
4. technical specifications and dimensions;
5. volume pricing, case quantity, shipping, lead time, and fulfillment details;
6. subordinate related education or editorial content;
7. **Compare all compatible combinations** link to Build a Bottle.

Alternatives and compatible components must never be blended into one unlabeled recommendation rail. Compatibility-dependent items require exact fitment evidence.

### 7.5 Mobile composition

At mobile widths:

- stack the stage above the purchase panel;
- keep the mode dock compact and horizontally reachable;
- expose variant buttons without hiding critical choices in a dropdown;
- show a sticky purchase summary only after a real SKU resolves;
- keep core PDP sections in vertical scroll or vertically collapsed sections;
- do not create PDP subpages;
- open Grace as a full-screen or near-full-screen overlay;
- preserve the configured SKU and conversation state when Grace closes.

## 8. Grace behavior

### 8.1 Desktop

Grace is a persistent side drawer that pushes eligible catalog and product pages inward when sufficient content width remains. On the PDP, the product stage and purchase panel remain visible as the same two-panel workspace; Grace is not a third equal column.

The responsive layout must be container-aware:

- wide desktop: retain the two-panel PDP while Grace pushes;
- constrained desktop: reduce stage chrome and spacing before sacrificing product identity or purchase controls;
- below the safe content-width threshold: use an overlay instead of crushing the two panels.

Grace receives the current family, application, SKU, selected options, and browse context. Closing Grace restores the prior layout without resetting the conversation, filters, or PDP configuration. Only an explicit new-chat action resets the conversation.

### 8.2 Mobile

Grace remains visually compact until opened. It must not permanently consume bottom-navigation or PDP content space. The conversation opens over the page and returns the buyer to the exact prior state.

### 8.3 Grace navigation contract

When Grace recommends or opens a product:

- it uses the same canonical family, application, and capacity vocabulary as the site;
- it navigates to the finder when the result remains broad;
- it navigates directly to a PDP only when an exact product group is resolved;
- it never invents a compatible part or silently broadens an unavailable configuration.

## 9. Build a Bottle / Product Compatibility Matrix

The existing `/matrix` capability remains a dedicated advanced buying tool. Its customer-facing name becomes:

**Build a Bottle**  
**Product Compatibility Matrix**

The matrix is for buyers who need to compare multiple bottle and component relationships at once. It may expose more technical density than the regular finder or PDP.

Entry points include:

- catalog/navigation utility link;
- application finder secondary action;
- family finder secondary action;
- lower PDP action: **Compare all compatible combinations**;
- Grace when a customer asks a cross-component compatibility question.

The matrix and PDP must use the same compatibility resolver. A matrix result must not contradict the PDP's compatible-component section.

## 10. Product truth and data boundaries

### 10.1 Runtime truth

Finder and PDP availability must be derived from the intersection of:

- canonical product groups and their real variants;
- canonical family, application, capacity, color, and thread vocabulary;
- verified fitment rules;
- checkout eligibility and current stock/lead-time state;
- existing route and SKU identity.

Static audit artifacts such as `data/rollon_bottles_complete.json` may inform reconciliation and testing but must not become an independent runtime catalog.

Existing queries such as `getFamilyOverview`, `getApplicatorSiblings`, and `getSiblingGroups` may contribute to the shared resolver. The implementation should centralize browse matching rather than reproduce family arrays in multiple page components.

### 10.2 Protected image behavior

Implementation begins from the branch that contains:

- `5756e56a` — master-only PSD source enforcement;
- `3df2b635` — applicator-aware component photograph selection.

The following functions and their usage are protected:

- `componentPhotoSkuBelongsToBase`;
- `photoKeysForVariant`;
- `resolveCapOptionPhoto`.

Closure images must never be selected by display name or finish color alone. Sprayers, lotion pumps, droppers, reducers, and antique bulbs require their correct component-photo prefixes.

The only approved PSD source is:

`/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master`

This project does not authorize bulk inventory regeneration, bulk plate regeneration, legacy PSD restoration, or production Convex mutation.

### 10.3 Media fallbacks

- Kits currently exist only for the 9 mL family.
- Other PDPs continue to use their published plate and catalog-photo fallback.
- Missing 3D, kit, or plate media must not block a real product from being purchased.
- A broken or missing image follows the approved fallback chain and never borrows an unrelated product photograph.

## 11. Visual reference lock

### Primary direction

The existing Best Bottles brand system and the approved Cylinder family/PDP mockups are authoritative. The interface remains product-led, editorial, precise, and restrained.

### Preserve

- bone and light neutral canvas;
- obsidian typography and controls;
- muted-gold accent used sparingly for active scope and emphasis;
- serif product/family identity paired with compact sans-serif operational text;
- large, accurately framed product imagery;
- thin borders, sharp or minimally rounded geometry, and little to no decorative shadow;
- strong whitespace without withholding useful B2B information.

### Refero synthesis

- **UY Studio:** primary gallery-like structure, thin divisions, and precise spacing;
- **Abel:** product-image priority and generous restraint;
- **Sigmaphoto:** technical clarity, explicit selection states, and product-commerce confidence;
- **Emma Lewisham:** refined beauty-commerce hierarchy and quiet supporting surfaces.

These references inform hierarchy and interaction density. Their brand colors, typography, and proprietary visual identity are not copied.

### Reject

- generic rounded cards and floating shadows;
- decorative gradients unrelated to physical materials;
- a numbered wizard that hides results;
- invented lifestyle claims or product capabilities;
- product imagery cropped to make room for excessive controls;
- an always-visible Grace panel on mobile;
- a mega-configurator inside the PDP.

## 12. Accessibility and responsive requirements

- Every filter and variant control exposes selected, disabled, and unavailable states programmatically.
- Disabled options include an accessible explanation where the reason matters.
- Filter counts and live-result updates use non-disruptive status announcements.
- Focus moves predictably when an application card updates the results area.
- All primary touch targets are at least 44 by 44 CSS pixels.
- Product imagery has meaningful alternative text; decorative swatch imagery does not duplicate labels.
- Keyboard buyers can refine, inspect results, open a PDP, operate the mode dock, and purchase.
- At 390 px, no bottle, control label, price, stock state, or primary CTA is clipped.

## 13. Measurement

The implementation should instrument these events without sending product-sensitive or customer-sensitive data beyond the existing analytics policy:

- finder entry mode;
- refinement selected or removed;
- zero-result recovery;
- finder result opened;
- matrix opened from finder or PDP;
- Grace opened from finder or PDP;
- PDP variant resolved;
- Add to Cart, Request Sample, and Request Quote.

Initial success criteria:

- a family-first buyer is never asked to reselect the family;
- an application-first buyer sees products before applying refinements;
- a result can reach an exact PDP with one click;
- back navigation restores browse context;
- invalid-combination and zero-result rates are measurable;
- the focused PDP reduces application-switching interactions above the fold;
- direct SKU and repeat-order paths remain unchanged or become shorter;
- a previously resolved product can be reopened directly without replaying discovery.

## 14. Rollout boundary

The architecture is shared across the catalog, but activation is progressive so incomplete media coverage cannot block launch.

1. establish the shared browse context and truth resolver;
2. implement the application-first Roll-On finder and integrate family-preserving filtering on Cylinder;
3. refactor the 9 mL Cylinder Roll-On PDP as the reference split PDP;
4. integrate Grace's preserved push behavior and the existing `/matrix` entry points;
5. roll the focused PDP shell across supported product groups using approved photo fallbacks;
6. reconcile and activate additional application finders from live product truth.

This sequence is a rollout boundary, not an implementation task list. A detailed implementation plan will be written only after this specification is reviewed and approved.

## 15. Acceptance criteria

### Finder

- Family-first entry retains the family through application selection.
- Application-first entry preselects the application and shows immediate results.
- Capacity and application-specific material are optional live refinements.
- URLs reproduce the visible scope and selections.
- Result cards expose the B2B attributes needed before opening a PDP.
- Exact product results link directly to their focused PDPs.
- Zero-result states explain and recover without silent broadening.
- Family results come from product truth, not hard-coded mockup arrays.

### PDP

- Desktop uses the dominant stage plus purchase-panel composition.
- The primary panel contains only options valid for the current product intent.
- No decoration selector exists.
- No application-type switcher appears in the primary purchase panel.
- Image, SKU, specification, price, and availability remain synchronized.
- Also Available in These Sizes, Other Ways to Dispense, and Compatible Components remain distinct.
- Supported stage modes work; unsupported modes are absent.
- Mobile preserves the complete purchase path at 390 px.

### Grace and matrix

- Grace preserves finder and PDP context and does not reset on close.
- The split PDP remains usable while Grace pushes on sufficiently wide desktops.
- Constrained layouts use overlay behavior before the PDP becomes unusable.
- Build a Bottle remains separate and uses the same compatibility truth as the PDP.

### Safety and quality

- Protected image-selection functions remain intact.
- No legacy PSD source is restored.
- No production Convex data is mutated.
- No large inventory, selection, or cross-reference JSON is regenerated unintentionally.
- Unit, integration, catalog-truth, responsive browser, accessibility, touched-file lint, TypeScript, and production-build checks pass before implementation handoff.

# Catalog UX Verification Matrix

This matrix keeps the Paper Doll golden reference in the context of the complete Best Bottles catalog. It is a release contract, not a claim that physical-device testing has already passed.

## Automated contract coverage

| Case | Architecture | Required result |
|---|---|---|
| Cylinder 9 mL · 17-415 | Paper Doll | Exact platform; Build request remains explicit; selected SKU, price, stock, compatibility, and cart identity move together |
| Cylinder 9 mL · 13-415 roll-on | Conventional | Uses `/products/cylinder-9ml-clear-13-415-rollon`; never enters or redirects to the 17-415 platform |
| Boston Round | Conventional | Family Refine state and result count survive navigation |
| Elegant fine mist | Conventional | Family and applicator filters remain URL-backed |
| Diva | Conventional | Variation previews are accessible and preserve PDP identity |
| Empire | Conventional | Swatch interaction never causes accidental navigation |
| Bottle only | Conventional | The page does not imply a component is included |
| Lotion pump | Conventional | Grace inherits the delivery-system and compatibility constraints |
| Quote required | Conventional | Quote replaces checkout and carries product identity |
| Out of stock | Conventional | No silent SKU substitution; a next action is present |
| Incompatible | Conventional | Cart and Grace reject the mismatch without broadening size or neck finish |

The source contract lives in `src/lib/products/catalog-ux-matrix.ts`; `tests/catalog-ux-matrix.test.ts` ensures every required family, delivery mode, commercial state, and compatibility outcome remains represented.

## Manual viewport pass

Use a 1440×1000 desktop viewport and a 390×844 mobile viewport for every case. Confirm:

1. Search or direct entry preserves URL state.
2. Family and Refine counts agree with visible results.
3. Capacity and neck finish never broaden silently.
4. Beauty and Build states are explicit and honest.
5. Selection updates SKU, price, stock, compatible choices, and cart identity together.
6. Grace sees the exact current Refine and product state.
7. Checkout, quote, unavailable, and incompatible paths each end in a clear next action.
8. The desktop header does not clip and the mobile tab bar does not cover content, drawers, or CTAs.

## Real-device release pass

Before production release, repeat the journey on at least one current iPhone-class device and one Android-class device:

`Search → family → Refine → configure → Grace → cart → compatibility → checkout or quote`

Record device, OS, browser, case ID, result, and evidence. This section is deliberately marked **pending** until those physical-device runs are completed.

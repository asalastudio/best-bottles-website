# Vintage bulb visibility audit

The 25 mL clear Cylinder standard bulb chooser showed six finishes. Three exact
assemblies and their published kits exist, but their listed sprayer components
are out of stock:

| Assembly | Component | Finish |
| --- | --- | --- |
| GBcyl25AnSpIvyGl | AnSp18-415IvyGl | Ivory / gold collar |
| GBcyl25AnSpLvn | AnSp18-415Lvn | Lavender / silver collar |
| GBcyl25AnSpRed | AnSp18-415Red | Red / silver collar |

Fresh source checks on 2026-09-23 confirmed Out of Stock for each loose component:

- https://www.bestbottles.com/product/Vintage-antique-bulb-sprayer-ivory-gold
- https://www.bestbottles.com/product/Vintage-antique-bulb-sprayer-lavender
- https://www.bestbottles.com/product/Vintage-antique-bulb-sprayer-red

The ivory/gold assembly source also reports Out of Stock:
https://www.bestbottles.com/all-bottles/option_details.php?items_count=2&OPTinv_id=2057

Convex's complete assembly records currently say Available to order and have
Shopify sellability enabled. This conflicts with included-component availability.
No stock or publication records were changed by this fix.

## Correction

The display-only unavailable-finish resolver now handles current listed components
as well as retired identities with verified replacements. Exact finish, mechanism,
neck, listed relationship, image, and unambiguous identity checks remain required.
Unavailable components cannot enter purchasable configurations. Existing desktop
and mobile unavailable-option rendering displays these choices with an Out of stock
label. The family cache key changed so earlier cached chooser data is refreshed.

All nine standard finishes are accounted for: six available plus three unavailable.
The nine tassel variants have no corresponding missing-component gap in this audit.
Existing cutouts and kits are present; image regeneration is unnecessary.

Validation: 20 component regression tests passed; TypeScript passed.

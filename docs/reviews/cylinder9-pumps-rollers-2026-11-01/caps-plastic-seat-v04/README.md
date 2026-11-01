# Roll-on cap and plastic insert seating, revision 4

Library: `73cfb8f1df29`.

All 100 roll-on caps now sit at the approved fine-mist collar's visible bottom edge. This lowers each cap by 14.41 canvas pixels, approximately 1.37 mm at the registered scale, to close the exposed shoulder gap. The target comes from source row 995 of the approved black collar. Cap artwork, width and height are unchanged.

All 50 plastic inserts now use the same neck seating datum as the corrected metal inserts. This lowers the plastic housing and ball together by 4.49 canvas pixels, about 0.43 mm. The 50 metal inserts remain unchanged. All 145 bottle bodies, 30 fine-mist kits and 15 lotion kits are unchanged.

The pre-edit library/index, reported cap gap and previous plastic seating detail are preserved here. `registration-checks.json` records the exact scope and offsets. The existing layout tests verify fixed body positioning, component clearance, cap coverage and uncropped views. All 27 focused tests passed in four files.

These are local review adjustments. No production deployment or live-store update was made.

Browser checks passed 66 product-page states: all ten cap finishes on clear plastic-roller bottles plus the clear metal/Matte Silver example, across three views at desktop and mobile widths. Eleven exact-SKU builder selections passed. Cap/shoulder and plastic/rim close-ups plus the mobile exploded view were visually inspected. All 100 roll-on registrations are checked numerically; this does not claim new visual approval of every glass/finish combination.

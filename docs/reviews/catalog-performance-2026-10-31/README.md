# Catalog loading investigation

The Cylinder catalog loaded many tiny cap swatches as eager full-size CSS backgrounds and subscribed to assembly media already supplied by approved heroes. Cap photos now use 22 px lazy Next images, exact checked-in cap photos skip redundant family-index queries, and approved-hero cards fetch assembly plates only when a finish is selected. Fallback media queries remain for missing heroes/photos.

In matched local observations, the initial family image count fell from 127 to 12, image transfer from 1,284,535 to 55,471 bytes, and media subscriptions from 59 to 9. Desktop/mobile selections for the four 4 ml vial colors passed 24 states. These development observations are not a controlled speed benchmark: LCP did not improve in this run, and Next development compilation, caches and concurrent work affect timings. Do not describe this as a 96% faster page.

Validation: 33 distinct focused tests, TypeScript and targeted lint passed. Desktop/mobile scrolling and cap changes produced no browser errors. The read-only production check found the same eager-thumbnail pattern. Updated code has not been deployed by this work.

Database audit: 363 groups; no duplicate slugs. 2,283 plate records and 1,747 kit records completed their integrity pagination with zero reported issues. 309 groups lack cached primary SKU fields; the existing internal backfill was identified but not run. No deletion or database mutation was justified or performed. These checks cover the media/group paths, not every database table.

Remaining investigations: both responsive catalog grids are mounted, family responses include substantial variant payloads, and production timing needs a controlled preview comparison. The backend's 48-group page cap also remains. Preserve reviewed SKU choices before any primary-SKU backfill.

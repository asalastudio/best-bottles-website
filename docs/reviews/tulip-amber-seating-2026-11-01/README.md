# Tulip 5 ml Amber sprayer shoulder and mechanism correction

Jordan explicitly requested both the visible neck gap and the pale mechanism be corrected on November 1. All eight sprayer finishes now seat by the measured visible collar edge at shoulder Y 705.2824074074074. The nominal PNG boxes have different transparent margins and lower connector tails, so each finish has its own measured offset and lower clip. `visible-edge-measurements.json` preserves that evidence.

The seated dip tube uses opacity 0.18 and multiply blending behind the Amber body. The exploded tube keeps its natural material. Moving the mechanism with its sprayer also increases its physical lower trim by the same distance, preserving the approved interior-floor endpoint Y 1009. The body, sizing, source image bytes, closed overcaps and Clear Tulip are unchanged.

`before-kits.json`, `after-kits.json` and `adjustments.json` record the exact eight revisions. `apply.cjs` reproduces them from the immutable before snapshot. `verify.cjs` checks 48 product-page states, eight finishes across three views and two viewports. The shared hosted manifest and localhost overrides use these same recipes.

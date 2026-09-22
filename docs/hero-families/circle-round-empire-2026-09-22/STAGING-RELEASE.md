# Circle, Round and Empire approved staging release

Jordan approved the complete family sheets on September 22: “Those look totally good,” followed by “Everything looks awesome. Let's roll forward.” The 60 exact files and three reviewed sheet hashes are frozen in complete-family-approval.json. The existing 59 Cylinder exports are unchanged.

- Circle: 28 heroes, 27 exact catalog groups.
- Round: 21 heroes, 21 groups.
- Empire: 11 heroes, 11 groups. All eleven reuse existing renders with whole-photograph alignment; no new Empire generation occurred.
- Canvas: 2080 × 2288. Glass foot: 91%. Body-specific shoulder/closure-seat targets and measurement uncertainty are recorded per image. CSS framing remains identity, so the image is not resized a second time.
- The 39-image finishing batch reused 37 images and generated two connected-tassel corrections. The other 21 images are the selected frosted Circle/Round finals. Prior files and approvals remain preserved.

## Scope and activation

Set NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22 at build time to enable all 119 reviewed Cylinder/Circle/Round/Empire exports. The prior cylinder-2026-09-22 value continues to enable only Cylinder. With neither value, the production registry and existing Shopify priority remain unchanged. This release adds src/lib/products/catalog-hero-cre-pilot.json without modifying catalog-heroes.json or the Cylinder manifest/registry/assets.

Exact group and filtered SKU matching controls selection. Circle 15 mL metal and plastic rollers remain separate images within the same group. Product links carry the pictured exact SKU. This changes catalog heroes only; PDP galleries, Convex, Shopify, plates and kits are unchanged.

Use a frontend-only Vercel preview with BB_CONVEX_PREVIEW_DEPLOY=false and the families flag. Verify the immutable preview, then assign only the user-requested best-bottles-website.vercel.app staging alias. Do not promote a production deployment or merge as part of this staging release.

Rollback: the pre-release alias target was verified as https://best-bottles-website-7zsmhwcv2-asala.vercel.app (dpl_H496bJEznHhXXwemEsmxBA8HZYZc), containing all 59 Cylinder exports. Reassigning only the staging alias to that deployment restores the prior frontend.

## Validation

418 focused tests pass, including exact approved bytes, canvas dimensions, unchanged Cylinder behavior, filtered SKU identity, Shopify precedence and original production registry guards. TypeScript passes. The local catalog audit passes all 60 exact heroes across 36 filtered views: both catalog routes, desktop and mobile, decoded images, SKU links, plastic-roller selection, identity framing and no page errors. Deployment and public-byte results are recorded separately as they complete.

The two Empire white lotion-pump images retain their existing clear overcaps. No component or cap state was changed during reuse. Older pending labels in preserved review packets are historical; complete-family-approval.json is the current visual approval. Visual acceptance does not imply pixel-identical generated geometry or a new native resolution for reused source files.

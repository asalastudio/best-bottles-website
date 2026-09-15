/**
 * Legacy bestbottles.com → this site.
 *
 * The old site is PHP with capitalised, keyword-stuffed paths; every one of
 * these has ranking history and inbound links that a 404 would throw away.
 *
 * A Map rather than `redirects()` in next.config: Next evaluates redirect rules
 * in order as patterns, so a few hundred of them is a few hundred regex tests
 * on every request. A lookup is one hash, and this list only grows as more of
 * the 2,600-odd legacy pages are mapped.
 *
 * Keys are lower-cased and query-stripped, because the legacy URLs were shared
 * and linked with inconsistent casing and stray tracking parameters, and a
 * redirect that only fires on the exact original spelling misses most of the
 * traffic it exists for.
 *
 * Every destination in here is verified to return 200 by
 * tests/legacy-redirects.test.ts. That guard exists because the first version
 * of this map — hand-written during the May audit — pointed 47 of its 135
 * destinations at pages that were never built, chiefly /collections/<slug>
 * routes. Collections are catalogue FILTERS (/catalog?shop=<key>), not pages.
 * A 301 into a 404 is worse than no redirect at all: it spends the link equity
 * and still shows the visitor an error.
 */

/** Legacy path (lower-case, no query) → the path that replaces it. */
export const LEGACY_REDIRECTS: ReadonlyMap<string, string> = new Map([
    ["/about-us.php", "/about"],
    ["/about.php", "/about"],
    ["/all-bottles/accessories/caps-plugs-sprayers.php", "/catalog?shop=accessories-packaging"],
    ["/all-bottles/accessories/dropper-1ml-glass-rubber.php", "/products/dropper-1ml-glass-rubber"],
    ["/all-bottles/accessories/dropper-2ml-glass-rubber.php", "/products/dropper-2ml-glass-rubber"],
    ["/all-bottles/accessories/dropper-3ml-glass-rubber.php", "/products/dropper-3ml-glass-rubber"],
    ["/all-bottles/accessories/funnel-stainless-steel-large.php", "/products/funnel-stainless-steel-large"],
    ["/all-bottles/accessories/funnel-stainless-steel-small.php", "/products/funnel-stainless-steel-small"],
    ["/all-bottles/accessories/funnels-and-droppers.php", "/catalog?shop=accessories-packaging"],
    ["/all-bottles/accessories/gift-box-large-black.php", "/products/gift-box-large-black"],
    ["/all-bottles/accessories/gift-box-medium-kraft.php", "/products/gift-box-medium-kraft"],
    ["/all-bottles/accessories/gift-box-small-white.php", "/products/gift-box-small-white"],
    ["/all-bottles/accessories/gift-boxes.php", "/catalog?shop=accessories-packaging"],
    ["/all-bottles/accessories/organza-bag-medium-silver.php", "/products/organza-bag-medium-silver"],
    ["/all-bottles/accessories/organza-bag-small-gold.php", "/products/organza-bag-small-gold"],
    ["/all-bottles/accessories/reclosable-plastic-bags-shipping-boxes.php", "/catalog?shop=accessories-packaging"],
    ["/all-bottles/accessories/velvet-bag-medium-purple.php", "/products/velvet-bag-medium-purple"],
    ["/all-bottles/accessories/velvet-bag-small-black.php", "/products/velvet-bag-small-black"],
    ["/all-bottles/accessories/velvet-bags-organza-gusseted-bags-gift-box-information.php", "/blog"],
    ["/all-bottles/accessories/velvet-bags-organza-gusseted-bags-gift-box-purchase.php", "/catalog?shop=accessories-packaging"],
    ["/all-bottles/accessories/velvet-bags-organza-gusseted-bags-wedding-favor.php", "/catalog?shop=accessories-packaging"],
    ["/all-bottles/lotion-pump-cream-jars/cream-jar-100ml-clear-gold-cap.php", "/products/cream-jar-100ml-clear-gold-cap"],
    ["/all-bottles/lotion-pump-cream-jars/cream-jar-15ml-amber-bamboo-cap.php", "/products/cream-jar-15ml-amber-bamboo-cap"],
    ["/all-bottles/lotion-pump-cream-jars/cream-jar-30ml-clear-gold-cap.php", "/products/cream-jar-30ml-clear-gold-cap"],
    ["/all-bottles/lotion-pump-cream-jars/cream-jar-50ml-frosted-silver-cap.php", "/products/cream-jar-50ml-frosted-silver-cap"],
    ["/all-bottles/lotion-pump-cream-jars/cream-jars-gold-silver-caps.php", "/catalog?shop=cream-jars"],
    ["/all-bottles/lotion-pump-cream-jars/lotion-bottle-100ml-amber-pump.php", "/products/lotion-bottle-100ml-amber-pump"],
    ["/all-bottles/lotion-pump-cream-jars/lotion-bottle-250ml-white-pump.php", "/products/lotion-bottle-250ml-white-pump"],
    ["/all-bottles/lotion-pump-cream-jars/lotion-bottle-500ml-clear-pump.php", "/products/lotion-bottle-500ml-clear-pump"],
    ["/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles-cream-jars-information.php", "/blog"],
    ["/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles-cream-jars-purchase.php", "/catalog?shop=cream-jars"],
    ["/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles.php", "/catalog?shop=lotion-pump-bottles"],
    ["/all-bottles/lotion-pump-cream-jars/treatment-pump-30ml-silver.php", "/products/treatment-pump-30ml-silver"],
    ["/all-bottles/lotion-pump-cream-jars/treatment-pump-50ml-gold.php", "/products/treatment-pump-50ml-gold"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/antique-bulb-spray-50ml-amber.php", "/products/antique-bulb-spray-50ml-amber"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/antique-style-bulb-spray-bottles.php", "/catalog?shop=glass-spray-bottles"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/bestbottles-metal-shell-perfume-atomizers.php", "/catalog?shop=perfume-atomizers"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/brushed-aluminum-100ml-gold-spray.php", "/products/brushed-aluminum-100ml-gold-spray"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/brushed-aluminum-50ml-silver-spray.php", "/products/brushed-aluminum-50ml-silver-spray"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/brushed-aluminum-bottles-sprayers-cans.php", "/catalog?shop=perfume-atomizers"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/classic-perfume-spray-30ml-clear.php", "/products/classic-perfume-spray-30ml-clear"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/classic-perfume-spray-bottles.php", "/catalog?shop=glass-spray-bottles"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/glass-bottles-fine-mist-sprayers.php", "/catalog?shop=glass-spray-bottles"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/glass-fine-mist-100ml-clear-spray.php", "/products/glass-fine-mist-100ml-clear-spray"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/glass-fine-mist-15ml-amber-spray.php", "/products/glass-fine-mist-15ml-amber-spray"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/glass-fine-mist-30ml-clear-spray.php", "/products/glass-fine-mist-30ml-clear-spray"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/glass-fine-mist-50ml-frosted-spray.php", "/products/glass-fine-mist-50ml-frosted-spray"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/metal-shell-atomizer-10ml-gold.php", "/products/metal-shell-atomizer-10ml-gold"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/metal-shell-atomizer-15ml-gold.php", "/products/metal-shell-atomizer-15ml-gold"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/metal-shell-atomizer-30ml-silver.php", "/products/metal-shell-atomizer-30ml-silver"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/metal-shell-atomizer-5ml-silver.php", "/products/metal-shell-atomizer-5ml-silver"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/perfume-atomizer-aluminum-bottle-cans-information.php", "/blog"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/perfume-atomizer-aluminum-bottle-cans-purchase.php", "/catalog?shop=perfume-atomizers"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/plastic-bottles-fine-mist-sprayers.php", "/catalog?shop=glass-spray-bottles"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/plastic-fine-mist-50ml-clear-spray.php", "/products/plastic-fine-mist-50ml-clear-spray"],
    ["/all-bottles/perfume-vials-glass-bottles/apothecary-100ml-clear-stopper.php", "/products/apothecary-100ml-clear-stopper"],
    ["/all-bottles/perfume-vials-glass-bottles/apothecary-250ml-amber-stopper.php", "/products/apothecary-250ml-amber-stopper"],
    ["/all-bottles/perfume-vials-glass-bottles/apothecary-style-bottles.php", "/catalog?shop=apothecary-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-120ml-amber-dropper.php", "/products/boston-round-120ml-amber-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-120ml-clear-dropper.php", "/products/boston-round-120ml-clear-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-15ml-amber-dropper.php", "/products/boston-round-15ml-amber-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-30ml-amber-dropper.php", "/products/boston-round-30ml-amber-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-30ml-clear-dropper.php", "/products/boston-round-30ml-clear-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-30ml-cobalt-blue-dropper.php", "/products/boston-round-30ml-cobalt-blue-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-60ml-amber-dropper.php", "/products/boston-round-60ml-amber-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/boston-round-60ml-cobalt-blue-dropper.php", "/products/boston-round-60ml-cobalt-blue-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/cylinder-15ml-amber.php", "/products/cylinder-15ml-amber"],
    ["/all-bottles/perfume-vials-glass-bottles/cylinder-30ml-amber-dropper.php", "/products/cylinder-30ml-amber-dropper"],
    ["/all-bottles/perfume-vials-glass-bottles/cylinder-30ml-clear-spray.php", "/products/cylinder-30ml-clear-spray"],
    ["/all-bottles/perfume-vials-glass-bottles/cylinder-50ml-frosted-spray.php", "/products/cylinder-50ml-frosted-spray"],
    ["/all-bottles/perfume-vials-glass-bottles/cylinder-5ml-clear.php", "/products/cylinder-5ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/cylinder-9ml-clear.php", "/products/cylinder-9ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/empire-100ml-amber-cap.php", "/products/empire-100ml-amber"],
    ["/all-bottles/perfume-vials-glass-bottles/empire-100ml-clear-cap.php", "/products/empire-100ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/empire-100ml-cobalt-blue.php", "/products/empire-100ml-cobalt-blue"],
    ["/all-bottles/perfume-vials-glass-bottles/empire-50ml-amber-cap.php", "/products/empire-50ml-amber"],
    ["/all-bottles/perfume-vials-glass-bottles/empire-50ml-clear-cap.php", "/products/empire-50ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/empire-50ml-cobalt-blue.php", "/products/empire-50ml-cobalt-blue"],
    ["/all-bottles/perfume-vials-glass-bottles/genie-50ml-decorative-bottle.php", "/products/genie-50ml-decorative"],
    ["/all-bottles/perfume-vials-glass-bottles/glass-stopper-100ml-clear.php", "/products/glass-stopper-100ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/heart-shape-15ml-clear-perfume-bottle.php", "/products/heart-shape-15ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/keychain-cap-10ml-decorative.php", "/products/keychain-cap-10ml-decorative"],
    ["/all-bottles/perfume-vials-glass-bottles/large-perfume-bottles-decorative-apothecary-style-bottles.php", "/catalog?shop=apothecary-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/large-perfume-bottles-decorative.php", "/catalog?shop=decorative-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/octagonal-30ml-clear.php", "/products/octagonal-30ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/octagonal-50ml-amber.php", "/products/octagonal-50ml-amber"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-bottles-with-metal-and-beads.php", "/catalog?shop=decorative-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-glas-bottle-vials-purchase.php", "/catalog?shop=sample-vials"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-glass-bottles-vials-information.php", "/blog"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-10ml-clear-dab.php", "/products/perfume-vial-10ml-clear-dab"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-1ml-clear-dab.php", "/products/perfume-vial-1ml-clear-dab"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-2ml-clear-dab.php", "/products/perfume-vial-2ml-clear-dab"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-3ml-amber-dab.php", "/products/perfume-vial-3ml-amber-dab"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-3ml-clear-dab.php", "/products/perfume-vial-3ml-clear-dab"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-5ml-clear-glass-stopper.php", "/products/perfume-vial-5ml-clear-glass-stopper"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vial-5ml-cobalt-blue-dab.php", "/products/perfume-vial-5ml-cobalt-blue-dab"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php", "/catalog?shop=sample-vials"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-bottle-10ml-amber-metal-roller.php", "/products/roll-on-10ml-amber-metal-roller"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-bottle-10ml-clear-glass-roller.php", "/products/roll-on-10ml-clear-glass-roller"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-bottle-10ml-frosted-glass-roller.php", "/products/roll-on-10ml-frosted-glass-roller"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-bottle-15ml-clear-roller.php", "/products/roll-on-15ml-clear-roller"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-bottle-5ml-cobalt-blue-roller.php", "/products/roll-on-5ml-cobalt-blue-roller"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php", "/catalog?shop=roll-on-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php", "/catalog?shop=decorative-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/sun-moon-30ml-clear-decorative.php", "/products/sun-moon-30ml-clear"],
    ["/all-bottles/perfume-vials-glass-bottles/tassel-cap-15ml-decorative.php", "/products/tassel-cap-15ml-decorative"],
    // INTERIM. The May audit's intent is that /bestbottles-compressed.pdf
    // SERVES the catalogue PDF at that exact filename, so external buyer-guide
    // links do not rot, and that these two alternates 301 to it. The file was
    // never placed in /public, so pointing at it would 301 into a 404 — the
    // precise failure this whole map exists to avoid. Restore the PDF and
    // change both of these back to "/bestbottles-compressed.pdf".
    ["/bestbottles-catalog.pdf", "/catalog"],
    ["/catalog.pdf", "/catalog"],
    ["/contact-us.php", "/contact"],
    ["/default.php", "/"],
    ["/faq.php", "/resources"],
    ["/feed.php", "/blog"],
    ["/filling-capping-labeling-perfume-bottles-atomizers.php", "/contact"],
    ["/home.php", "/"],
    ["/index.php", "/"],
    ["/login", "/sign-in"],
    ["/login.php", "/sign-in"],
    ["/personalize.php", "/contact"],
    ["/privacy-policy.php", "/privacy"],
    ["/privacy.php", "/privacy"],
    ["/product-packaging-ideas.php", "/blog"],
    ["/register.php", "/sign-up"],
    ["/returns.php", "/resources#returns"],
    ["/rss.php", "/blog"],
    ["/search", "/catalog"],
    ["/search.php", "/catalog"],
    ["/shipping.php", "/resources#shipping"],
    ["/sitemap.php", "/sitemap.xml"],
    ["/terms-conditions.php", "/terms"],
    ["/terms.php", "/terms"],
]);

/**
 * Legacy paths whose destination depends on a query parameter.
 *
 * The old site used `?subcat=NN` to split one PHP page into several listings,
 * and those subcategories did NOT all become the same thing here — subcat 64,
 * 65 and 66 on one path lead to sample vials, the whole catalogue, and Boston
 * Round respectively. Stripping the query would collapse three destinations
 * into one and send two thirds of that traffic somewhere it did not ask for.
 *
 * Keyed on `pathname?subcat=value`, checked before the path-only map.
 */
export const LEGACY_QUERY_REDIRECTS: ReadonlyMap<string, string> = new Map([
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/brushed-aluminum-bottles-sprayers-cans.php?subcat=75", "/catalog?shop=perfume-atomizers"],
    ["/all-bottles/perfume-atomizer-aluminum-bottle-cans/brushed-aluminum-bottles-sprayers-cans.php?subcat=76", "/catalog?shop=perfume-atomizers"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php?subcat=64", "/catalog?shop=sample-vials"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php?subcat=65", "/catalog"],
    ["/all-bottles/perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php?subcat=66", "/catalog/boston-round"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php?subcat=67", "/catalog?shop=roll-on-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php?subcat=68", "/catalog?shop=roll-on-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php?subcat=69", "/catalog?shop=roll-on-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php?subcat=70", "/catalog?shop=roll-on-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php?subcat=15", "/catalog?shop=decorative-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php?subcat=16", "/catalog?shop=decorative-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php?subcat=71", "/catalog?shop=decorative-bottles"],
    ["/all-bottles/perfume-vials-glass-bottles/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php?subcat=72", "/catalog?shop=decorative-bottles"],
]);

/**
 * Resolve a legacy URL, or null when it is not one of ours.
 *
 * The query-specific map wins, since it is the more precise statement about
 * where a given page went. Trailing slashes are tried both ways: the legacy
 * site linked its own pages inconsistently and search engines indexed both.
 */
export function resolveLegacyRedirect(
    pathname: string,
    searchParams?: URLSearchParams,
): string | null {
    const key = pathname.toLowerCase();

    const subcat = searchParams?.get("subcat");
    if (subcat) {
        const specific = LEGACY_QUERY_REDIRECTS.get(`${key}?subcat=${subcat.toLowerCase()}`);
        if (specific) return specific;
    }

    const direct = LEGACY_REDIRECTS.get(key);
    if (direct) return direct;

    const trimmed = key.endsWith("/") ? key.slice(0, -1) : `${key}/`;
    const slashed = LEGACY_REDIRECTS.get(trimmed);
    if (slashed) return slashed;

    return legacyFallback(key);
}

/**
 * Where an UNMAPPED legacy URL goes.
 *
 * The old site had roughly 2,600 pages and this map covers the ones the audit
 * identified; the rest still need an answer that is not a 404. These rules used
 * to live in next.config as catch-all patterns, which was actively harmful in
 * two ways.
 *
 * First, next.config redirects run BEFORE middleware, so `/all-bottles/:path*`
 * swallowed every legacy URL to the generic catalogue — the specific map below
 * it could never fire, and a link about roll-on bottles landed on all 2,285
 * SKUs.
 *
 * Second, `/:path*.php` sent everything else to the HOMEPAGE. A redirect to a
 * page unrelated to the original is what Google calls a soft 404: it transfers
 * no ranking and the visitor has to start their search again. The catalogue is
 * the honest destination, because a legacy .php page here was a product or a
 * category listing — never the front page.
 */
function legacyFallback(pathname: string): string | null {
    if (pathname.startsWith("/all-bottles/") || pathname === "/all-bottles") return "/catalog";
    if (pathname.endsWith(".php")) return "/catalog";
    return null;
}

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { defaultLocale, ogLocale, type AppLocale } from "./config";
import { localizeHref, stripLocalePrefix } from "./paths";

export function localizedAbsoluteUrl(locale: AppLocale, pathname: string): string {
    const path = localizeHref(locale, stripLocalePrefix(pathname) || "/");
    if (path === "/") return SITE_URL;
    return `${SITE_URL}${path}`;
}

/**
 * The routes whose copy exists in both messages/en.json and messages/es.json
 * (home, catalog, catalog families, collections, bottle families). Only these
 * advertise a Spanish alternate. Every other route serves English copy under
 * /es/… too, so it canonicalises to its English URL and advertises no
 * hreflang: an hreflang pair whose pages differ only in chrome would tell
 * search engines two languages exist where one does.
 */
export function isTranslatedPath(pathname: string): boolean {
    const stripped = stripLocalePrefix(pathname.split("?")[0] ?? pathname) || "/";
    if (stripped === "/" || stripped === "/catalog" || stripped === "/collections" || stripped === "/bottle-families") return true;
    // /catalog/<family> is translated; /catalog/application/<application> is not.
    const family = stripped.match(/^\/catalog\/([^/]+)$/);
    return family !== null && family[1] !== "application";
}

export function buildHreflangAlternates(pathname: string): NonNullable<Metadata["alternates"]> {
    const stripped = stripLocalePrefix(pathname) || "/";
    const en = localizedAbsoluteUrl("en", stripped);
    const es = localizedAbsoluteUrl("es", stripped);
    return {
        canonical: localizedAbsoluteUrl(
            pathname.startsWith("/es") ? "es" : defaultLocale,
            stripped,
        ),
        languages: {
            en,
            es,
            "x-default": en,
        },
    };
}

/**
 * The one `alternates` every page sets. A translated route gets a
 * self-referential canonical in its own locale plus the en/es/x-default
 * hreflang set; any other route gets the English canonical alone. Next merges
 * metadata shallowly, so a page's `alternates` replaces the root layout's: the
 * root therefore emits hreflang only for translated routes as well, and a page
 * that does not call this helper (cart, portal, sign-in) inherits nothing.
 *
 * `canonicalPath` names a different page as the canonical version, for pages
 * that only redirect or refine another page (the application finder, the
 * 30 ml Boston Round collection stub).
 */
export function pageAlternates(pathname: string, canonicalPath?: string): NonNullable<Metadata["alternates"]> {
    if (canonicalPath === undefined && isTranslatedPath(pathname)) return buildHreflangAlternates(pathname);
    const target = stripLocalePrefix(canonicalPath ?? pathname) || "/";
    return { canonical: target === "/" ? SITE_URL : `${SITE_URL}${target}` };
}

export function localeOpenGraph(locale: AppLocale, pathname: string) {
    return {
        locale: ogLocale(locale),
        url: localizedAbsoluteUrl(locale, pathname),
    };
}

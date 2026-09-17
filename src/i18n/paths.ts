import {
    defaultLocale,
    isEnglishOnlyPath,
    type AppLocale,
} from "./config";

function splitHref(href: string): { path: string; query: string; hash: string } {
    const hashIndex = href.indexOf("#");
    const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
    const queryIndex = withoutHash.indexOf("?");
    const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
    return { path, query, hash };
}

export function hasLocalePrefix(pathname: string): boolean {
    return pathname === "/es" || pathname.startsWith("/es/");
}

export function stripLocalePrefix(pathname: string): string {
    if (pathname === "/es") return "/";
    if (pathname.startsWith("/es/")) {
        const stripped = pathname.slice(3);
        return stripped.length > 0 ? stripped : "/";
    }
    return pathname;
}

export function localizeHref(locale: AppLocale, href: string): string {
    if (!href.startsWith("/") || href.startsWith("//")) return href;
    const { path, query, hash } = splitHref(href);
    if (isEnglishOnlyPath(path)) return href;
    const stripped = stripLocalePrefix(path);
    const prefixed = locale === "es"
        ? (stripped === "/" ? "/es" : `/es${stripped}`)
        : stripped;
    return `${prefixed}${query}${hash}`;
}

export function switchLocaleHref(
    nextLocale: AppLocale,
    pathname: string,
    search = "",
): string {
    const stripped = stripLocalePrefix(pathname);
    const query = search && !search.startsWith("?") ? `?${search}` : search;
    return localizeHref(nextLocale, `${stripped}${query}`);
}

export function withCurrentLocale(locale: AppLocale, href: string): string {
    return localizeHref(locale, href);
}

export function localeFromPathname(pathname: string): AppLocale {
    return hasLocalePrefix(pathname) ? "es" : defaultLocale;
}

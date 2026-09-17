import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { defaultLocale, ogLocale, type AppLocale } from "./config";
import { localizeHref, stripLocalePrefix } from "./paths";

export function localizedAbsoluteUrl(locale: AppLocale, pathname: string): string {
    const path = localizeHref(locale, stripLocalePrefix(pathname) || "/");
    if (path === "/") return SITE_URL;
    return `${SITE_URL}${path}`;
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

export function localeOpenGraph(locale: AppLocale, pathname: string) {
    return {
        locale: ogLocale(locale),
        url: localizedAbsoluteUrl(locale, pathname),
    };
}

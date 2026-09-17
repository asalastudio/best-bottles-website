export const locales = ["en", "es"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export const LOCALE_HEADER = "x-bb-locale";
export const PATHNAME_HEADER = "x-bb-pathname";

/** Internal and account surfaces stay English in v1. Do not prefix or rewrite them. */
export const ENGLISH_ONLY_PREFIXES = [
    "/portal",
    "/api",
    "/trpc",
    "/team",
    "/executive",
    "/lab",
    "/dev",
    "/studio",
    "/sign-in",
    "/sign-up",
    "/grace-workspace",
    "/ingest",
    "/monitoring-tunnel",
] as const;

export function isLocale(value: string | null | undefined): value is AppLocale {
    return value === "en" || value === "es";
}

export function isEnglishOnlyPath(pathname: string): boolean {
    const path = pathname.split("?")[0] ?? pathname;
    return ENGLISH_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function ogLocale(locale: AppLocale): string {
    return locale === "es" ? "es_ES" : "en_US";
}

import {
    isEnglishOnlyPath,
    type AppLocale,
} from "./config";
import { hasLocalePrefix, stripLocalePrefix } from "./paths";

export type LocaleResolution =
    | { kind: "next"; locale: AppLocale; pathname: string }
    | { kind: "rewrite"; locale: "es"; pathname: string; rewritePath: string }
    | { kind: "redirect"; locale: "en"; pathname: string; redirectPath: string };

/**
 * URL is the source of truth. `/es/...` is Spanish; unprefixed public routes
 * are English. Internal surfaces never keep the Spanish prefix.
 */
export function resolveLocale(pathname: string): LocaleResolution {
    if (!hasLocalePrefix(pathname)) {
        return { kind: "next", locale: "en", pathname };
    }

    const stripped = stripLocalePrefix(pathname);
    if (isEnglishOnlyPath(stripped)) {
        return { kind: "redirect", locale: "en", pathname, redirectPath: stripped };
    }

    return { kind: "rewrite", locale: "es", pathname, rewritePath: stripped };
}

/** Next re-invokes proxy on the rewrite destination; keep Spanish from the first pass. */
export function localeAfterProxyPass(pathname: string, incomingLocale: string | null): AppLocale {
    const resolved = resolveLocale(pathname);
    return resolved.locale === "es" || incomingLocale === "es" ? "es" : "en";
}

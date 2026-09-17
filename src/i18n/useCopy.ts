"use client";

import { useLocale, useTranslations } from "next-intl";
import en from "../../messages/en.json";
import { defaultLocale, type AppLocale } from "./config";

type MessageNamespace = keyof typeof en;

function lookupEnglish(namespace: MessageNamespace, key: string, values?: Record<string, string | number>): string {
    const dict = en[namespace] as Record<string, string>;
    const template = dict[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

/**
 * next-intl hook with an English fallback so unit tests that render chrome
 * without NextIntlClientProvider still produce the live English copy.
 */
export function useCopy(namespace: MessageNamespace) {
    try {
        return useTranslations(namespace);
    } catch {
        const t = ((key: string, values?: Record<string, string | number>) =>
            lookupEnglish(namespace, key, values)) as ReturnType<typeof useTranslations>;
        return t;
    }
}

export function useAppLocale(): AppLocale {
    try {
        const locale = useLocale();
        return locale === "es" ? "es" : defaultLocale;
    } catch {
        return defaultLocale;
    }
}

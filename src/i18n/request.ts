import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, isLocale, LOCALE_HEADER, type AppLocale } from "./config";

const messageLoaders: Record<AppLocale, () => Promise<{ default: Record<string, unknown> }>> = {
    en: () => import("../../messages/en.json"),
    es: () => import("../../messages/es.json"),
};

export default getRequestConfig(async () => {
    const headerLocale = (await headers()).get(LOCALE_HEADER);
    const locale = isLocale(headerLocale) ? headerLocale : defaultLocale;
    const messages = (await messageLoaders[locale]()).default;
    return { locale, messages };
});

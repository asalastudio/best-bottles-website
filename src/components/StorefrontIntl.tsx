"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";
import { defaultLocale, type AppLocale } from "@/i18n/config";

/**
 * English messages are the static shell. Spanish is a path prefix (`/es`),
 * applied after paint so the root layout can stay cacheable. The first client
 * render matches the server HTML.
 */
export default function StorefrontIntl({ children }: { children: ReactNode }) {
    const [locale, setLocale] = useState<AppLocale>(defaultLocale);
    const [messages, setMessages] = useState(enMessages);

    useEffect(() => {
        const path = window.location.pathname;
        if (path !== "/es" && !path.startsWith("/es/")) return;
        let cancelled = false;
        void import("../../messages/es.json").then((mod) => {
            if (cancelled) return;
            setLocale("es");
            setMessages(mod.default);
            document.documentElement.lang = "es";
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}

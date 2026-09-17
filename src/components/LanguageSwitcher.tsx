"use client";

import { useRouter } from "next/navigation";
import { locales, type AppLocale } from "@/i18n/config";
import { switchLocaleHref } from "@/i18n/paths";
import { useAppLocale, useCopy } from "@/i18n/useCopy";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    const locale = useAppLocale();
    const router = useRouter();
    const t = useCopy("language");

    function go(next: AppLocale) {
        const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
        const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
        router.push(switchLocaleHref(next, pathname, search));
    }

    const classes = [styles.root, compact ? styles.compact : "", className ?? ""].filter(Boolean).join(" ");

    return (
        <div className={classes} role="navigation" aria-label={t("label")}>
            {locales.map((code, index) => (
                <span key={code} className={styles.item}>
                    {index > 0 && <span className={styles.rule} aria-hidden="true">|</span>}
                    <button
                        type="button"
                        className={styles.option}
                        aria-pressed={locale === code}
                        aria-label={t(code)}
                        onClick={() => go(code)}
                    >
                        {code.toUpperCase()}
                    </button>
                </span>
            ))}
        </div>
    );
}

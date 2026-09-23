"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { localizeHref } from "@/i18n/paths";
import { useAppLocale } from "@/i18n/useCopy";

type LocaleLinkProps = ComponentProps<typeof Link>;

export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
    const locale = useAppLocale();
    const localized = typeof href === "string" ? localizeHref(locale, href) : href;
    return <Link href={localized} {...props} />;
}

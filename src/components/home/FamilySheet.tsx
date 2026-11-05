"use client";

/*
 * Phones: "Shop bottles" opens this full-screen sheet of bottle shapes (Jordan, 4 Nov 2026: the button dropped buyers
 * on the 1 ml vial; "the whole page opens up where it shows the new icon and bottle names"). Each shape goes to its
 * family in the catalog; a quiet "or build your bottle" sits at the foot. Desktop keeps the plain link to the
 * Bottle Families page.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import LocaleLink from "@/components/LocaleLink";
import FamilyShapeIcon from "@/components/icons/FamilyShapeIcon";
import { X } from "@/components/icons";
import { NAV_FAMILIES } from "@/lib/navFamilies";
import { familyFinderHref } from "@/lib/products/focused-shopping";
import { localizeFamilyName } from "@/i18n/catalogCopy";
import { useAppLocale, useCopy } from "@/i18n/useCopy";
import styles from "./CollectionShopping.module.css";

export default function FamilySheet({ onClose }: { onClose: () => void }) {
    const t = useCopy("home");
    const locale = useAppLocale();
    const close = useRef<HTMLButtonElement>(null);
    // Keep the latest close handler without re-running the open effect on every parent render.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.dataset.shopMenu = "open";
        close.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            delete document.documentElement.dataset.shopMenu;
            window.removeEventListener("keydown", onKey);
        };
    }, []);

    // Rendered on <body>: inside the hero it would sit under the header and the hero's own layers.
    return createPortal(
        <div className={styles.familySheet} role="dialog" aria-modal="true" aria-labelledby="family-sheet-title" data-testid="family-sheet">
            <div className={styles.familySheetHead}>
                <div>
                    <span>{t("sheetEyebrow")}</span>
                    <h2 id="family-sheet-title">{t("sheetTitle")}</h2>
                </div>
                <button ref={close} type="button" aria-label={t("sheetClose")} onClick={onClose}><X size={22} /></button>
            </div>
            <div className={styles.familySheetGrid}>
                {NAV_FAMILIES.map((family) => (
                    <LocaleLink key={family} href={familyFinderHref(family)} onClick={onClose}>
                        <FamilyShapeIcon family={family} size={48} strokeWidth={0.9} />
                        <span>{localizeFamilyName(locale, family)}</span>
                    </LocaleLink>
                ))}
            </div>
            <div className={styles.familySheetFoot}>
                <LocaleLink href="/bottle-families" onClick={onClose}>{t("sheetAllFamilies")}</LocaleLink>
                <LocaleLink href="/matrix" onClick={onClose} className={styles.familySheetBuild}>{t("sheetOrBuild")}</LocaleLink>
            </div>
        </div>,
        document.body,
    );
}

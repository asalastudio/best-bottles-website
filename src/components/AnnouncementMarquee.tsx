"use client";

import { useCopy } from "@/i18n/useCopy";
import styles from "./AnnouncementMarquee.module.css";

/**
 * Announcement ticker: ONE instance of the message glides across the bar from
 * right to left and comes round again — never repeated side by side (Jordan,
 * 2026-09-14: "listed one time… make the marquee better. Move."). Hover
 * pauses it; reduced-motion users get the line static and centred. Screen
 * readers get the message once, unmoving.
 */
export default function AnnouncementMarquee({ message }: { message?: string }) {
    const t = useCopy("announcement");
    const text = message ?? t("freeShipping");
    return (
        <div className={styles.bar} role="region" aria-label={t("label")}>
            <p className="sr-only">{text}</p>
            <div className={styles.track} aria-hidden="true">
                <span className={styles.line}>{text}</span>
            </div>
        </div>
    );
}

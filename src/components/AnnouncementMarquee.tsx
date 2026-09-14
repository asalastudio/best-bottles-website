import styles from "./AnnouncementMarquee.module.css";

const DEFAULT_MESSAGE = "Free shipping on all domestic orders above $99.";

/**
 * Announcement bar: the message once, centred and still (Jordan, 2026-09-14 —
 * "listed one time, not repetitively"). The name is kept so the two headers
 * need no change; the earlier scrolling marquee is retired.
 */
export default function AnnouncementMarquee({ message = DEFAULT_MESSAGE }: { message?: string }) {
    return (
        <div className={styles.bar} role="region" aria-label="Announcement">
            <p className={styles.line}>{message}</p>
        </div>
    );
}

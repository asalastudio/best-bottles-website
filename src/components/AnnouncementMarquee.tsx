import styles from "./AnnouncementMarquee.module.css";

const DEFAULT_MESSAGE = "Free shipping on all domestic orders above $99.";

/**
 * Announcement ticker: ONE instance of the message glides across the bar from
 * right to left and comes round again — never repeated side by side (Jordan,
 * 2026-09-14: "listed one time… make the marquee better. Move."). Hover
 * pauses it; reduced-motion users get the line static and centred. Screen
 * readers get the message once, unmoving.
 */
export default function AnnouncementMarquee({ message = DEFAULT_MESSAGE }: { message?: string }) {
    return (
        <div className={styles.bar} role="region" aria-label="Announcement">
            <p className="sr-only">{message}</p>
            <div className={styles.track} aria-hidden="true">
                <span className={styles.line}>{message}</span>
            </div>
        </div>
    );
}

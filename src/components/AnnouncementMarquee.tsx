import styles from "./AnnouncementMarquee.module.css";

const DEFAULT_MESSAGE = "Free shipping on all domestic orders above $99.";

/**
 * Slow-moving announcement bar. Two identical groups scroll by exactly one
 * group width so the loop is seamless; hover pauses it and reduced-motion
 * users get a static, centred line. Screen readers get the message once.
 */
export default function AnnouncementMarquee({ message = DEFAULT_MESSAGE }: { message?: string }) {
    const repeats = Array.from({ length: 6 });
    return (
        <div className={styles.bar} role="region" aria-label="Announcement">
            <p className="sr-only">{message}</p>
            <div className={styles.marquee} aria-hidden="true">
                <div className={styles.track}>
                    {[0, 1].map((group) => (
                        <div key={group} className={styles.group}>
                            {repeats.map((_, i) => (
                                <span key={i} className={styles.item}>{message}<span className={styles.dot}>·</span></span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

import styles from "./BuilderLoading.module.css";

export default function BuilderLoading() {
    return <section className={styles.workspace} aria-label="Bottle builder loading">
        <div className={styles.status} role="status" aria-live="polite">
            {/* Outline follows the real Circle 30 ml perfume bottle and tall cap:
                public/images/bottle-builder/circle/GBCrcl30SpryMattGl.webp. */}
            <svg className={styles.bottle} viewBox="0 0 120 202" fill="none" aria-hidden="true">
                <path d="M40 82V8Q60 3 80 8V82" />
                <path d="M40 8Q60 12 80 8M46 17V75" opacity=".5" />
                <path d="M40 82C17 88 2 109 2 139C2 160 11 177 25 185L25 196Q60 201 95 196L95 185C109 177 118 160 118 139C118 109 103 88 80 82Z" />
                <path d="M25 185Q60 198 95 185M29 193Q60 198 91 193M32 92C16 103 9 120 10 140" opacity=".5" />
            </svg>
            <h1>Preparing your bottle builder</h1>
            <p>Bringing your bottles and compatible finishes together.</p>
            <span className={styles.track} aria-hidden="true"><span /></span>
        </div>
        <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /><span /></div>
    </section>;
}

import Image from "next/image";
import styles from "./BrandWordmark.module.css";

/**
 * Best Bottles wordmark — the supplied logo artwork (preserved on the Figma
 * Start Here board), keyed to transparent black ink and cropped to the
 * wordmark line. Pass `tone="light"` on dark grounds (footer) to invert to
 * white. Height is set in CSS; width follows the artwork's 968:76 ratio.
 *
 * `tagline` renders the full lockup (Jordan, 2026-09-14): the wordmark with
 * "Fragrance & Beauty Packaging" set beneath it as live text in the brand
 * face — widely tracked, light — sized from the mark so the two lines keep
 * the supplied artwork's proportions at every header size.
 */
export default function BrandWordmark({ className, tone = "dark", tagline = false }: { className?: string; tone?: "dark" | "light"; tagline?: boolean }) {
    const light = tone === "light";
    const mark = (
        <Image
            src="/brand/best-bottles-wordmark-supplied.png"
            alt="Best Bottles"
            width={968}
            height={76}
            priority
            unoptimized
            className={[styles.wordmark, light ? styles.light : "", tagline ? styles.inLockup : "", tagline ? "" : (className ?? "")].filter(Boolean).join(" ")}
        />
    );
    if (!tagline) return mark;
    return (
        <span className={[styles.lockup, light ? styles.lockupLight : "", className ?? ""].filter(Boolean).join(" ")}>
            {mark}
            <span className={styles.tagline}>Fragrance &amp; Beauty Packaging</span>
        </span>
    );
}

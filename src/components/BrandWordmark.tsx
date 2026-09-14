import Image from "next/image";
import styles from "./BrandWordmark.module.css";

/**
 * Best Bottles wordmark — the supplied logo artwork (preserved on the Figma
 * Start Here board), keyed to transparent black ink and cropped to the
 * wordmark line. Pass `tone="light"` on dark grounds (footer) to invert to
 * white. Height is set in CSS; width follows the artwork's 968:76 ratio.
 */
export default function BrandWordmark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
    const classes = [styles.wordmark, tone === "light" ? styles.light : "", className ?? ""].filter(Boolean).join(" ");
    return (
        <Image
            src="/brand/best-bottles-wordmark-supplied.png"
            alt="Best Bottles"
            width={968}
            height={76}
            priority
            unoptimized
            className={classes}
        />
    );
}

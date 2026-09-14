import styles from "./BrandWordmark.module.css";

/**
 * Best Bottles wordmark — single-weight direction from the Figma brand system:
 * Montserrat, +12% tracking, all caps. Weight is set heavier than the Figma
 * 400 proposal (SemiBold 600) so the mark carries the same presence as
 * reference luxury wordmarks without tipping into Bold.
 */
export default function BrandWordmark({ className }: { className?: string }) {
    return (
        <span className={className ? `${styles.wordmark} ${className}` : styles.wordmark} aria-label="Best Bottles">
            Best Bottles
        </span>
    );
}

import styles from "./BrandWordmark.module.css";

/**
 * Best Bottles wordmark: brand face (target TT Norms Pro Medium; Montserrat
 * stand-in until licensed), uppercase, 0.115em tracking. Weight comes from
 * --brand-weight-display so the header and footer marks move together.
 */
export default function BrandWordmark({ className }: { className?: string }) {
    return (
        <span className={className ? `${styles.wordmark} ${className}` : styles.wordmark} aria-label="Best Bottles">
            Best Bottles
        </span>
    );
}

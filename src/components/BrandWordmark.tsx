import Image from "next/image";
import styles from "./BrandWordmark.module.css";

export default function BrandWordmark() {
    return (
        <span className={styles.wordmark}>
            <Image
                src="/brand/best-bottles-wordmark.png"
                alt="Best Bottles"
                width={2172}
                height={724}
                className={styles.artwork}
                priority
                unoptimized
            />
        </span>
    );
}

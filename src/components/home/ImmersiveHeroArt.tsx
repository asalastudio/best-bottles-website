/* The full scene keeps the glass, lighting, contact shadows and reflections together. */
/* eslint-disable @next/next/no-img-element */

import styles from './CollectionShopping.module.css';

export function ImmersiveHeroArt() {
  return (
    <div className={styles.immersiveArt}>
      <video
        className={`${styles.heroScene} ${styles.heroMotion}`}
        src="/assets/homepage/hero-empire-water-rebuilt.mp4"
        poster="/assets/homepage/hero-empire-water-rebuilt.webp"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <img
        className={`${styles.heroScene} ${styles.heroFallback}`}
        src="/assets/homepage/hero-empire-water-rebuilt.webp"
        alt="Two Empire perfume bottles with a gold spray pump and black vintage bulb, photographed on dark rock surrounded by reflective water"
        width={2688}
        height={1152}
        fetchPriority="high"
      />
    </div>
  );
}

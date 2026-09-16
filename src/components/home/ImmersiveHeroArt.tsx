/* The full scene keeps the glass, lighting, contact shadows and reflections together. */
/* eslint-disable @next/next/no-img-element */

import styles from './CollectionShopping.module.css';

export function ImmersiveHeroArt() {
  return (
    <div className={styles.immersiveArt}>
      <img
        className={styles.heroScene}
        src="/assets/homepage/hero-empire-water-rebuilt.webp"
        alt="Two Empire perfume bottles with a gold spray pump and black vintage style bulb, photographed on dark rock surrounded by reflective water"
        width={2688}
        height={1152}
        fetchPriority="high"
      />
    </div>
  );
}

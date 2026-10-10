import Image from 'next/image';
import styles from './CollectionShopping.module.css';

const STONE_HERO_SRC = '/assets/homepage/diva-circle-hero-ivory-marble.png';
/*
 * Rendered width of the photograph: the full viewport above 640px; on phones the
 * image covers a 1.35:1 box, so it is drawn (100vw / 1.35) * (1672 / 941) ≈ 132vw
 * wide and cropped from the right.
 */
const STONE_HERO_SIZES = '(max-width: 640px) 132vw, 100vw';

export default function StoneHeroArt() {
    return (
        <div className={styles.stoneArt}>
            {/* Mirrors the top strip of the photograph into the gap above the lowered
                image. Same src and sizes as the hero, and eager so it joins the hero's
                in-flight request: the browser downloads the photograph once. */}
            <div className={styles.stoneMirror} aria-hidden="true">
                <Image
                    src={STONE_HERO_SRC}
                    alt=""
                    width={1672}
                    height={941}
                    loading="eager"
                    sizes={STONE_HERO_SIZES}
                    className={styles.stoneMirrorImage}
                />
            </div>
            <Image
                src={STONE_HERO_SRC}
                alt="Frosted Diva bottle with a black leather-textured cap on a lower ivory marble step, beside a clear Circle bottle with a red vintage bulb and tassel"
                width={1672}
                height={941}
                priority
                fetchPriority="high"
                sizes={STONE_HERO_SIZES}
                className={styles.stoneImage}
            />
        </div>
    );
}

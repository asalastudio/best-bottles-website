import { getImageProps } from 'next/image';
import styles from './CollectionShopping.module.css';

/*
 * Homepage hero, 4 Nov 2026 (Jordan: seven of the most popular bottles in raw glass with black tops on varying stone
 * plinths, "raw stone"; scripts/hero-plinths/). The bottles are drawn from their masters and photographed with
 * gpt-image-2.5-sunburst. Desktop and tablet show the 16:9 photograph (the plinth bases sit just above the strip the
 * desktop crop hides, so little floor shows); phones get their own full-screen portrait photograph of the same seven
 * bottles in two staggered rows (scripts/hero-plinths/compose_portrait.py), so a phone never downloads the desktop file.
 */
const DESKTOP = { src: '/assets/homepage/hero-raw-stone-plinths.webp', width: 2688, height: 1512 };
const MOBILE = { src: '/assets/homepage/hero-raw-stone-plinths-mobile.webp', width: 1290, height: 1935 };
const PHONE = '(max-width: 640px)';
const ALT = 'Seven clear glass perfume bottles with black caps — Diamond, Cylinder, Diva, Empire, Circle, Elegant and Grace — on raw stone plinths of varying heights in a sunlit plaster niche';

function sources(alt: string, priority: boolean) {
    const common = { alt, sizes: '100vw', ...(priority ? { fetchPriority: 'high' as const, loading: 'eager' as const } : { loading: 'eager' as const }) };
    const { props: { srcSet: desktop, ...img } } = getImageProps({ ...common, ...DESKTOP });
    const { props: { srcSet: mobile } } = getImageProps({ ...common, ...MOBILE });
    return { desktop, mobile, img };
}

export default function StoneHeroArt() {
    const hero = sources(ALT, true);
    const mirror = sources('', false);
    return (
        <div className={styles.stoneArt}>
            {/* Mirrors the top strip of the photograph into the gap above the lowered image. Same sources as the hero,
                and eager so it joins the hero's in-flight request: the browser downloads each photograph once. */}
            <div className={styles.stoneMirror} aria-hidden="true">
                <picture>
                    <source media={PHONE} srcSet={mirror.mobile} />
                    <source srcSet={mirror.desktop} />
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative mirror; alt is "" */}
                    <img {...mirror.img} className={styles.stoneMirrorImage} />
                </picture>
            </div>
            <picture>
                <source media={PHONE} srcSet={hero.mobile} />
                <source srcSet={hero.desktop} />
                {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
                <img {...hero.img} className={styles.stoneImage} />
            </picture>
        </div>
    );
}

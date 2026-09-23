import Image from 'next/image';
import styles from './CollectionShopping.module.css';

export default function StoneHeroArt() {
    return (
        <div className={styles.stoneArt}>
            <Image
                src="/assets/homepage/diva-circle-hero-original.png"
                alt="Frosted Diva bottle with a black leather-textured cap on a lower limestone step, beside a clear Circle bottle with a red vintage bulb and tassel"
                width={1672}
                height={941}
                unoptimized
                priority
                sizes="100vw"
                className={styles.stoneImage}
            />
        </div>
    );
}

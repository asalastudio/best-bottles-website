"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/components/CartProvider';
import AnnouncementMarquee from '@/components/AnnouncementMarquee';
import BrandWordmark from '@/components/BrandWordmark';
import RegionSelector from '@/components/RegionSelector';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LocaleLink from '@/components/LocaleLink';
import CartDrawer from '@/components/CartDrawer';
import { useGrace } from '@/components/useGrace';
import { CaretDown, List, MagnifyingGlass, ShoppingBag, User, X } from '@/components/icons';
import { FAMILY_ART, familySketchSrc } from '@/lib/homepageFamilyArt';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { SHOP_COLLECTIONS, shopCollectionHref } from '@/lib/shopCollections';
import { localizeCollectionName, localizeCollectionSubtitle, localizeFamilyName } from '@/i18n/catalogCopy';
import { localizeHref } from '@/i18n/paths';
import { useAppLocale, useCopy } from '@/i18n/useCopy';
import styles from './CollectionShopping.module.css';

type MegaMenu = 'families' | 'collections' | 'search';

export default function ShoppingHeader() {
    const [menu, setMenu] = useState(false);
    const [activeMega, setActiveMega] = useState<MegaMenu | null>(null);
    const [cart, setCart] = useState(false);
    const header = useRef<HTMLElement>(null);
    const { itemCount, isCartHydrated } = useCart();
    const { open } = useGrace();
    const locale = useAppLocale();
    const t = useCopy('nav');
    const catalogAction = localizeHref(locale, '/catalog');

    useEffect(() => {
        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenu(false);
                setActiveMega(null);
            }
        };
        const closeOutside = (event: PointerEvent) => {
            if (!header.current?.contains(event.target as Node)) setActiveMega(null);
        };
        const openCart = () => setCart(true);
        window.addEventListener('keydown', close);
        window.addEventListener('pointerdown', closeOutside);
        window.addEventListener('open-cart-drawer', openCart);
        return () => {
            window.removeEventListener('keydown', close);
            window.removeEventListener('pointerdown', closeOutside);
            window.removeEventListener('open-cart-drawer', openCart);
        };
    }, []);

    const toggleMega = (name: MegaMenu) => setActiveMega(current => current === name ? null : name);
    const closeNavigation = () => {
        setActiveMega(null);
        setMenu(false);
    };

    return <>
        <header ref={header} className={styles.header}>
            <AnnouncementMarquee/>
            <div className={styles.headerMain}>
                <div className={styles.headerLeft}>
                    <button className={styles.menuButton} aria-label={menu ? t('closeMenu') : t('openMenu')} aria-expanded={menu} aria-controls="shopping-menu" onClick={() => setMenu(!menu)}>{menu ? <X size={22}/> : <List size={22}/>}</button>
                    <form action={catalogAction} className={styles.search} role="search">
                        <button type="submit" aria-label={t('search')}><MagnifyingGlass size={18}/></button>
                        <input name="search" aria-label={t('searchCatalog')} placeholder={t('searchPlaceholder')} type="search"/>
                    </form>
                    <div className={styles.region}>
                        <LanguageSwitcher />
                        <RegionSelector />
                    </div>
                </div>
                <LocaleLink href="/" className={styles.brand} aria-label={t('home')}><BrandWordmark tagline/></LocaleLink>
                <div className={styles.headerRight}>
                    <button type="button" className={styles.searchTrigger} aria-expanded={activeMega === 'search'} aria-controls="search-mega-menu" onClick={() => toggleMega('search')}><MagnifyingGlass size={18}/><span>{t('search')}</span></button>
                    <button className={styles.grace} onClick={() => open()}>{t('askGrace')}</button>
                    <LocaleLink className={styles.portal} href="/sign-in?redirect_url=%2Fportal" aria-label={t('signInPortal')}><User size={22}/></LocaleLink>
                    <button className={styles.cartButton} aria-label={isCartHydrated ? t('openCartWithCount', { count: itemCount }) : t('openCart')} onClick={() => setCart(true)}><ShoppingBag size={22}/>{isCartHydrated && itemCount > 0 && <span>{itemCount}</span>}</button>
                </div>
            </div>
            <nav className={styles.nav} aria-label={t('mainNav')}>
                <button type="button" aria-expanded={activeMega === 'families'} aria-controls="families-mega-menu" onClick={() => toggleMega('families')}>{t('bottleFamilies')} <CaretDown size={13}/></button>
                <button type="button" aria-expanded={activeMega === 'collections'} aria-controls="collections-mega-menu" onClick={() => toggleMega('collections')}>{t('collections')} <CaretDown size={13}/></button>
                <LocaleLink href="/catalog" onFocus={() => setActiveMega(null)}>{t('fullCatalog')}</LocaleLink><LocaleLink href="/matrix" onFocus={() => setActiveMega(null)}>{t('buildYourBottle')}</LocaleLink><LocaleLink href="/blog" onFocus={() => setActiveMega(null)}>{t('journal')}</LocaleLink><LocaleLink href="/about" onFocus={() => setActiveMega(null)}>{t('about')}</LocaleLink>
            </nav>
            {activeMega && <div className={styles.megaBackdrop} onClick={() => setActiveMega(null)} aria-hidden="true"/>}
            {activeMega === 'families' && <div className={styles.megaMenu} id="families-mega-menu">
                <div className={styles.megaHeading}><div><span>{t('findSilhouette')}</span><h2>{t('bottleFamilies')}</h2></div><LocaleLink href="/bottle-families" onClick={closeNavigation}>{t('viewAll')}</LocaleLink></div>
                <div className={styles.megaFamilyGrid}>{Object.entries(FAMILY_ART).map(([family, image]) => <LocaleLink href={familyFinderHref(family)} onClick={closeNavigation} key={family}><Image src={familySketchSrc(family) ?? `/assets/homepage/${image}.webp`} alt="" width={400} height={300}/><span>{localizeFamilyName(locale, family)}</span></LocaleLink>)}</div>
            </div>}
            {activeMega === 'search' && <div className={styles.megaMenu} id="search-mega-menu">
                <form action={catalogAction} className={styles.megaSearch} role="search">
                    <MagnifyingGlass size={22}/>
                    <input name="search" aria-label={t('searchCatalog')} placeholder={t('searchPlaceholderLong')} type="search" autoFocus autoComplete="off"/>
                    <button type="submit">{t('search')}</button>
                </form>
                <div className={styles.megaSearchBody}>
                    <div><h3>{t('bottleFamilies')}</h3><div className={styles.megaSearchFamilies}>{Object.entries(FAMILY_ART).map(([family, image]) => <LocaleLink href={familyFinderHref(family)} onClick={closeNavigation} key={family}><Image src={familySketchSrc(family) ?? `/assets/homepage/${image}.webp`} alt="" width={400} height={300}/><span>{localizeFamilyName(locale, family)}</span></LocaleLink>)}</div></div>
                    <div><h3>{t('collections')}</h3><div className={styles.megaSearchCollections}>{SHOP_COLLECTIONS.map(collection => <LocaleLink key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><strong>{localizeCollectionName(locale, collection.key, collection.title)}</strong><span>{localizeCollectionSubtitle(locale, collection.key, collection.subtitle)}</span></LocaleLink>)}</div></div>
                </div>
            </div>}
            {activeMega === 'collections' && <div className={styles.megaMenu} id="collections-mega-menu">
                <div className={styles.megaHeading}><div><span>{t('beginApplication')}</span><h2>{t('collections')}</h2></div><LocaleLink href="/collections" onClick={closeNavigation}>{t('viewAll')}</LocaleLink></div>
                <div className={styles.megaCollectionGrid}>{SHOP_COLLECTIONS.map(collection => <LocaleLink key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><strong>{localizeCollectionName(locale, collection.key, collection.title)}</strong><span>{localizeCollectionSubtitle(locale, collection.key, collection.subtitle)}</span></LocaleLink>)}</div>
            </div>}
            {menu && <nav id="shopping-menu" className={styles.menu} aria-label={t('mobileNav')}>
                <details><summary>{t('bottleFamilies')}</summary><LocaleLink href="/bottle-families" onClick={closeNavigation}>{t('viewAll')}</LocaleLink>{Object.keys(FAMILY_ART).map(family => <LocaleLink key={family} href={familyFinderHref(family)} onClick={closeNavigation}>{localizeFamilyName(locale, family)}</LocaleLink>)}</details>
                <details><summary>{t('collections')}</summary><LocaleLink href="/collections" onClick={closeNavigation}>{t('viewAll')}</LocaleLink>{SHOP_COLLECTIONS.map(collection => <LocaleLink key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}>{localizeCollectionName(locale, collection.key, collection.title)}</LocaleLink>)}</details>
                <LocaleLink href="/catalog" onClick={closeNavigation}>{t('fullCatalog')}</LocaleLink><LocaleLink href="/matrix" onClick={closeNavigation}>{t('buildYourBottle')}</LocaleLink><LocaleLink href="/blog" onClick={closeNavigation}>{t('journal')}</LocaleLink><LocaleLink href="/sign-in?redirect_url=%2Fportal" onClick={closeNavigation}>{t('clientPortal')}</LocaleLink>
                <LanguageSwitcher className={styles.regionMobile}/>
                <RegionSelector inline className={styles.regionMobile}/>
            </nav>}
        </header>
        <CartDrawer isOpen={cart} onClose={() => setCart(false)}/>
    </>;
}

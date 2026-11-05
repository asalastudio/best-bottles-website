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
import FamilyShapeIcon from '@/components/icons/FamilyShapeIcon';
import CollectionIcon from '@/components/icons/CollectionIcon';
import GraceMark from '@/components/icons/GraceMark';
import { NAV_FAMILIES } from '@/lib/navFamilies';
import styles from './CollectionShopping.module.css';



type MegaMenu = 'families' | 'collections' | 'search';
type MenuView = 'root' | 'families' | 'collections';

export default function ShoppingHeader() {
    const [menu, setMenu] = useState(false);
    // Phones: the menu opens on its main rows; families and collections each open their own panel.
    const [menuView, setMenuView] = useState<MenuView>('root');
    const [activeMega, setActiveMega] = useState<MegaMenu | null>(null);
    const [cart, setCart] = useState(false);
    // Phones: the search field opens from an icon in the one-row header (2026-11-04).
    const [phoneSearch, setPhoneSearch] = useState(false);
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
                setPhoneSearch(false);
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

    // The open phone menu covers the page, so the floating Grace launcher steps aside (globals.css).
    useEffect(() => {
        const root = document.documentElement;
        if (menu) root.dataset.shopMenu = 'open';
        else delete root.dataset.shopMenu;
        return () => { delete root.dataset.shopMenu; };
    }, [menu]);

    const toggleMega = (name: MegaMenu) => setActiveMega(current => current === name ? null : name);
    const closeNavigation = () => {
        setActiveMega(null);
        setMenu(false);
        setMenuView('root');
    };
    const askGrace = () => {
        closeNavigation();
        open();
    };

    return <>
        <header ref={header} className={styles.header}>
            <AnnouncementMarquee/>
            <div className={styles.headerMain}>
                <div className={styles.headerLeft}>
                    <div className={styles.leftIcons}>
                        <button className={styles.menuButton} aria-label={menu ? t('closeMenu') : t('openMenu')} aria-expanded={menu} aria-controls="shopping-menu" onClick={() => { setMenuView('root'); setMenu(!menu); }}>{menu ? <X size={22}/> : <List size={22}/>}</button>
                        <button type="button" className={styles.phoneGraceButton} aria-label={t('askGrace')} onClick={askGrace}><GraceMark/></button>
                    </div>
                    <form action={catalogAction} className={`${styles.search} ${phoneSearch ? styles.searchOpen : ""}`} role="search" id="header-search">
                        <button type="submit" aria-label={t('search')}><MagnifyingGlass size={18}/></button>
                        <input name="search" aria-label={t('searchCatalog')} placeholder={t('searchPlaceholder')} type="search" autoFocus={phoneSearch}/>
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
                    <button type="button" className={styles.phoneSearchButton} aria-label={t('search')} aria-expanded={phoneSearch} aria-controls="header-search" onClick={() => setPhoneSearch(open => !open)}>{phoneSearch ? <X size={22}/> : <MagnifyingGlass size={22}/>}</button>
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
                <div className={styles.megaShapeGrid}>{NAV_FAMILIES.map(family => <LocaleLink href={familyFinderHref(family)} onClick={closeNavigation} key={family}><FamilyShapeIcon family={family} size={44} strokeWidth={1}/><span>{localizeFamilyName(locale, family)}</span></LocaleLink>)}</div>
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
                <div className={styles.megaCollectionGrid}>{SHOP_COLLECTIONS.map(collection => <LocaleLink key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><CollectionIcon collection={collection.key} size={30} strokeWidth={1.1}/><span><strong>{localizeCollectionName(locale, collection.key, collection.title)}</strong><small>{localizeCollectionSubtitle(locale, collection.key, collection.subtitle)}</small></span></LocaleLink>)}</div>
            </div>}
            {menu && <nav id="shopping-menu" className={styles.menu} aria-label={t('mobileNav')}>
                {menuView === 'root' && <>
                    <form action={catalogAction} className={styles.menuSearch} role="search">
                        <MagnifyingGlass size={18}/>
                        <input name="search" aria-label={t('searchCatalog')} placeholder={t('searchPlaceholder')} type="search"/>
                    </form>
                    <div className={styles.menuPrimary}>
                        <button type="button" onClick={() => setMenuView('families')}>{t('bottleFamilies')}</button>
                        <button type="button" onClick={() => setMenuView('collections')}>{t('collections')}</button>
                        <LocaleLink href="/catalog" onClick={closeNavigation}>{t('fullCatalog')}</LocaleLink>
                        <LocaleLink href="/matrix" onClick={closeNavigation}>{t('buildYourBottle')}</LocaleLink>
                    </div>
                    <div className={styles.menuSecondary}>
                        <LocaleLink href="/blog" onClick={closeNavigation}>{t('journal')}</LocaleLink>
                        <LocaleLink href="/about" onClick={closeNavigation}>{t('about')}</LocaleLink>
                        <LocaleLink href="/resources" onClick={closeNavigation}>{t('guides')}</LocaleLink>
                        <button type="button" onClick={askGrace}>{t('askGrace')}</button>
                    </div>
                    <div className={styles.menuUtility}>
                        <LocaleLink href="/sign-in?redirect_url=%2Fportal" onClick={closeNavigation}>{t('clientPortal')}</LocaleLink>
                        <LanguageSwitcher className={styles.regionMobile}/>
                        <RegionSelector inline className={styles.regionMobile}/>
                    </div>
                </>}
                {menuView === 'families' && <div className={styles.menuPanel}>
                    <button type="button" className={styles.menuBack} onClick={() => setMenuView('root')}>{t('back')}</button>
                    <h2>{t('bottleFamilies')}</h2>
                    <div className={styles.menuShapes}>{NAV_FAMILIES.map(family => <LocaleLink key={family} href={familyFinderHref(family)} onClick={closeNavigation}><FamilyShapeIcon family={family} size={36} strokeWidth={1}/><span>{localizeFamilyName(locale, family)}</span></LocaleLink>)}</div>
                    <LocaleLink className={styles.menuViewAll} href="/bottle-families" onClick={closeNavigation}>{t('viewAll')}</LocaleLink>
                </div>}
                {menuView === 'collections' && <div className={styles.menuPanel}>
                    <button type="button" className={styles.menuBack} onClick={() => setMenuView('root')}>{t('back')}</button>
                    <h2>{t('collections')}</h2>
                    <div className={styles.menuCollections}>{SHOP_COLLECTIONS.map(collection => <LocaleLink key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><CollectionIcon collection={collection.key} size={26} strokeWidth={1.1}/><span><strong>{localizeCollectionName(locale, collection.key, collection.title)}</strong><small>{localizeCollectionSubtitle(locale, collection.key, collection.subtitle)}</small></span></LocaleLink>)}</div>
                    <LocaleLink className={styles.menuViewAll} href="/collections" onClick={closeNavigation}>{t('viewAll')}</LocaleLink>
                </div>}
            </nav>}
        </header>
        <CartDrawer isOpen={cart} onClose={() => setCart(false)}/>
    </>;
}

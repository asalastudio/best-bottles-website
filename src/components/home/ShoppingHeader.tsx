"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import AnnouncementMarquee from '@/components/AnnouncementMarquee';
import BrandWordmark from '@/components/BrandWordmark';
import RegionSelector from '@/components/RegionSelector';
import CartDrawer from '@/components/CartDrawer';
import { useGrace } from '@/components/useGrace';
import { CaretDown, List, MagnifyingGlass, ShoppingBag, User, X } from '@/components/icons';
import { FAMILY_ART, familySketchSrc } from '@/lib/homepageFamilyArt';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { SHOP_COLLECTIONS, shopCollectionHref } from '@/lib/shopCollections';
import styles from './CollectionShopping.module.css';

type MegaMenu = 'families' | 'collections' | 'search';

export default function ShoppingHeader() {
    const [menu, setMenu] = useState(false);
    const [activeMega, setActiveMega] = useState<MegaMenu | null>(null);
    const [cart, setCart] = useState(false);
    const header = useRef<HTMLElement>(null);
    const { itemCount, isCartHydrated } = useCart();
    const { open } = useGrace();

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
        window.addEventListener('keydown', close);
        window.addEventListener('pointerdown', closeOutside);
        return () => {
            window.removeEventListener('keydown', close);
            window.removeEventListener('pointerdown', closeOutside);
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
                    <button className={styles.menuButton} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="shopping-menu" onClick={() => setMenu(!menu)}>{menu ? <X size={22}/> : <List size={22}/>}</button>
                    <form action="/catalog" className={styles.search} role="search">
                        <input name="search" aria-label="Search the catalog" placeholder="Search" type="search"/>
                        <button aria-label="Search"><MagnifyingGlass size={18}/></button>
                    </form>
                    <RegionSelector className={styles.region}/>
                </div>
                <Link href="/" className={styles.brand} aria-label="Best Bottles home"><BrandWordmark/></Link>
                <div className={styles.headerRight}>
                    <button type="button" className={styles.searchTrigger} aria-expanded={activeMega === 'search'} aria-controls="search-mega-menu" onClick={() => toggleMega('search')}><MagnifyingGlass size={18}/><span>Search</span></button>
                    <button className={styles.grace} onClick={() => open()}>Ask Grace</button>
                    <Link className={styles.portal} href="/sign-in?redirect_url=%2Fportal" aria-label="Sign in to the client portal"><User size={22}/></Link>
                    <button className={styles.cartButton} aria-label={`Open cart${isCartHydrated ? `, ${itemCount} items` : ''}`} onClick={() => setCart(true)}><ShoppingBag size={22}/>{isCartHydrated && itemCount > 0 && <span>{itemCount}</span>}</button>
                </div>
            </div>
            <nav className={styles.nav} aria-label="Main navigation">
                <button type="button" aria-expanded={activeMega === 'families'} aria-controls="families-mega-menu" onClick={() => toggleMega('families')}>Bottle Families <CaretDown size={13}/></button>
                <button type="button" aria-expanded={activeMega === 'collections'} aria-controls="collections-mega-menu" onClick={() => toggleMega('collections')}>Collections <CaretDown size={13}/></button>
                <Link href="/catalog" onFocus={() => setActiveMega(null)}>Full Catalog</Link><Link href="/matrix" onFocus={() => setActiveMega(null)}>Build your bottle</Link><Link href="/blog" onFocus={() => setActiveMega(null)}>Journal</Link><Link href="/about" onFocus={() => setActiveMega(null)}>About</Link>
            </nav>
            {activeMega && <div className={styles.megaBackdrop} onClick={() => setActiveMega(null)} aria-hidden="true"/>}
            {activeMega === 'families' && <div className={styles.megaMenu} id="families-mega-menu">
                <div className={styles.megaHeading}><div><span>Find your silhouette</span><h2>Bottle Families</h2></div><Link href="/bottle-families" onClick={closeNavigation}>View all</Link></div>
                <div className={styles.megaFamilyGrid}>{Object.entries(FAMILY_ART).map(([family, image]) => <Link href={familyFinderHref(family)} onClick={closeNavigation} key={family}><Image src={familySketchSrc(family) ?? `/assets/homepage/${image}.webp`} alt="" width={400} height={300}/><span>{family}</span></Link>)}</div>
            </div>}
            {activeMega === 'search' && <div className={styles.megaMenu} id="search-mega-menu">
                <form action="/catalog" className={styles.megaSearch} role="search">
                    <MagnifyingGlass size={22}/>
                    <input name="search" aria-label="Search the catalog" placeholder="Search bottles, closures, sizes, SKUs…" type="search" autoFocus autoComplete="off"/>
                    <button type="submit">Search</button>
                </form>
                <div className={styles.megaSearchBody}>
                    <div><h3>Bottle families</h3><div className={styles.megaSearchFamilies}>{Object.entries(FAMILY_ART).map(([family, image]) => <Link href={familyFinderHref(family)} onClick={closeNavigation} key={family}><Image src={familySketchSrc(family) ?? `/assets/homepage/${image}.webp`} alt="" width={400} height={300}/><span>{family}</span></Link>)}</div></div>
                    <div><h3>Collections</h3><div className={styles.megaSearchCollections}>{SHOP_COLLECTIONS.map(collection => <Link key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><strong>{collection.title}</strong><span>{collection.subtitle}</span></Link>)}</div></div>
                </div>
            </div>}
            {activeMega === 'collections' && <div className={styles.megaMenu} id="collections-mega-menu">
                <div className={styles.megaHeading}><div><span>Begin with the application</span><h2>Collections</h2></div><Link href="/collections" onClick={closeNavigation}>View all</Link></div>
                <div className={styles.megaCollectionGrid}>{SHOP_COLLECTIONS.map(collection => <Link key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><strong>{collection.title}</strong><span>{collection.subtitle}</span></Link>)}</div>
            </div>}
            {menu && <nav id="shopping-menu" className={styles.menu} aria-label="Mobile navigation">
                <details><summary>Bottle Families</summary><Link href="/bottle-families" onClick={closeNavigation}>View all</Link>{Object.keys(FAMILY_ART).map(family => <Link key={family} href={familyFinderHref(family)} onClick={closeNavigation}>{family}</Link>)}</details>
                <details><summary>Collections</summary><Link href="/collections" onClick={closeNavigation}>View all</Link>{SHOP_COLLECTIONS.map(collection => <Link key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}>{collection.title}</Link>)}</details>
                <Link href="/catalog" onClick={closeNavigation}>Full Catalog</Link><Link href="/matrix" onClick={closeNavigation}>Build your bottle</Link><Link href="/blog" onClick={closeNavigation}>Journal</Link><Link href="/sign-in?redirect_url=%2Fportal" onClick={closeNavigation}>Client portal</Link>
                <RegionSelector inline className={styles.regionMobile}/>
            </nav>}
        </header>
        <CartDrawer isOpen={cart} onClose={() => setCart(false)}/>
    </>;
}

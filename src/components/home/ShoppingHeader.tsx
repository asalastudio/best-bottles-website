"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import CartDrawer from '@/components/CartDrawer';
import { useGrace } from '@/components/useGrace';
import { CaretDown, List, MagnifyingGlass, ShoppingBag, User, X } from '@/components/icons';
import { FAMILY_ART } from '@/lib/homepageFamilyArt';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { SHOP_COLLECTIONS, shopCollectionHref } from '@/lib/shopCollections';
import styles from './CollectionShopping.module.css';

type MegaMenu = 'families' | 'collections';

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
            <div className={styles.headerMain}>
                <button className={styles.menuButton} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="shopping-menu" onClick={() => setMenu(!menu)}>{menu ? <X size={22}/> : <List size={22}/>}</button>
                <Link href="/" className={styles.brand} aria-label="Best Bottles home"><Image src="/assets/brand/best-bottles-wordmark.png" alt="Best Bottles" width={2172} height={724} priority/></Link>
                <form action="/catalog" className={styles.search} role="search">
                    <input name="search" aria-label="Search the catalog" placeholder="Search bottles, dispensers, sizes…" type="search"/>
                    <button aria-label="Search"><MagnifyingGlass size={20}/></button>
                </form>
                <button className={styles.grace} onClick={() => open()}>Ask Grace</button>
                <Link className={styles.portal} href="/sign-in?redirect_url=%2Fportal" aria-label="Sign in to the client portal"><User size={22}/><span>Portal</span></Link>
                <button className={styles.cartButton} aria-label={`Open cart${isCartHydrated ? `, ${itemCount} items` : ''}`} onClick={() => setCart(true)}><ShoppingBag size={22}/>{isCartHydrated && itemCount > 0 && <span>{itemCount}</span>}</button>
            </div>
            <nav className={styles.nav} aria-label="Main navigation">
                <button type="button" aria-expanded={activeMega === 'families'} aria-controls="families-mega-menu" onClick={() => toggleMega('families')}>Shop by Bottle Family <CaretDown size={13}/></button>
                <button type="button" aria-expanded={activeMega === 'collections'} aria-controls="collections-mega-menu" onClick={() => toggleMega('collections')}>Shop by Collection <CaretDown size={13}/></button>
                <Link href="/catalog" onFocus={() => setActiveMega(null)}>Full Catalog</Link><Link href="/matrix" onFocus={() => setActiveMega(null)}>Build your bottle</Link><Link href="/blog" onFocus={() => setActiveMega(null)}>Journal</Link><Link href="/about" onFocus={() => setActiveMega(null)}>About</Link>
            </nav>
            {activeMega && <div className={styles.megaBackdrop} onClick={() => setActiveMega(null)} aria-hidden="true"/>}
            {activeMega === 'families' && <div className={styles.megaMenu} id="families-mega-menu">
                <div className={styles.megaHeading}><div><span>Find your silhouette</span><h2>Shop by Bottle Family</h2></div><Link href="/bottle-families" onClick={closeNavigation}>View all families</Link></div>
                <div className={styles.megaFamilyGrid}>{Object.entries(FAMILY_ART).map(([family, image]) => <Link href={familyFinderHref(family)} onClick={closeNavigation} key={family}><Image src={`/assets/homepage/${image}.webp`} alt="" width={160} height={200}/><span>{family}</span></Link>)}</div>
            </div>}
            {activeMega === 'collections' && <div className={styles.megaMenu} id="collections-mega-menu">
                <div className={styles.megaHeading}><div><span>Begin with the application</span><h2>Shop by Collection</h2></div><Link href="/collections" onClick={closeNavigation}>View all collections</Link></div>
                <div className={styles.megaCollectionGrid}>{SHOP_COLLECTIONS.map(collection => <Link key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}><strong>{collection.title}</strong><span>{collection.subtitle}</span></Link>)}</div>
            </div>}
            {menu && <nav id="shopping-menu" className={styles.menu} aria-label="Mobile navigation">
                <details><summary>Shop by Bottle Family</summary><Link href="/bottle-families" onClick={closeNavigation}>View all families</Link>{Object.keys(FAMILY_ART).map(family => <Link key={family} href={familyFinderHref(family)} onClick={closeNavigation}>{family}</Link>)}</details>
                <details><summary>Shop by Collection</summary><Link href="/collections" onClick={closeNavigation}>View all collections</Link>{SHOP_COLLECTIONS.map(collection => <Link key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeNavigation}>{collection.title}</Link>)}</details>
                <Link href="/catalog" onClick={closeNavigation}>Full Catalog</Link><Link href="/matrix" onClick={closeNavigation}>Build your bottle</Link><Link href="/blog" onClick={closeNavigation}>Journal</Link><Link href="/sign-in?redirect_url=%2Fportal" onClick={closeNavigation}>Client portal</Link>
            </nav>}
        </header>
        <CartDrawer isOpen={cart} onClose={() => setCart(false)}/>
    </>;
}

"use client";
/* Editorial images here are collection navigation, never SKU plates. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { HomepageData } from '@/sanity/lib/queries';
import { editorialImageUrl } from '@/sanity/lib/image';
import { FAMILY_ART } from '@/lib/homepageFamilyArt';
import { CATALOG_FAMILIES } from '@/lib/catalogFilters';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { SHOP_COLLECTIONS, featuredCollectionCards, shopCollectionHref } from '@/lib/shopCollections';
import { ImmersiveHeroArt } from './ImmersiveHeroArt';
import styles from './CollectionShopping.module.css';

const asset = (name: string) => `/assets/homepage/${name}.webp`;
const cmsImage = editorialImageUrl;
const approvedCollectionArt = new Set(['lotion-pump-bottles', 'glass-spray-bottles', 'perfume-atomizers']);
export function CollectionGrid({ cards, all = false }: { cards?: HomepageData['collectionCards']; all?: boolean }) {
    const rail = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: true, end: false });
    const updateEdges = () => { const el = rail.current; if (el) setEdges({ start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }); };
    useEffect(() => { const el=rail.current; if(!el)return; const observer=new ResizeObserver(updateEdges);observer.observe(el);return()=>observer.disconnect(); }, []);
    const move = (direction: number) => { const el=rail.current; if(el)el.scrollBy({left:direction*((el.firstElementChild?.getBoundingClientRect().width??600)+parseFloat(getComputedStyle(el).columnGap)),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); };
    const configured = featuredCollectionCards(cards);
    const entries = all ? SHOP_COLLECTIONS.map(c => ({ ...c, ...configured.find(card => card.key === c.key) })) : configured;
    return <div className={all ? undefined : styles.collectionRailWrap}><div ref={rail} id={all ? undefined : "collection-carousel"} onScroll={updateEdges} className={all ? styles.grid : styles.collectionRail}>{entries.map(c => <Link key={c.key} href={shopCollectionHref(c.key)} className={styles.collection}>
        <img className={['roll-on-bottles', 'perfume-atomizers', 'dropper-bottles', 'sample-vials'].includes(c.key) ? styles.collectionScene : undefined} src={cmsImage('image' in c ? c.image : undefined, 800, 600) ?? (c.key === 'roll-on-bottles' ? asset('collection-roll-on-measured') : c.key === 'perfume-atomizers' ? asset('collection-perfume-atomizers-cap-off') : c.key === 'dropper-bottles' ? asset('collection-dropper-cobalt-amber-empire') : c.key === 'sample-vials' ? asset('collection-sample-vials-seven') : asset(`${approvedCollectionArt.has(c.key) ? 'collection' : 'source'}-${c.key}`))} alt={c.title} width={800} height={600} loading="lazy"/>
        <div className={styles.collectionCopy}><h3>{c.title}</h3><p>{c.subtitle}</p></div>
    </Link>)}</div>{!all && <div className={styles.edgeControls}><button aria-label="Previous collection" aria-controls="collection-carousel" disabled={edges.start} onClick={()=>move(-1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="M14 4 4 14l10 10"/></svg></button><button aria-label="Next collection" aria-controls="collection-carousel" disabled={edges.end} onClick={()=>move(1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="m6 4 10 10L6 24"/></svg></button></div>}</div>;
}
export function FamilyCarousel({ cards }: { cards?: HomepageData['designFamilyCards'] }) {
    const rail = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({start:true,end:false,index:1});
    const entries = cards?.length ? [...cards].sort((a,b)=>(a.order??0)-(b.order??0)).filter(c => CATALOG_FAMILIES.includes(c.family)) : Object.keys(FAMILY_ART).map(family => ({family,title:family,image:undefined}));
    const update = () => { const el=rail.current; if(el) {const step=(el.firstElementChild?.getBoundingClientRect().width??280)+(window.innerWidth<=640?14:20);setPosition({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2,index:Math.min(entries.length,Math.round(el.scrollLeft/step)+1)});} };
    useEffect(() => { const el=rail.current; if(!el)return;const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect(); }, [entries.length]); // eslint-disable-line react-hooks/exhaustive-deps
    function move(direction:number){rail.current?.scrollBy({left:direction*((rail.current.firstElementChild?.getBoundingClientRect().width??280)+(window.innerWidth<=640?14:20)),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    return <section className={styles.section} aria-labelledby="family-heading"><div className={styles.heading}><h2 id="family-heading">Shop by Bottle Family</h2><Link href="/bottle-families">View all families</Link></div>
        <div className={styles.railWrap}><div ref={rail} id="family-carousel" className={styles.rail} onScroll={update} aria-label="Bottle families">
            {entries.map(c => <Link href={familyFinderHref(c.family)} className={styles.family} key={c.family}>
                {(c.image?.asset?._ref || FAMILY_ART[c.family]) && <img src={cmsImage(c.image,800)??asset(FAMILY_ART[c.family])} alt={`${c.family} bottle family`} width={800} height={1000} loading="lazy"/>}
                <span className={styles.familyTitle}>{c.title || c.family}</span>
            </Link>)}
        </div>
        <div className={styles.edgeControls}><button aria-label="Previous bottle family" aria-controls="family-carousel" disabled={position.start} onClick={()=>move(-1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="M14 4 4 14l10 10"/></svg></button><button aria-label="Next bottle family" aria-controls="family-carousel" disabled={position.end} onClick={()=>move(1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="m6 4 10 10L6 24"/></svg></button></div></div><div className={styles.railControls} aria-live="polite">{position.index} / {entries.length}</div>
    </section>;
}
export function ShoppingHero({ slides }: {slides?:HomepageData['heroSlides']}) {
    const [index,setIndex]=useState(0);
    const heroVideo=useRef<HTMLVideoElement>(null);
    const slide=slides?.[index];
    const desktop=cmsImage(slide?.image,1800)??asset('hero-empire-water-rebuilt');
    const mobile=cmsImage(slide?.mobileImage,860)??desktop;
    useEffect(() => {
        const video=heroVideo.current;
        if(!video)return;
        const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync=()=>preference.matches?video.pause():void video.play().catch(()=>undefined);
        sync();
        preference.addEventListener('change',sync);
        return()=>preference.removeEventListener('change',sync);
    }, [slide]);
    return <section className={styles.hero} data-scene={!slide ? "empire-water" : undefined} aria-label="Featured bottles">
        {slide?.mediaType==='video' && slide.video?.asset?.url ? <video ref={heroVideo} className={styles.heroArt} src={slide.video.asset.url} poster={cmsImage(slide.videoPoster,1800)} autoPlay muted loop playsInline/> : !slide ? <ImmersiveHeroArt/> : <picture><source media="(max-width:640px)" srcSet={mobile}/><img className={styles.heroArt} src={desktop} alt="Glass perfume bottles with red vintage bulb sprayers on a stone platform" fetchPriority="high"/></picture>}
        <div className={styles.heroCopy}><h1>{slide?.headline || 'Beautifully contained.'}</h1><p>{slide?.subheadline || 'Distinctive glass. Thoughtful details. Endless possibilities.'}</p><div className={styles.buttons}><Link className={styles.primary} href={slide?.ctaHref || '/catalog'}>{slide?.ctaText || 'Shop bottles'}</Link><Link className={styles.secondary} href="/matrix">Build your bottle</Link></div></div>
        {(slides?.length??0)>1 && <div className={styles.heroControls}>{slides!.map((_,i)=><button key={i} aria-label={`Show hero ${i+1}`} aria-pressed={index===i} onClick={()=>setIndex(i)}>{i+1}</button>)}</div>}
    </section>;
}
export default function CollectionShopping({data}:{data:HomepageData|null}){
    const build=data?.buildYourBottle;
    return <div className={styles.page}>
        <ShoppingHero slides={data?.useEditorialArtwork ? data.heroSlides : undefined}/><FamilyCarousel cards={data?.useEditorialArtwork ? data.designFamilyCards : undefined}/>
        <section className={styles.section} aria-labelledby="collections-heading"><div className={styles.heading}><h2 id="collections-heading">Shop by Collection</h2><Link href="/collections">View all collections</Link></div><p className={styles.intro}>Know how you want to dispense? Start here, then find the shape and finish that fit.</p><CollectionGrid cards={data?.collectionCards}/></section>
        <section className={styles.section} id="build-your-bottle"><div className={styles.build}><div className={styles.buildCopy}><h2>{build?.heading || 'Build your bottle.'}</h2><p>{build?.description || 'Start with a shape you love.\nFind the finishing touches that fit.'}</p><Link className={styles.primary} href={build?.destination === '/collections' ? '/collections' : '/matrix'}>{build?.buttonLabel || 'Build your bottle'}</Link></div><img src={asset('build-your-bottle-artwork-standard')} alt="Colored-pencil study of a bare glass bottle, compatible spray assembly, clear cap and finished bottle" width={1000} height={600} loading="lazy"/></div></section>
    </div>;
}

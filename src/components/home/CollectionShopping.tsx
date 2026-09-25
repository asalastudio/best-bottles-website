"use client";
/* Editorial images here are collection navigation, never SKU plates. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { HomepageData } from '@/sanity/lib/queries';
import { editorialImageUrl } from '@/sanity/lib/image';
import { FAMILY_ART, familyCardSources } from '@/lib/homepageFamilyArt';
import { CATALOG_FAMILIES } from '@/lib/catalogFilters';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { SHOP_COLLECTIONS, featuredCollectionCards, shopCollectionHref } from '@/lib/shopCollections';
import { ImmersiveHeroArt } from './ImmersiveHeroArt';
import EmpireFitmentHero from './EmpireFitmentHero';
import StoneHeroArt from './StoneHeroArt';
import BuildYourBottleSteps from './BuildYourBottleSteps';
import LocaleLink from '@/components/LocaleLink';
import { localizeCollectionName, localizeCollectionSubtitle, localizeFamilyName } from '@/i18n/catalogCopy';
import { useAppLocale, useCopy } from '@/i18n/useCopy';
import styles from './CollectionShopping.module.css';

const asset = (name: string) => `/assets/homepage/${name}.webp`;
const cmsImage = editorialImageUrl;
const BONE_COLLECTION_ART = new Set(['roll-on-bottles','perfume-atomizers','glass-spray-bottles','dropper-bottles','sample-vials','lotion-pump-bottles','decorative-bottles','apothecary-bottles','cream-jars','accessories-packaging','splash-on-bottles']);
export function CollectionGrid({ cards, all = false }: { cards?: HomepageData['collectionCards']; all?: boolean }) {
    const rail = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: true, end: false });
    const updateEdges = () => { const el = rail.current; if (el) setEdges({ start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }); };
    useEffect(() => { const el=rail.current; if(!el)return; const observer=new ResizeObserver(updateEdges);observer.observe(el);return()=>observer.disconnect(); }, []);
    const move = (direction: number) => { const el=rail.current; if(el)el.scrollBy({left:direction*((el.firstElementChild?.getBoundingClientRect().width??600)+parseFloat(getComputedStyle(el).columnGap)),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); };
    const configured = featuredCollectionCards(cards);
    const entries = all ? SHOP_COLLECTIONS.map(c => ({ ...c, ...configured.find(card => card.key === c.key) })) : configured;
    const t = useCopy('home');
    const locale = useAppLocale();
    return <div className={all ? undefined : styles.collectionRailWrap}><div ref={rail} id={all ? undefined : "collection-carousel"} onScroll={updateEdges} className={all ? styles.grid : styles.collectionRail}>{entries.map(c => {
        const title = localizeCollectionName(locale, c.key, c.title);
        const subtitle = localizeCollectionSubtitle(locale, c.key, c.subtitle);
        return <LocaleLink key={c.key} href={shopCollectionHref(c.key)} className={styles.collection}>
        <img className={['roll-on-bottles', 'perfume-atomizers', 'dropper-bottles', 'sample-vials'].includes(c.key) ? styles.collectionScene : undefined} src={cmsImage('image' in c ? c.image : undefined, 800, 600) ?? (BONE_COLLECTION_ART.has(c.key) ? asset(`collection-${c.key}-bone-v3`) : asset(`source-${c.key}`))} alt={title} width={800} height={600} loading="lazy"/>
        <div className={styles.collectionCopy}><h3>{title}</h3><p>{subtitle}</p></div>
    </LocaleLink>;})}</div>{!all && <div className={styles.edgeControls}><button aria-label={t("previousCollection")} aria-controls="collection-carousel" disabled={edges.start} onClick={()=>move(-1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="M14 4 4 14l10 10"/></svg></button><button aria-label={t("nextCollection")} aria-controls="collection-carousel" disabled={edges.end} onClick={()=>move(1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="m6 4 10 10L6 24"/></svg></button></div>}</div>;
}
export function FamilyCarousel({ cards }: { cards?: HomepageData['designFamilyCards'] }) {
    const rail = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({start:true,end:false,index:1});
    const entries = cards?.length ? [...cards].sort((a,b)=>(a.order??0)-(b.order??0)).filter(c => CATALOG_FAMILIES.includes(c.family)) : Object.keys(FAMILY_ART).map(family => ({family,title:family,image:undefined}));
    const update = () => { const el=rail.current; if(el) {const step=(el.firstElementChild?.getBoundingClientRect().width??280)+(window.innerWidth<=640?14:20);setPosition({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2,index:Math.min(entries.length,Math.round(el.scrollLeft/step)+1)});} };
    useEffect(() => { const el=rail.current; if(!el)return;const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect(); }, [entries.length]); // eslint-disable-line react-hooks/exhaustive-deps
    function move(direction:number){rail.current?.scrollBy({left:direction*((rail.current.firstElementChild?.getBoundingClientRect().width??280)+(window.innerWidth<=640?14:20)),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    const locale = useAppLocale();
    const t = useCopy('home');
    return <section className={`${styles.section} ${styles.families}`} aria-labelledby="family-heading"><div className={styles.heading}><h2 id="family-heading"><span className={styles.headingDesktop}>{t("bottleFamilies")}</span><span className={styles.headingMobile}>{t("popularFamilies")}</span></h2><LocaleLink href="/bottle-families">{t("viewAll")}<span className={styles.viewAllArrow} aria-hidden="true"> →</span></LocaleLink></div>
        <div className={styles.railWrap}><div ref={rail} id="family-carousel" className={styles.rail} onScroll={update} aria-label={t("familyRail")}>
            {entries.map(c => {
                const art = familyCardSources(c.family, cmsImage(c.image, 800));
                const familyLabel = localizeFamilyName(locale, c.family);
                return <LocaleLink href={familyFinderHref(c.family)} className={styles.family} key={c.family}>
                    {art && <picture>
                        {art.desktop !== art.mobile && <source media="(min-width:641px)" srcSet={art.desktop}/>}
                        <img src={art.mobile} alt={`${familyLabel} bottle family`} width={800} height={1000} loading="lazy"/>
                    </picture>}
                    <span className={styles.familyTitle}>{c.title ? localizeFamilyName(locale, c.title) : familyLabel}</span>
                </LocaleLink>;
            })}
        </div>
        <div className={styles.edgeControls}><button aria-label={t("previousFamily")} aria-controls="family-carousel" disabled={position.start} onClick={()=>move(-1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="M14 4 4 14l10 10"/></svg></button><button aria-label={t("nextFamily")} aria-controls="family-carousel" disabled={position.end} onClick={()=>move(1)}><svg viewBox="0 0 20 28" aria-hidden="true"><path d="m6 4 10 10L6 24"/></svg></button></div></div><div className={styles.railControls} aria-live="polite">{position.index} / {entries.length}</div>
    </section>;
}
/** Stage-percent anchor on the v7 niche still (3584×1024): the underside of the sill at its left end, where the tag hangs. */
const DEMO_HOTSPOTS: NonNullable<HomepageData['heroHotspots']> = [
    { _key: 'demo-bottle', x: 77.3, y: 78.8, label: 'Empire 50 mL', detail: 'Clear glass with an 18-415 neck. Every closure shown here fits it.', href: familyFinderHref('Empire') },
];
export function ShoppingHero({ slides, hotspots }: {slides?:HomepageData['heroSlides']; hotspots?:HomepageData['heroHotspots']}) {
    const [index,setIndex]=useState(0);
    const heroVideo=useRef<HTMLVideoElement>(null);
    // Keep previous scenes available for comparison while using the selected stone photograph.
    const scene=useSyncExternalStore(()=>()=>{}, ()=>{
        const requested=new URLSearchParams(window.location.search).get('hero');
        return requested==='water' ? 'empire-water' : requested==='niche' ? 'empire-niche' : 'diva-circle-stone';
    }, ()=>'diva-circle-stone');
    // ?hotspots=demo previews the hotspot design on the niche hero before any are placed in Sanity.
    const demoHotspots=useSyncExternalStore(()=>()=>{}, ()=>new URLSearchParams(window.location.search).get('hotspots')==='demo', ()=>false);
    const heroHotspots=hotspots?.length ? hotspots : demoHotspots ? DEMO_HOTSPOTS : undefined;
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
    const t = useCopy('home');
    return <section className={styles.hero} data-scene={!slide ? scene : undefined} aria-label={t("featuredBottles")}>
        {slide?.mediaType==='video' && slide.video?.asset?.url ? <video ref={heroVideo} className={styles.heroArt} src={slide.video.asset.url} poster={cmsImage(slide.videoPoster,1800)} autoPlay muted loop playsInline/> : !slide ? (scene==='diva-circle-stone' ? <StoneHeroArt/> : scene==='empire-niche' ? <EmpireFitmentHero hotspots={heroHotspots}/> : <ImmersiveHeroArt/>) : <picture><source media="(max-width:640px)" srcSet={mobile}/><img className={styles.heroArt} src={desktop} alt="Glass perfume bottles with red vintage style bulb sprayers on a stone platform" fetchPriority="high"/></picture>}
        <div className={styles.heroCopy}>
            <h1>{slide?.headline || <><span>{t("headlineA")}</span><span>{t("headlineB")}</span></>}</h1>
            <p className={styles.heroLead}>{slide?.subheadline || t("lead")}</p>
            {!slide?.subheadline && <p className={styles.heroLeadMobile}>{t("leadMobile")}</p>}
            <div className={styles.buttons}>
                <LocaleLink className={styles.primary} href={slide?.ctaHref || '/catalog'}>{slide?.ctaText || t("shopBottles")}</LocaleLink>
                <LocaleLink className={styles.secondary} href="/matrix"><span className={styles.secondaryDesktop}>{t("buildYourBottle")}</span><span className={styles.secondaryMobile}>{t("buildYourBottleTitle")}</span></LocaleLink>
            </div>
        </div>
        {(slides?.length??0)>1 && <div className={styles.heroControls}>{slides!.map((_,i)=><button key={i} aria-label={`Show hero ${i+1}`} aria-pressed={index===i} onClick={()=>setIndex(i)}>{i+1}</button>)}</div>}
    </section>;
}
export default function CollectionShopping({data}:{data:HomepageData|null}){
    const build=data?.buildYourBottle;
    const t = useCopy('home');
    return <div className={styles.page}>
        <ShoppingHero slides={data?.useEditorialArtwork ? data.heroSlides : undefined} hotspots={data?.heroHotspots}/><FamilyCarousel cards={data?.useEditorialArtwork ? data.designFamilyCards : undefined}/>
        <section className={styles.section} aria-labelledby="collections-heading"><div className={styles.heading}><h2 id="collections-heading">{t("collections")}</h2><LocaleLink href="/collections">{t("viewAll")}</LocaleLink></div><p className={styles.intro}>{t("collectionsIntro")}</p><CollectionGrid cards={data?.collectionCards}/></section>
        <BuildYourBottleSteps build={build}/>
    </div>;
}

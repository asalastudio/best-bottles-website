'use client';
import { useLayoutEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CaretRight } from '@/components/icons';
import type { HomeBrowseCard, HomeBrowseData } from '@/lib/homepageBrowse';
import { HOME_FAMILY_MOSAIC } from '@/lib/homepageMerchandising';
import type { HomepageData } from '@/sanity/lib/queries';
import { urlFor } from '@/sanity/lib/image';
import styles from './HomeCatalogBrowser.module.css';

const tabs = ['families','applicators','collections'] as const;
type Tab = typeof tabs[number];
const labels = {families:'Families',applicators:'Applicators',collections:'Collections'};
const storageKey='best-bottles-home-browse-v1';
type Saved = {tab:Tab; expanded:boolean; popular:number; positions:Partial<Record<Tab,number>>};
const initial:Saved={tab:'families',expanded:false,popular:0,positions:{}};

function CardImage({card,featured=false}:{card:HomeBrowseCard;featured?:boolean}) {
 const [failed,setFailed]=useState(false);
 return card.image && !failed ? <Image src={card.image} alt="" fill sizes={featured?'(min-width: 1024px) 33vw, 82vw':'(min-width: 1024px) 16vw, 43vw'} className={featured?styles.photo:styles.product} onError={()=>setFailed(true)} unoptimized={card.image.startsWith('http')} /> : <span className={styles.missing}>Browse {card.label}</span>;
}
function Arrows({label,previous,next,onMove}:{label:string;previous:boolean;next:boolean;onMove:(direction:number)=>void}) {
 return <div className={styles.arrows}><button type="button" aria-label={`Previous ${label}`} disabled={!previous} onClick={()=>onMove(-1)}><ArrowLeft size={19}/></button><button type="button" aria-label={`Next ${label}`} disabled={!next} onClick={()=>onMove(1)}><ArrowRight size={19}/></button></div>;
}
export default function HomeCatalogBrowser({data,designFamilyCards}:{data:HomeBrowseData|null;designFamilyCards?:HomepageData['designFamilyCards']}) {
 const id=useId();const popular=useRef<HTMLDivElement>(null);const track=useRef<HTMLDivElement>(null);const panelHeading=useRef<HTMLHeadingElement>(null);
 const saved=useRef<Saved>({...initial,positions:{}});const ready=useRef(false);
 const [tab,setTab]=useState<Tab>('families');const [expanded,setExpanded]=useState(false);
 const [popularEdges,setPopularEdges]=useState({previous:false,next:false});const [edges,setEdges]=useState({previous:false,next:false});
 const cards=data?.[tab]??[];
 // Editorial order is configurable in the existing merchandising list, not a sales ranking.
 const featured=HOME_FAMILY_MOSAIC.flatMap(f=>{
  const found=data?.families.find(c=>c.id===f.family);if(!found)return [];
  const editorial=designFamilyCards?.find(c=>c.family===f.family);
  // A generated, gated bare-glass card (true relative scale) outranks the CMS still for that family.
  return [{...found,image:f.card??(editorial?.image?urlFor(editorial.image):f.image)}];
 });
 function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify(saved.current));}catch{/* Storage is optional in private browsing. */}}
 function sync(which:'popular'|'catalog'){
  const el=(which==='popular'?popular:track).current;if(!el || el.clientWidth===0)return;
  const value={previous:el.scrollLeft>2,next:el.scrollLeft+el.clientWidth<el.scrollWidth-2};
  (which==='popular'?setPopularEdges:setEdges)(value);
  if(!ready.current || tab!==saved.current.tab || expanded!==saved.current.expanded)return;
  if(which==='popular')saved.current.popular=el.scrollLeft;else if(!expanded)saved.current.positions[tab]=el.scrollLeft;
  persist();
 }
 useLayoutEffect(()=>{
  try{const value=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(value&&tabs.includes(value.tab)){
   saved.current={tab:value.tab,expanded:value.expanded===true,popular:Number(value.popular)||0,positions:value.positions??{}};
   setTab(saved.current.tab);setExpanded(saved.current.expanded);
  }}catch{/* Keep browsing usable if storage is unavailable. */}
  ready.current=true;
 },[]);
 useLayoutEffect(()=>{
  // Cached routes can be hidden by Next while retaining their DOM. Never persist
  // their zero-width scroll positions, and restore only once the track is visible.
  if(tab!==saved.current.tab || expanded!==saved.current.expanded)return;
  const p=popular.current;const t=track.current;
  let restorePopular=true;let restoreCatalog=true;
  const measure=()=>{
   if(p?.clientWidth && restorePopular){p.scrollLeft=saved.current.popular;restorePopular=false;}
   if(t?.clientWidth && restoreCatalog){if(!expanded)t.scrollLeft=Number(saved.current.positions[tab])||0;restoreCatalog=false;}
   sync('popular');sync('catalog');
  };
  const observer=new ResizeObserver(measure);
  if(p)observer.observe(p);if(t)observer.observe(t);
  measure();return()=>observer.disconnect();
 // Restore per-tab positions after the new track has rendered.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[tab,expanded,data]);
 function move(which:'popular'|'catalog',direction:number){
  const el=(which==='popular'?popular:track).current;if(!el)return;
  el.scrollBy({left:direction*el.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function chooseTab(next:Tab){saved.current.tab=next;saved.current.expanded=false;setTab(next);setExpanded(false);persist();}
 function tabKey(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const next=event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:-1;
  if(next<0)return;event.preventDefault();chooseTab(tabs[next]);document.getElementById(`${id}-${tabs[next]}`)?.focus();
 }
 function toggle(){saved.current.expanded=!expanded;setExpanded(!expanded);persist();if(expanded)panelHeading.current?.scrollIntoView({block:'start',behavior:'instant'});}
 return <div className={styles.browser} data-home-browse>
  <section aria-labelledby={`${id}-popular`} className={styles.popular}>
   <div className={styles.heading}><h2 id={`${id}-popular`}>Popular families</h2><Arrows label="popular families" {...popularEdges} onMove={d=>move('popular',d)}/></div>
   {data ? <div ref={popular} className={styles.popularTrack} onScroll={()=>sync('popular')} data-popular-track>
    {featured.map(card=><Link prefetch={false} key={card.id} href={card.href} className={styles.featured} onClick={persist}><CardImage card={card} featured/><div className={styles.caption}><h3>{card.label}</h3><span>Shop family <ArrowRight size={16}/></span></div></Link>)}
   </div> : <p>Browse our <Link href="/catalog">complete catalog</Link>. Family browsing is temporarily unavailable.</p>}
  </section>
  <section aria-labelledby={`${id}-catalog`} className={styles.catalog}>
   <div className={styles.heading}><h2 ref={panelHeading} id={`${id}-catalog`}>Explore the catalog</h2><button className={styles.viewAll} type="button" aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={toggle}>{expanded?'Show less':'View all'}<ArrowRight size={16}/></button></div>
   <div role="tablist" aria-label="Browse catalog by" className={styles.tabs}>{tabs.map((name,i)=><button id={`${id}-${name}`} key={name} role="tab" aria-selected={tab===name} aria-controls={`${id}-panel`} tabIndex={tab===name?0:-1} onKeyDown={e=>tabKey(e,i)} onClick={()=>chooseTab(name)}>{labels[name]}{data&&<span>{data[name].length}</span>}</button>)}</div>
   <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
    <div key={`${tab}-${expanded}`} ref={track} className={expanded?styles.expanded:styles.compact} onScroll={()=>sync('catalog')} data-catalog-track>
     {cards.map(card=><Link prefetch={false} key={card.id} href={card.href} className={styles.card} onClick={persist}><div className={styles.image}><CardImage card={card}/></div><span>{card.label}<CaretRight size={17}/></span></Link>)}
    </div>
    {!expanded&&<div className={styles.controls}><span>Browse {labels[tab].toLowerCase()}</span><Arrows label={labels[tab].toLowerCase()} {...edges} onMove={d=>move('catalog',d)}/></div>}
   </div>
  </section>
  <Link href="/matrix" className={styles.builder}>Build your bottle<CaretRight size={22}/></Link>
  <p className={styles.terms}>$50 minimum per cart at checkout. Free shipping on orders above $99. <Link href="/shipping-returns">Shipping details</Link></p>
 </div>;
}

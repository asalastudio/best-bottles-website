/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import ShoppingHeader from '@/components/home/ShoppingHeader';
import { FAMILY_ART } from '@/lib/homepageFamilyArt';
import Footer from '@/components/Footer';
import styles from '@/components/home/CollectionShopping.module.css';
import { getHomepageBrowse } from '@/lib/homepageBrowse.server';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { PRODUCT_TYPE_FAMILIES } from '@/lib/catalogFilters';
export const metadata:Metadata={title:'Shop by Bottle Family | Best Bottles',description:'Explore the shapes of Best Bottles, including Cylinder, Elegant, Circle, Diva, Grace, Empire and Round.'};
export default async function BottleFamiliesPage(){
    const data=await getHomepageBrowse().catch(()=>null);
    const names=data ? data.families.map(c=>c.label).filter(name=>!PRODUCT_TYPE_FAMILIES.includes(name as never)&&name!=='Atomizer') : Object.keys(FAMILY_ART);
    return <div className={styles.page}><ShoppingHeader/><main className={styles.directory}><Link className={styles.breadcrumb} href="/">Home / Bottle families</Link><h1>Shop by Bottle Family</h1><p className={styles.intro}>Start with a shape. Then explore its available sizes, glass finishes and dispensers. Looking for a specific dispenser? <Link className="underline" href="/collections">Shop by collection.</Link></p><div className={styles.familyGrid}>{names.map(name=><Link key={name} href={familyFinderHref(name)} className={FAMILY_ART[name]?styles.family:styles.textFamily}>{FAMILY_ART[name]&&<img src={`/assets/homepage/${FAMILY_ART[name]}.webp`} alt={`${name} bottle family`} width={800} height={1000} loading="lazy"/>}<span className={styles.familyTitle}>{name}</span></Link>)}</div></main><Footer/></div>;
}

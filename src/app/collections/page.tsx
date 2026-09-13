import type { Metadata } from 'next';
import Link from 'next/link';
import ShoppingHeader from '@/components/home/ShoppingHeader';
import { CollectionGrid } from '@/components/home/CollectionShopping';
import Footer from '@/components/Footer';
import styles from '@/components/home/CollectionShopping.module.css';
import { HOMEPAGE_QUERY, type HomepageData } from '@/sanity/lib/queries';
import { sanityFetch } from '@/sanity/lib/live';
import { isSanityConfigured } from '@/sanity/lib/client';
export const metadata: Metadata={title:'Shop by Collection | Best Bottles',description:'Find roll-on bottles, travel perfume atomizers, glass sprays, droppers, sample vials, jars and accessories.'};
export default async function CollectionsPage(){
    let data: HomepageData|null=null;
    if(isSanityConfigured)try{data=(await sanityFetch({query:HOMEPAGE_QUERY})).data as HomepageData|null;}catch{}
    return <div className={styles.page}><ShoppingHeader/><main className={styles.directory}><Link className={styles.breadcrumb} href="/">Home / Collections</Link><h1>Shop by Collection</h1><p className={styles.intro}>Find the way you want to dispense, carry or present your product. Explore the available bottle families, sizes and finishes within each collection.</p><CollectionGrid all cards={data?.collectionCards}/></main><Footer/></div>;
}

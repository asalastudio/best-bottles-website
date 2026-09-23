import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import ShoppingHeader from '@/components/home/ShoppingHeader';
import { CollectionGrid } from '@/components/home/CollectionShopping';
import Footer from '@/components/Footer';
import LocaleLink from '@/components/LocaleLink';
import styles from '@/components/home/CollectionShopping.module.css';
import { HOMEPAGE_QUERY, type HomepageData } from '@/sanity/lib/queries';
import { sanityFetch } from '@/sanity/lib/live';
import { isSanityConfigured } from '@/sanity/lib/client';
import { defaultLocale, isLocale, type AppLocale } from '@/i18n/config';
import { buildHreflangAlternates } from '@/i18n/metadata';
import enMessages from '../../../messages/en.json';
import esMessages from '../../../messages/es.json';

export async function generateMetadata(): Promise<Metadata> {
    const localeValue = await getLocale();
    const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
    const copy = locale === 'es' ? esMessages.home : enMessages.home;
    const path = locale === 'es' ? '/es/collections' : '/collections';
    return {
        title: { absolute: copy.collectionsSeoTitle },
        description: copy.collectionsSeoDescription,
        alternates: buildHreflangAlternates(path),
    };
}

export default async function CollectionsPage(){
    const localeValue = await getLocale();
    const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
    const copy = locale === 'es' ? esMessages.home : enMessages.home;
    let data: HomepageData|null=null;
    if(isSanityConfigured)try{data=(await sanityFetch({query:HOMEPAGE_QUERY})).data as HomepageData|null;}catch{}
    return <div className={styles.page}><ShoppingHeader/><main className={styles.directory}><LocaleLink className={styles.breadcrumb} href="/">{copy.collectionsBreadcrumb}</LocaleLink><h1>{copy.collections}</h1><p className={styles.intro}>{copy.collectionsDirectoryIntro}</p><CollectionGrid all cards={data?.collectionCards}/></main><Footer/></div>;
}

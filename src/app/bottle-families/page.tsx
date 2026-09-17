/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import ShoppingHeader from '@/components/home/ShoppingHeader';
import { FAMILY_ART, familyCardSources } from '@/lib/homepageFamilyArt';
import Footer from '@/components/Footer';
import LocaleLink from '@/components/LocaleLink';
import styles from '@/components/home/CollectionShopping.module.css';
import { getHomepageBrowse } from '@/lib/homepageBrowse.server';
import { familyFinderHref } from '@/lib/products/focused-shopping';
import { PRODUCT_TYPE_FAMILIES } from '@/lib/catalogFilters';
import { localizeFamilyName } from '@/i18n/catalogCopy';
import { defaultLocale, isLocale, type AppLocale } from '@/i18n/config';
import { buildHreflangAlternates } from '@/i18n/metadata';
import enMessages from '../../../messages/en.json';
import esMessages from '../../../messages/es.json';

export async function generateMetadata(): Promise<Metadata> {
    const localeValue = await getLocale();
    const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
    const copy = locale === 'es' ? esMessages.familiesDirectory : enMessages.familiesDirectory;
    const path = locale === 'es' ? '/es/bottle-families' : '/bottle-families';
    return {
        title: { absolute: copy.seoTitle },
        description: copy.seoDescription,
        alternates: buildHreflangAlternates(path),
    };
}

export default async function BottleFamiliesPage(){
    const localeValue = await getLocale();
    const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
    const copy = locale === 'es' ? esMessages.familiesDirectory : enMessages.familiesDirectory;
    const data=await getHomepageBrowse().catch(()=>null);
    const names=data ? data.families.map(c=>c.label).filter(name=>!PRODUCT_TYPE_FAMILIES.includes(name as never)&&name!=='Atomizer') : Object.keys(FAMILY_ART);
    return <div className={styles.page}><ShoppingHeader/><main className={styles.directory}><LocaleLink className={styles.breadcrumb} href="/">{copy.breadcrumb}</LocaleLink><h1>{copy.title}</h1><p className={styles.intro}>{copy.intro} <LocaleLink className="underline" href="/collections">{copy.shopByCollection}</LocaleLink></p><div className={styles.familyGrid}>{names.map(name=>{const art=familyCardSources(name);return <LocaleLink key={name} href={familyFinderHref(name)} className={art?styles.family:styles.textFamily}>{art&&<picture>{art.desktop!==art.mobile&&<source media="(min-width:641px)" srcSet={art.desktop}/>}<img src={art.mobile} alt={`${localizeFamilyName(locale, name)} bottle family`} width={800} height={1000} loading="lazy"/></picture>}<span className={styles.familyTitle}>{localizeFamilyName(locale, name)}</span></LocaleLink>;})}</div></main><Footer/></div>;
}

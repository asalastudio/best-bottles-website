import { BOTTLE_CATEGORIES, FAMILY_ORDER } from './catalogFilters';
import { HOME_ACCESSORY_STORY, HOME_APPLICATION_LINKS, HOME_EDITORIAL_STORIES, HOME_SAMPLE_FEATURE, homepageFamilyHref } from './homepageMerchandising';
import { isVisibleCatalogGroup } from './products/catalog-listing-visibility';

export type HomeBrowseCard = { id: string; label: string; href: string; image: string | null };
export type HomeBrowseData = { families: HomeBrowseCard[]; applicators: HomeBrowseCard[]; collections: HomeBrowseCard[]; glassFamilyCount: number };
export type HomeBrowseGroup = { _id: string; slug: string; family: string; category: string; variantCount: number; heroImageUrl?: string | null };
type Hero = { groupSlug: string; family: string; url: string };

/** Exact catalog labels are navigation identities. Never coalesce similar names. */
export function buildHomeBrowseData(groups: readonly HomeBrowseGroup[], heroes: readonly Hero[]): HomeBrowseData {
    const visible = groups.filter(g => isVisibleCatalogGroup(g));
    const bottles = visible.filter(g => BOTTLE_CATEGORIES.has(g.category) || g.category === 'Metal Atomizer');
    const imageFor = (rows: readonly HomeBrowseGroup[]) => {
        const slugs = new Set(rows.map(g => g.slug));
        return heroes.find(h => slugs.has(h.groupSlug) && rows.some(g => g.slug === h.groupSlug && g.family === h.family))?.url
            ?? rows.find(g => g.heroImageUrl)?.heroImageUrl ?? null;
    };
    const names = [...new Set(bottles.map(g => g.family).filter(Boolean))];
    const rank = (name: string) => FAMILY_ORDER.includes(name) ? FAMILY_ORDER.indexOf(name) : FAMILY_ORDER.length;
    names.sort((a,b) => rank(a)-rank(b) || a.localeCompare(b));
    const families = names.map(name => ({ id: name, label: name, href: homepageFamilyHref(name), image: imageFor(bottles.filter(g => g.family === name)) }));
    const familyImage = (name: string) => imageFor(visible.filter(g => g.family === name));
    const collection = (id: string, label: string, href: string, family: string): HomeBrowseCard => ({id,label,href,image:familyImage(family)});
    return {
        families,
        glassFamilyCount: new Set(bottles.filter(g => g.category === 'Glass Bottle').map(g => g.family)).size,
        applicators: HOME_APPLICATION_LINKS.map(c => ({id:c.key,label:c.label,href:c.href,image:c.image})),
        collections: [
            collection('samples','Samples & Testers',HOME_SAMPLE_FEATURE.href,'Vial'),
            collection('cream-jars','Cream Jars',HOME_EDITORIAL_STORIES.find(c=>c.key==='cream-jars')!.href,'Cream Jar'),
            collection('gift-bottles','Gift Bottles',HOME_EDITORIAL_STORIES.find(c=>c.key==='gift-bottles')!.href,'Decorative'),
            collection('bags','Bags & Pouches',HOME_ACCESSORY_STORY.links.find(c=>c.label==='Bags & Pouches')!.href,'Gift Bag'),
            ...HOME_ACCESSORY_STORY.links.filter(c=>c.label!=='Bags & Pouches').map(c=>collection(c.label,c.label,c.href,c.label==='Gift Boxes'?'Gift Box':'Tool')),
        ],
    };
}

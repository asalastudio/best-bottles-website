/** Merchandising views of existing catalog groups. Never creates product identities
 * or implies compatibility. Group category and dispenser are both required. */
export const SHOP_COLLECTIONS = [
    { key: 'roll-on-bottles', title: 'Roll-On Bottles', subtitle: 'A precise, personal application.', featured: true },
    { key: 'perfume-atomizers', title: 'Perfume Atomizers', subtitle: 'Refillable fragrance, ready to travel.', featured: true },
    { key: 'glass-spray-bottles', title: 'Glass Spray Bottles', subtitle: 'Fine mist, perfume and vintage style bulb sprays.', featured: true },
    { key: 'dropper-bottles', title: 'Dropper Bottles', subtitle: 'A measured drop for oils and serums.', featured: true },
    { key: 'sample-vials', title: 'Sample Vials', subtitle: 'Small formats for first impressions.', featured: true },
    { key: 'lotion-pump-bottles', title: 'Lotion Pump Bottles', subtitle: 'Dispensing for lotions and treatments.', featured: true },
    { key: 'splash-on-bottles', title: 'Splash-On Bottles', subtitle: 'Fragrance bottles with reducer fitments.', featured: false },
    { key: 'decorative-bottles', title: 'Decorative Bottles', subtitle: 'Hearts, teardrops and distinctive forms.', featured: false },
    { key: 'apothecary-bottles', title: 'Apothecary Bottles', subtitle: 'Traditional glass applicators and stoppers.', featured: false },
    { key: 'cream-jars', title: 'Cream Jars', subtitle: 'Wide openings for creams and balms.', featured: false },
    { key: 'accessories-packaging', title: 'Accessories & Packaging', subtitle: 'Loose components, tools, bags and boxes.', featured: false },
] as const;
export type ShopCollectionKey = typeof SHOP_COLLECTIONS[number]['key'];
export function getShopCollection(key: unknown) { return SHOP_COLLECTIONS.find(collection => collection.key === key); }
export function shopCollectionHref(key: ShopCollectionKey) { return `/catalog?shop=${key}`; }
export type CollectionGroup = { category: string; family?: string | null; slug: string; applicatorTypes?: string[] | null };
export function matchesShopCollection(group: CollectionGroup, key: string): boolean {
    const glass = group.category === 'Glass Bottle';
    const bottle = glass || ['Plastic Bottle', 'Aluminum Bottle'].includes(group.category);
    const has = (...values: string[]) => (group.applicatorTypes ?? []).some(value => values.includes(value));
    const apothecary = group.family === 'Apothecary' || /^(eternal-flame|pear)-/.test(group.slug);
    switch (key) {
        case 'roll-on-bottles': return bottle && has('Metal Roller Ball', 'Plastic Roller Ball');
        case 'perfume-atomizers': return group.category === 'Metal Atomizer' && group.family === 'Atomizer';
        case 'glass-spray-bottles': return glass && has('Fine Mist Sprayer', 'Perfume Spray Pump', 'Vintage Bulb Sprayer', 'Vintage Bulb Sprayer with Tassel');
        case 'dropper-bottles': return bottle && has('Dropper');
        case 'sample-vials': return glass && group.family === 'Vial';
        case 'lotion-pump-bottles': return bottle && has('Lotion Pump');
        case 'splash-on-bottles': return glass && has('Reducer');
        case 'decorative-bottles': return glass && !apothecary && ['Decorative', 'Teardrop'].includes(group.family ?? '');
        case 'apothecary-bottles': return glass && apothecary;
        case 'cream-jars': return group.category === 'Glass Jar' && group.family === 'Cream Jar';
        case 'accessories-packaging': return ['Component', 'Accessory', 'Packaging'].includes(group.category);
        default: return false;
    }
}

export type CollectionCardConfig = { collectionKey: string; title?: string; subtitle?: string; image?: { asset?: { _ref: string } }; order?: number; enabled?: boolean };
export function featuredCollectionCards(config?: CollectionCardConfig[]) {
    if (!config) return SHOP_COLLECTIONS.filter(row => row.featured).map(row => ({ ...row, image: undefined as CollectionCardConfig['image'] }));
    const seen = new Set<string>();
    return [...config].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).flatMap(card => {
        const collection = getShopCollection(card.collectionKey);
        if (!collection || card.enabled === false || seen.has(collection.key)) return [];
        seen.add(collection.key);
        return [{ ...collection, title: card.title || collection.title, subtitle: card.subtitle || collection.subtitle, image: card.image }];
    });
}

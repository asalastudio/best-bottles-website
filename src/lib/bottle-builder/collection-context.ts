import type { BuilderBody, BuilderConfiguration } from './model';
/** Restrict existing validated assemblies; never infer compatibility from threads. */
export const BUILDER_COLLECTION_FITMENTS: Record<string, readonly string[]> = {
    'roll-on-bottles':['Metal Roller','Plastic Roller'],
    'glass-spray-bottles':['Fine Mist Sprayer','Perfume Sprayer','Vintage Bulb Sprayer','Vintage Bulb Sprayer with Tassel'],
    'dropper-bottles':['Dropper'],
    'lotion-pump-bottles':['Lotion Pump'],
    'splash-on-bottles':['Reducer'],
};

/** The chooser draws each glass from the first configuration of that colour, and
 * only that one carries the bare-glass layer (payload.ts keeps one per colour).
 * When the collection drops it (a Cylinder whose first clear configuration is a
 * sprayer), the first kept configuration of the colour inherits the same body
 * layer: the bare glass is identical whatever fitment goes on it. Without this,
 * "Start building" from a roll-on PDP drew every Cylinder tile as "Image unavailable". */
function keepChooserGlass(all: BuilderConfiguration[], kept: BuilderConfiguration[]): BuilderConfiguration[] {
    const seen = new Set<string>();
    return kept.map(config => {
        if (seen.has(config.color)) return config;
        seen.add(config.color);
        if (config.bodyImage || config.chooserKit || config.kit || config.previewKit) return config;
        const donor = all.find(other => other.color === config.color && (other.chooserKit || other.bodyImage));
        if (!donor) return config;
        return { ...config, ...(donor.chooserKit ? { chooserKit: donor.chooserKit } : { bodyImage: donor.bodyImage }) };
    });
}

export function builderCollectionBodies(bodies:BuilderBody[],collection?:string){
    const fitments=collection ? BUILDER_COLLECTION_FITMENTS[collection] : undefined;
    if(!fitments)return bodies;
    return bodies.map(body=>({...body,configurations:keepChooserGlass(body.configurations,body.configurations.filter(c=>fitments.includes(c.fitment))),unavailableFinishes:body.unavailableFinishes?.filter(c=>fitments.includes(c.fitment))})).filter(body=>body.configurations.length>0);
}

import type { BuilderBody } from './model';
/** Restrict existing validated assemblies; never infer compatibility from threads. */
export const BUILDER_COLLECTION_FITMENTS: Record<string, readonly string[]> = {
    'roll-on-bottles':['Metal Roller','Plastic Roller'],
    'glass-spray-bottles':['Fine Mist Sprayer','Perfume Sprayer','Vintage Bulb Sprayer','Vintage Bulb Sprayer with Tassel'],
    'dropper-bottles':['Dropper'],
    'lotion-pump-bottles':['Lotion Pump'],
    'splash-on-bottles':['Reducer'],
};
export function builderCollectionBodies(bodies:BuilderBody[],collection?:string){
    const fitments=collection ? BUILDER_COLLECTION_FITMENTS[collection] : undefined;
    if(!fitments)return bodies;
    return bodies.map(body=>({...body,configurations:body.configurations.filter(c=>fitments.includes(c.fitment)),unavailableFinishes:body.unavailableFinishes?.filter(c=>fitments.includes(c.fitment))})).filter(body=>body.configurations.length>0);
}

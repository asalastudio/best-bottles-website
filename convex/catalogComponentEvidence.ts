import reviewedLinks from "./catalog-component-links.json";

type Identity = {
    websiteSku?: string | null; graceSku?: string | null; family?: string | null;
    capacityMl?: number | null; color?: string | null; neckThreadSize?: string | null;
    applicator?: string | null; capColor?: string | null;
};

/** An exact catalog assembly witness, never permission to fit a sibling. */
export function reviewedCatalogLink(bottle: Identity) {
    return reviewedLinks.find(link => link.assemblySku === bottle.websiteSku && link.assemblyGraceSku === bottle.graceSku
        && link.family === bottle.family && link.capacityMl === bottle.capacityMl && link.color === bottle.color
        && link.neck === bottle.neckThreadSize && link.applicator === bottle.applicator && link.finish === bottle.capColor);
}

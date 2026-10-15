import source from './local-copper-caps.json';
import type { RegisterComponent, RegisterKit } from './stage-kit';

/** Local alpha cleanup, after measured composition. Keep the source image datum. */
export function localCopperCaps(kit: RegisterKit, components: Readonly<Record<string, RegisterComponent>>): RegisterKit {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL || !source.websiteSkus.includes(kit.sku)) return kit;
    const component = components[source.componentId];
    const layer = component?.layers.find(p => p.slot === source.slot && !p.bodyId);
    const e = source.expectedLayer;
    if (!component?.approved || component.type !== source.expectedComponentType || !layer || layer.url !== e.url
        || layer.width !== e.width || layer.height !== e.height || layer.pxPerMm !== e.pxPerMm
        || layer.anchor.x !== e.anchor.x || layer.anchor.y !== e.anchor.y || layer.solidBottomY !== e.solidBottomY
        || layer.explodeIndex !== e.explodeIndex || layer.z !== e.z || layer.approved !== e.approved
        || component.layers.some(p => p.slot === source.slot && p.bodyId === kit.register.bodyId)) return kit;
    let changed = false;
    const parts = kit.parts.map(p => {
        if (p.slot !== source.slot || p.componentId !== source.componentId || p.image.url !== e.url
            || p.image.width !== source.width || p.image.height !== source.height) return p;
        changed = true;
        return { ...p, image: { ...p.image, url: source.url, key: source.url, sha256: source.sha256, bytes: source.bytes } };
    });
    return changed ? { ...kit, parts } : kit;
}

import { storefrontFamily } from "../products/storefront-family";
import { emptySelection, type BuilderBody, type BuilderSelection } from "./model";
import { chooserBodies } from "./payload";
export type BuilderFamily = { family: string; groups: number };

/** The selected family is the critical path. Discover other eligible families
 * after the workspace is usable; never expose unvalidated catalog families. */
export async function loadBuilderEntry(requested: string | undefined, loaders: {
    family: (name: string) => Promise<BuilderBody[]>;
    families: () => Promise<BuilderFamily[]>;
}) {
    const preferred = requested && requested.length <= 100 ? storefrontFamily(requested) : "Cylinder";
    const bodies = await loaders.family(preferred);
    if (bodies.length) return { openFamily: preferred, bodies, families: [{ family: preferred, groups: bodies.length }] };
    const families = await loaders.families();
    const openFamily = families.find(f => f.family === "Cylinder")?.family ?? families[0]?.family ?? "Cylinder";
    return { openFamily, families, bodies: openFamily === preferred ? bodies : await loaders.family(openFamily) };
}

/** Resolve against current eligible configurations, never approximate a product
 * by capacity or neck. Keep the chosen body's complete options on first paint
 * so its selected finish survives chooser slimming and hydration. */
export function builderProductEntry(bodies: BuilderBody[], sku?: string) {
    const wanted = typeof sku === "string" && sku.length <= 200 ? sku : null;
    const body = wanted ? bodies.find(b => b.configurations.some(c => c.id === wanted || c.product.graceSku === wanted)) : undefined;
    const config = body?.configurations.find(c => c.id === wanted || c.product.graceSku === wanted);
    const selection: BuilderSelection = config && body ? {
        ...emptySelection(), bodyId: body.id, color: config.color, fitment: config.fitment, closure: config.closure,
    } : emptySelection();
    return {
        bodies: chooserBodies(bodies).map(b => b.id === body?.id ? { ...body, chooserOnly: false } : b),
        selection,
        step: config ? 3 : 0,
        unavailable: Boolean(sku && !config),
    };
}

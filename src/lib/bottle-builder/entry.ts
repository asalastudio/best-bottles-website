import type { BuilderBody } from "./model";
export type BuilderFamily = { family: string; groups: number };

/** The selected family is the critical path. Discover other eligible families
 * after the workspace is usable; never expose unvalidated catalog families. */
export async function loadBuilderEntry(requested: string | undefined, loaders: {
    family: (name: string) => Promise<BuilderBody[]>;
    families: () => Promise<BuilderFamily[]>;
}) {
    const preferred = requested && requested.length <= 100 ? requested : "Cylinder";
    const bodies = await loaders.family(preferred);
    if (bodies.length) return { openFamily: preferred, bodies, families: [{ family: preferred, groups: bodies.length }] };
    const families = await loaders.families();
    const openFamily = families.find(f => f.family === "Cylinder")?.family ?? families[0]?.family ?? "Cylinder";
    return { openFamily, families, bodies: openFamily === preferred ? bodies : await loaders.family(openFamily) };
}

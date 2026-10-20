import recipesJson from './recipes.json';
import { releaseEntries } from './release';
import type { RegisterKit, RegisterStagePayload } from '../register/stage-kit';

type Source = { assembly: unknown; plate: unknown; body: unknown; components: Record<string, unknown> };
const recipes = recipesJson as unknown as Record<string, { kit: RegisterKit; sources: Source[] }>;
function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
}
function sourceFor(payload: RegisterStagePayload, graceSku: string): Source | null {
    const assembly = payload.assemblies[graceSku];
    if (!assembly) return null;
    return { assembly, plate: payload.plates[assembly.plateKey], body: payload.bodies[assembly.bodyId],
        components: Object.fromEntries(assembly.parts.map(p => [p.componentId, payload.components[p.componentId]])) };
}
/** Frozen accepted media only. Current exact assembly, plate, body and complete
 * component layer definitions must match a reviewed source. No commerce data is
 * included or changed. A mismatch retains the caller's existing kit. */
export function applyMediaRelease(payload: RegisterStagePayload, previous: Record<string, RegisterKit>) {
    const kits = { ...previous };
    const rejected: string[] = [];
    for (const entry of releaseEntries()) {
        const source = sourceFor(payload, entry.graceSku);
        if (!source) {
            if (Object.hasOwn(payload.assemblies, entry.graceSku)) rejected.push(entry.websiteSku);
            continue; // Unrequested families/batches are absent.
        }
        const recipe = recipes[entry.websiteSku];
        if (!recipe || !recipe.sources.some(expected => stable(source) === stable(expected))) {
            rejected.push(entry.websiteSku);
            continue;
        }
        const kit = structuredClone(recipe.kit);
        kits[entry.websiteSku] = kit;
        kits[entry.graceSku] = kit;
    }
    return { kits, rejected };
}

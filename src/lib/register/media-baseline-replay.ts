/** Pure, read-only replay of a captured public family catalogue. */
import type { CatalogSearchGroup, CatalogSearchPrimarySku, CatalogSearchVariantPreviewRow } from '../catalogSearchFallback';
import type { RegisterStagePayload } from './stage-kit';

type CapturedProduct = { websiteSku: string; family?: string | null; capacityMl?: number | null; applicator?: string | null; capColor?: string | null; productGroupId?: string | null };
export const localMediaBaselineAllowed = (nodeEnv: string | undefined, vercel: string | undefined) => nodeEnv === 'development' && !vercel;
export type MediaBaseline = {
    schemaVersion: number;
    family: string;
    capturedAt: string;
    source: string;
    queries: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
    scopeSkus: string[];
    scopeSlugs: string[];
    scopeGroupIds: string[];
    register: RegisterStagePayload;
    legacy: Record<string, unknown>;
    plates: Record<string, unknown>;
    lookups: Record<string, { product?: CapturedProduct | null } | null>;
    previews: Array<{ groupId: string; variants: unknown[] }>;
    catalog?: { groups: CatalogSearchGroup[]; primarySkus: CatalogSearchPrimarySku[]; variantPreviewRows: CatalogSearchVariantPreviewRow[]; capturedAt: string };
};

export function canonicalQueryArgs(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalQueryArgs).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalQueryArgs(v)}`).join(',')}}`;
    return JSON.stringify(value);
}

/** null means outside this snapshot's scope; a matching missing receipt throws. */
export function replayMediaQuery(snapshot: MediaBaseline, name: string, args: Record<string, unknown>, family?: string): { value: unknown } | null {
    const match = snapshot.queries.find(q => q.name === name && canonicalQueryArgs(q.args) === canonicalQueryArgs(args));
    if (match) return { value: structuredClone(match.result) };
    const scoped = new Set(snapshot.scopeSkus);
    const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    const pairs = Array.isArray(args.pairs) ? args.pairs.flatMap(p => p && typeof p === 'object' ? strings([p.websiteSku, p.graceSku]) : []) : [];
    const requested = args.graceSkus !== undefined ? strings(args.graceSkus) : args.skus !== undefined ? strings(args.skus) : pairs;
    const sku = typeof args.sku === 'string' ? args.sku : '';
    const anyScoped = requested.some(s => scoped.has(s));
    const select = <T>(data: Record<string, T>, keys: string[]) => Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]]));
    if (name === 'products:lookupSku' && (scoped.has(sku) || family === snapshot.family) && sku in snapshot.lookups) return { value: structuredClone(snapshot.lookups[sku]) };
    if (anyScoped) {
        if (requested.some(s => !scoped.has(s))) throw new Error('Media baseline cannot mix captured and uncaptured SKUs in one query');
        if (name === 'registerStage:forSkus') return { value: structuredClone({ ...snapshot.register, assemblies: select(snapshot.register.assemblies, strings(args.graceSkus)) }) };
        if (name === 'productKits:forSkus') return { value: structuredClone(select(snapshot.legacy, requested)) };
        if (name === 'productPlates:forSkus') return { value: { plates: structuredClone(select(snapshot.plates, requested)), conflicts: [] } };
    }
    const groupIds = strings(args.groupIds);
    if (name === 'products:getCatalogGroupVariantPreviewData' && groupIds.some(id => snapshot.scopeGroupIds.includes(id))) {
        if (groupIds.some(id => !snapshot.scopeGroupIds.includes(id))) throw new Error('Media baseline cannot mix group scopes');
        return { value: structuredClone(snapshot.previews.filter(p => groupIds.includes(String(p.groupId)))) };
    }
    if (anyScoped || strings([args.sku, args.websiteSku, args.graceSku]).some(s => scoped.has(s)) || (typeof args.slug === 'string' && snapshot.scopeSlugs.includes(args.slug)) || args.family === snapshot.family) {
        throw new Error(`Missing captured media query: ${name}. Refresh the family snapshot; do not fall back to development.`);
    }
    return null;
}

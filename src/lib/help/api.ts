/**
 * Projections for the public, read-only help API (/api/kb/v1). Only published
 * public entries and the fit index's public fields leave the server; every
 * field is listed explicitly so nothing new leaks by default.
 */
import { SITE_URL } from "@/lib/seo";
import { FIT_SNAPSHOT, FIT_STATUS_LABEL, FIT_STATUS_MEANING, allBodies, bodyLabel, fitHref, fitReport, itemCatalogHref, type FitBody, type FitGroup } from "./fit";
import { KB_TOPICS, publicEntries, toPublicEntry, type KbTopicId } from "./kb";
import { searchHelp } from "./search";
import { neckBuilder, neckBuilderHref, neckBuilderNecks, type BuilderPart } from "./fit-neck";

export const KB_API_VERSION = "1.0.0";

const abs = (path: string) => `${SITE_URL}${path}`;

export function apiEntry(entry: Parameters<typeof toPublicEntry>[0]) {
    const pub = toPublicEntry(entry);
    return { ...pub, url: abs(pub.url) };
}

export function apiEntries(topic?: string | null) {
    const valid = KB_TOPICS.some((t) => t.id === topic) ? (topic as KbTopicId) : null;
    return {
        version: KB_API_VERSION,
        topics: KB_TOPICS.map(({ id, title, summary }) => ({ id, title, summary })),
        entries: publicEntries().filter((entry) => !valid || entry.topic === valid).map(apiEntry),
    };
}

function apiBottle(body: FitBody) {
    return {
        id: body.id,
        name: bodyLabel(body),
        family: body.family,
        capacityMl: body.capacityMl,
        neck: body.neck,
        category: body.category,
        interchangeableClosures: body.interchangeable,
        glass: body.glass,
        heightMm: body.heightMm,
        diameterMm: body.diameterMm,
        fitUrl: body.interchangeable ? abs(fitHref(body)) : null,
        apiUrl: abs(`/api/kb/v1/fit/${encodeURIComponent(body.id)}`),
    };
}

const flat = (groups: FitGroup[]) => groups.flatMap((g) => g.rows.map((row) => ({
    componentId: row.componentId,
    itemCode: row.itemCode,
    name: row.name,
    type: row.type,
    group: g.label,
    basis: row.basis,
    neck: row.neck,
    status: row.status,
    statusLabel: FIT_STATUS_LABEL[row.status],
    catalogUrl: row.itemCode ? abs(itemCatalogHref(row.itemCode)) : null,
})));

export function apiFitSource() {
    return { source: "Best Bottles component register", snapshotDate: FIT_SNAPSHOT.date, note: FIT_SNAPSHOT.note, statuses: Object.fromEntries((Object.keys(FIT_STATUS_LABEL) as Array<keyof typeof FIT_STATUS_LABEL>).map((s) => [s, { label: FIT_STATUS_LABEL[s], meaning: FIT_STATUS_MEANING[s] }])) };
}

export function apiFit(bottleId: string) {
    const report = fitReport(bottleId);
    if (!report) return null;
    return {
        version: KB_API_VERSION,
        bottle: apiBottle(report.body),
        physicalFit: report.body.interchangeable
            ? { listed: flat(report.listed), notConfirmed: flat(report.notConfirmed), conflicting: flat(report.conflicting) }
            : { soldAsSet: true, listed: [], notConfirmed: [], conflicting: [] },
        formulaSuitability: { status: report.formulaSuitability, note: "No formula or material test data is held. Test samples with your formula." },
        evidence: apiFitSource(),
    };
}

const apiPart = (part: BuilderPart) => ({
    componentId: part.id, itemCode: part.itemCode, name: part.name, finish: part.finish,
    catalogUrl: part.catalogUrl ? abs(part.catalogUrl) : null,
});

/** One neck finish as the builder walks it: bottle, then applicator, then closure. */
export function apiNeck(neck: string) {
    const view = neckBuilder(neck);
    if (!view) return null;
    const parts = (ids: string[]) => ids.map((id) => apiPart(view.parts[id]));
    return {
        version: KB_API_VERSION,
        neck: view.neck,
        url: abs(neckBuilderHref(view.neck)),
        ruling: view.ruling,
        steps: ["bottle", "applicator", "closure"],
        bottles: view.bottles.map((bottle) => ({
            id: bottle.id, name: bottle.label, family: bottle.family, capacityMl: bottle.capacityMl, heightMm: bottle.heightMm, diameterMm: bottle.diameterMm,
            fitUrl: abs(bottle.fitUrl), apiUrl: abs(`/api/kb/v1/fit/${encodeURIComponent(bottle.id)}`),
            products: bottle.products.map((product) => ({ sku: product.sku, parts: product.parts, builderUrl: abs(`/matrix?family=${encodeURIComponent(bottle.family)}&sku=${encodeURIComponent(product.sku)}`) })),
        })),
        applicators: view.applicators.map((a) => {
            const closure = a.key === "spray" ? { included: "matching overcap", choices: [] }
                : a.key.startsWith("roll") ? { included: null, choices: [{ group: "Roll-on caps", parts: parts(view.rollOnCaps) }] }
                : a.key === "none" ? { included: null, choices: view.capGroups.map((g) => ({ group: g.label, parts: parts(g.partIds) })) }
                : null;
            return {
                key: a.key, label: a.label, available: a.available,
                ...(a.available ? {} : { offeredOnNecks: a.elsewhere }),
                insert: a.key === "roll-plastic" && view.rollers.plastic ? apiPart(view.parts[view.rollers.plastic]) : a.key === "roll-metal" && view.rollers.metal ? apiPart(view.parts[view.rollers.metal]) : null,
                finishes: a.key === "spray" ? parts(view.sprayers) : [],
                closure: a.available ? closure : null,
            };
        }),
        formulaSuitability: { status: "unknown", note: "Fit is physical only. No formula or material test data is held." },
        evidence: apiFitSource(),
    };
}

export function apiNecks() {
    return { version: KB_API_VERSION, necks: neckBuilderNecks().map((neck) => ({ neck, url: abs(neckBuilderHref(neck)), apiUrl: abs(`/api/kb/v1/fit/neck/${encodeURIComponent(neck)}`) })) };
}

export function apiBottles() {
    return { version: KB_API_VERSION, evidence: apiFitSource(), bottles: allBodies().map(apiBottle) };
}

export function apiSearch(q: string) {
    const result = searchHelp(q);
    return {
        version: KB_API_VERSION,
        query: result.query,
        interpretation: result.interpretation,
        noApprovedAnswer: result.gap ? { topic: result.gap, guidance: "The approved FAQ does not establish this. Do not infer an answer; refer the customer to the team." } : null,
        size: result.size && {
            requestedMl: Math.round(result.size.requestedMl * 100) / 100,
            notOffered: result.size.notOffered,
            offered: result.size.offered.map(apiBottle),
            nearestSmaller: result.size.smaller && { ml: result.size.smaller.ml, bottles: result.size.smaller.bodies.map(apiBottle) },
            nearestLarger: result.size.larger && { ml: result.size.larger.ml, bottles: result.size.larger.bodies.map(apiBottle) },
            note: "Not offered means no such size exists in the catalog. It is not a stock status.",
        },
        closure: result.closure?.label ?? null,
        bottles: result.bottles.map(apiBottle),
        answers: result.answers.map(({ entry }) => apiEntry(entry)),
        catalogUrl: result.catalogHref ? abs(result.catalogHref) : null,
        priceAndStock: "Not provided by this API. Use catalogUrl for live prices and stock.",
    };
}

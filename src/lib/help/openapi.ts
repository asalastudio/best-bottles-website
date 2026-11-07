import { SITE_URL } from "@/lib/seo";
import { KB_TOPICS } from "./kb";
import { KB_API_VERSION } from "./api";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown, description = "OK") => ({ description, content: { "application/json": { schema } } });
const notFound = json({ type: "object", properties: { error: { type: "string" } } }, "Not found");
const limited = json({ type: "object", properties: { error: { type: "string" } } }, "Rate limited (60 requests per minute)");

/** OpenAPI 3.1 description of /api/kb/v1. tests/help-api.test.ts checks it matches the routes. */
export function buildKbOpenApi() {
    return {
        openapi: "3.1.0",
        info: {
            title: "Best Bottles help center API",
            version: KB_API_VERSION,
            description:
                "Read-only. Serves approved, published public answers and catalog-listed bottle–closure fits, each with its source and date. " +
                "It never serves prices or stock: follow catalogUrl for live data. A 'Listed fit' is a catalog listing, not a physical test, and formula suitability is always 'unknown'.",
        },
        servers: [{ url: `${SITE_URL}/api/kb/v1` }],
        paths: {
            "/entries": {
                get: {
                    operationId: "listEntries",
                    summary: "Published answers",
                    parameters: [{ name: "topic", in: "query", required: false, schema: { type: "string", enum: KB_TOPICS.map((t) => t.id) } }],
                    responses: { 200: json({ type: "object", properties: { version: { type: "string" }, topics: { type: "array", items: ref("Topic") }, entries: { type: "array", items: ref("Entry") } } }), 429: limited },
                },
            },
            "/entries/{id}": {
                get: {
                    operationId: "getEntry",
                    summary: "One published answer by stable id, e.g. policy.returns",
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                    responses: { 200: json({ type: "object", properties: { version: { type: "string" }, entry: ref("Entry") } }), 404: notFound, 429: limited },
                },
            },
            "/search": {
                get: {
                    operationId: "search",
                    summary: "Search answers, sizes and bottles with everyday words",
                    parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", maxLength: 200 } }],
                    responses: { 200: json(ref("SearchResult")), 400: notFound, 429: limited },
                },
            },
            "/fit": {
                get: {
                    operationId: "listBottles",
                    summary: "Bottles in the fit index",
                    responses: { 200: json({ type: "object", properties: { version: { type: "string" }, evidence: ref("Evidence"), bottles: { type: "array", items: ref("Bottle") } } }), 429: limited },
                },
            },
            "/fit/{bottleId}": {
                get: {
                    operationId: "getFit",
                    summary: "Closures listed, not confirmed and conflicting for one bottle",
                    parameters: [{ name: "bottleId", in: "path", required: true, schema: { type: "string" }, example: "bell-10ml-13-415" }],
                    responses: { 200: json(ref("FitReport")), 404: notFound, 429: limited },
                },
            },
        },
        components: {
            schemas: {
                Topic: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, summary: { type: "string" } } },
                Source: { type: "object", properties: { kind: { type: "string" }, label: { type: "string" }, url: { type: ["string", "null"] }, checkedOn: { type: "string", format: "date" } } },
                Entry: {
                    type: "object",
                    required: ["id", "url", "status", "version", "title", "answer", "sources"],
                    properties: {
                        id: { type: "string", description: "Stable id, never reused" },
                        url: { type: "string" },
                        type: { type: "string", enum: ["policy", "article", "product-fact"] },
                        topic: { type: "string" },
                        status: { type: "string", enum: ["published"] },
                        version: { type: "integer" },
                        title: { type: "string" },
                        shortAnswer: { type: "string" },
                        answer: { type: "string", description: "The approved answer, verbatim" },
                        openQuestions: { type: "array", items: { type: "string" }, description: "Known disagreements inside the approved source; state them, do not resolve them" },
                        related: { type: "array", items: { type: "string" } },
                        sources: { type: "array", items: ref("Source") },
                        publishedOn: { type: "string", format: "date" },
                        updatedOn: { type: "string", format: "date" },
                    },
                },
                Bottle: {
                    type: "object",
                    properties: {
                        id: { type: "string" }, name: { type: "string" }, family: { type: "string" }, capacityMl: { type: ["number", "null"] },
                        neck: { type: ["string", "null"] }, category: { type: "string" }, interchangeableClosures: { type: "boolean" },
                        glass: { type: "array", items: { type: "string" } }, heightMm: { type: ["number", "null"] }, diameterMm: { type: ["number", "null"] },
                        fitUrl: { type: ["string", "null"], description: "null when the bottle is sold with its own closure" }, apiUrl: { type: "string" },
                    },
                },
                FitRow: {
                    type: "object",
                    properties: {
                        componentId: { type: "string", description: "Stable register id" },
                        itemCode: { type: ["string", "null"], description: "The code customers order and search by" },
                        name: { type: "string" }, type: { type: "string" }, neck: { type: ["string", "null"] },
                        group: { type: "string", description: "Closure group as the neck-thread matrices draw it, e.g. Short ribbed caps, Tall caps with liner" },
                        status: { type: "string", enum: ["listed", "not-confirmed", "conflicting"], description: "listed = the catalog pairs this part with the bottle; not-confirmed = same thread only, not a fit; conflicting = records disagree, do not recommend" },
                        statusLabel: { type: "string" },
                        catalogUrl: { type: ["string", "null"], description: "Catalog search for the item code: live price and stock" },
                    },
                },
                Evidence: { type: "object", properties: { source: { type: "string" }, snapshotDate: { type: "string" }, note: { type: "string" }, statuses: { type: "object" } } },
                FitReport: {
                    type: "object",
                    properties: {
                        version: { type: "string" },
                        bottle: ref("Bottle"),
                        physicalFit: {
                            type: "object",
                            properties: {
                                soldAsSet: { type: "boolean" },
                                listed: { type: "array", items: ref("FitRow") },
                                notConfirmed: { type: "array", items: ref("FitRow") },
                                conflicting: { type: "array", items: ref("FitRow") },
                            },
                        },
                        formulaSuitability: { type: "object", properties: { status: { type: "string", enum: ["unknown"] }, note: { type: "string" } } },
                        evidence: ref("Evidence"),
                    },
                },
                SearchResult: {
                    type: "object",
                    properties: {
                        version: { type: "string" }, query: { type: "string" }, interpretation: { type: "array", items: { type: "string" } },
                        noApprovedAnswer: { type: ["object", "null"] },
                        size: { type: ["object", "null"], description: "notOffered=true means no such size exists; it is not a stock status" },
                        bottles: { type: "array", items: ref("Bottle") },
                        answers: { type: "array", items: ref("Entry") },
                        catalogUrl: { type: ["string", "null"] },
                        priceAndStock: { type: "string" },
                    },
                },
            },
        },
    };
}

/**
 * Review-sheet helper (local, read-only): compose the register kits the rebuilt register would draw for some SKUs.
 *
 *   npx tsx scripts/register/preview-kits.ts <out.json> <approveIdsCsv|none> [--anchor id:slot:y] [--local-plates] SKU…
 *
 * Plates, bodies and component layers come from production's registerStage.forSkus; each SKU's build comes from the
 * rebuilt register (data/register/assemblies.csv), so a refresh can be previewed before it is pushed. A part
 * production does not hold yet is read from its local cut (data/register/components/<neck>-measurements.json, images
 * in output/register-components/<neck>/, drawn from file:// URLs). The named components are treated as approved.
 * Writes each kit's parts (slot, url, box, componentId) in draw order. Nothing is written to Convex.
 */
import fs from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";
import { parseBuildParts, readRegister } from "./registerRows";

const ROOT = resolve(__dirname, "..", "..");
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const LOOKUP = 50;

type Cut = {
    neck: string;
    entry: {
        componentId: string;
        type: string;
        layers: Array<{
            slot: string; z: "behind-body" | "front"; explodeIndex: number; file: string; width: number; height: number;
            pxPerMm: number; anchor: { x: number; y: number }; solidBottomY?: number;
        }>;
    };
};

function localCuts(): Map<string, Cut> {
    const dir = resolve(ROOT, "data", "register", "components");
    const cuts = new Map<string, Cut>();
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith("-measurements.json"))) {
        const file = JSON.parse(fs.readFileSync(resolve(dir, name), "utf8")) as { neck: string; components: Cut["entry"][] };
        for (const entry of file.components) if (entry.layers?.length) cuts.set(entry.componentId, { neck: file.neck, entry });
    }
    return cuts;
}

async function main() {
    const [out, approveCsv, ...rest] = process.argv.slice(2);
    // --anchor <componentId>:<slot>:<y>: preview a proposed anchor (layer px) in place of the measured one
    const anchors = new Map<string, number>();
    const skus: string[] = [];
    let localPlates = false;
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--local-plates") { localPlates = true; continue; }
        if (rest[i] !== "--anchor") { skus.push(rest[i]); continue; }
        const [id, slot, y] = (rest[++i] ?? "").split(":");
        if (!id || !slot || !Number.isFinite(Number(y))) throw new Error("--anchor takes <componentId>:<slot>:<y>");
        anchors.set(`${id}:${slot}`, Number(y));
    }
    if (!out || !approveCsv || !skus.length) throw new Error("usage: preview-kits.ts <out.json> <approveIdsCsv|none> [--anchor id:slot:y] SKU…");
    const approve = new Set(approveCsv.split(",").filter((id) => id && id !== "none"));
    const register = readRegister(resolve(ROOT, "data", "register"));
    const bySku = new Map(register.assemblies.map((a) => [a.websiteSku, a]));
    const grace = skus.map((sku) => bySku.get(sku)?.graceSku).filter(Boolean) as string[];
    const local = new Map(register.assemblies.map((a) => [a.graceSku, a]));

    const client = new ConvexHttpClient(PROD_URL);
    const payload: RegisterStagePayload = { plates: {}, components: {}, bodies: {}, assemblies: {} };
    for (let i = 0; i < grace.length; i += LOOKUP) {  // forSkus answers at most 50 SKUs per call
        const page = await client.query(anyApi.registerStage.forSkus, { graceSkus: grace.slice(i, i + LOOKUP) }) as RegisterStagePayload;
        Object.assign(payload.plates, page.plates);
        Object.assign(payload.components, page.components);
        Object.assign(payload.bodies, page.bodies);
        Object.assign(payload.assemblies, page.assemblies);
    }
    const cuts = localCuts();
    for (const graceSku of grace) {
        const assembly = payload.assemblies[graceSku];
        const row = local.get(graceSku);
        if (!assembly || !row) continue;
        assembly.parts = row.buildStatus === "resolved" ? parseBuildParts(row.buildParts, graceSku) : [];
        for (const part of assembly.parts) {
            const cut = payload.components[part.componentId] ? undefined : cuts.get(part.componentId);
            if (!cut) continue;
            payload.components[part.componentId] = {
                componentId: part.componentId,
                type: cut.entry.type,
                approved: false,
                layers: cut.entry.layers.map((layer) => ({
                    slot: layer.slot as RegisterStagePayload["components"][string]["layers"][number]["slot"],
                    z: layer.z, explodeIndex: layer.explodeIndex,
                    url: `file://${resolve(ROOT, "output", "register-components", cut.neck, layer.file)}`,
                    width: layer.width, height: layer.height, pxPerMm: layer.pxPerMm, anchor: layer.anchor, approved: false,
                    ...(layer.solidBottomY !== undefined ? { solidBottomY: layer.solidBottomY } : {}),
                })),
            };
        }
    }
    for (const id of approve) {
        const component = payload.components[id];
        if (component) { component.approved = true; component.layers = component.layers.map((layer) => ({ ...layer, approved: true })); }
    }
    if (localPlates) {
        // --local-plates: each SKU's body and plate as the rebuilt register names them, from the local measurements
        // (data/register/bodies/bodies-measurements.json, images in output/register-bodies/), for a body not pushed yet
        const measured = new Map((JSON.parse(fs.readFileSync(resolve(ROOT, "data", "register", "bodies", "bodies-measurements.json"), "utf8")) as Array<{
            plateKey: string; bodyId: string; glass: string; file: string; width: number; height: number; pxPerMm: number;
            anchors: { axisX: number; seatY: number; baselineY: number; shoulderY: number | null };
        }>).map((p) => [p.plateKey, p]));
        const bodies = new Map(register.bodies.map((b) => [b.bodyId, b]));
        const num = (value: string | undefined) => (value && Number.isFinite(Number(value)) ? Number(value) : null);
        for (const graceSku of grace) {
            const assembly = payload.assemblies[graceSku];
            const row = local.get(graceSku);
            if (!assembly || !row) continue;
            const plateKey = `${row.bodyId}|${row.glass}`;
            const plate = measured.get(plateKey);
            const body = bodies.get(row.bodyId);
            if (!plate || !body) continue;
            assembly.bodyId = row.bodyId;
            assembly.plateKey = plateKey;
            payload.plates[plateKey] = {
                plateKey, bodyId: row.bodyId, glass: plate.glass, url: `file://${resolve(ROOT, "output", "register-bodies", plate.file)}`,
                width: plate.width, height: plate.height, pxPerMm: plate.pxPerMm,
                anchors: { axisX: plate.anchors.axisX, seatY: plate.anchors.seatY, baselineY: plate.anchors.baselineY, shoulderY: plate.anchors.shoulderY ?? null },
                approved: true,
            } as RegisterStagePayload["plates"][string];
            payload.bodies[row.bodyId] = {
                bodyId: row.bodyId, family: body.family, capacityMl: num(body.capacityMl), neck: body.neck,
                dims: { heightBareMm: num(body.dimsHeightBareMm), diameterMm: num(body.dimsDiameterMm), widthMm: num(body.widthMm) },
            } as RegisterStagePayload["bodies"][string];
        }
    }
    for (const [key, y] of anchors) {
        const [id, slot] = key.split(":");
        const component = payload.components[id];
        if (component) component.layers = component.layers.map((layer) => layer.slot === slot ? { ...layer, anchor: { ...layer.anchor, y } } : layer);
    }
    for (const graceSku of grace) {
        const assembly = payload.assemblies[graceSku];
        const row = local.get(graceSku);
        if (!assembly || !row) continue;
        const plate = payload.plates[assembly.plateKey];
        const drawable = !["quarantine", "retired"].includes(row.status) && row.buildStatus === "resolved" && Boolean(plate?.approved)
            && assembly.parts.length > 0 && assembly.parts.every((part) => payload.components[part.componentId]?.approved);
        assembly.renderable = drawable;
        assembly.reason = drawable ? null : "not drawable in this preview";
    }

    const kits = drawableRegisterKits(payload);
    const result: Record<string, unknown> = {};
    for (const sku of skus) {
        const graceSku = bySku.get(sku)?.graceSku;
        const kit = graceSku ? kits[graceSku] : undefined;
        result[sku] = kit ? {
            bodyId: payload.assemblies[graceSku!]?.bodyId, glass: payload.assemblies[graceSku!]?.glass, baselineY: kit.anchors.baselineY,
            parts: [...kit.parts].filter((p) => !p.views || p.views.includes("capon")).sort((a, b) => a.zOrder - b.zOrder)
                .map((p) => ({ slot: p.slot, url: p.image.url, box: p.box, componentId: p.componentId })),
        } : null;
    }
    fs.writeFileSync(out, JSON.stringify(result, null, 1));
    console.log(Object.entries(result).map(([sku, kit]) => sku + (kit ? "" : " (not drawable)")).join(", "));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

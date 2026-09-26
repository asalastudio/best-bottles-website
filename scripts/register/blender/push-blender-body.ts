#!/usr/bin/env tsx
/**
 * Load the native Blender 9 mL Cylinder 17-415 family into the component register: the five glass plates and
 * the 21 components' layers (caps, roller inserts, fine-mist sprayers, lotion pumps), replacing the Phase 3 pilot
 * cut-outs. Both storefront stages (the product page and Build Your Bottle) draw from these rows.
 *
 *   npx tsx scripts/register/blender/push-blender-body.ts --dir <final dir>                      # dry run
 *   npx tsx scripts/register/blender/push-blender-body.ts --dir <final dir> --apply              # upload + write dev, "measured"
 *   npx tsx scripts/register/blender/push-blender-body.ts --dir <final dir> --apply --approve    # the same, "approved"
 *   ... --env-dir <checkout>   read .env.local / .env.blob.local from another checkout (default: this repo root)
 *   ... --data <name>          data/register/<name>/measurements.json (default blender-9ml; e.g. blender-tallcyl-13-415)
 *   ... --deployment prod      PRODUCTION (scripts/register/deployment.ts): needs REGISTER_PROD_WRITE_TOKEN in the
 *                              environment; never the default. Refuses a deployment with no register rows. Images are
 *                              content-addressed in the one public Blob store, so a prod run reuses the dev uploads.
 *
 * Reads data/register/<data>/measurements.json (written by the Blender lane's build_assets.py) and the images in
 * --dir. Every layer carries the body's `bodyId`, and is written with setBodyComponentLayers, so a component shared
 * with other bodies keeps their layers. See-through layers also carry `glass` (one per plate glass) and
 * `usage: "seated"`; full plugs and lifted pump internals carry `usage: "exploded"`. Blob keys are content-addressed.
 * Dev by default; production only with --deployment prod (Jordan runs it).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";
import { registerTarget } from "../deployment";

const ROOT = resolve(__dirname, "..", "..", "..");
const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const envDir = resolve(arg("--env-dir") ?? ROOT);
config({ path: [resolve(envDir, ".env.local"), resolve(envDir, ".env.blob.local")], quiet: true });
const apply = argv.includes("--apply");
const approve = argv.includes("--approve");
const dir = arg("--dir");
const dataName = arg("--data") ?? "blender-9ml";

type Asset = { file: string; width: number; height: number; sha256: string };
type Layer = Asset & {
    slot: string; layerName: string; pxPerMm: number; anchor: { x: number; y: number };
    z: "front" | "behind-body"; explodeIndex: number; usage?: "seated" | "exploded"; glass?: string;
};
type Measurements = {
    bodyId: string;
    plates: (Asset & { plateKey: string; glass: string; pxPerMm: number;
        anchors: { axisX: number; seatY: number; shoulderY: number; baselineY: number };
        source: { library: string; path: string; layer: string } })[];
    components: { componentId: string; layers: Layer[] }[];
};

async function main() {
    if (!dir) throw new Error("--dir <final dir> is required (the Blender lane's register-9ml-v32/final)");
    const m = JSON.parse(readFileSync(resolve(ROOT, "data", "register", dataName, "measurements.json"), "utf8")) as Measurements;
    const { deployment, url, token } = registerTarget(argv);
    console.log(`register images -> ${deployment} (${url}) ${apply ? "APPLY" : "dry run"}`);
    if (apply && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set (vercel env pull .env.blob.local --environment=development)");
    const status = (approve ? "approved" : "measured") as "approved" | "measured";
    const neck = m.bodyId.split("-").slice(-2).join("-");
    const store = apply ? createBlobStore() : null;
    const uploaded = new Map<string, string>();
    const upload = async (key: string, a: Asset) => {
        const bytes = readFileSync(resolve(dir, a.file));
        let blobUrl = uploaded.get(key);
        if (!blobUrl) {
            blobUrl = store ? (await store.putObject(key, bytes, "image/png")).url : `(dry run) ${key}`;
            uploaded.set(key, blobUrl);
        }
        return { url: blobUrl, key, sha256: a.sha256, bytes: bytes.length, width: a.width, height: a.height };
    };

    const plates = [];
    for (const p of m.plates) {
        const image = await upload(`register/plates/${m.bodyId}/${p.glass.toLowerCase().replace(/ /g, "-")}/${p.sha256}.png`, p);
        plates.push({ plateKey: p.plateKey, bodyId: m.bodyId, glass: p.glass, image, thumb: null, pxPerMm: p.pxPerMm,
            anchors: { axisX: p.anchors.axisX, seatY: p.anchors.seatY, baselineY: p.anchors.baselineY, shoulderY: p.anchors.shoulderY },
            anchorStatus: status, anchorMeasuredBy: "Blender camera projection (register-9ml-v32/export.py)", derivedFrom: null,
            storageProvider: "vercel-blob" as const,
            source: { library: p.source.library, path: p.source.path, psdSha256: null, layer: p.source.layer } });
        console.log(`plate ${p.plateKey}: ${p.width}x${p.height} @ ${p.pxPerMm} px/mm, ${status}`);
    }
    const components = [];
    for (const c of m.components) {
        const layers = [];
        for (const l of c.layers) {
            const image = await upload(`register/components/${neck}/${c.componentId}/${l.slot}-${l.sha256}.png`, l);
            layers.push({ slot: l.slot as never, layerName: l.layerName, z: l.z, image, image2x: null, pxPerMm: l.pxPerMm,
                anchor: l.anchor, anchorStatus: status, explodeIndex: l.explodeIndex,
                ...(l.usage ? { usage: l.usage } : {}), ...(l.glass ? { glass: l.glass } : {}), bodyId: m.bodyId });
        }
        components.push({ componentId: c.componentId, layers });
        console.log(`component ${c.componentId}: ${layers.length} layer(s) (${layers.filter(l => "glass" in l).length} see-through), ${status}`);
    }
    console.log(`\n${uploaded.size} distinct images`);
    if (!apply) { console.log("dry run: nothing uploaded or written. Add --apply."); return; }
    const client = new ConvexHttpClient(url);
    const before = await client.query(api.register.counts, {});
    const total = (tally: Record<string, number>) => Object.values(tally).reduce((sum, n) => sum + n, 0);
    if (!total(before.bodies) || !total(before.components)) throw new Error(`${deployment} has no register rows (${JSON.stringify(before)}); run scripts/register/push-register.ts --deployment ${deployment} --apply first`);
    console.log("plates:", JSON.stringify(await client.mutation(api.register.upsertBodyPlates, { writeToken: token, rows: plates })));
    for (const c of components) console.log(c.componentId, JSON.stringify(await client.mutation(api.register.setBodyComponentLayers, { writeToken: token, bodyId: m.bodyId, ...c })));
    console.log("counts:", JSON.stringify(await client.query(api.register.counts, {})));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

#!/usr/bin/env tsx
/**
 * Replace SOME of one Blender body's layers in the register: the layers of data/register/<data>/measurements.json
 * that match --slot / --glass / --usage, on every component that has them. Every other layer of that body (and every
 * other body's and the generic set) is kept as the deployment has it. For a correction to a live body when a full
 * push-blender-body run would also carry changes that are not approved yet (Tall 9 mL, 2026-09-30: the thin frosted
 * dip tube, while the two dotted caps of #319 still wait for Jordan).
 *
 *   npx tsx scripts/register/blender/push-body-layers.ts --data blender-tallcyl-13-415 --slot diptube --glass Frosted --usage seated            # dry run, dev
 *   ... --apply --approve                                          # upload + write dev, "approved"
 *   REGISTER_PROD_WRITE_TOKEN=... ... --deployment prod --apply --approve   # production (Jordan's OK)
 *   ... --dir <final dir>   read images from the lane's folder; by default data/register/<data>/<file> in this repo
 *
 * Blob keys are content-addressed (register/components/<neck>/<componentId>/<slot>-<sha256>.png) and every file's
 * sha256 is checked against measurements.json before anything is written.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";
import { PROD_URL, registerTarget } from "../deployment";

const ROOT = resolve(__dirname, "..", "..", "..");
config({ path: [resolve(ROOT, ".env.local"), resolve(ROOT, ".env.blob.local")], quiet: true });
const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const dataName = arg("data"), slot = arg("slot"), glass = arg("glass"), usage = arg("usage"), dir = arg("dir");
const apply = argv.includes("--apply"), approve = argv.includes("--approve");

type Layer = { slot: string; layerName: string; file: string; width: number; height: number; sha256: string; pxPerMm: number;
    anchor: { x: number; y: number }; z: "front" | "behind-body"; explodeIndex: number; usage?: "seated" | "exploded"; glass?: string };
type Measurements = { bodyId: string; components: { componentId: string; layers: Layer[] }[] };
type Stored = { slot: string; glass?: string; usage?: string; bodyId?: string; image: { url: string; sha256: string } };
const matches = (l: { slot: string; glass?: string; usage?: string }) => l.slot === slot && (!glass || l.glass === glass) && (!usage || l.usage === usage);

async function main() {
    if (!dataName || !slot) throw new Error("--data and --slot are required");
    const m = JSON.parse(readFileSync(resolve(ROOT, "data", "register", dataName, "measurements.json"), "utf8")) as Measurements;
    const neck = m.bodyId.split("-").slice(-2).join("-");
    const toProd = arg("deployment") === "prod";
    const url = toProd ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL!;
    if (!url || (!toProd && url === PROD_URL)) throw new Error("dev needs NEXT_PUBLIC_CONVEX_URL (a dev deployment) in .env.local");
    const client = new ConvexHttpClient(url);
    const live = new Map((await client.query(api.register.componentsForNeck, { neck })).map(c => [c.componentId, c]));
    const status = (approve ? "approved" : "measured") as "approved" | "measured";
    const store = apply ? createBlobStore() : null;
    if (apply && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set (.env.blob.local)");
    const uploaded = new Map<string, string>();
    const writes: { componentId: string; layers: unknown[] }[] = [];

    for (const c of m.components) {
        const wanted = c.layers.filter(matches);
        if (!wanted.length) continue;
        const row = live.get(c.componentId);
        if (!row) throw new Error(`${toProd ? "prod" : "dev"} has no ${c.componentId}`);
        const body = (row.layers as Stored[]).filter(l => l.bodyId === m.bodyId);
        const replaced = body.filter(matches);
        const layers: unknown[] = body.filter(l => !matches(l));
        for (const l of wanted) {
            const local = dir ? resolve(dir, l.file) : resolve(ROOT, "data", "register", dataName, l.file);
            if (!existsSync(local)) throw new Error(`${l.file} is not in ${dir ?? `data/register/${dataName}`}`);
            const bytes = readFileSync(local);
            const actual = createHash("sha256").update(bytes).digest("hex");
            if (actual !== l.sha256) throw new Error(`${l.file}: sha256 ${actual} does not match measurements.json (${l.sha256})`);
            const key = `register/components/${neck}/${c.componentId}/${l.slot}-${l.sha256}.png`;
            let blobUrl = uploaded.get(key);
            if (!blobUrl) { blobUrl = store ? (await store.putObject(key, bytes, "image/png")).url : `(dry run) ${key}`; uploaded.set(key, blobUrl); }
            layers.push({ slot: l.slot, layerName: l.layerName, z: l.z, image: { url: blobUrl, key, sha256: l.sha256, bytes: bytes.length, width: l.width, height: l.height },
                image2x: null, pxPerMm: l.pxPerMm, anchor: l.anchor, anchorStatus: status, explodeIndex: l.explodeIndex,
                ...(l.usage ? { usage: l.usage } : {}), ...(l.glass ? { glass: l.glass } : {}), bodyId: m.bodyId });
        }
        console.log(`${c.componentId}: replace ${replaced.map(l => l.image.sha256.slice(0, 8)).join(",") || "nothing"} with ${wanted.map(l => l.sha256.slice(0, 8)).join(",")}; keeps ${body.length - replaced.length} other ${m.bodyId} layer(s)`);
        writes.push({ componentId: c.componentId, layers });
    }
    console.log(`\n${writes.length} components, ${uploaded.size} image(s) -> ${toProd ? "PRODUCTION" : "dev"} (${url})`);
    if (!apply) { console.log("dry run: nothing uploaded or written. Add --apply --approve."); return; }
    const { token } = registerTarget(argv);
    for (const w of writes) console.log(w.componentId, JSON.stringify(await client.mutation(api.register.setBodyComponentLayers, { writeToken: token, componentId: w.componentId, bodyId: m.bodyId, layers: w.layers as never })));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

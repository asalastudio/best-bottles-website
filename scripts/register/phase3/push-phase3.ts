#!/usr/bin/env tsx
/**
 * Load the Phase 3 pilot cut-outs into the register: body plates and component layers.
 *
 *   npx tsx scripts/register/phase3/push-phase3.ts                      # dry run: what would be uploaded and written
 *   npx tsx scripts/register/phase3/push-phase3.ts --apply              # upload to Vercel Blob, write dev as "measured"
 *   npx tsx scripts/register/phase3/push-phase3.ts --apply --approve    # the same, marked "approved" (Jordan's sign-off)
 *   ... --approve --except plateKey|componentId,...                     # approve all but the named items
 *   ... --only componentId,...                                           # load only the named components (no plates)
 *
 * Reads data/register/phase3/pilot-measurements.json and output/register-phase3/pilot/ (run cut_pilot.py
 * first). Blob keys are content-addressed and write-once. Dev only: NEXT_PUBLIC_CONVEX_URL and
 * BEST_BOTTLES_CONVEX_WRITE_TOKEN from .env.local; BLOB_READ_WRITE_TOKEN from the environment, .env.local,
 * or .env.blob.local (gitignored), e.g. `vercel env pull .env.blob.local --environment=development`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";

const ROOT = resolve(__dirname, "..", "..", "..");
const OUT = resolve(ROOT, "output", "register-phase3", "pilot");
config({ path: [resolve(ROOT, ".env.local"), resolve(ROOT, ".env.blob.local")], quiet: true });
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const approve = argv.includes("--approve");
const except = new Set((argv[argv.indexOf("--except") + 1] ?? "").split(",").filter(() => argv.includes("--except")).map(s => s.trim()).filter(Boolean));
const onlyArg = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] ?? "" : null;
if (onlyArg !== null && (onlyArg.startsWith("--") || !onlyArg.split(",").some(s => s.trim()))) {
    throw new Error("--only needs one or more component IDs, e.g. --only CMP-SPR-CLR-17-415");  // an empty --only would load everything
}
const only = new Set((onlyArg ?? "").split(",").map(s => s.trim()).filter(Boolean));

type Layer = { slot: string; layerName: string; file: string; width: number; height: number; sha256: string; pxPerMm: number; anchor: { x: number; y: number }; z: string; explodeIndex: number; solidBottomY?: number };
type Measurements = {
    bodyId: string;
    plates: { plateKey: string; glass: string; file: string; width: number; height: number; sha256: string; pxPerMm: number;
        anchors: { axisX: number; seatY: number; shoulderY: number; baselineY: number }; checks: { passes: boolean; approvable: boolean; acceptedBy: string | null }; derivedFrom?: string; source: { library: string; path: string; layer: string } }[];
    components: { componentId: string; layers: Layer[]; checks: Record<string, unknown> }[];
};

async function main() {
    const m = JSON.parse(readFileSync(resolve(ROOT, "data", "register", "phase3", "pilot-measurements.json"), "utf8")) as Measurements;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL, token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url || !token) throw new Error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN are required");
    if (url.includes("precise-raccoon-123")) throw new Error("this loader writes dev only");
    const status = (key: string) => (approve && !except.has(key) ? "approved" : "measured") as "approved" | "measured";
    const neck = m.bodyId.split("-").slice(-2).join("-");
    if (apply && !process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error("BLOB_READ_WRITE_TOKEN is not set. Run: vercel env pull .env.blob.local --environment=development");
    }
    const store = apply ? createBlobStore() : null;
    const upload = async (key: string, file: string, width: number, height: number, sha256: string) => {
        const bytes = readFileSync(resolve(OUT, file));
        const { url: blobUrl } = store ? await store.putObject(key, bytes, "image/png") : { url: `(dry run) ${key}` };
        return { url: blobUrl, key, sha256, bytes: bytes.length, width, height };
    };

    const plates = [];
    for (const p of only.size ? [] : m.plates) {
        const image = await upload(`register/plates/${m.bodyId}/${p.glass.toLowerCase().replace(/ /g, "-")}/${p.sha256}.png`, p.file, p.width, p.height, p.sha256);
        // A plate that fails the size gate is approved only if it carries a named ruling (checks.acceptedBy).
        const s = p.checks.approvable ? status(p.plateKey) : "measured";
        plates.push({ plateKey: p.plateKey, bodyId: m.bodyId, glass: p.glass, image, thumb: null, pxPerMm: p.pxPerMm,
            anchors: { axisX: p.anchors.axisX, seatY: p.anchors.seatY, baselineY: p.anchors.baselineY, shoulderY: p.anchors.shoulderY },
            anchorStatus: s, anchorMeasuredBy: "scripts/register/phase3/cut_pilot.py", derivedFrom: p.derivedFrom ?? null, storageProvider: "vercel-blob" as const,
            source: { library: p.source.library, path: p.source.path, psdSha256: null, layer: p.source.layer } });
        console.log(`plate ${p.plateKey}: ${s}${p.checks.passes ? "" : p.checks.acceptedBy ? ` (outside the gate; ${p.checks.acceptedBy})` : " (fails the size gate; held at measured)"}`);
    }
    const components = [];
    for (const c of m.components.filter((x) => !only.size || only.has(x.componentId))) {
        const layers = [];
        for (const l of c.layers) {
            const image = await upload(`register/components/${neck}/${c.componentId}/${l.slot}-${l.sha256}.png`, l.file, l.width, l.height, l.sha256);
            layers.push({ slot: l.slot as never, layerName: l.layerName, z: l.z as "front" | "behind-body", image, image2x: null, pxPerMm: l.pxPerMm,
                anchor: l.anchor, anchorStatus: status(c.componentId), explodeIndex: l.explodeIndex, ...(l.solidBottomY != null ? { solidBottomY: l.solidBottomY } : {}) });
        }
        components.push({ componentId: c.componentId, layers });
        console.log(`component ${c.componentId}: ${layers.length} layer(s), ${status(c.componentId)}`);
    }
    if (!apply) { console.log("\ndry run: nothing uploaded or written. Add --apply."); return; }
    const client = new ConvexHttpClient(url);
    if (plates.length) console.log("plates:", JSON.stringify(await client.mutation(api.register.upsertBodyPlates, { writeToken: token, rows: plates })));
    for (const c of components) console.log(c.componentId, JSON.stringify(await client.mutation(api.register.setComponentLayers, { writeToken: token, ...c })));
    console.log("counts:", JSON.stringify(await client.query(api.register.counts, {})));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

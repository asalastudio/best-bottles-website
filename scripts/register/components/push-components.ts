#!/usr/bin/env tsx
/**
 * Load one neck's measured component layers into the register (dev only).
 *
 *   npx tsx scripts/register/components/push-components.ts --neck 18-415                      # dry run
 *   npx tsx scripts/register/components/push-components.ts --neck 18-415 --apply              # upload + write as "measured"
 *   npx tsx scripts/register/components/push-components.ts --neck 18-415 --apply --approve    # approvable ones as "approved"
 *   ... --except CMP-A,CMP-B                                                                   # hold back named components
 *   ... --deployment prod                                                   # production: REGISTER_PROD_WRITE_TOKEN (scripts/register/deployment.ts)
 *
 * Reads data/register/components/<neck>-measurements.json and output/register-components/<neck>/
 * (run cut_components.py first). A component is approvable when its registration self-check passed
 * (checks.approvable); anything else loads as "measured" and is not drawn. Blob keys are content-addressed
 * and write-once. Tokens: NEXT_PUBLIC_CONVEX_URL + BEST_BOTTLES_CONVEX_WRITE_TOKEN from .env.local,
 * BLOB_READ_WRITE_TOKEN from the environment or .env.blob.local.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";
import { registerTarget } from "../deployment";

const ROOT = resolve(__dirname, "..", "..", "..");
config({ path: [resolve(ROOT, ".env.local"), resolve(ROOT, ".env.blob.local")], quiet: true });
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const neck = arg("neck", "");
const apply = argv.includes("--apply");
const approve = argv.includes("--approve");
const except = new Set(arg("except", "").split(",").map((s) => s.trim()).filter(Boolean));

type Layer = { slot: string; layerName: string; file: string; width: number; height: number; sha256: string; pxPerMm: number; anchor: { x: number; y: number }; z: string; explodeIndex: number; usage?: "seated" | "exploded"; solidBottomY?: number };
type Measurements = { neck: string; components: { componentId: string; type: string; layers: Layer[]; checks: Record<string, unknown> }[] };

async function main() {
    if (!neck) throw new Error("--neck is required");
    const OUT = resolve(ROOT, "output", "register-components", neck);
    const m = JSON.parse(readFileSync(resolve(ROOT, "data", "register", "components", `${neck}-measurements.json`), "utf8")) as Measurements;
    const { deployment, url, token } = registerTarget(process.argv.slice(2));
    console.log(`deployment: ${deployment} (${url})`);
    if (apply && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
    const store = apply ? createBlobStore() : null;
    const upload = async (key: string, file: string, width: number, height: number, sha256: string) => {
        const bytes = readFileSync(resolve(OUT, file));
        const { url: blobUrl } = store ? await store.putObject(key, bytes, "image/png") : { url: `(dry run) ${key}` };
        return { url: blobUrl, key, sha256, bytes: bytes.length, width, height };
    };
    const summary = { approved: 0, measured: 0, skipped: 0 };
    const components = [];
    for (const c of m.components) {
        if (!c.layers.length) { summary.skipped++; console.log(`component ${c.componentId}: no layers (${String(c.checks.status ?? "")}), skipped`); continue; }
        const status = approve && c.checks.approvable === true && !except.has(c.componentId) ? "approved" : "measured";
        const layers = [];
        for (const l of c.layers) {
            const image = await upload(`register/components/${neck}/${c.componentId}/${l.slot}-${l.sha256}.png`, l.file, l.width, l.height, l.sha256);
            layers.push({ slot: l.slot as never, layerName: l.layerName, z: l.z as "front" | "behind-body", image, image2x: null, pxPerMm: l.pxPerMm,
                anchor: l.anchor, anchorStatus: status as "approved" | "measured", explodeIndex: l.explodeIndex, ...(l.usage ? { usage: l.usage } : {}),
                ...(l.solidBottomY != null ? { solidBottomY: l.solidBottomY } : {}) });
        }
        components.push({ componentId: c.componentId, layers });
        summary[status]++;
        console.log(`component ${c.componentId}: ${layers.length} layer(s) [${layers.map((l) => l.slot).join(", ")}] ${status}${c.checks.registrationIoU != null ? ` (IoU ${c.checks.registrationIoU})` : ""}`);
    }
    console.log("summary:", JSON.stringify(summary));
    if (!apply) { console.log("\ndry run: nothing uploaded or written. Add --apply."); return; }
    const client = new ConvexHttpClient(url);
    for (const c of components) console.log(c.componentId, JSON.stringify(await client.mutation(api.register.setComponentLayers, { writeToken: token, ...c })));
    console.log("counts:", JSON.stringify(await client.query(api.register.counts, {})));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

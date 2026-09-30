#!/usr/bin/env tsx
/**
 * Copy ONE reviewed layer from dev's register into another deployment's generic layers of the same component,
 * keeping every layer the target already has (its generic set and every body's own layers). For a single approved
 * part one deployment is missing, where a full neck push (push-components.ts) would rewrite every component.
 *
 *   npx tsx scripts/register/components/promote-layer.ts --neck 17-415 --component LIB-17-415-MtlRollon --sha 4c3c4a50 --usage seated --deployment prod            # dry run
 *   REGISTER_PROD_WRITE_TOKEN=… npx tsx scripts/register/components/promote-layer.ts … --deployment prod --apply                                                # write
 *
 * The source is dev (NEXT_PUBLIC_CONVEX_URL in .env.local). The copied layer loses its bodyId, so every body that
 * draws the component's generic layers draws it. Images are content-addressed in the one public Blob store both
 * deployments read, so nothing is uploaded. Production writes only with --deployment prod --apply (Jordan's OK).
 *
 * --from-body <bodyId> picks the source when two bodies carry the same image (the short 13-415 caps are one render
 * shared by the Tall 9 mL and the 5 mL Cylinder).
 *
 * 2026-09-30: production's LIB-17-415-MtlRollon had only the pilot crop (d64975…). reconcileCylinder9Kit also
 * requires the reviewed seated insert (4c3c4a…), so all 50 9 mL 17-415 metal-roller SKUs fell back to the old photo
 * kits in Build Your Bottle and on the product page.
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { PROD_URL, registerTarget } from "../deployment";

const ROOT = resolve(__dirname, "..", "..", "..");
config({ path: [resolve(ROOT, ".env.local")], quiet: true });
const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const neck = arg("neck"), componentId = arg("component"), sha = arg("sha"), usage = arg("usage"), fromBody = arg("from-body");
const apply = argv.includes("--apply");

type Layer = { image: { sha256: string; url: string }; slot: string; z: string; usage?: string; glass?: string; bodyId?: string; anchorStatus: string };
const describe = (l: Layer) => `${l.image.sha256.slice(0, 10)} ${l.slot} ${l.z}${l.usage ? ` ${l.usage}` : ""}${l.glass ? ` ${l.glass}` : ""}${l.bodyId ? ` @${l.bodyId}` : ""} (${l.anchorStatus})`;

async function main() {
    if (!neck || !componentId || !sha || sha.length < 8) throw new Error("--neck, --component and --sha (8+ hex characters) are required");
    const sourceUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!sourceUrl || sourceUrl === PROD_URL) throw new Error("the source is dev: NEXT_PUBLIC_CONVEX_URL in .env.local must be the dev deployment");
    const toProd = arg("deployment") === "prod";
    const targetUrl = toProd ? PROD_URL : sourceUrl;

    const source = (await new ConvexHttpClient(sourceUrl).query(api.register.componentsForNeck, { neck }))
        .find(c => c.componentId === componentId);
    const matches = ((source?.layers ?? []) as Layer[]).filter(l => l.image.sha256.startsWith(sha) && (!usage || l.usage === usage) && (!fromBody || l.bodyId === fromBody));
    if (matches.length !== 1) throw new Error(`dev ${componentId}: ${matches.length} layers match ${sha}${usage ? ` (${usage})` : ""}; need exactly one`);
    const { bodyId: _bodyId, ...layer } = matches[0];

    const target = (await new ConvexHttpClient(targetUrl).query(api.register.componentsForNeck, { neck }))
        .find(c => c.componentId === componentId);
    if (!target) throw new Error(`${toProd ? "prod" : "dev"} has no ${componentId}`);
    const generic = (target.layers as Layer[]).filter(l => !l.bodyId);
    console.log(`${toProd ? "prod" : "dev"} ${componentId} generic layers now: ${generic.map(describe).join(" | ") || "none"}`);
    if (generic.some(l => l.image.sha256 === layer.image.sha256 && l.usage === layer.usage)) {
        console.log("already there; nothing to do");
        return;
    }
    console.log(`adding: ${describe(layer as Layer)}`);
    if (!apply) { console.log("dry run: nothing written. Add --apply."); return; }

    const { url, token } = registerTarget(argv);
    if (url !== targetUrl) throw new Error(`target mismatch: ${url} vs ${targetUrl}`);
    const client = new ConvexHttpClient(url);
    const outcome = await client.mutation(api.register.setComponentLayers, { writeToken: token, componentId, layers: [...generic, layer] as never });
    console.log("setComponentLayers:", JSON.stringify(outcome));
    const after = (await client.query(api.register.componentsForNeck, { neck })).find(c => c.componentId === componentId);
    console.log(`generic layers after: ${((after?.layers ?? []) as Layer[]).filter(l => !l.bodyId).map(describe).join(" | ")}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

#!/usr/bin/env tsx
/**
 * Give a roller insert its EXPLODED plug: two layers on one register component.
 *
 *   npx tsx scripts/register/plates/push-insert.ts --component LIB-17-415-MtlRollon --candidate a            # dry run
 *   npx tsx scripts/register/plates/push-insert.ts --component LIB-17-415-MtlRollon --candidate a --apply    # upload + write dev
 *   npx tsx scripts/register/plates/push-insert.ts --component LIB-17-415-MtlRollon --restore --apply        # back to the stub alone
 *
 * The component keeps its seated stub (usage "seated": CAP ON and SIDECAR, behind the
 * glass, clipped at the rim) and gains the full insert (usage "exploded": the EXPLODED view,
 * in front, the same anchor and px/mm, extended below the rim by the generated plug).
 * Reads output/register-plates/inserts/<component>/final/<candidate>.{png,json}
 * (extend-insert.mjs). Dev only; needs BLOB_READ_WRITE_TOKEN and the Convex write token.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";

const ROOT = resolve(__dirname, "..", "..", "..");
config({ path: [resolve(ROOT, ".env.local"), resolve(ROOT, ".env.blob.local")], quiet: true });
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const componentId = arg("component", "LIB-17-415-MtlRollon");
const candidate = arg("candidate", "a");
const apply = argv.includes("--apply");
const restore = argv.includes("--restore");

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL, token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url || !token) throw new Error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN are required");
    if (url.includes("precise-raccoon-123")) throw new Error("this loader writes dev only");
    const client = new ConvexHttpClient(url);
    const neck = componentId.split("-").slice(1, 3).join("-");
    const comp = (await client.query(api.register.componentsForNeck, { neck })).find((c) => c.componentId === componentId);
    if (!comp) throw new Error(`${componentId} not on dev`);
    const stub = comp.layers.find((l) => l.slot === "roller" && l.usage !== "exploded");
    if (!stub) throw new Error(`${componentId} has no seated roller layer`);
    const seated = { slot: stub.slot, layerName: stub.layerName, z: stub.z, image: stub.image, image2x: stub.image2x, pxPerMm: stub.pxPerMm, anchor: stub.anchor, anchorStatus: stub.anchorStatus, explodeIndex: stub.explodeIndex, usage: "seated" as const };

    if (restore) {
        console.log(`${componentId}: ${restore && apply ? "restoring" : "would restore"} the seated stub alone`);
        if (!apply) return;
        console.log(JSON.stringify(await client.mutation(api.register.setComponentLayers, { writeToken: token, componentId, layers: [{ ...seated, usage: undefined }] })));
        return;
    }

    const base = resolve(ROOT, "output", "register-plates", "inserts", componentId, "final");
    const bytes = readFileSync(resolve(base, `${candidate}.png`));
    const meta = JSON.parse(readFileSync(resolve(base, `${candidate}.json`), "utf8")) as { width: number; height: number; anchor: { x: number; y: number }; pxPerMm: number; plugMm: number; prompt: string };
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const key = `register/components/${neck}/${componentId}/roller-exploded-${sha256}.png`;
    console.log(`${componentId}: stub ${stub.image.width}x${stub.image.height} anchor (${stub.anchor.x}, ${stub.anchor.y}) → plug candidate ${candidate} ${meta.width}x${meta.height}, ${meta.plugMm} mm below the rim, sha ${sha256.slice(0, 12)}`);
    // A photographed insert may be wider than the stub's canvas; it must share the stub's px/mm and seat at the same rim point.
    if (meta.pxPerMm !== stub.pxPerMm || meta.anchor.y !== stub.anchor.y) throw new Error("the insert must keep the stub's px/mm and rim anchor");
    if (!apply) { console.log(`dry run: would upload ${key} and set two layers (seated stub, exploded plug). Add --apply.`); return; }
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
    const { url: blobUrl } = await createBlobStore().putObject(key, bytes, "image/png");
    const exploded = {
        slot: "roller" as const, layerName: `${stub.layerName ?? "roller"} + generated plug (${candidate})`, z: "front" as const,
        image: { url: blobUrl, key, sha256, bytes: bytes.length, width: meta.width, height: meta.height }, image2x: null,
        pxPerMm: meta.pxPerMm, anchor: meta.anchor, anchorStatus: "approved" as const, explodeIndex: stub.explodeIndex, usage: "exploded" as const,
    };
    console.log(JSON.stringify(await client.mutation(api.register.setComponentLayers, { writeToken: token, componentId, layers: [seated, exploded] })));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

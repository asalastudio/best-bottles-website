/**
 * The Pillar 9 ml cap and roller SKUs on the photographed Pillar body (Jordan, 4 Nov 2026: the Pillar "needs a new
 * generated bottle ... with a single pour bottle cap, but it's missing all the fitments"). The page
 * pillar-9ml-clear-13-415 sells GBPillar9BlkShSht (short black cap), GBPillar9RollBlkDot (plastic roller) and
 * GBPillar9MtlRollBlkdot (metal roller); production draws them from the register on the old outline body.
 * Each kit is production's own register kit (registerStage.forSkus, read-only) with its body replaced by the approved
 * Pillar sprayer kits' photographed body (same body id and datum, already hosted with display copies), and the sprayer
 * kits' glass sizing, so cap, roller and sprayer pages draw one bottle. Writes
 * public/local-kits/pillar-caps-2026-11-04/kits.json.
 * Usage: npx tsx scripts/pillar/pillar-cap-kits.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";

const OUT = "public/local-kits/pillar-caps-2026-11-04";
const SKUS = { GBPillar9BlkShSht: "GB-PIL-CLR-9ML-CAP-BLK", GBPillar9RollBlkDot: "GB-PIL-CLR-9ML-RBL-BDOT", GBPillar9MtlRollBlkdot: "GB-PIL-CLR-9ML-MRL-BDOT" };
const approved = JSON.parse(readFileSync("src/lib/paper-doll/approved-kits.generated.json", "utf8")).rows;
const sprayer = approved.GBPillar9SpryBlkMatt;
assert(sprayer, "The Pillar sprayer masters are approved (PR #397)");
const photoBody = sprayer.parts.find((part: any) => part.slot === "body");

const convex = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const payload = await convex.query(anyApi.registerStage.forSkus, { graceSkus: Object.values(SKUS) }) as RegisterStagePayload;
const kits = Object.fromEntries(Object.values(drawableRegisterKits(payload)).map((kit: any) => [kit.sku, kit]));
const rows: Record<string, any> = {};
for (const sku of Object.keys(SKUS)) {
    const kit = structuredClone(kits[sku]);
    assert(kit, "No register kit for " + sku);
    assert.equal(kit.register?.bodyId, sprayer.register.bodyId, sku + " is the same glass");
    assert.deepEqual(kit.register.datum, sprayer.register.datum, sku + " shares the sprayer kits' datum");
    kit.parts = kit.parts.map((part: any) => part.slot === "body" ? { ...structuredClone(photoBody) } : part);
    kit.glassSizing = structuredClone(sprayer.glassSizing);
    kit.reviewMaster = "pillar-caps-2026-11-04";
    rows[sku] = kit;
    console.log(sku, kit.parts.map((part: any) => part.slot + (part.views ? `[${part.views}]` : "")).join(", "));
}
mkdirSync(OUT, { recursive: true });
const version = createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 12);
writeFileSync(`${OUT}/kits.json`, JSON.stringify({ version, rows, defaultPdpSkus: Object.keys(rows) }, null, 1) + "\n");
console.log("version", version);

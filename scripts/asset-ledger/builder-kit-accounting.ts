/**
 * Every Build Your Bottle configuration, and whether it has a layered kit.
 *
 *   npx tsx scripts/asset-ledger/builder-kit-accounting.ts
 *
 * Reads the last builder funnel (configurations on offer per family), asks dev
 * Convex for each configuration's kit, and counts locally extracted kits that
 * are not published yet (dist/paper-doll/<batch>/kits/manifest.json). Writes
 * data/asset-ledger/builder-kit-accounting.json. Read-only.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const root = process.cwd();
if (!process.env.NEXT_PUBLIC_CONVEX_URL && existsSync(path.join(root, ".env.local"))) {
    for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const LOCAL_BATCHES = ["dist/paper-doll/boston-current-2026-09-16"];

async function main() {
    const funnel = JSON.parse(readFileSync(path.join(root, "data/asset-ledger/builder-funnel.json"), "utf8"));
    const local = new Map<string, { batch: string; status: string; reason?: string }>();
    for (const batch of LOCAL_BATCHES) {
        const file = path.join(root, batch, "kits/manifest.json");
        if (!existsSync(file)) continue;
        for (const row of JSON.parse(readFileSync(file, "utf8")).rows) local.set(row.sku, { batch, status: row.status, reason: row.reason });
    }
    const families: Record<string, unknown>[] = []; const rows: Record<string, unknown>[] = [];
    for (const fam of funnel.report) {
        const skus: string[] = fam.configurationSkus ?? [];
        const counts = { configurations: skus.length, kitFull: 0, kitCapSplit: 0, kitBodyOnly: 0, kitStale: 0, localReady: 0, localHeld: 0, none: 0 };
        let i = 0;
        await Promise.all(Array.from({ length: 8 }, async () => {
            while (i < skus.length) {
                const sku = skus[i++];
                const kit = await convex.query(api.productKits.forSku, { websiteSku: sku, graceSku: sku });
                const { plates } = await convex.query(api.productPlates.forSkus, { skus: [sku] });
                const plateSha = (plates[sku]?.image ?? "").match(/([0-9a-f]{64})\.front-on/)?.[1] ?? null;
                const stale = kit ? kit.plateSha256 !== plateSha : false;
                const loc = local.get(sku);
                const status = kit && !stale ? `kit:${kit.completeness}` : kit && stale ? "kit:stale" : loc?.status === "candidate" ? "local:ready" : loc ? "local:held" : "none";
                if (status === "kit:full") counts.kitFull++; else if (status === "kit:capSplit") counts.kitCapSplit++; else if (status === "kit:bodyOnly") counts.kitBodyOnly++;
                else if (status === "kit:stale") counts.kitStale++; else if (status === "local:ready") counts.localReady++; else if (status === "local:held") counts.localHeld++; else counts.none++;
                rows.push({ family: fam.family, sku, status, kitParts: kit?.parts.map((p: { slot: string }) => p.slot).join("+") ?? null, local: loc ?? null });
            }
        }));
        families.push({ family: fam.family, ...counts });
    }
    writeFileSync(path.join(root, "data/asset-ledger/builder-kit-accounting.json"), JSON.stringify({ generatedAt: new Date().toISOString(), deployment: process.env.NEXT_PUBLIC_CONVEX_URL, families, rows }, null, 1));
    const cols = ["configurations", "kitFull", "kitCapSplit", "kitBodyOnly", "kitStale", "localReady", "localHeld", "none"];
    console.log("family".padEnd(14) + cols.map(c => c.padStart(14)).join(""));
    const total: Record<string, number> = {};
    for (const f of families) { console.log(String(f.family).padEnd(14) + cols.map(c => String(f[c]).padStart(14)).join("")); for (const c of cols) total[c] = (total[c] ?? 0) + (f[c] as number); }
    console.log("TOTAL".padEnd(14) + cols.map(c => String(total[c]).padStart(14)).join(""));
}
main().catch(e => { console.error(e); process.exit(1); });

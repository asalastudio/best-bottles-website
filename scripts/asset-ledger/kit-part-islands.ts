/**
 * Scan published kit parts for stray retouch cards: disconnected alpha islands
 * or near-white opaque pixels outside the part's main silhouette.
 *
 *   npx tsx scripts/asset-ledger/kit-part-islands.ts [family…]
 *
 * Downloads each distinct part once into the scratch dir, writes
 * data/asset-ledger/kit-part-islands.json. Read-only.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
const root = process.cwd();
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const families = process.argv.slice(2).length ? process.argv.slice(2) : ["Cylinder"];
const cache = path.join(process.env.SCRATCH ?? "/tmp", "kit-parts"); mkdirSync(cache, { recursive: true });
async function main() {
  const funnel = JSON.parse(readFileSync(path.join(root, "data/asset-ledger/builder-funnel.json"), "utf8"));
  const parts = new Map<string, { url: string; slot: string; skus: string[] }>();
  for (const fam of funnel.report.filter((r: any) => families.includes(r.family))) {
    for (const sku of fam.configurationSkus as string[]) {
      const kit = await convex.query(api.productKits.forSku, { websiteSku: sku, graceSku: sku });
      for (const p of kit?.parts ?? []) { const e = parts.get(p.image.sha256) ?? { url: p.image.url, slot: p.slot, skus: [] }; e.skus.push(sku); parts.set(p.image.sha256, e); }
    }
  }
  console.log("distinct parts", parts.size);
  const list = [...parts].map(([sha, e]) => ({ sha, ...e }));
  for (const e of list) { const f = path.join(cache, `${e.sha}.webp`); if (!existsSync(f)) execFileSync("curl", ["-sS", "-o", f, e.url]); }
  writeFileSync(path.join(cache, "index.json"), JSON.stringify(list));
  const py = `
import json, numpy as np, sys
from PIL import Image
from scipy import ndimage
cache=sys.argv[1]; out=[]
for e in json.load(open(cache+'/index.json')):
    im=Image.open(f"{cache}/{e['sha']}.webp").convert('RGBA'); arr=np.asarray(im); a=arr[...,3]>8
    lab,n=ndimage.label(a)
    if n==0: continue
    sizes=ndimage.sum(a,lab,range(1,n+1)); main=int(np.argmax(sizes))+1
    stray=[int(s) for k,s in enumerate(sizes) if k+1!=main and s>=40]
    # near-white opaque pixels inside the main island that touch its edge (a card fused to the part)
    rgb=arr[...,:3].astype(int); white=(lab==main)&(arr[...,3]>200)&(rgb.min(axis=2)>=240)
    edge=white&~ndimage.binary_erosion(lab==main,iterations=3)
    out.append({'sha':e['sha'],'slot':e['slot'],'skus':e['skus'],'strayIslands':stray,'strayPixels':int(sum(stray)),'whiteEdgePixels':int(edge.sum())})
json.dump(out,open(cache+'/islands.json','w'))
flag=[o for o in out if o['strayPixels']>0 or o['whiteEdgePixels']>150]
print(len(out),'parts scanned;',len(flag),'flagged')
for o in sorted(flag,key=lambda o:-(o['strayPixels']+o['whiteEdgePixels']))[:40]: print(f"  {o['slot']:8} stray {o['strayPixels']:6} whiteEdge {o['whiteEdgePixels']:6}  {o['skus'][0]} (+{len(o['skus'])-1})")
`;
  console.log(execFileSync("/opt/homebrew/bin/python3", ["-c", py, cache]).toString());
  writeFileSync(path.join(root, "data/asset-ledger/kit-part-islands.json"), readFileSync(path.join(cache, "islands.json")));
}
main().catch(e => { console.error(e); process.exit(1); });

// Regression test for the generalised variantKey parser.
// CYL-9ML is LIVE in Sanity - if these 26 keys change, the configurator breaks.
//   node scripts/paper-doll/test-variant-keys.mjs
import { variantKeyFromFilename } from "./generate-manifest.mjs";
import { readFileSync } from "node:fs";
const m = JSON.parse(readFileSync(new URL("../../data/paper-doll/CYL-9ML/manifest.json", import.meta.url),"utf8"));
let bad = 0;
for (const l of m.layers) {
  const got = variantKeyFromFilename(l.slot, l.sourceFilename, m.familyKey);
  if (got !== l.variantKey) { bad++; console.log(`  MISMATCH ${l.slot} ${l.sourceFilename}: got '${got}' want '${l.variantKey}'`); }
}
console.log(`CYL-9ML (live): ${m.layers.length - bad}/${m.layers.length} variantKeys reproduced exactly`);
console.log("\nnew family DIVA-46ML (previously fell through to raw basename):");
for (const [slot,f] of [["body","DIVA-CLR-46ML-body.png"],["body","DIVA-FRS-46ML-body.png"],
                        ["cap","DIVA-46ML-SHN-GLD-cap.png"],["roller","DIVA-46ML-MTL-roller.png"],
                        ["sprayer","DIVA-46ML-SPRAY-BLK-sprayer.png"],["pump","DIVA-46ML-LOTION-WHT-pump.png"]])
  console.log(`  ${slot.padEnd(8)} ${f.padEnd(34)} -> ${variantKeyFromFilename(slot,f,"DIVA-46ML")}`);
process.exit(bad ? 1 : 0);

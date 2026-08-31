/**
 * extract-glass.mts — dump GLASS_PRESETS to JSON, exactly.
 *
 * The presets are approved TypeScript with multi-line provenance strings.
 * Regex-parsing them would risk mangling an approval record, so we import
 * the real module and serialise what the app actually uses. Reproducible:
 * re-run after any glass edit and the token file follows.
 */
import { writeFileSync } from "node:fs";
import { GLASS_PRESETS } from "../../src/lib/materials/glassPresets.ts";

const out = "data/materials/glass-presets.generated.json";
writeFileSync(out, JSON.stringify(GLASS_PRESETS, null, 2) + "\n");
console.log(`wrote ${out}: ${Object.keys(GLASS_PRESETS).length} presets`);

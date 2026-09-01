import fs from "node:fs/promises";
import path from "node:path";
import PaperDollSwapper, { type FamilyManifest } from "./PaperDollSwapper";

export const metadata = { title: "Paper Doll swapper — Best Bottles lab" };

/**
 * Photographic paper-doll swapper, deliberately separate from the real PDP.
 *
 * Diva 46 ml Clear is the pilot family: it is the one bottle whose PSD master
 * set covers every closure archetype we sell — reducer, spray pump, lotion
 * pump, dropper, vintage bulb sprayer, and bulb-with-tassel — across 46 SKUs
 * that all join to live catalogue rows.
 */
export default async function Page() {
  const manifest: FamilyManifest = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "public/paper-doll/diva-46-clear/manifest.json"),
      "utf8",
    ),
  );
  return <PaperDollSwapper family={manifest} />;
}

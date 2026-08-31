import fs from "node:fs/promises";
import path from "node:path";
import MaterialLab from "./MaterialLab";

export const metadata = { title: "Material Lab — Best Bottles" };

export default async function Page() {
  const root = process.cwd();
  // read-only: the lab consumes the existing manifest and writes nothing
  const manifest = await fs.readFile(
    path.join(root, "public/models/bodies/manifest.json"), "utf8");

  // Which bodies have a DRAWING-EXACT THREADED build. bodies/ carries a plain
  // lathed neck with 0.00 mm relief - no thread at all - while
  // bodies-threaded/ carries the real helix (0.75 mm relief, crest rotating
  // ~146 deg per mm of height). Glass magnifies the neck, so the lab must
  // default to the threaded build wherever one exists.
  let threadedIds: string[] = [];
  try {
    const files = await fs.readdir(path.join(root, "public/models/bodies-threaded"));
    threadedIds = files.filter((f) => f.endsWith(".glb")).map((f) => f.slice(0, -4));
  } catch { /* directory optional */ }

  return <MaterialLab bodies={JSON.parse(manifest)} threadedIds={threadedIds} />;
}

import fs from "node:fs/promises";
import path from "node:path";
import BottleViewer, { type ClosureManifest } from "./BottleViewer";

export const metadata = { title: "Bottle bodies — 3D lab" };

export default async function Page() {
  const manifest = await fs.readFile(
    path.join(process.cwd(), "public/models/bodies/manifest.json"),
    "utf8",
  );

  // Which bodies also have a threaded build. Read from disk rather than
  // hardcoded: the threaded set grows one batch at a time.
  let threadedIds: string[] = [];
  try {
    const dir = path.join(process.cwd(), "public/models/bodies-threaded");
    threadedIds = (await fs.readdir(dir))
      .filter((f) => f.endsWith(".glb"))
      .map((f) => f.slice(0, -4));
  } catch {
    threadedIds = [];
  }

  // Closure parts + assembly stacks. Absent until closures.py has run.
  let closures: unknown = { parts: [], assemblies: [] };
  try {
    closures = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "public/models/closures/manifest.json"),
        "utf8",
      ),
    );
  } catch {
    /* no closures published yet */
  }

  return (
    <BottleViewer
      bodies={JSON.parse(manifest)}
      threadedIds={threadedIds}
      closures={closures as ClosureManifest}
    />
  );
}

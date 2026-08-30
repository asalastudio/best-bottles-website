import fs from "node:fs/promises";
import path from "node:path";
import BottleViewer from "./BottleViewer";

export const metadata = { title: "Bottle bodies — 3D lab" };

export default async function Page() {
  const manifest = await fs.readFile(
    path.join(process.cwd(), "public/models/bodies/manifest.json"),
    "utf8",
  );
  return <BottleViewer bodies={JSON.parse(manifest)} />;
}

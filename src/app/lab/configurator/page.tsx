import fs from "node:fs/promises";
import path from "node:path";
import Configurator from "./Configurator";

export const metadata = { title: "17/415 configurator — Best Bottles lab" };

/**
 * A throwaway product page, deliberately separate from the real PDP.
 * 17-415 only: it is the one family with all three body shapes (including the
 * swirl) and a complete closure set.
 */
export default async function Page() {
  const bodies = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "public/models/bodies/manifest.json"), "utf8"),
  ).filter((b: { neckFinish: string | null }) => b.neckFinish === "17-415");

  const closures = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "public/models/closures/manifest.json"), "utf8"),
  );

  return <Configurator bodies={bodies} closures={closures} />;
}

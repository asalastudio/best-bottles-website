import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src/lib/products/catalog-heroes.json");
const outPath = path.join(root, "docs/reviews/round-enhancement/review-input.json");
const sourceUrlsPath = path.join(root, "docs/reviews/round-enhancement/source-urls.json");
const publicRoot = path.join(root, "public");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const sourceUrls = JSON.parse(fs.readFileSync(sourceUrlsPath, "utf8"));

const rows = catalog
  .filter((row) => row.family === "Round" && /^(GB|LB)Rnd/.test(row.websiteSku ?? ""))
  .map((row) => {
    const url = `/images/catalog/round-enhancement/aligned/${row.websiteSku}.premium-aligned-v2.png`;
    const bytes = fs.readFileSync(path.join(publicRoot, url));
    const shoulderHeight = row.capacityMl === 128 ? 54.5 : 49;
    return {
      sku: row.websiteSku,
      family: "Round",
      capacityMl: row.capacityMl,
      title: row.alt,
      url,
      assetSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      priorUrl: sourceUrls[row.websiteSku],
      sourcePreview: sourceUrls[row.websiteSku],
      sourceKind: "Photoshop-derived current SKU assembly",
      stage: "rework",
      targetHeightRequest: {
        heightPercent: shoulderHeight,
        measurement: "glass_shoulder",
        baselinePercent: 91,
      },
      measurement: {
        totalHeightPercent: shoulderHeight,
        basis: "glass base to shoulder",
      },
      shoulderSizing: {
        measuredPercent: shoulderHeight,
        baselinePercent: 91,
        capacityGroupMl: row.capacityMl,
      },
      reviewNotes: [
        "Bottle body scale is derived from the glass radius; closure and accessory height do not affect scale.",
        "The complete assembly was moved only by uniform scale and translation to the 91% baseline.",
        "Verify the exact SKU fitment against the source comparison before release.",
      ],
      framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 },
    };
  });

if (rows.length !== 21) throw new Error(`Expected 21 Round rows, found ${rows.length}`);
fs.writeFileSync(outPath, `${JSON.stringify({ rows }, null, 2)}\n`);
console.log(`Wrote ${rows.length} review rows to ${outPath}`);

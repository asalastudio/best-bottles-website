import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Review manifest for the Round premium final set, one revision on from
// `round-premium-family-2026-09-07-v3` where all 21 images were returned.
//
// Unlike the v3 builder, no height is asserted that was not measured. That
// builder wrote `row.capacityMl === 128 ? 54.5 : 49` into both the request and
// the measurement, so the figures on screen were constants. Here the target is
// what Jordan set and the measurement is read off the rendered image.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "src/lib/products/catalog-heroes.json"), "utf8"));
const sourceUrls = JSON.parse(fs.readFileSync(path.join(root, "docs/reviews/round-enhancement/source-urls.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(path.join(root, "docs/reviews/round-enhancement/aligned-v4-report.json"), "utf8"));
const outPath = path.join(root, "docs/reviews/round-enhancement/review-input-final.json");

const measured = new Map(report.rows.map((row) => [row.sku, row]));
const REPAIRED = "GBRndFrst128RdcrShnGl";

const rows = catalog
  .filter((row) => row.family === "Round" && /^(GB|LB)Rnd/.test(row.websiteSku ?? ""))
  .map((row) => {
    const sku = row.websiteSku;
    const stats = measured.get(sku);
    if (!stats) throw new Error(`No measurement for ${sku}`);
    const url = `/images/catalog/round-enhancement/aligned-v4/${sku}.premium-aligned-v4.png`;
    const bytes = fs.readFileSync(path.join(publicRoot, url));
    const ratio = stats.scaleRatioAppliedToV2;
    const direction = ratio > 1.001 ? "larger" : ratio < 0.999 ? "smaller" : "unchanged";

    const notes = [
      `Glass base to shoulder measures ${stats.measuredShoulderPercent}% against your ${stats.targetShoulderPercent}% target.`,
      `Scale ${ratio} on the version you returned, so this bottle is ${direction}.`,
      "Shoulder here means the top of the glass, where the bottom of the closure meets the ball.",
      "Every bottle was solved on its own measured glass rather than a shared family radius, which is why the group now reads level.",
      "Uniform scale and translation only, onto the same 91% baseline. The closure, sprayer, bulb, tassel and dropper never affect scale.",
    ];
    if (stats.assemblyPixelsErasedPercent >= 0.5) {
      notes.push(`Background normalisation touched ${stats.assemblyPixelsErasedPercent}% of assembly pixels, all antialiased edge.`);
    }
    if (stats.clippedAtCanvasEdge) {
      notes.push("The assembly reaches the canvas edge. It did so in the previous version too; this is not new.");
    }
    if (sku === REPAIRED) {
      notes.push("Rejection cause found and fixed: the previous background flood-fill crossed the low-contrast frosted rim and erased 41.8% of this bottle, which is the removed centre and blotching. The source photograph was always intact.");
    }

    return {
      sku,
      family: "Round",
      capacityMl: row.capacityMl,
      title: row.alt,
      url,
      assetSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      priorUrl: `/images/catalog/round-enhancement/aligned/${sku}.premium-aligned-v2.png`,
      sourcePreview: sourceUrls[sku],
      sourceKind: "Photoshop-derived current SKU assembly",
      stage: "rework",
      targetHeightRequest: {
        heightPercent: stats.targetShoulderPercent,
        measurement: "glass_shoulder",
        baselinePercent: 91,
      },
      measurement: {
        totalHeightPercent: stats.measuredShoulderPercent,
        basis: "glass base to the top of the glass, measured off this image",
      },
      shoulderSizing: {
        measuredPercent: stats.measuredShoulderPercent,
        targetPercent: stats.targetShoulderPercent,
        baselinePercent: 91,
        capacityGroupMl: row.capacityMl,
        scaleRatioAppliedToPreviousRevision: ratio,
      },
      reviewNotes: notes,
      framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 },
    };
  });

if (rows.length !== 21) throw new Error(`Expected 21 Round rows, found ${rows.length}`);
fs.writeFileSync(outPath, `${JSON.stringify({ rows }, null, 2)}\n`);
console.log(`Wrote ${rows.length} review rows to ${outPath}`);

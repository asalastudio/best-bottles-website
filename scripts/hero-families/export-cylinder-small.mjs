/** Reproduce the authorized small Cylinder review exports from the preserved batch archive. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const batch = process.argv[2];
assert.ok(batch, 'Pass the family3-4-5 archive directory containing inventory.json');
const inventory = JSON.parse(fs.readFileSync(path.join(batch, 'inventory.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(inventory.rows.length, 11);
const width = 2080, height = 2288;
const records = [];
for (const row of inventory.rows) {
  assert.ok(['Clear', 'Cobalt Blue'].includes(row.catalog.color));
  assert.ok(['cylinder:3.3-sample', 'cylinder:4-sample', 'cylinder:5-standard'].includes(row.lock.glassBodyKey));
  assert.equal(row.lock.baselinePct, 91);
  assert.equal(row.lock.shoulderPct, row.lock.glassBodyKey === 'cylinder:3.3-sample' ? 28 : row.lock.glassBodyKey === 'cylinder:4-sample' ? 32.5 : 36.5);
  for (const input of row.inputHashes) {
    assert.equal(hash(fs.readFileSync(path.join(batch, input.file))), input.sha256);
  }
  assert.equal(hash(fs.readFileSync(path.join(batch, row.files.prompt))), row.promptSha256);
  const raw = fs.readFileSync(path.join(batch, row.files.raw));
  const metadata = await sharp(raw).metadata();
  const measured = row.generatedMeasurement;
  assert.deepEqual([metadata.width, metadata.height], [measured.width, measured.height]);
  const scale = height * row.lock.shoulderPct / 100 / (measured.footY - measured.shoulderY);
  const x = width * row.transform.targetBodyCenterPct / 100 - measured.bodyCenterX * scale;
  const y = height * 0.91 - measured.footY * scale;
  // Transform the complete raster uniformly. No masks, component moves, or shadow edits.
  const background = row.backgroundQA.borderMedianRgb.join(',');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}"><rect width="100%" height="100%" fill="rgb(${background})"/><image width="${metadata.width}" height="${metadata.height}" transform="translate(${x} ${y}) scale(${scale})" xlink:href="data:image/png;base64,${raw.toString('base64')}"/></svg>`;
  const output = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync(path.join(batch, row.files.output), output);
  records.push({
    sku: row.sku, source: row.files.raw, sourceSha256: hash(raw),
    sourceSize: [metadata.width, metadata.height], output: row.files.output,
    outputSha256: hash(output), outputSize: [width, height], nativeResolution: false,
    exportMethod: 'One uniform whole-raster affine transform, Sharp SVG rasterization; border-median padding. No component or shadow editing.',
    outputAlignment: { method: measured.method, rawFootY: measured.footY,
      rawShoulderY: measured.shoulderY, rawBodyCenterX: measured.bodyCenterX,
      scale, x, y, targetBodyCenterPct: row.transform.targetBodyCenterPct,
      targetFootPercent: 91, targetShoulderSpanPercent: row.lock.shoulderPct,
      uncertaintyPx: measured.uncertaintyPx * scale },
    sourceMeasuredOutput: measured, lock: row.lock,
    shoulderYTargetPx: height * row.lock.shoulderYFromTopPct / 100, footYTargetPx: height * 0.91,
    materialReference: row.materialReference, materialReferenceSha256: row.inputHashes.find(r => r.file === row.materialReference).sha256,
    geometrySource: row.geometrySource.kind === 'master-psd'
      ? {...row.geometrySource, path: row.geometrySource.path.slice(row.geometrySource.path.indexOf('BB-PSD-Files-Master/'))}
      : {...row.geometrySource, path: 'approved-legacy-plate/' + row.geometrySource.sha256 + '.webp'},
    masterSource: row.geometrySource.kind === 'master-psd' ? [row.geometrySource.path.slice(row.geometrySource.path.indexOf('BB-PSD-Files-Master/'))] : [],
    masterSha256: row.geometrySource.kind === 'master-psd' ? row.geometrySource.sha256 : null, generationInputHashes: row.inputHashes,
    promptSha256: row.promptSha256, backgroundQA: row.backgroundQA,
    geometryQA: row.geometryQA,
    masterBodyAspect: (row.masterLandmarks.footY - row.masterLandmarks.shoulderY) / row.masterLandmarks.bodyWidthPx,
    visualStatus: 'Agent inspected source fidelity; final export awaits user review',
    technicalClearance: false, publicationApproved: false,
    generationModel: 'gpt-image-2.5-sunburst', generationQuality: 'high',
    generationSize: 'auto', groupSlug: row.catalog.groupSlug,
    catalogVisibility: row.catalogVisibility ?? {visible: true},
    priorHero: row.registryEntry,
  });
}
fs.writeFileSync(path.join(batch, 'export-records.json'), JSON.stringify(records, null, 2) + '\n');
console.log(`Exported ${records.length} measured 2080 × 2288 review images; original bytes preserved.`);

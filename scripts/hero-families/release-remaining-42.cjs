// Export only the 42 source-matched Slim, Aluminum, and Atomizer renders.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const batch = path.join(root, 'output/imagegen/next-four-2026-09-24');
const docs = path.join(root, 'docs/hero-families/remaining-42-2026-09-24');
const publicDir = '/images/catalog/next-four-approved-2026-09-24';
const expected = { Slim: 15, 'Aluminum Bottle': 4, Atomizer: 23 };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(batch, 'manifest.json')));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/products/catalog-heroes.json')));
  const rows = manifest.rows.filter(row => row.family in expected && row.rawOutput);
  if (rows.length !== 42 || new Set(rows.map(row => row.websiteSku)).size !== 42) {
    throw new Error('Expected 42 unique rendered SKUs');
  }
  for (const [family, count] of Object.entries(expected)) {
    if (rows.filter(row => row.family === family).length !== count) throw new Error(`Unexpected ${family} count`);
  }
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });

  const heroes = [];
  const evidence = [];
  for (const row of rows) {
    const identity = catalog.find(hero => hero.websiteSku === row.websiteSku);
    if (!identity || ['groupSlug', 'graceSku', 'shopifyVariantId', 'family', 'capacityMl', 'bottleColor']
      .some(key => identity[key] !== row[key])) {
      throw new Error(`Catalog identity mismatch: ${row.websiteSku}`);
    }
    const sourcePath = path.join(batch, path.basename(row.rawOutput));
    const source = fs.readFileSync(sourcePath);
    const receipt = JSON.parse(fs.readFileSync(sourcePath.replace(/\.png$/, '.render.json')));
    if (hash(source) !== receipt.outputSha256 || receipt.model !== 'gpt-image-2.5-sunburst') {
      throw new Error(`Invalid source receipt: ${row.websiteSku}`);
    }
    const meta = await sharp(source).metadata();
    if (meta.width !== 2080 || meta.height !== 2288) throw new Error(`Unexpected dimensions: ${row.websiteSku}`);

    const resized = await sharp(source).resize(1560, 1716, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha().raw().toBuffer();
    const webp = await sharp(resized, { raw: { width: 1560, height: 1716, channels: 3 } })
      .webp({ lossless: true, effort: 6 }).toBuffer();
    if (!(await sharp(webp).removeAlpha().raw().toBuffer()).equals(resized)) {
      throw new Error(`Lossless export failed: ${row.websiteSku}`);
    }
    const sha256 = hash(webp);
    const url = `${publicDir}/${row.websiteSku}.${sha256.slice(0, 12)}.webp`;
    fs.writeFileSync(path.join(root, 'public', url), webp);
    const hero = Object.fromEntries(['groupSlug', 'websiteSku', 'graceSku', 'shopifyVariantId',
      'family', 'capacityMl', 'bottleColor', 'alt'].map(key => [key, identity[key]]));
    heroes.push({ ...hero, presentation: 'Original product assembly', url, width: 1560, height: 1716,
      framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    evidence.push({ sku: row.websiteSku, family: row.family, groupSlug: row.groupSlug,
      shopifyVariantId: row.shopifyVariantId, url, sha256, bytes: webp.length,
      sourceFile: path.basename(sourcePath), sourceRenderSha256: hash(source), sourceBytes: source.length,
      model: receipt.model, nativeSize: receipt.nativeSize, exportSize: [1560, 1716],
      resize: 'uniform 0.75 Lanczos3', encoding: 'lossless WebP', decodedPixelsVerified: true,
      approvedFramingTarget: { baselinePct: 91, spanPct: row.framingLock.spanPct },
      inputSha256: receipt.inputSha256, masterSha256: receipt.masterSha256,
      effectivePromptSha256: receipt.effectivePromptSha256,
      correction: row.websiteSku === 'GBAtom5SlimBlk' ? 'black trim and actuator v2' : null });
  }
  fs.writeFileSync(path.join(root, 'src/lib/products/catalog-hero-remaining-42-release.json'),
    JSON.stringify(heroes, null, 2) + '\n');
  fs.writeFileSync(path.join(docs, 'approval.json'), JSON.stringify({
    date: '2026-09-24', userApproval: 'No we need the Slim one. Let\'s do the remaining 42 images now. Let\'s integrate those please',
    scope: expected, publication: false,
    background: 'Generated bone treatment retained; pixel-exact background not claimed', rows: evidence,
  }, null, 2) + '\n');
  for (const family of ['slim', 'aluminum-bottle', 'atomizer']) {
    fs.copyFileSync(path.join(batch, `${family}-generated-review.jpg`), path.join(docs, `${family}-review.jpg`));
  }
  console.log(JSON.stringify({ images: heroes.length,
    nativeBytes: evidence.reduce((sum, row) => sum + row.sourceBytes, 0),
    shippedBytes: evidence.reduce((sum, row) => sum + row.bytes, 0) }));
}

main().catch(error => { console.error(error); process.exit(1); });

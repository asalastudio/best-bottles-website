// Export the five approved native renders without changing framing or materials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const batch = path.join(root, 'output/imagegen/next-four-2026-09-24');
const docs = path.join(root, 'docs/hero-families/apothecary-2026-09-24');
const publicDir = '/images/catalog/apothecary-approved-2026-09-24';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(batch, 'manifest.json')));
  const sources = manifest.rows.filter(row => row.family === 'Apothecary');
  if (sources.length !== 5) throw new Error('Expected exactly five approved Apothecary images');
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });
  const heroes = [], evidence = [];
  for (const row of sources) {
    const source = fs.readFileSync(row.rawOutput);
    const receipt = JSON.parse(fs.readFileSync(row.rawOutput.replace(/\.png$/, '.render.json')));
    if (hash(source) !== receipt.outputSha256 || receipt.model !== 'gpt-image-2.5-sunburst') {
      throw new Error(`Invalid source receipt: ${row.websiteSku}`);
    }
    const image = sharp(source);
    const meta = await image.metadata();
    if (meta.width !== 2080 || meta.height !== 2288) throw new Error('Unexpected native dimensions');
    // One uniform downsample; lossless encoding avoids additional color drift.
    const resized = await image.resize(1560, 1716, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    const webp = await sharp(resized, { raw: { width: 1560, height: 1716, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer();
    const decoded = await sharp(webp).removeAlpha().raw().toBuffer();
    if (!decoded.equals(resized)) throw new Error('Lossless export failed pixel verification');
    const sha256 = hash(webp);
    const url = `${publicDir}/${row.websiteSku}.${sha256.slice(0,12)}.webp`;
    fs.writeFileSync(path.join(root, 'public', url), webp);
    const hero = Object.fromEntries(['groupSlug','websiteSku','graceSku','shopifyVariantId','family','capacityMl','bottleColor','alt'].map(key => [key,row[key]]));
    heroes.push({ ...hero, presentation: 'Empty · glass stopper inserted', url, width: 1560, height: 1716,
      framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    evidence.push({ sku: row.websiteSku, groupSlug: row.groupSlug, shopifyVariantId: row.shopifyVariantId,
      url, sha256, bytes: webp.length, sourceFile: path.basename(row.rawOutput), sourceRenderSha256: hash(source),
      sourceBytes: source.length, model: receipt.model, nativeSize: receipt.nativeSize, exportSize: [1560,1716],
      resize: 'uniform 0.75 Lanczos3', encoding: 'lossless WebP', decodedPixelsVerified: true,
      approvedFramingTarget: { baselinePct: 91, spanPct: row.framingLock.spanPct },
      visualDecision: 'approved', correction: row.presentationCorrection ?? null,
      inputSha256: receipt.inputSha256, masterSha256: receipt.masterSha256, effectivePromptSha256: receipt.effectivePromptSha256,
    });
  }
  fs.writeFileSync(path.join(root,'src/lib/products/catalog-hero-apothecary-release.json'), JSON.stringify(heroes,null,2)+'\n');
  fs.writeFileSync(path.join(docs,'approval.json'), JSON.stringify({ date:'2026-09-24', userApproval:'ok lets push these to the UI ad create a PR', scope:'Five reviewed Apothecary images, including seated green stopper', publication:false, background:'Approved generated bone treatment retained; no new exact-field background claim', rows:evidence },null,2)+'\n');
  fs.copyFileSync(path.join(batch,'apothecary-generated-review.jpg'),path.join(docs,'approved-review.jpg'));
  console.log(JSON.stringify({ images:heroes.length, nativeBytes:evidence.reduce((n,r)=>n+r.sourceBytes,0), shippedBytes:evidence.reduce((n,r)=>n+r.bytes,0) }));
}
main().catch(error => { console.error(error); process.exit(1); });

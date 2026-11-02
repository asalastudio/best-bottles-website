import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');
const { createBlobStore } = await import(path.join(process.cwd(), 'scripts/paperdoll/lib/store-blob.mjs'));
const dir = process.env.DISPLAY_WORK_DIR || '/private/tmp/bb-display-derivatives';
const manifest = JSON.parse(fs.readFileSync('src/lib/paper-doll/approved-kits.generated.json'));
const widths = [128, 256, 640, 1200];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const publish = process.argv.includes('--publish');
const assets = new Map();
for (const kit of Object.values(manifest.rows)) for (const part of kit.parts) {
 for (const im of [part.image, part.detached?.image].filter(Boolean)) {
  if (!im.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/')) throw Error('Unexpected source host');
  assets.set(im.url, { source: im.url, expectedHash: im.sha256 });
 }
}
const tola = fs.readFileSync('src/lib/products/tola-applicator.ts', 'utf8').match(/https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\/plates\/[^\s"']+\.webp/);
if (tola) assets.set(tola[0], { source: tola[0] });
fs.mkdirSync(dir, { recursive: true });
const report = { version: 1, masterManifestVersion: manifest.version, mode: 'lossless WebP display copies; original masters unchanged', assets: {} };
const receiptPath = path.join(dir, 'receipt.json');
const receipts = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath)) : {};
const store = publish ? createBlobStore() : null;
const save = () => fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
async function build(asset) {
 const ext = new URL(asset.source).pathname.split('.').at(-1);
 const sourceFile = path.join(dir, sha(asset.source) + '.' + ext);
 let bytes;
 if (fs.existsSync(sourceFile)) bytes = fs.readFileSync(sourceFile);
 else {
  const response = await fetch(asset.source);
  if (!response.ok) throw Error('Source failed ' + response.status + ' ' + asset.source);
  bytes = Buffer.from(await response.arrayBuffer()); fs.writeFileSync(sourceFile, bytes);
 }
 const sourceHash = sha(bytes);
 if (asset.expectedHash && asset.expectedHash !== sourceHash) throw Error('Master hash mismatch ' + asset.source);
 if (ext === 'svg' && /<(?:script|foreignObject)\b|\b(?:href|xlink:href)=["'](?:https?:|\/)/i.test(bytes.toString())) throw Error('External or active SVG');
 const metadata = await sharp(bytes).metadata();
 const result = { sourceHash, sourceBytes: bytes.length, sourceWidth: metadata.width, sourceHeight: metadata.height, derivatives: {} };
 for (const width of widths) {
  const pipeline = sharp(bytes).resize({ width, withoutEnlargement: true }).ensureAlpha();
  const reference = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
  const encoded = await pipeline.clone().webp({ lossless: true, effort: 6, alphaQuality: 100 }).toBuffer();
  const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (reference.info.width !== decoded.info.width || reference.info.height !== decoded.info.height) throw Error('Dimensions changed');
  let alphaDifferences = 0, visibleColorDifferences = 0;
  for (let i = 0; i < reference.data.length; i += 4) {
   if (reference.data[i+3] !== decoded.data[i+3]) alphaDifferences++;
   if (reference.data[i+3] && [0,1,2].some(c => reference.data[i+c] !== decoded.data[i+c])) visibleColorDifferences++;
  }
  if (alphaDifferences || visibleColorDifferences) throw Error('Lossless pixels changed ' + JSON.stringify({ alphaDifferences, visibleColorDifferences }));
  const hash = sha(encoded), filename = hash + '.' + width + '.webp';
  fs.writeFileSync(path.join(dir, filename), encoded);
  const key = 'product-display/v1/' + sourceHash + '/' + width + '-' + hash + '.webp';
  let url = 'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/' + key;
  if (publish) {
   if (!receipts[hash]) {
    const uploaded = await store.putObject(key, encoded, 'image/webp');
    const response = await fetch(uploaded.url);
    if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== hash) throw Error('Hosted derivative hash mismatch');
    if (!/max-age=\d{6,}/.test(response.headers.get('cache-control') || '')) throw Error('Missing immutable cache lifetime');
    receipts[hash] = { url: uploaded.url, bytes: encoded.length, verified: true };
    fs.writeFileSync(receiptPath, JSON.stringify(receipts, null, 2) + '\n');
   }
   url = receipts[hash].url;
  }
  result.derivatives[width] = { url, sha256: hash, bytes: encoded.length, width: decoded.info.width, height: decoded.info.height, alphaDifferences, visibleColorDifferences };
 }
 report.assets[asset.source] = result; save();
 if (Object.keys(report.assets).length % 10 === 0) console.log('Prepared ' + Object.keys(report.assets).length + '/' + assets.size);
}
const queue = [...assets.values()];
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await build(queue.shift()); }));
const entries = Object.values(report.assets);
report.summary = { assets: assets.size, sourceBytes: entries.reduce((n,a) => n+a.sourceBytes,0), displayBytes: Object.fromEntries(widths.map(w => [w,entries.reduce((n,a) => n+a.derivatives[w].bytes,0)])), losslessPixelChecksPassed: true, published: publish };
save();
if (publish) {
 const sources = Object.fromEntries(Object.entries(report.assets).map(([source,a]) => [source, Object.fromEntries(widths.map(w => [w,a.derivatives[w].url]))]));
 // Local review mirrors may use the delivery copy only after exact byte-hash verification.
 const hashes = new Map(Object.entries(report.assets).map(([url, asset]) => [asset.sourceHash, url]));
 const aliases = {};
 function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
   const file = path.join(directory, entry.name);
   if (entry.isDirectory()) { scan(file); continue; }
   if (!entry.isFile() || !/^(?:kit|kits)\.json$/.test(entry.name)) continue;
   let kit; try { kit = JSON.parse(fs.readFileSync(file)); } catch { continue; }
   const urls = new Set();
   function visit(value) {
    if (typeof value === 'string' && value.startsWith('/local-kits/') && /\.(?:svg|png|webp)$/.test(value)) urls.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
   }
   visit(kit);
   for (const url of urls) {
    if (aliases[url] || !fs.existsSync('public' + url)) continue;
    const canonical = hashes.get(sha(fs.readFileSync('public' + url)));
    if (canonical) aliases[url] = canonical;
   }
  }
 }
 scan('public/local-kits');
 const pixelWidths = Object.fromEntries(Object.entries(report.assets).map(([url, asset]) => [url, Object.fromEntries(widths.map(w => [w, asset.derivatives[w].width]))]));
 fs.writeFileSync(path.join(dir, 'display-images.generated.json'), JSON.stringify({ version: sha(JSON.stringify({ sources, aliases, pixelWidths })).slice(0,16), sources, aliases, pixelWidths }) + '\n');
}
console.log(JSON.stringify(report.summary));

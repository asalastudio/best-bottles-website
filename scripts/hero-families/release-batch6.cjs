// Export the 15 batch-6 Sunburst heroes Jordan approved on 2026-09-25 ("approve all"):
// Royal 13 ml, Square 15 ml, Flair 15 ml, Bell 10 ml and Pillar 9 ml (three cards each, cap /
// fine-mist / metal roller). Jordan asked for all five to be regenerated after reviewing the
// 13-415 family cards ("Regenerate all three plus Pillar and Bell").
//
// Sources: the exact-SKU master PSDs (BB-PSD-Files-Master / 5. 13-415 Bottles; the library files the
// Bell as "12ml" and names its SKUs GBBell12…) except Pillar, which has no master PSD and was rendered
// from its exact-SKU legacy bestbottles.com photographs (images/store/enlarged_pics), the route the
// PSD-less vials took. Sizing: approved curve pct = 3.5314 * mm^0.5868 (shoulder-to-foot span, foot at
// 91%) on production's glass heights (Royal 56, Square 52, Flair 56, Bell 55, Pillar 57 mm). The Square
// foot is the lowest ink row inside the bottle's columns (its glass foot is a separate PSD component).
//
// GBPillar9BlkShSht (the Pillar cap card) was held from the first run: production filed that bottle in the
// corrupt group "pillar-9ml-clear-Size: GBPillar9BlkSht Nemat In". It joined the release on 2026-09-25 after
// scripts/catalog-corrections/2026-09-25-pillar-cap-group-move.mjs moved it into pillar-9ml-clear-13-415.
//
// Usage: node scripts/hero-families/release-batch6.cjs <lane-dir>
//   <lane-dir> holds approval-candidates.json, fitted/, renders/ and the review sheets.
//
// Read-only against the lane and production: refuses any fitted or raw render whose sha256 differs
// from the approved one below, and any SKU production Convex does not hold in exactly one group.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const lane = path.resolve(process.argv[2] || process.env.HERO_LANE_DIR || '');
const docs = path.join(root, 'docs/hero-families/batch6-2026-09-25');
const publicDir = '/images/catalog/batch6-approved-2026-09-25';
const registryPath = path.join(root, 'src/lib/products/catalog-hero-batch6-release.json');
const productionQuery = 'https://precise-raccoon-123.convex.cloud/api/query';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const APPROVED = {
  GBRoyal13Gl: { attempt: 'a1', fittedSha256: '6e041a1f68d46a97683e8282c302dadb8aad5b441a6c287cb0be61a4249e50df', renderSha256: 'dc8033bd329dcdc9c1d10922bb47ffb38f1abbcdcd1bbb481ef8d84dd2c6db53',
    alt: '13 ml Clear Royal Bottle with Shiny Gold Cap' },
  GBRoyal13SpryGlMatt: { attempt: 'a1', fittedSha256: '181cbbb67b3b3ac2977f51897db58c13218f1967e5bd63cfb62b01ab2d735efa', renderSha256: '1b51bfdc4a828c4863cbdf46d6430af69b50f422edbfd420ab8a79cb56c91735',
    alt: '13 ml Clear Royal Fine Mist Spray Bottle with Matte Gold Sprayer and Cap' },
  GBRoyal13MtlRollBlkDot: { attempt: 'a1', fittedSha256: '3725e50611226ccb601fcc1520f0f0e4c70a89232be2e805e6de5036395670d3', renderSha256: '12812b4153bf67a0a90cd9892f5c286e329adb8897d8e1f2738fde63384a7c28',
    alt: '13 ml Clear Royal Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GBSqr15Gl: { attempt: 'a1', fittedSha256: '8b523cc6bdce8b61ff8bb82c78b3f51b19ea8d2b1deb961d6118aa096026bddb', renderSha256: 'c5ae84ed35f7af8792d96d6ac2b503473f3f0d52df95d237e25400274c62dc6f',
    alt: '15 ml Clear Square Bottle with Shiny Gold Cap' },
  GBSqr15SpryGlMatt: { attempt: 'a1', fittedSha256: 'c1d1020201bccd55f56c7f4c26bafd414d7e7bbb2b994419b0dd29278593e50d', renderSha256: 'd90abb397e56065ff63fa3f73d912dbb2238e8362109841588cbc1a22bfab4c0',
    alt: '15 ml Clear Square Fine Mist Spray Bottle with Matte Gold Sprayer and Cap' },
  GBSqr15MtlRollBlkDot: { attempt: 'a1', fittedSha256: 'b8330cce9494a71cce9bb4a8fa2d5ce4ad675c369b69f044158eaf95e57fc7ef', renderSha256: 'd86f3fc08dff479bc20364f95e9510d7ac4ddd1e74026652c5f75279925fcad2',
    alt: '15 ml Clear Square Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GBFlair15Gl: { attempt: 'a1', fittedSha256: '9d965769a94f5ab486a2af1d6f265583411e35c0b123851c956553aa72080784', renderSha256: 'dc685164ee0dc1823f3f6b2874b21b1bcf0d733d48aa6017d57e6d0f062ccff3',
    alt: '15 ml Clear Flair Bottle with Shiny Gold Cap' },
  GBFlair15SpryGlMatt: { attempt: 'a1', fittedSha256: 'e8c86d8b2578e2d58f13624f1ee30700124e7382660c814bfefb83b001b7fba7', renderSha256: '85affcc7e0fd3d11113c479c094f53c898b0cbbca8e3b1f8824536b5a5c8c9f5',
    alt: '15 ml Clear Flair Fine Mist Spray Bottle with Matte Gold Sprayer and Cap' },
  GBFlair15MtlRollBlkDot: { attempt: 'a1', fittedSha256: 'a6f7a7e569548fcd233b706191b1cbb32991ad30ab67cc1962c054a770574432', renderSha256: '42805c7b321c20f139062df576dba64fb26e46a95814dd0713dacef13c3075ac',
    alt: '15 ml Clear Flair Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GBBell10BlkShSht: { attempt: 'a1', fittedSha256: 'f7e91e8e8b3a4aa02d0aecd23aebd70a8e80ea46b3323d2fa29a7299a314e869', renderSha256: '5c6e16e03774d159ec805b4681387412699ff988199ca42531e2cc24fa41d977',
    alt: '10 ml Clear Bell Bottle with Shiny Black Short Cap' },
  GBBell10SpryBlkSh: { attempt: 'a1', fittedSha256: '82b8939783c5a1f8eb2efd37f1decb23136b69cd09bea508f54692034d6be059', renderSha256: '26752462cfe9c1210c074d08a14ebe98881bbf4975b2d74dbc432c2b0eb7f571',
    alt: '10 ml Clear Bell Fine Mist Spray Bottle with Shiny Black Sprayer and Cap' },
  GBBell10MtlRollBlkDot: { attempt: 'a1', fittedSha256: '67338faec32aff90c618400ae8d5d3364d4f1e26f96885fbb2cae4881c78bc78', renderSha256: 'd573c03dba1bc5a6dd0a7e2f79aa57ca39b47e8b5ca92ba147573288f75cd9c8',
    alt: '10 ml Clear Bell Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GBPillar9BlkShSht: { attempt: 'a1', fittedSha256: '758d0ebe54fdd69109da527eb92e4c51c2864a720405ff42a10b6e8b3ea14f48', renderSha256: '60feb0ee5a2349e24a616fb691f2480ed0b33479dfa67e8ac0ce77b06443ded7',
    alt: '9 ml Clear Pillar Bottle with Shiny Black Short Cap' },
  GBPillar9MtlRollBlkdot: { attempt: 'a1', fittedSha256: 'ccc2c97818f3719e835553e2f8b8d6591b488068098487ff10561aca613c6b0c', renderSha256: '4ada3c681a64a0cdc22ad9932168914887fe1a35821f2062509979113f965f6a',
    alt: '9 ml Clear Pillar Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GBPillar9SpryBlkMatt: { attempt: 'a1', fittedSha256: 'c8e8f6ab1aac3b4b37ad89b9ce7d6148d2717fb0a898c423a65c90f71b01ba65', renderSha256: 'a048c7d5050646e4125a0bb0903019d4d761285858f8d0c4ebad4395f549a82d',
    alt: '9 ml Clear Pillar Fine Mist Spray Bottle with Matte Black Sprayer and Cap' },
};
const EXPECTED = { Royal: 3, Square: 3, Flair: 3, Bell: 3, Pillar: 3 };
// Nothing is held any more; the record of the Pillar cap hold and its release stays in approval.json.
const HELD = {};
const RELEASED_FROM_HOLD = {
  GBPillar9BlkShSht: 'held on the first run (2026-09-25 midday) because production filed the bottle in the corrupt group "pillar-9ml-clear-Size: GBPillar9BlkSht Nemat In"; released the same evening after scripts/catalog-corrections/2026-09-25-pillar-cap-group-move.mjs moved it into pillar-9ml-clear-13-415',
};

async function productionHolder(websiteSku) {
  const response = await fetch(productionQuery, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'products:searchCatalog', format: 'json',
      args: { filters: { search: websiteSku }, sort: 'relevance', view: 'grid', limit: 24 } }),
  });
  const body = await response.json();
  if (body.status !== 'success') throw new Error(`Production query failed: ${websiteSku}`);
  const byId = new Map(body.value.items.map(item => [item._id, item]));
  const holders = body.value.variantPreviewRows.flatMap(row => row.variants
    .filter(variant => variant.websiteSku === websiteSku)
    .map(variant => ({ group: byId.get(row.groupId), variant })));
  if (holders.length !== 1 || !holders[0].group) throw new Error(`Expected one production holder: ${websiteSku}`);
  return holders[0];
}

async function main() {
  const laneJsonPath = path.join(lane, 'approval-candidates.json');
  if (!fs.existsSync(laneJsonPath)) throw new Error('Pass the lane directory: node scripts/hero-families/release-batch6.cjs <lane-dir>');
  const laneJsonBytes = fs.readFileSync(laneJsonPath);
  const candidates = JSON.parse(laneJsonBytes);
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });

  const heroes = [];
  const evidence = [];
  for (const [sku, approved] of Object.entries(APPROVED)) {
    const record = candidates.find(c => c.websiteSku === sku);
    if (!record || record.selectedAttempt !== approved.attempt || record.fitted.sha256 !== approved.fittedSha256
      || record.render.sha256 !== approved.renderSha256 || record.render.model !== 'gpt-image-2.5-sunburst') {
      throw new Error(`Lane record no longer matches the approved selection: ${sku}`);
    }
    const source = fs.readFileSync(path.join(lane, record.fitted.file));
    const render = fs.readFileSync(path.join(lane, record.render.file));
    if (hash(source) !== approved.fittedSha256 || hash(render) !== approved.renderSha256) throw new Error(`Changed source: ${sku}`);
    const meta = await sharp(source).metadata();
    if (meta.width !== 2080 || meta.height !== 2288) throw new Error(`Unexpected dimensions: ${sku}`);

    const { group, variant } = await productionHolder(sku);
    if (group.slug !== record.slug) throw new Error(`Production group differs from the lane's: ${sku} ${group.slug} vs ${record.slug}`);
    if (group.color !== 'Clear') throw new Error(`Production colour mismatch: ${sku}`);

    const resized = await sharp(source).resize(1560, 1716, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    const webp = await sharp(resized, { raw: { width: 1560, height: 1716, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer();
    const decoded = await sharp(webp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== 1560 || decoded.info.height !== 1716 || !decoded.data.equals(resized)) throw new Error(`Lossless export failed: ${sku}`);
    const sha256 = hash(webp);
    const url = `${publicDir}/${sku}.${sha256.slice(0, 12)}.webp`;
    const target = path.join(root, 'public', url);
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(webp)) throw new Error(`Released file changed: ${sku}`);
    fs.writeFileSync(target, webp);

    heroes.push({ groupSlug: group.slug, websiteSku: sku, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, family: group.family, capacityMl: group.capacityMl,
      bottleColor: 'Clear', alt: approved.alt, presentation: 'Empty · cap beside',
      url, width: 1560, height: 1716, framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    evidence.push({ sku, family: group.family, groupSlug: group.slug, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, status: 'approved',
      production: { deployment: 'precise-raccoon-123', groupId: group._id, slug: group.slug, displayName: group.displayName,
        color: group.color, capColor: variant.capColor ?? null, applicator: variant.applicator ?? null,
        verifiedBy: 'products:searchCatalog exact websiteSku' },
      url, sha256, bytes: webp.length,
      selectedAttempt: approved.attempt, sourceFittedSha256: approved.fittedSha256, sourceBytes: source.length,
      sourceRenderSha256: approved.renderSha256, model: record.render.model, nativeSize: record.render.nativeSize,
      exportSize: [1560, 1716], resize: 'uniform 0.75 Lanczos3', encoding: 'lossless WebP', decodedPixelsVerified: true,
      attemptsForSku: 1, sizing: record.sizing, fit: record.fit, qaOutline: record.qaOutline, qaRawMask: record.qaRawMask,
      input: record.input, source: record.source, promptSha256: record.render.promptSha256 });
  }
  for (const [family, count] of Object.entries(EXPECTED)) {
    if (heroes.filter(hero => hero.family === family).length !== count) throw new Error(`Unexpected ${family} count`);
  }
  fs.writeFileSync(registryPath, JSON.stringify(heroes, null, 2) + '\n');
  fs.writeFileSync(path.join(docs, 'approval.json'), JSON.stringify({
    date: '2026-09-25', approvedBy: 'Jordan ("approve all") after the contact sheet and the three before/after review sheets',
    scope: EXPECTED, publication: false,
    source: { lane: 'batch6-2026-09-25', approvalCandidatesSha256: hash(laneJsonBytes),
      inputs: 'exact-SKU master PSDs (BB-PSD-Files-Master / 5. 13-415 Bottles; Bell filed as 12ml, files GBBell12…); Pillar from exact-SKU legacy bestbottles.com photographs (no master PSD)' },
    supersedes: { 'catalog-hero-next-batch-release.json': ['GBRoyal13Gl', 'GBRoyal13SpryGlMatt', 'GBRoyal13MtlRollBlkDot', 'GBFlair15Gl', 'GBFlair15SpryGlMatt', 'GBFlair15MtlRollBlkDot'],
      'catalog-hero-batch3-release.json': ['GBSqr15Gl', 'GBSqr15SpryGlMatt', 'GBSqr15MtlRollBlkDot'],
      'catalog-heroes.json (older generation, still present as the fallback)': ['GBBell10BlkShSht', 'GBBell10SpryBlkSh', 'GBBell10MtlRollBlkDot', 'GBPillar9MtlRollBlkdot', 'GBPillar9SpryBlkMatt'] },
    sizing: { curve: 'pct = 3.5314 * mm^0.5868 (shoulder-to-foot span; foot at 91%)',
      glassMm: { Royal: 56, Square: 52, Flair: 56, Bell: 55, Pillar: 57 }, glassMmSource: 'production Convex heightWithoutCap 2026-09-25',
      landmarkRule: 'shoulder = first row wider than 1.25x the neck on the open-neck reference; siblings by body width',
      footRule: 'lowest ink row inside the bottle\'s own columns (the Square glass foot is a separate PSD component)' },
    qa: 'Outline-only gate (row-filled components, so interior reflections seen through the open necks do not count as edges): Square x3, Flair cap and roller, Pillar cap pass IoU >= 0.995 and p99 <= 4 px; Royal x3, Flair spray, Pillar roller and spray sit at the measurement noise floor (IoU 0.9947-0.9961, p99 2.5-7.2 px); Bell x3 are 6-12 px at the shoulder (IoU 0.992-0.995). Every image reviewed by eye and approved by Jordan.',
    held: HELD, releasedFromHold: RELEASED_FROM_HOLD, rows: evidence,
  }, null, 2) + '\n');
  for (const sheet of ['contact-approved.jpg', 'sizing-proof.jpg', 'review-A.jpg', 'review-B.jpg', 'review-C.jpg']) {
    fs.copyFileSync(path.join(lane, sheet), path.join(docs, sheet));
  }
  console.log(JSON.stringify({ images: heroes.length, shippedBytes: evidence.reduce((sum, row) => sum + row.bytes, 0) }));
}

main().catch(error => { console.error(error); process.exit(1); });

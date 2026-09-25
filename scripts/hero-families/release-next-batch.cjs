// Export the 14 next-batch Sunburst heroes Jordan approved on 2026-09-25 from
// the contact sheets (Grace 55, Royal 13 spray, Flair 15, Tola 6, Marble,
// Eternal Flame Clear/Blue, Genie Clear).
//
// Usage: node scripts/hero-families/release-next-batch.cjs <lane-worktree>
//   <lane-worktree> is the generation lane checkout that holds
//   docs/hero-families/next-batch-2026-09-25/approval-candidates.json and
//   output/imagegen/next-batch-2026-09-25/{fitted,renders}/.
//
// Read-only against the lane and production: refuses any fitted or raw render
// whose sha256 differs from the approved one recorded below, any lane record
// that no longer selects the approved attempt, and any SKU that production
// Convex does not hold in exactly the registry's group.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const lane = path.resolve(process.argv[2] || process.env.HERO_LANE_DIR || '');
const laneDocs = path.join(lane, 'docs/hero-families/next-batch-2026-09-25');
const laneOutput = path.join(lane, 'output/imagegen/next-batch-2026-09-25');
const docs = path.join(root, 'docs/hero-families/next-batch-2026-09-25');
const publicDir = '/images/catalog/next-batch-approved-2026-09-25';
const registryPath = path.join(root, 'src/lib/products/catalog-hero-next-batch-release.json');
const productionQuery = 'https://precise-raccoon-123.convex.cloud/api/query';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Approved selection: the round-1 fitted file for each SKU, pinned by hash.
// bottleColor keeps production's catalog colour (it feeds the card spec line
// and the guided-finder colour facet); alt describes what is pictured.
const APPROVED = {
  GBGrce55SpryMtGl: { attempt: 'a2', fittedSha256: '7cea9becd0134081108372662d326c7eb1d8efc33b893337ae78815659b0bb22', renderSha256: '57dcc84c18bd1ed0500e3daba1e67a0d648aa6a6ae24c8c2e47726ea1d85ea6f',
    bottleColor: 'Clear', alt: '55 ml Clear Grace Spray Bottle with Matte Gold Spray Pump and Cap' },
  LBGrce55LtnMtGl: { attempt: 'a1', fittedSha256: 'e18b2e9aaf6e5b98056c0ae897f58caa2ffed31448c5358b8b3447ffaf3fde02', renderSha256: '911d3caebceefc883add219543e5a0e732555ff301c2d9b99eaeec7c78b66f92',
    bottleColor: 'Clear', alt: '55 ml Clear Grace Lotion Pump Bottle with Matte Gold Pump and Cap' },
  GBGrce55RdcrMtSl: { attempt: 'a1', fittedSha256: '269052f1985bedf6c3a69a7516da6d3bdd7538cd5234deb6956cb2c3afc9a559', renderSha256: 'c252b27dbf2816c44d2e02e0bf33fdae8d27afbfce2cef8ff28562ecea5956ff',
    bottleColor: 'Clear', alt: '55 ml Clear Grace Reducer Bottle with Matte Silver Cap' },
  GBGrce55AnSpMtSl: { attempt: 'a2', fittedSha256: '1c0d90571d5352961166a1c9d2a3469276154e7785fbb03b04ad23568b99444f', renderSha256: '73dba17ec0bda62de27572ea35d22984ccdd5ec8c19eb8624e9d45a0b68cac69',
    bottleColor: 'Clear', alt: '55 ml Clear Grace Vintage Style Bulb Spray Bottle with Matte Silver Sprayer' },
  GBRoyal13SpryGlMatt: { attempt: 'a3', fittedSha256: '0fef459dc1bfd4dda6f53fac74d67947c2ea604d150e43f67b81353560edd81e', renderSha256: '6bac97c04a428c25ac90d9a972733b4080506b55d8e856e5505bd4996e674518',
    bottleColor: 'Clear', alt: '13 ml Clear Royal Fine Mist Spray Bottle with Matte Gold Sprayer and Cap' },
  GBFlair15Gl: { attempt: 'a1', fittedSha256: '661e7918dbc6b938e6ac099a4e609aa43b04f02e4146d234fb6230551b8c2671', renderSha256: '5f00d2b5876fdb9c30e7efb4f262d2a79c738782ee8472fe9892d8bc7e5a24c1',
    bottleColor: 'Clear', alt: '15 ml Clear Flair Bottle with Shiny Gold Cap' },
  GBFlair15SpryGlMatt: { attempt: 'a1', fittedSha256: 'd07e80e118ee359e6ab0759b6baf8c7cec86c929cace6a20370457ee208a0a22', renderSha256: '66ea1592da621ebceb7289daa7bc47d384b2967642c374a1798fc2e9f2670cfc',
    bottleColor: 'Clear', alt: '15 ml Clear Flair Fine Mist Spray Bottle with Matte Gold Sprayer and Cap' },
  GBFlair15MtlRollBlkDot: { attempt: 'a2', fittedSha256: '12a72a59f5dbe9c46de92045e07e8435b8e11eb17b8b46a0b3302b44066a0665', renderSha256: 'd803879611e69517fd527869307dff5a4bdafda011eb24972d647d284f4a57bb',
    bottleColor: 'Clear', alt: '15 ml Clear Flair Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GB6TPlGl: { attempt: 'a2', fittedSha256: 'eb8c6b38153b51a8d741bde27e453e4b19f980f3487ead9d7047bbee6610235b', renderSha256: 'af2e878c7facf64740197be869db5429dd71cfc8eef053d80288669932f772f6',
    bottleColor: 'Clear', alt: '6 ml Clear Tola Bottle with Shiny Gold Cap and Red Bead' },
  GBMtlMrblSmall: { attempt: 'a1', fittedSha256: '813cd4c46c0b268cf66f32d2224c786f9f9ec6934b0a10a792c7281d4c0afd63', renderSha256: 'bee76b9225882d179c698a8d9c279a5166d37444eeacfcf3f66fa4f62a47225b',
    bottleColor: 'Clear', alt: '5 ml Marble Bottle with Wood-Grain Metal Shell, Gold Trim and Crystal Stopper' },
  GBMtlMrblLarge: { attempt: 'a2', fittedSha256: '9a0ad3dd658333d2a1ce13580bb1c5b1267c430b389f9a81409662e515bbd420', renderSha256: 'dc3ed26bfa17d56391bb300921402b3a44ffe8a9ae79585dfbc22b524347fa9d',
    bottleColor: 'Clear', alt: '10 ml Marble Bottle with Wood-Grain Metal Shell, Gold Trim and Crystal Stopper' },
  GBEternalFlameClear: { attempt: 'a2', fittedSha256: 'f8708ea3532863b7197f64f03a00033ee188346cbbb4f9a1c1bb20a4588c424e', renderSha256: '94fa76086776d39085d1623dcdcb467055453851461e13e9f0456dde5cedfa90',
    bottleColor: 'Clear', alt: '35 ml Clear Eternal Flame Bottle with Ground Glass Stopper' },
  GBEternalFlameBlue: { attempt: 'a3', fittedSha256: '0a85d8e54dd0cadfcd3e9c827570f3ab8d71b001fc1a2d70a3eda2cd354fdf86', renderSha256: 'feb604f372f36c16bdd5c0ff95f9e22f4279d1c21db0af0d9c5f195546b86523',
    bottleColor: 'Cobalt Blue', alt: '35 ml Cobalt Blue Eternal Flame Bottle with Ground Glass Stopper' },
  GB1ozGenieCl: { attempt: 'a2', fittedSha256: 'c8ce8d0675cc2fa9e7b24823e3a629093d37a8e8b511a3e1bbbd66391da0dfa3', renderSha256: '30352f1c1e66393a5b21b9b4db12df8b285c60b4fe6cca03453133caf8a6c914',
    bottleColor: 'Clear', alt: '32 ml Clear Genie Bottle with Glass Stopper' },
};
const EXPECTED = { Grace: 4, Royal: 1, Flair: 3, Decorative: 6 };
const HELD = {
  GBGrce55AnSpTslMtSl: 'QA near-miss (tassel strands redrawn); re-rendering',
  GBRoyal13Gl: 'QA near-miss (right side of square body 5-8 px); re-rendering',
  GBRoyal13MtlRollBlkDot: 'QA near-miss (right side of square body 5-8 px); re-rendering',
  GB3TPlGl: 'QA near-miss (cap outline, partly a PSD alpha sliver); re-rendering',
  GBEternalFlameGreen: 'QA near-miss (one detector point at the dome/foot corner); re-rendering',
  GBCB12ozPear: 'QA near-miss (foot flare and stopper rim 4-8 px); re-rendering',
  GBHeartFrst4KeyGld: 'presentation hold: keychain floats in the master pose, no contact shadow; being re-posed',
  GBHeartFrst4TslRed: 'presentation hold: tassel floats in the master pose, no contact shadow; being re-posed',
  LB1ozGl: 'not rendered: Lotion glass height unknown',
  LB1ozSl: 'not rendered: Lotion glass height unknown',
  LB3mlClear: 'not rendered: height unknown, plastic',
  LBMetalSilver1oz: 'not rendered: discontinued, hidden from the catalog',
  GBMtlCylGl: 'not rendered: Royal 14 ml height disagreement',
  GB1ozGenieBl: 'not rendered: cobalt vs aqua master PSD conflict',
  Pillar: 'not rendered: no exact master PSDs',
};

async function productionHolder(websiteSku) {
  const response = await fetch(productionQuery, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'products:searchCatalog', format: 'json',
      args: { filters: { search: websiteSku }, sort: 'relevance', view: 'grid', limit: 24 } }),
  });
  const body = await response.json();
  if (body.status !== 'success') throw new Error(`Production query failed: ${websiteSku}`);
  const slugById = new Map(body.value.items.map(item => [item._id, item]));
  const holders = body.value.variantPreviewRows.flatMap(row => row.variants
    .filter(variant => variant.websiteSku === websiteSku)
    .map(variant => ({ group: slugById.get(row.groupId), variant })));
  if (holders.length !== 1 || !holders[0].group) throw new Error(`Expected one production holder: ${websiteSku}`);
  return holders[0];
}

async function main() {
  if (!fs.existsSync(path.join(laneDocs, 'approval-candidates.json'))) {
    throw new Error('Pass the generation lane checkout: node scripts/hero-families/release-next-batch.cjs <lane>');
  }
  const laneJsonBytes = fs.readFileSync(path.join(laneDocs, 'approval-candidates.json'));
  const candidates = JSON.parse(laneJsonBytes).candidates;
  const sizing = JSON.parse(fs.readFileSync(path.join(laneDocs, 'sizing-proof/sizing-targets.json')));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/products/catalog-heroes.json')));
  const skus = Object.keys(APPROVED);
  for (const [family, count] of Object.entries(EXPECTED)) {
    if (skus.filter(sku => candidates.find(c => c.websiteSku === sku)?.family === family).length !== count) {
      throw new Error(`Unexpected ${family} count`);
    }
  }
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });

  const heroes = [];
  const evidence = [];
  for (const sku of skus) {
    const approved = APPROVED[sku];
    const record = candidates.find(c => c.websiteSku === sku);
    if (!record || record.status !== 'pass' || record.selectedAttempt !== approved.attempt
      || record.fitted.sha256 !== approved.fittedSha256 || record.render.sha256 !== approved.renderSha256) {
      throw new Error(`Lane record no longer matches the approved selection: ${sku}`);
    }
    const identity = catalog.find(hero => hero.websiteSku === sku);
    const { group, variant } = await productionHolder(sku);
    if (!identity || group.slug !== record.prodGroupSlug || group.slug !== identity.groupSlug
      || variant.graceSku !== record.graceSku || variant.graceSku !== identity.graceSku
      || variant.shopifyVariantId !== identity.shopifyVariantId || group.family !== record.family
      || group.capacityMl !== identity.capacityMl || group.color !== approved.bottleColor) {
      throw new Error(`Production identity mismatch: ${sku}`);
    }

    const fittedPath = path.join(laneOutput, 'fitted', `${sku}-${approved.attempt}-fitted.png`);
    const renderPath = path.join(laneOutput, 'renders', `${sku}-${approved.attempt}.png`);
    const source = fs.readFileSync(fittedPath);
    const render = fs.readFileSync(renderPath);
    const receipt = JSON.parse(fs.readFileSync(renderPath.replace(/\.png$/, '.render.json')));
    if (hash(source) !== approved.fittedSha256 || hash(render) !== approved.renderSha256
      || receipt.outputSha256 !== approved.renderSha256 || receipt.model !== 'gpt-image-2.5-sunburst') {
      throw new Error(`Changed or unverifiable source: ${sku}`);
    }
    const meta = await sharp(source).metadata();
    if (meta.width !== 2080 || meta.height !== 2288) throw new Error(`Unexpected dimensions: ${sku}`);

    const resized = await sharp(source).resize(1560, 1716, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha().raw().toBuffer();
    const webp = await sharp(resized, { raw: { width: 1560, height: 1716, channels: 3 } })
      .webp({ lossless: true, effort: 6 }).toBuffer();
    const decoded = await sharp(webp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== 1560 || decoded.info.height !== 1716 || !decoded.data.equals(resized)) {
      throw new Error(`Lossless export failed: ${sku}`);
    }
    const sha256 = hash(webp);
    const url = `${publicDir}/${sku}.${sha256.slice(0, 12)}.webp`;
    fs.writeFileSync(path.join(root, 'public', url), webp);
    heroes.push({ groupSlug: group.slug, websiteSku: sku, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, family: group.family, capacityMl: group.capacityMl,
      bottleColor: approved.bottleColor, alt: approved.alt, presentation: 'Original product assembly',
      url, width: 1560, height: 1716, framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    const size = sizing.rows.find(row => row.sku === sku);
    evidence.push({ sku, family: group.family, groupSlug: group.slug, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId,
      production: { deployment: 'precise-raccoon-123', groupId: group._id, slug: group.slug,
        displayName: group.displayName, color: group.color, capColor: variant.capColor ?? null,
        applicator: variant.applicator ?? null, verifiedBy: 'products:searchCatalog exact websiteSku' },
      url, sha256, bytes: webp.length,
      sourceFile: path.basename(fittedPath), sourceFittedSha256: approved.fittedSha256, sourceBytes: source.length,
      selectedAttempt: approved.attempt, sourceRenderFile: path.basename(renderPath), sourceRenderSha256: approved.renderSha256,
      model: receipt.model, nativeSize: receipt.nativeSize, exportSize: [1560, 1716],
      resize: 'uniform 0.75 Lanczos3', encoding: 'lossless WebP', decodedPixelsVerified: true,
      sizing: { glassMm: size.glassMm, landmarkRule: size.landmarkRule, targetPct: size.targetPct,
        baselinePct: 91, curve: sizing.curve.bestFit.formula },
      fit: record.fit, qa: { iou: record.qa.geometry.iou, edgeSmoothed: record.qa.geometry.edgeSmoothed,
        edgePerPoint: record.qa.geometry.edgePerPoint, operationalPass: record.qa.geometry.operationalPass,
        strictPolicyPass: record.qa.geometry.strictPolicyPass, shadowProbe: record.qa.shadowProbe,
        background: record.qa.background, eye: record.qa.eye },
      input: record.input, inputSha256: receipt.inputSha256, psdSha256: receipt.psdSha256,
      effectivePromptSha256: receipt.effectivePromptSha256, laneRecord: record });
  }
  fs.writeFileSync(registryPath, JSON.stringify(heroes, null, 2) + '\n');
  fs.writeFileSync(path.join(docs, 'approval.json'), JSON.stringify({
    date: '2026-09-25', approvedBy: 'Jordan, after reviewing the contact sheets',
    scope: EXPECTED, publication: false,
    source: { lane: 'next-batch-2026-09-25 round 1 (fitted/)', approvalCandidatesSha256: hash(laneJsonBytes) },
    sizing: { curve: sizing.curve.bestFit.formula, measure: 'glass height mm (heightWithoutCap, foot to rim)',
      baselinePct: 91, landmarkRule: sizing.landmarkRule },
    qaGate: 'IoU >= 0.995 and smoothed edge p99 <= 4 px vs the master PSD input silhouette, plus by-eye shadow/material check',
    background: 'Generated bone treatment retained; pixel-exact background not claimed',
    held: HELD, rows: evidence,
  }, null, 2) + '\n');
  for (const sheet of ['contact-grace.jpg', 'contact-royal-flair.jpg', 'contact-decorative.jpg', 'lineup-strip-wrapped.jpg']) {
    const from = path.join(laneDocs, sheet);
    const to = path.join(docs, sheet);
    if (fs.statSync(from).size > 2 * 1024 * 1024) {
      fs.writeFileSync(to, await sharp(from).jpeg({ quality: 82, mozjpeg: true }).toBuffer());
    } else {
      fs.copyFileSync(from, to);
    }
  }
  console.log(JSON.stringify({ images: heroes.length,
    nativeBytes: evidence.reduce((sum, row) => sum + row.sourceBytes, 0),
    shippedBytes: evidence.reduce((sum, row) => sum + row.bytes, 0) }));
}

main().catch(error => { console.error(error); process.exit(1); });

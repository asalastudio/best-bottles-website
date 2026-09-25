// Export the 21 next-batch Sunburst heroes Jordan approved on 2026-09-25 from
// the contact sheets: 14 round-1 QA passes, 2 round-2 QA passes (Eternal
// Flame Green, Pear), 4 round-2 renders approved on sight despite a 4-6 px
// edge-gate miss (Royal 13 cap and roll-on, Tola 3, Grace bulb spray tassel)
// and the round-3 aqua Genie Blue, also approved on sight.
//
// Usage: node scripts/hero-families/release-next-batch.cjs <lane-worktree>
//   <lane-worktree> is the generation lane checkout that holds
//   docs/hero-families/next-batch-2026-09-25/approval-candidates.json and
//   output/imagegen/next-batch-2026-09-25/{fitted,renders}/ (rounds 2 and 3 in round2/, round3/).
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

// Approved selection: the fitted file for each SKU, pinned by hash. Round-1
// rows come from candidates[], round-N rows from roundN.candidates[].
// productionColor is set only where Jordan chose a registry bottleColor that
// differs from production's colour field; production is left unchanged.
// bottleColor keeps production's catalog colour (it feeds the card spec line
// and the guided-finder colour facet); alt describes what is pictured.
const ON_SIGHT = 'Approved on sight by Jordan 2026-09-25 after six attempts: the 4-6 px edge-gate miss is '
  + 'about the gate\'s own measurement noise (a geometrically perfect copy measures up to 4.4-5.2 px max).';
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
  GBEternalFlameGreen: { round: 2, attempt: 'r2a1', fittedSha256: '42ae3dd4a50bd6341516ab502521a49eb704087ea93256c15ce73ed607532473', renderSha256: '4be658119be23cb887f366714b90bf6e3b7cbf2739aeafe096fdfa2acbd20ec0',
    bottleColor: 'Green', alt: '35 ml Green Eternal Flame Bottle with Ground Glass Stopper' },
  GBCB12ozPear: { round: 2, attempt: 'r2a1', fittedSha256: '8304a736a514b49a77bb69cab3e248953d6e36281b06b9101429c94ecf1cbcca', renderSha256: '443d787603c9d55a00ec83386a9e241467e8b8709fa2d02fc4cb2aad7fe82804',
    bottleColor: 'Cobalt Blue', productionColor: 'Clear', alt: '355 ml Cobalt Blue Pear Bottle with Glass Ball Stopper',
    colourNote: 'The pictured glass is cobalt blue and Jordan confirmed "Pear is cobalt", so bottleColor is Cobalt Blue. '
      + 'Production\'s colour field still says Clear (and the slug says clear); that data fix is left for later.' },
  GBRoyal13Gl: { round: 2, attempt: 'r2a3', fittedSha256: '035d552c9baf7135a3bd4a9886ccfc49cf4dec442bd14b75a6f391fc3ed5f823', renderSha256: 'e0093a1e789747eeca0ec83bcf9512f004794f240f323b9477150a4efd7c474f',
    onSight: true, bottleColor: 'Clear', alt: '13 ml Clear Royal Bottle with Shiny Gold Cap' },
  GBRoyal13MtlRollBlkDot: { round: 2, attempt: 'r2a1', fittedSha256: 'a3427b4fb46f99c4c9b2c933ba4c1c89b0100dc9afac599d1a67e66b851f0bb5', renderSha256: '644bfcb4ff88f9e9c8d7272ee8b82130d7340c534cc7089dada5d5cbb03b1862',
    onSight: true, bottleColor: 'Clear', alt: '13 ml Clear Royal Roll-On Bottle with Metal Roller Ball and Black Dotted Cap' },
  GB3TPlGl: { round: 2, attempt: 'r2a1', fittedSha256: '5dc2d3348d945b108d9565c99fd06c35096d0233a69b6e569488fbbd486084bf', renderSha256: 'c97edeafe6d6f39d7ad9ad6881682a3b751f41f28d86e11e46beb5e2b2d58964',
    onSight: true, bottleColor: 'Clear', alt: '3 ml Clear Tola Bottle with Shiny Gold Cap and Red Bead' },
  GBGrce55AnSpTslMtSl: { round: 2, attempt: 'r2a1', fittedSha256: 'fa088500026c3074c178238bf482f8dc2e8d4825bba54885343d304483341842', renderSha256: '357b8bb6cd0b115ea3db074e04dfb6d8ed959559cd95bb3e6d3167b08559d26f',
    onSight: true, bottleColor: 'Clear', alt: '55 ml Clear Grace Vintage Style Bulb Spray Bottle with Matte Silver Sprayer and Tassel' },
  GB1ozGenieBl: { round: 3, attempt: 'r3a1', fittedSha256: 'c1c8cb452bdf0cf19f48e3556d4366849518e86ee3a39a8c458b7ecfbc94a1dc', renderSha256: 'c733fe55c0cb15a52a59c7688a7449644fa5c5759f62426addab6d16938af5d8',
    onSight: true, onSightNote: 'Approved on sight by Jordan 2026-09-25: IoU 0.9941 is just under the 0.995 gate while the edge '
      + 'deviation passes (smoothed p99 2.60 / max 2.84 px), and the pale aqua glass of the master PSD is kept.',
    bottleColor: 'Aqua', productionColor: 'Cobalt Blue', alt: '32 ml Aqua Genie Bottle with Glass Stopper',
    colourNote: 'Jordan decided the glass is aqua (pale aqua / light turquoise, as in its master PSD) and must stay aqua, so '
      + 'bottleColor is Aqua. Production still names and filters it as Cobalt Blue; Jordan chose to leave that unchanged for now.' },
};
const EXPECTED = { Grace: 5, Royal: 3, Flair: 3, Decorative: 10 };
const HELD = {
  GBHeartFrst4KeyGld: 'held: round 2 laid the keychain flat but the model re-posed the heart (IoU 0.976); today\'s card image stays',
  GBHeartFrst4TslRed: 'held: round 2 laid the tassel flat but the model re-posed the heart (IoU 0.976); today\'s card image stays',
  LB1ozGl: 'not rendered: Lotion glass height unknown',
  LB1ozSl: 'not rendered: Lotion glass height unknown',
  LB3mlClear: 'not rendered: height unknown, plastic',
  LBMetalSilver1oz: 'not rendered: discontinued, hidden from the catalog',
  GBMtlCylGl: 'not rendered: Royal 14 ml height disagreement',
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
  const laneJson = JSON.parse(laneJsonBytes);
  const candidates = laneJson.candidates;
  const rounds = { 1: candidates, 2: laneJson.round2.candidates, 3: laneJson.round3.candidates };
  const sizing = JSON.parse(fs.readFileSync(path.join(laneDocs, 'sizing-proof/sizing-targets.json')));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/products/catalog-heroes.json')));
  const skus = Object.keys(APPROVED);
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });

  const heroes = [];
  const evidence = [];
  for (const sku of skus) {
    const approved = APPROVED[sku];
    const round = approved.round ?? 1;
    const round1 = candidates.find(c => c.websiteSku === sku);
    const record = rounds[round].find(c => c.websiteSku === sku);
    const status = approved.onSight ? 'approved-on-sight' : 'qa-pass';
    if (!record || (round < 3 && !round1) || record.status !== (approved.onSight ? 'held' : 'pass') || record.selectedAttempt !== approved.attempt
      || record.fitted.sha256 !== approved.fittedSha256 || record.render.sha256 !== approved.renderSha256
      || (round1 && (record.groupSlug !== round1.groupSlug || record.graceSku !== round1.graceSku))) {
      throw new Error(`Lane record no longer matches the approved selection: ${sku}`);
    }
    const identity = catalog.find(hero => hero.websiteSku === sku);
    const { group, variant } = await productionHolder(sku);
    if (!identity || group.slug !== (round1 ? round1.prodGroupSlug : record.groupSlug) || group.slug !== identity.groupSlug
      || variant.graceSku !== record.graceSku || variant.graceSku !== identity.graceSku
      || variant.shopifyVariantId !== identity.shopifyVariantId || group.family !== (round1 ? round1.family : identity.family)
      || group.capacityMl !== identity.capacityMl || group.color !== (approved.productionColor ?? approved.bottleColor)) {
      throw new Error(`Production identity mismatch: ${sku}`);
    }

    const sub = round > 1 ? `round${round}` : '';
    const fittedPath = path.join(laneOutput, 'fitted', sub, `${sku}-${approved.attempt}-fitted.png`);
    const renderPath = path.join(laneOutput, 'renders', sub, `${sku}-${approved.attempt}.png`);
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
    const target = path.join(root, 'public', url);
    // Already-released files must stay byte-identical across reruns.
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(webp)) throw new Error(`Released file changed: ${sku}`);
    fs.writeFileSync(target, webp);
    heroes.push({ groupSlug: group.slug, websiteSku: sku, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, family: group.family, capacityMl: group.capacityMl,
      bottleColor: approved.bottleColor, alt: approved.alt, presentation: 'Original product assembly',
      url, width: 1560, height: 1716, framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    const size = sizing.rows.find(row => row.sku === sku);
    const g = record.qa.geometry;
    const onSight = approved.onSight ? {
      attemptsTotal: Object.values(rounds).reduce((sum, list) => sum + (list.find(c => c.websiteSku === sku)?.attempts.length ?? 0), 0),
      measured: { iou: g.iou, edgeSmoothedP99: g.edgeSmoothed.p99, edgeSmoothedMax: g.edgeSmoothed.max,
        edgePerPointMax: g.edgePerPoint.max, gate: 'IoU >= 0.995 and smoothed edge p99 <= 4 px', operationalPass: g.operationalPass,
        ...(record.qa.colourCheck ? { fitErrPct: record.fit.maxErrPctOfCanvasHeight, glassColour: {
          inputMedianRGB: record.qa.colourCheck.input.medianRGB, outputMedianRGB: record.qa.colourCheck.output.medianRGB,
          inputHueDeg: record.qa.colourCheck.input.hueOfMedianDeg, outputHueDeg: record.qa.colourCheck.output.hueOfMedianDeg } } : {}) } } : null;
    evidence.push({ sku, family: group.family, groupSlug: group.slug, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId,
      // Round-1 evidence rows keep their original shape; round-2 rows say how they were approved.
      ...(round > 1 ? { round, status, approvalNote: onSight ? (approved.onSightNote ?? ON_SIGHT) : 'QA pass in round 2; approved from the round-2 contact sheet' } : {}),
      ...(onSight ? { approvedOnSight: onSight } : {}),
      ...(approved.colourNote ? { colourNote: approved.colourNote } : {}),
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
  for (const [family, count] of Object.entries(EXPECTED)) {
    if (heroes.filter(hero => hero.family === family).length !== count) throw new Error(`Unexpected ${family} count`);
  }
  fs.writeFileSync(registryPath, JSON.stringify(heroes, null, 2) + '\n');
  fs.writeFileSync(path.join(docs, 'approval.json'), JSON.stringify({
    date: '2026-09-25', approvedBy: 'Jordan, after reviewing the contact sheets',
    scope: EXPECTED, publication: false,
    source: { lane: 'next-batch-2026-09-25 round 1 (fitted/), round 2 (fitted/round2/) and round 3 (fitted/round3/)',
      approvalCandidatesSha256: hash(laneJsonBytes) },
    approvedOnSight: { skus: skus.filter(sku => APPROVED[sku].onSight),
      reasons: Object.fromEntries(skus.filter(sku => APPROVED[sku].onSight).map(sku => [sku, APPROVED[sku].onSightNote ?? ON_SIGHT])) },
    labelFollowUps: Object.fromEntries(skus.filter(sku => APPROVED[sku].productionColor).map(sku => [sku, {
      registryBottleColor: APPROVED[sku].bottleColor, productionColor: APPROVED[sku].productionColor, note: APPROVED[sku].colourNote }])),
    sizing: { curve: sizing.curve.bestFit.formula, measure: 'glass height mm (heightWithoutCap, foot to rim)',
      baselinePct: 91, landmarkRule: sizing.landmarkRule },
    qaGate: 'IoU >= 0.995 and smoothed edge p99 <= 4 px vs the master PSD input silhouette, plus by-eye shadow/material check',
    background: 'Generated bone treatment retained; pixel-exact background not claimed',
    held: HELD, rows: evidence,
  }, null, 2) + '\n');
  for (const sheet of ['contact-grace.jpg', 'contact-royal-flair.jpg', 'contact-decorative.jpg', 'lineup-strip-wrapped.jpg', 'contact-round2.jpg', 'contact-genie-blue.jpg']) {
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

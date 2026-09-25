// Export the 16 vial-family Sunburst heroes Jordan approved on 2026-09-25: the 13 batch-3 vials
// re-rendered proportional to his caliper heights (+20%), the 3 ml blue and green vials and the
// 3 ml lotion rendered from the legacy site photos (no master PSD). These rows replace the 13 vial
// rows of the batch-3 release, whose files are removed.
//
// Usage: node scripts/hero-families/release-vials.cjs <audit-lane-dir>
//   <audit-lane-dir> holds vials-approval-candidates.json and the b5/ and b4/ lanes.
//
// Read-only against the lane and production, pinned by hash like release-batch3.cjs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const lane = path.resolve(process.argv[2] || process.env.HERO_LANE_DIR || '');
const docs = path.join(root, 'docs/hero-families/vials-2026-09-25');
const publicDir = '/images/catalog/vials-approved-2026-09-25';
const registryPath = path.join(root, 'src/lib/products/catalog-hero-vials-release.json');
const productionQuery = 'https://precise-raccoon-123.convex.cloud/api/query';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// bottleColor keeps production's colour except where the pictured glass differs
// (productionColor records production's value; the data fix is left for later).
const APPROVED = {
  GBV1DrmWhtCapSht: { fittedSha256: '32779e36d81ff657f74605c71b10a1b00f94b32787a6657763345b5ef1f0d08a', renderSha256: 'c1dd7b6eee2830933e5298e1f40c398e315914baab8c0e24e814d2e01ff56ec4', alt: "4 ml Clear Vial with White Screw Cap" },
  GBVAmb1DrmWhtCapSht: { fittedSha256: 'f33ba6d458127e036432764efa1f36e424f19b28d7a55be492d899b5baeee901', renderSha256: 'c3265b13db134b112efa2841c693e7b20ac390c1176e4b80b1987ccd0a043d90', alt: "4 ml Amber Vial with White Screw Cap" },
  GBVBlu1DrmWhtCapSht: { fittedSha256: '0550b74c113bd3a2eb3aff27e280342ff005b7bcefe35a511ef6fb8820468659', renderSha256: '61e6f851e4ab36907f43fa083ec78bfc010bbf9930bfbe9176e6ede95d80f7e7', alt: "4 ml Blue Vial with White Screw Cap" },
  GBVGr1DrmWhtCapSht: { fittedSha256: '8c64487d78ff20c04b2e0fd9a9e8ac129d744b06b7c836767a1c9f49d6b5b2ed', renderSha256: 'e22a1abcd3ca30e6aa789b56beae2a0eceff9073e31e322b3769e7d039d20dbd', alt: "4 ml Green Vial with White Screw Cap" },
  GBV1DrmBlkDropper: { fittedSha256: 'f56618f5a552131865f86a06ec231441da57e4cb0c135557c5be7c4a4a220fdc', renderSha256: '9587a3c45318662e01637ee7251ceeee8fed8a0e70a2b37fa42b107d103aea1a', alt: "4 ml Clear Vial with Black Dropper" },
  GBVAmb1DrmBlkDrpr: { fittedSha256: 'c5ecaa88d031b56e3bacf8e506d3267ff55b688e06f18f1e0a3a23306facbb57', renderSha256: '3a5be3119e5a4198f0d77560b70eb3da4558747a3c5a3297c38c8647f8e2053a', alt: "4 ml Amber Vial with Black Dropper" },
  GBVBlu1DrmBlkDropper: { fittedSha256: '0b972e067e5d88cc14350c92f2b1386addf5a53e3d7b52cb0e02049e65a6897c', renderSha256: '326fcecf31932f2a38c7831d6d96f782275bf4af578275ebbc600d0b6154d032', alt: "4 ml Blue Vial with Black Dropper" },
  GBVGr1DrmBlkDropper: { fittedSha256: 'd4bbcd99aeb619ae05ce8e9fa57c124741c819aa74bedf1add58ed75c00f7e93', renderSha256: '99b82e66601d554f21aded06bcc0522ef0972039e58af13daffe4bf8824cf33d', alt: "4 ml Green Vial with Black Dropper" },
  GBVialClr2mlWhtCap: { fittedSha256: '0fc3205e0cbce6ea16c68390aae201b788ae7391690b0c6f14f1cff6574e4860', renderSha256: 'b8a7cb41fcfdc91de2ab02eca835284a060683992baaf4c0a455da435f30eece', alt: "2 ml Clear Vial with White Screw Cap" },
  GBVAmb2WhtCap: { fittedSha256: 'ef2e2ce96eee1aaabffa43e80658923104bb2c8ffc2b86d7266a41e8045de54d', renderSha256: '422437f5a6b59756df760fb644341638e534ec386984cc32eee7c04c8eb1d532', alt: "2 ml Amber Vial with White Screw Cap" },
  GB1mlAmbVialWht: { fittedSha256: 'f6564f9937fa59a1f349cc9a09ca37003c742a013bf8ce64d9c5bdf09b59d3b4', renderSha256: '320eff4a93fd3771fe83a6dfade2022d4f7ea6f40ff81032d54de87748680ad3', alt: "1 ml Amber Sample Vial with White Plug Applicator" },
  GB1mlVBlk: { fittedSha256: '9573cbcddb92dad94b1b936abe6a526da6059979dacb027a791beb562e608613', renderSha256: '5af2afb6d29158ce3748275b107279fe60cf6b1bfc72523409623dd1824cf979', alt: "1 ml Clear Sample Vial with Black Plug Applicator" },
  GBVialAmb1o5WhtCapSht: { fittedSha256: '01f5959192b98714b2a6a3038774fbd84010fcb2ada3ecde383706a187e5e32f', renderSha256: 'a539819414f9da0ee10ff6c07955bcad4698b48cccdcb39629f7c60742fb3684', alt: "2 ml Amber Vial with White Screw Cap" },
  GBVBlu1o9BlackCapSht: { fittedSha256: '947b086c58c1970336897325edf0c01a4dcb9c47754163e7f187649ba294db7c', renderSha256: 'f33af31dfaa452304caeb1347ede798b548d261c57abfd03f8088e12b3c05d9e', alt: "3 ml Blue Vial with Black Screw Cap" },
  GBVGreen2o4BlackCapSht: { fittedSha256: 'c73777645f3e190402052b961b7371abdf6091d87ad4decda32e72a19149e02b', renderSha256: 'a26b2728deb0d9aaaf42be41fcf6f3a013cb1889e3670d280722fad576dcf544', alt: "3 ml Green Vial with Black Screw Cap" },
  LB3mlClear: { fittedSha256: '6bf1c6ad544ccebc430a897a411c7a49f8f0d5ba81b65c2f9a2e5db266e406a1', renderSha256: '249bd27f48e61325a1616f2dfeec2db42555236b372e3ce170d5e9b606c17871', alt: "3 ml Clear Plastic Sample Vial with Fine Mist Sprayer and Cap" },
};
const EXPECTED = { Vial: 15, 'Lotion Bottle': 1 };
const HELD = {};

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
  const laneJsonPath = path.join(lane, 'vials-approval-candidates.json');
  if (!fs.existsSync(laneJsonPath)) throw new Error('Pass the lane directory: node scripts/hero-families/release-vials.cjs <lane-dir>');
  const laneJsonBytes = fs.readFileSync(laneJsonPath);
  const candidates = JSON.parse(laneJsonBytes).candidates;
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });

  const heroes = [];
  const evidence = [];
  for (const [sku, approved] of Object.entries(APPROVED)) {
    const record = candidates.find(c => c.websiteSku === sku);
    if (!record || record.selectedAttempt !== 'a1' || record.fitted.sha256 !== approved.fittedSha256
      || record.render.sha256 !== approved.renderSha256 || record.render.model !== 'gpt-image-2.5-sunburst') {
      throw new Error(`Lane record no longer matches the approved selection: ${sku}`);
    }
    const source = fs.readFileSync(path.join(lane, record.fitted.file));
    const render = fs.readFileSync(path.join(lane, record.render.file));
    if (hash(source) !== approved.fittedSha256 || hash(render) !== approved.renderSha256) throw new Error(`Changed source: ${sku}`);
    const meta = await sharp(source).metadata();
    if (meta.width !== 2080 || meta.height !== 2288) throw new Error(`Unexpected dimensions: ${sku}`);

    const { group, variant } = await productionHolder(sku);
    const bottleColor = group.color;

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
      bottleColor, alt: approved.alt,
      presentation: /Clr2ml|1mlAmb/.test(sku) ? 'Original product assembly' : 'Empty · cap beside',
      url, width: 1560, height: 1716, framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    evidence.push({ sku, family: group.family, groupSlug: group.slug, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, status: 'approved',
      production: { deployment: 'precise-raccoon-123', groupId: group._id, slug: group.slug, displayName: group.displayName,
        color: group.color, capColor: variant.capColor ?? null, applicator: variant.applicator ?? null,
        verifiedBy: 'products:searchCatalog exact websiteSku' },
      url, sha256, bytes: webp.length,
      selectedAttempt: record.selectedAttempt, sourceFittedSha256: approved.fittedSha256, sourceBytes: source.length,
      sourceRenderSha256: approved.renderSha256, model: record.render.model, nativeSize: record.render.nativeSize,
      exportSize: [1560, 1716], resize: 'uniform 0.75 Lanczos3', encoding: 'lossless WebP', decodedPixelsVerified: true,
      attemptsForSku: record.attemptsForSku, sizing: record.sizing, fit: record.fit, qaRaw: record.qaRaw,
      input: record.input, source: record.source, lane: record.lane, promptSha256: record.render.promptSha256 });
  }
  for (const [family, count] of Object.entries(EXPECTED)) {
    if (heroes.filter(hero => hero.family === family).length !== count) throw new Error(`Unexpected ${family} count`);
  }
  fs.writeFileSync(registryPath, JSON.stringify(heroes, null, 2) + '\n');
  fs.writeFileSync(path.join(docs, 'approval.json'), JSON.stringify({
    date: '2026-09-25', approvedBy: 'Jordan ("approve all") after the review sheets', scope: EXPECTED, publication: false,
    source: { lane: 'batch3-2026-09-25', approvalCandidatesSha256: hash(laneJsonBytes) },
    labelFollowUps: {},
    sizing: { rule: 'Vial family proportional to caliper glass height: 4 ml (45 mm) anchor at its approved 43.1% of the card, lifted 20% (Jordan 2026-09-25) = 26.3 px/mm; caps beside where the source shows them',
      caliper: { '4 ml 13-425': '45 mm glass / 47.47 with cap', '2 ml clear 8-425': '35 / 37.73', '1 ml tubes': '35 / 44', '2 ml amber 13-425': '22 / 24', '3 ml 5/8 dram': '27 / 29', '3 ml lotion': 'no height; 65 mm with cap by Jordan\'s call' },
      sources: 'master PSDs for the 13 batch-3 vials; legacy bestbottles.com photos for the 3 ml blue and green vials and the 3 ml lotion (no master PSD)' },
    qa: 'Framing re-registered to the lock; every image reviewed by eye and approved by Jordan',
    held: HELD, rows: evidence,
  }, null, 2) + '\n');
  for (const sheet of ['b5/review-vials.jpg', 'b5/vial-lift-proof.jpg', 'b4/review-legacy3.jpg']) {
    fs.copyFileSync(path.join(lane, sheet), path.join(docs, path.basename(sheet)));
  }
  console.log(JSON.stringify({ images: heroes.length, shippedBytes: evidence.reduce((sum, row) => sum + row.bytes, 0) }));
}

main().catch(error => { console.error(error); process.exit(1); });
